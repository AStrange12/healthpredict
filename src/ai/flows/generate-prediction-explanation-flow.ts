'use server';
/**
 * @fileOverview A Genkit flow for generating doctor-friendly explanations of patient deterioration predictions.
 *
 * - generatePredictionExplanation - A function that handles the generation of the explanation.
 * - PredictionExplanationInput - The input type for the generatePredictionExplanation function.
 * - PredictionExplanationOutput - The return type for the generatePredictionExplanation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const VitalReadingSchema = z.object({
  timestamp: z.string().describe('Timestamp of the vital reading in ISO format.'),
  hr: z.number().optional().describe('Heart Rate (beats per minute).'),
  bpSystolic: z.number().optional().describe('Systolic Blood Pressure (mmHg).'),
  bpDiastolic: z.number().optional().describe('Diastolic Blood Pressure (mmHg).'),
  spo2: z.number().optional().describe('Oxygen Saturation (%).'),
  rr: z.number().optional().describe('Respiratory Rate (breaths per minute).'),
  temp: z.number().optional().describe('Temperature (Celsius).'),
});

const PredictionExplanationInputSchema = z.object({
  patientId: z.string().describe('The unique identifier for the patient.'),
  vitals: z.array(VitalReadingSchema).describe('An array of time-series vital readings for the patient.'),
  clinicalNotes: z.string().describe('Recent clinical notes for the patient.'),
  icuTransferRisk: z.number().min(0).max(1).describe('Predicted risk score for ICU Transfer (0-1).'),
  cardiacArrestRisk: z.number().min(0).max(1).describe('Predicted risk score for Cardiac Arrest (0-1).'),
  mortalityRisk: z.number().min(0).max(1).describe('Predicted risk score for Mortality (0-1).'),
  icuTransferLevel: z.enum(['Low', 'Medium', 'High']).describe('Predicted risk level for ICU Transfer.'),
  cardiacArrestLevel: z.enum(['Low', 'Medium', 'High']).describe('Predicted risk level for Cardiac Arrest.'),
  mortalityLevel: z.enum(['Low', 'Medium', 'High']).describe('Predicted risk level for Mortality.'),
});
export type PredictionExplanationInput = z.infer<typeof PredictionExplanationInputSchema>;

const PredictionExplanationOutputSchema = z.object({
  textExplanation: z.string().describe('A doctor-friendly explanation of the prediction, including contributing factors and feature importance.'),
});
export type PredictionExplanationOutput = z.infer<typeof PredictionExplanationOutputSchema>;

export async function generatePredictionExplanation(input: PredictionExplanationInput): Promise<PredictionExplanationOutput> {
  return generatePredictionExplanationFlow(input);
}

const explanationPrompt = ai.definePrompt({
  name: 'generatePredictionExplanationPrompt',
  input: { schema: PredictionExplanationInputSchema },
  output: { schema: PredictionExplanationOutputSchema },
  prompt: `You are an AI medical assistant designed to provide doctor-friendly explanations for patient deterioration predictions.
Your goal is to help medical professionals understand the rationale behind the AI's assessment by detailing contributing factors and feature importance.
The explanation should be clear, concise, and actionable.

Here is the patient's data and prediction results:

Patient ID: {{{patientId}}}

---
**Recent Vitals (Time-Series Data):**
{{#if vitals}}
{{#each vitals}}
- Timestamp: {{{timestamp}}}, HR: {{{hr}}} bpm, BP: {{{bpSystolic}}}/{{{bpDiastolic}}} mmHg, SpO2: {{{spo2}}}%, RR: {{{rr}}} rpm, Temp: {{{temp}}}°C
{{/each}}
{{else}}
No vital readings available.
{{/if}}

---
**Recent Clinical Notes:**
{{{clinicalNotes}}}

---
**Prediction Results:**
- ICU Transfer Risk: {{{icuTransferRisk}}} (Level: {{{icuTransferLevel}}})
- Cardiac Arrest Risk: {{{cardiacArrestRisk}}} (Level: {{{cardiacArrestLevel}}})
- Mortality Risk: {{{mortalityRisk}}} (Level: {{{mortalityLevel}}})

---
**Task:**
Generate a doctor-friendly explanation based on the provided data and prediction results.
Focus on:
1.  Summarizing the key predictions.
2.  Identifying which vital signs or aspects of the clinical notes are likely contributing most to these predictions (e.g., "The elevated heart rate and decreasing SpO2 are significant factors contributing to the high Cardiac Arrest risk").
3.  Explaining the interplay between the multimodal data (vitals and notes).
4.  Highlighting any concerning trends or observations.

The explanation should be in a narrative, easy-to-read format suitable for a medical professional. Do not just list features; explain their clinical significance in relation to the predictions.
`,
});

const generatePredictionExplanationFlow = ai.defineFlow(
  {
    name: 'generatePredictionExplanationFlow',
    inputSchema: PredictionExplanationInputSchema,
    outputSchema: PredictionExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await explanationPrompt(input);
    return output!;
  }
);
