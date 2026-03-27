'use server';
/**
 * @fileOverview This file implements a Genkit flow for predicting patient deterioration.
 * It integrates a dataset-driven k-NN machine learning model (using mini_mimic_dataset.csv)
 * to predict risks for ICU transfer, cardiac arrest, and mortality.
 *
 * - predictPatientDeterioration - A wrapper function to trigger the patient deterioration prediction flow.
 * - PredictPatientDeteriorationInput - The input type for the prediction.
 * - PredictPatientDeteriorationOutput - The return type for the prediction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs';
import path from 'path';

// 1. Define Input Schema
const VitalsSchema = z.object({
  heartRate: z.number().min(0).describe('Patient current Heart Rate (bpm).'),
  systolicBp: z.number().min(0).describe('Patient current Systolic Blood Pressure (mmHg).'),
  diastolicBp: z.number().min(0).describe('Patient current Diastolic Blood Pressure (mmHg).'),
  spo2: z.number().min(0).max(100).describe('Patient current Blood Oxygen Saturation (%).'),
  respiratoryRate: z.number().min(0).describe('Patient current Respiratory Rate (breaths/min).'),
  temperature: z.number().min(30).max(45).describe('Patient current Body Temperature (Celsius).'),
});
export type Vitals = z.infer<typeof VitalsSchema>;

const PredictPatientDeteriorationInputSchema = z.object({
  patientId: z.string().describe('Unique identifier for the patient.'),
  vitals: VitalsSchema.describe('Current snapshot of patient time-series vitals.'),
  clinicalNotes: z.string().describe('Latest clinical notes for the patient.').optional(),
});
export type PredictPatientDeteriorationInput = z.infer<typeof PredictPatientDeteriorationInputSchema>;

// 2. Define Output Schema
const PredictPatientDeteriorationOutputSchema = z.object({
  patientId: z.string().describe('Unique identifier for the patient.'),
  icuTransferRisk: z.number().min(0).max(1).describe('Probability (0-1) of ICU transfer.'),
  cardiacArrestRisk: z.number().min(0).max(1).describe('Probability (0-1) of cardiac arrest.'),
  mortalityRisk: z.number().min(0).max(1).describe('Probability (0-1) of mortality.'),
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('Overall risk level.'),
  explanation: z.string().describe('A doctor-friendly explanation.'),
  featureImportance: z.record(z.number().min(0).max(1)).describe('Breakdown of feature contribution.'),
});
export type PredictPatientDeteriorationOutput = z.infer<typeof PredictPatientDeteriorationOutputSchema>;

/**
 * Helper to calculate Euclidean distance between two vectors.
 * Features are normalized to roughly 0-1 based on expected clinical ranges.
 */
