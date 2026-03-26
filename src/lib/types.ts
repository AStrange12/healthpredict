
export interface VitalReading {
  id: string;
  timestamp: string;
  hr: number;
  bpSystolic: number;
  bpDiastolic: number;
  spo2: number;
  rr: number;
  temp: number;
}

export interface PredictionResult {
  id: string;
  timestamp: string;
  icuTransferRisk: number;
  cardiacArrestRisk: number;
  mortalityRisk: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  explanation: string;
  featureImportance: Record<string, number>;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  admissionDate: string;
  clinicalNotes: string;
  vitals: VitalReading[];
  predictions: PredictionResult[];
}
