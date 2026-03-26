'use server';
/**
 * @fileOverview This file implements a Genkit flow for predicting patient deterioration.
 * It integrates simulated time-series vitals and clinical notes to predict risks
 * for ICU transfer, cardiac arrest, and mortality, providing an explanation based on these predictions.
 *
 * - predictPatientDeterioration - A wrapper function to trigger the patient deterioration prediction flow.
 * - PredictPatientDeteriorationInput - The input type for the prediction.
 * - PredictPatientDeteriorationOutput - The return type for the prediction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  icuTransferRisk: z.number().min(0).max(1).describe('Probability (0-1) of ICU transfer within the next 24-48 hours.'),
  cardiacArrestRisk: z.number().min(0).max(1).describe('Probability (0-1) of cardiac arrest within the next 24-48 hours.'),
  mortalityRisk: z.number().min(0).max(1).describe('Probability (0-1) of mortality within the next 24-48 hours.'),
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('Overall risk level for patient deterioration.'),
  explanation: z.string().describe('A doctor-friendly explanation of the prediction and contributing factors.'),
  featureImportance: z.record(z.number().min(0).max(1)).describe('A breakdown of how much each vital contributed to the risk prediction (0-1 scale).'),
});
export type PredictPatientDeteriorationOutput = z.infer<typeof PredictPatientDeteriorationOutputSchema>;

// 3. Define a Tool to simulate the ML Model
// In a real application, this would call an external FastAPI/PyTorch model.
const predictDeteriorationModel = ai.defineTool(
  {
    name: 'predictDeteriorationModel',
    description: 'Simulates the prediction of patient deterioration risks based on vitals and clinical notes.',
    inputSchema: PredictPatientDeteriorationInputSchema,
    outputSchema: z.object({
      icuTransferRisk: z.number().min(0).max(1),
      cardiacArrestRisk: z.number().min(0).max(1),
      mortalityRisk: z.number().min(0).max(1),
      featureImportance: z.record(z.number().min(0).max(1)), // Simulate feature importance from ML model
    }),
  },
  async (input) => {
    // --- MOCK ML MODEL LOGIC --- This is a placeholder for the actual ML model inference.
    // In a real system, this would make an API call to the FastAPI backend.
    const { vitals, clinicalNotes } = input;

    let icuTransferRisk = 0.1;
    let cardiacArrestRisk = 0.05;
    let mortalityRisk = 0.02;

    const featureImportance: { [key: string]: number } = {
      heartRate: 0.1,
      systolicBp: 0.1,
      diastolicBp: 0.05,
      spo2: 0.1,
      respiratoryRate: 0.1,
      temperature: 0.05,
      clinicalNotes: clinicalNotes ? 0.2 : 0,
    };

    // Simple heuristic-based risk adjustment for demonstration
    if (vitals.heartRate > 100 || vitals.heartRate < 50) {
      icuTransferRisk += 0.2;
      cardiacArrestRisk += 0.1;
      featureImportance.heartRate = Math.min(1, featureImportance.heartRate + 0.2);
    }
    if (vitals.systolicBp < 90 || vitals.systolicBp > 180) {
      icuTransferRisk += 0.3;
      cardiacArrestRisk += 0.2;
      mortalityRisk += 0.1;
      featureImportance.systolicBp = Math.min(1, featureImportance.systolicBp + 0.3);
    }
    if (vitals.spo2 < 92) {
      icuTransferRisk += 0.4;
      cardiacArrestRisk += 0.3;
      mortalityRisk += 0.2;
      featureImportance.spo2 = Math.min(1, featureImportance.spo2 + 0.4);
    }
    if (vitals.respiratoryRate > 25 || vitals.respiratoryRate < 10) {
      icuTransferRisk += 0.2;
      featureImportance.respiratoryRate = Math.min(1, featureImportance.respiratoryRate + 0.2);
    }
    if (vitals.temperature > 38.5 || vitals.temperature < 36) {
      icuTransferRisk += 0.1;
      featureImportance.temperature = Math.min(1, featureImportance.temperature + 0.1);
    }

    if (clinicalNotes && clinicalNotes.toLowerCase().includes('sepsis')) {
      icuTransferRisk += 0.3;
      mortalityRisk += 0.2;
      featureImportance.clinicalNotes = Math.min(1, featureImportance.clinicalNotes + 0.3);
    }
    if (clinicalNotes && clinicalNotes.toLowerCase().includes('chest pain')) {
      cardiacArrestRisk += 0.2;
      featureImportance.clinicalNotes = Math.min(1, featureImportance.clinicalNotes + 0.2);
    }

    // Ensure risks are within 0-1 range
    icuTransferRisk = parseFloat(Math.min(1, Math.max(0, icuTransferRisk)).toFixed(2));
    cardiacArrestRisk = parseFloat(Math.min(1, Math.max(0, cardiacArrestRisk)).toFixed(2));
    mortalityRisk = parseFloat(Math.min(1, Math.max(0, mortalityRisk)).toFixed(2));

    return {
      icuTransferRisk,
      cardiacArrestRisk,
      mortalityRisk,
      featureImportance,
    };
    // --- END MOCK ML MODEL LOGIC ---
  }
);

const ExplainPredictionOutputSchema = z.object({
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('Overall risk level for patient deterioration.'),
  explanation: z.string().describe('A doctor-friendly explanation of the prediction and contributing factors.'),
});

// 4. Define a Prompt to generate explanations and overall risk level
const explainPredictionPrompt = ai.definePrompt({
  name: 'explainPredictionPrompt',
  input: {
    schema: z.object({
      patientId: z.string(),
      vitals: VitalsSchema,
      clinicalNotes: z.string().optional(),
      icuTransferRisk: z.number().min(0).max(1),
      cardiacArrestRisk: z.number().min(0).max(1),
      mortalityRisk: z.number().min(0).max(1),
      // Feature importance is passed to the prompt so it can be incorporated into the explanation
      featureImportance: z.record(z.number().min(0).max(1)),
    }),
  },
  output: { schema: ExplainPredictionOutputSchema },
  prompt: `You are an expert clinical AI system providing explanations for patient deterioration predictions.
Given the following patient data and predicted risks, generate a clear, doctor-friendly explanation and an overall risk level.

Patient ID: {{{patientId}}}

Current Vitals:
- Heart Rate: {{{vitals.heartRate}}} bpm
- Systolic BP: {{{vitals.systolicBp}}} mmHg
- Diastolic BP: {{{vitals.diastolicBp}}} mmHg
- SpO2: {{{vitals.spo2}}}%
- Respiratory Rate: {{{vitals.respiratoryRate}}} breaths/min
- Temperature: {{{vitals.temperature}}} °C

Clinical Notes:
{{#if clinicalNotes}}
{{{clinicalNotes}}}
{{else}}
No clinical notes provided.
{{/if}}

Predicted Risks:
- ICU Transfer Risk: {{icuTransferRisk}} (0-1)
- Cardiac Arrest Risk: {{cardiacArrestRisk}} (0-1)
- Mortality Risk: {{mortalityRisk}} (0-1)

Feature Importance (higher value indicates more contribution to the prediction):
{{#each featureImportance}}
- {{ @key }}: {{ this }}
{{/each}}

Based on this information, provide:
1.  An overall risk level (Low, Medium, or High).
2.  A concise, doctor-friendly explanation highlighting the most significant contributing factors from the vitals and clinical notes. Focus on explaining *why* the risks are at their predicted levels. Integrate the feature importance into the explanation by describing which vitals or notes were most impactful, without just listing the numbers.

Constraint: Ensure the explanation is clear, concise, and clinically relevant. Do not repeat the numerical values in the explanation itself, but refer to them qualitatively (e.g., "elevated", "low", "significant"). Make sure the overall risk level is consistent with the highest individual risk and the explanation.
`,
});

// 5. Define the Genkit Flow
const predictPatientDeteriorationFlow = ai.defineFlow(
  {
    name: 'predictPatientDeteriorationFlow',
    inputSchema: PredictPatientDeteriorationInputSchema,
    outputSchema: PredictPatientDeteriorationOutputSchema,
  },
  async (input) => {
    // 1. Call the simulated ML model tool to get numerical predictions and raw feature importance
    const mlModelOutput = await predictDeteriorationModel(input);

    // 2. Call the GenAI prompt to generate explanations and overall risk level based on ML predictions
    const { output: explanationOutput } = await explainPredictionPrompt({
      ...input,
      ...mlModelOutput, // Pass prediction results and feature importance from the tool to the prompt
    });

    if (!explanationOutput) {
      throw new Error('Failed to generate explanation or risk level for patient deterioration prediction.');
    }

    // 3. Combine all results into the final output schema
    return {
      patientId: input.patientId,
      icuTransferRisk: mlModelOutput.icuTransferRisk,
      cardiacArrestRisk: mlModelOutput.cardiacArrestRisk,
      mortalityRisk: mlModelOutput.mortalityRisk,
      riskLevel: explanationOutput.riskLevel, // Use the LLM generated risk level
      explanation: explanationOutput.explanation,
      featureImportance: mlModelOutput.featureImportance, // Direct from ML model tool
    };
  }
);

// 6. Exported wrapper function
export async function predictPatientDeterioration(input: PredictPatientDeteriorationInput): Promise<PredictPatientDeteriorationOutput> {
  return predictPatientDeteriorationFlow(input);
}