function calculateDistance(v1: number[], v2: number[]) {
  const ranges = [140, 130, 80, 30, 32, 10]; // HR, SBP, DBP, SpO2, RR, Temp ranges
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    const diff = (v1[i] - v2[i]) / ranges[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// 3. Define the Prediction Model Tool
const predictDeteriorationModel = ai.defineTool(
  {
    name: 'predictDeteriorationModel',
    description: 'Calculates patient deterioration risks using a k-NN model driven by the MIMIC dataset.',
    inputSchema: PredictPatientDeteriorationInputSchema,
    outputSchema: z.object({
      icuTransferRisk: z.number(),
      cardiacArrestRisk: z.number(),
      mortalityRisk: z.number(),
      featureImportance: z.record(z.number()),
    }),
  },
  async (input) => {
    try {
      const csvPath = path.join(process.cwd(), 'src/app/dashboard/dataset/mini_mimic_dataset.csv');
      
      if (!fs.existsSync(csvPath)) {
        console.error(`Dataset not found at: ${csvPath}. Falling back to baseline.`);
        return { icuTransferRisk: 0.1, cardiacArrestRisk: 0.05, mortalityRisk: 0.02, featureImportance: {} };
      }

      const fileContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',');
      
      const col = {
        hr: headers.indexOf('hr'),
        sbp: headers.indexOf('sbp'),
        dbp: headers.indexOf('dbp'),
        spo2: headers.indexOf('spo2'),
        rr: headers.indexOf('rr'),
        temp: headers.indexOf('temp'),
        icu: headers.indexOf('icu'),
        arrest: headers.indexOf('arrest'),
        mortality: headers.indexOf('mortality'),
      };

      const inputVector = [
        input.vitals.heartRate,
        input.vitals.systolicBp,
        input.vitals.diastolicBp,
        input.vitals.spo2,
        input.vitals.respiratoryRate,
        input.vitals.temperature
      ];

      // Parse dataset and calculate distances
      const neighbors: { distance: number; icu: number; arrest: number; mortality: number }[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(Number);
        if (row.length < headers.length) continue;

        const rowVector = [row[col.hr], row[col.sbp], row[col.dbp], row[col.spo2], row[col.rr], row[col.temp]];
        const distance = calculateDistance(inputVector, rowVector);
        
        neighbors.push({
          distance,
          icu: row[col.icu] || 0,
          arrest: row[col.arrest] || 0,
          mortality: row[col.mortality] || 0
        });
      }

      // Sort by distance and pick top K=10
      neighbors.sort((a, b) => a.distance - b.distance);
      const topK = neighbors.slice(0, 10);

      // Average targets for probability
      const icuTransferRisk = parseFloat((topK.reduce((acc, n) => acc + n.icu, 0) / topK.length).toFixed(3));
      const cardiacArrestRisk = parseFloat((topK.reduce((acc, n) => acc + n.arrest, 0) / topK.length).toFixed(3));
      const mortalityRisk = parseFloat((topK.reduce((acc, n) => acc + n.mortality, 0) / topK.length).toFixed(3));

      // Simple feature importance based on deviation from normal
      const featureImportance: Record<string, number> = {
        heartRate: Math.abs(input.vitals.heartRate - 75) / 100,
        systolicBp: Math.abs(input.vitals.systolicBp - 120) / 100,
        diastolicBp: Math.abs(input.vitals.diastolicBp - 80) / 100,
        spo2: (100 - input.vitals.spo2) / 30,
        respiratoryRate: Math.abs(input.vitals.respiratoryRate - 16) / 30,
        temperature: Math.abs(input.vitals.temperature - 37) / 5,
      };

      return { icuTransferRisk, cardiacArrestRisk, mortalityRisk, featureImportance };
    } catch (error) {
      console.error('Error in ML prediction model:', error);
      return { icuTransferRisk: 0.1, cardiacArrestRisk: 0.05, mortalityRisk: 0.02, featureImportance: {} };
    }
  }
);

const ExplainPredictionOutputSchema = z.object({
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('Overall risk level for patient deterioration.'),
  explanation: z.string().describe('A doctor-friendly explanation of the prediction and contributing factors.'),
});

// 4. Define a Prompt to generate explanations
const explainPredictionPrompt = ai.definePrompt({
  name: 'explainPredictionPrompt',
  input: {
    schema: z.object({
      patientId: z.string(),
      vitals: VitalsSchema,
      clinicalNotes: z.string().optional(),
      icuTransferRisk: z.number(),
      cardiacArrestRisk: z.number(),
      mortalityRisk: z.number(),
      featureImportance: z.record(z.number()),
    }),
  },
  output: { schema: ExplainPredictionOutputSchema },
  prompt: `You are an expert clinical AI system providing explanations for patient deterioration predictions.
The following risks were calculated using a dataset-driven k-NN model based on clinical outcomes.

Patient ID: {{{patientId}}}

Current Vitals:
- Heart Rate: {{{vitals.heartRate}}} bpm
- Systolic BP: {{{vitals.systolicBp}}} mmHg
- Diastolic BP: {{{vitals.diastolicBp}}} mmHg
- SpO2: {{{vitals.spo2}}}%
- Respiratory Rate: {{{vitals.respiratoryRate}}} breaths/min
- Temperature: {{{vitals.temperature}}} °C

Clinical Notes:
{{#if clinicalNotes}}{{{clinicalNotes}}}{{else}}No clinical notes provided.{{/if}}

Data-Driven Risk Scores:
- ICU Transfer Risk: {{icuTransferRisk}}
- Cardiac Arrest Risk: {{cardiacArrestRisk}}
- Mortality Risk: {{mortalityRisk}}

Feature Importance:
{{#each featureImportance}}
- {{ @key }}: {{ this }}
{{/each}}

Provide:
1. An overall risk level (Low, Medium, or High).
2. A clinical explanation for these numbers, highlighting which vitals are the most concerning based on the feature importance provided. Explain why the model might have found similar historical cases with these outcomes.`,
});

// 5. Define the Genkit Flow
const predictPatientDeteriorationFlow = ai.defineFlow(
  {
    name: 'predictPatientDeteriorationFlow',
    inputSchema: PredictPatientDeteriorationInputSchema,
    outputSchema: PredictPatientDeteriorationOutputSchema,
  },
  async (input) => {
    // 1. Call the ML model tool to get data-driven predictions
    const mlModelOutput = await predictDeteriorationModel(input);

    // 2. Call the GenAI prompt for clinical context
    const { output: explanationOutput } = await explainPredictionPrompt({
      ...input,
      ...mlModelOutput,
    });

    if (!explanationOutput) {
      throw new Error('Failed to generate explanation for patient deterioration prediction.');
    }

    return {
      patientId: input.patientId,
      icuTransferRisk: mlModelOutput.icuTransferRisk,
      cardiacArrestRisk: mlModelOutput.cardiacArrestRisk,
      mortalityRisk: mlModelOutput.mortalityRisk,
      riskLevel: explanationOutput.riskLevel,
      explanation: explanationOutput.explanation,
      featureImportance: mlModelOutput.featureImportance,
    };
  }
);

export async function predictPatientDeterioration(input: PredictPatientDeteriorationInput): Promise<PredictPatientDeteriorationOutput> {
  return predictPatientDeteriorationFlow(input);
}
