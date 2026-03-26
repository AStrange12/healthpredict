
import { Patient, VitalReading, PredictionResult } from './types';

// Simple global store for demo purposes, in a real app this would be Firestore/PostgreSQL
let patients: Patient[] = [];

export const getPatients = async (): Promise<Patient[]> => {
  return [...patients];
};

export const getPatientById = async (id: string): Promise<Patient | undefined> => {
  return patients.find(p => p.id === id);
};

export const getPatientByName = async (name: string): Promise<Patient | undefined> => {
  return patients.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
};

export const addPatient = async (patient: Omit<Patient, 'predictions' | 'vitals'>): Promise<Patient> => {
  const newPatient: Patient = {
    ...patient,
    vitals: [],
    predictions: []
  };
  patients.push(newPatient);
  return newPatient;
};

export const addVitalsToPatient = async (patientId: string, vitals: Omit<VitalReading, 'id'>): Promise<void> => {
  const patient = patients.find(p => p.id === patientId);
  if (patient) {
    patient.vitals.push({
      ...vitals,
      id: Math.random().toString(36).substr(2, 9)
    });
  }
};

export const updateClinicalNotes = async (patientId: string, notes: string): Promise<void> => {
  const patient = patients.find(p => p.id === patientId);
  if (patient) {
    patient.clinicalNotes = notes;
  }
};

export const addPredictionToPatient = async (patientId: string, prediction: PredictionResult): Promise<void> => {
  const patient = patients.find(p => p.id === patientId);
  if (patient) {
    patient.predictions.unshift(prediction);
  }
};
