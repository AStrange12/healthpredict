# HealthPredict AI - Multimodal Clinical Deterioration Prediction System

An AI-powered clinical decision support system (CDSS) designed to predict patient deterioration (ICU transfer, cardiac arrest, and mortality) using **multimodal data** (numerical vitals + unstructured clinical notes).

## 🚀 Project Architecture

### 1. Technical Stack
*   **Framework**: Next.js 15 (App Router)
*   **Language**: TypeScript
*   **UI/UX**: React 19, Tailwind CSS, ShadCN UI, Lucide Icons
*   **Visualization**: Recharts (Time-series trend analysis)
*   **Backend & Database**: Firebase (Auth, Firestore, Hosting)
*   **AI/ML Framework**: Firebase Genkit
*   **Models**: 
    *   **LLM**: Gemini 2.5 Flash (Clinical reasoning & narrative generation)
    *   **ML**: Custom Weighted k-Nearest Neighbors (k-NN) for dataset-driven inference

### 2. Multimodal AI: "Late Fusion" Strategy
This system is classified as **Multimodal AI** because it integrates two distinct data modalities:
1.  **Structured Numerical Modality**: Physiological signals (Heart Rate, BP, SpO2, Respiratory Rate, Temperature).
2.  **Unstructured Textual Modality**: Clinical notes, symptoms, and doctor observations.

By analyzing both, the system detects "hidden" deterioration where vitals might appear stable, but the patient's symptoms (captured in notes) indicate an upcoming adverse event.

### 3. Machine Learning Logic (k-NN)
The system performs real-time inference against the `mini_mimic_dataset.csv`. 
*   **Algorithm**: Weighted k-Nearest Neighbors (k=10).
*   **Medical Weighting**: Features are weighted by clinical sensitivity: **SpO2 (35%)**, **Heart Rate (25%)**, and **Respiratory Rate (20%)** are prioritized.
*   **Normalization**: Input vitals are normalized against physiological ranges to ensure accurate similarity mapping.

## 🛠 Features
*   **Dual Prediction Modes**: Switch between pure AI clinical assessment and data-driven ML modeling.
*   **Explainable AI (XAI)**: Generates a "Medical Rationale" to help doctors understand the *why* behind a specific risk level.
*   **Real-time Trends**: Visualization of vitals over time to identify downward physiological trajectories.
*   **Comprehensive Registration**: Multi-tab intake for basic info, initial vitals, and clinical history.

## ⚖️ Security & Compliance
*   **Data Isolation**: Firestore security rules ensure that patient data is strictly accessible only to the authorized medical professional who registered them.
*   **Professional Use**: Designed as a decision-support tool; final clinical decisions remain with the medical professional.

## 🗄 Database Schema
*   **Users**: Professional profiles for doctors/medical staff.
*   **Patients**: Demographic data and risk factors.
*   **VitalsRecords**: Time-series physiological data.
*   **Predictions**: Historical record of all generated AI and ML assessments.
