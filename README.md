# HealthPredict AI - Multimodal Clinical Deterioration Prediction System

An AI-powered clinical decision support system designed to predict patient deterioration (ICU transfer, cardiac arrest, and mortality) using **multimodal data** (numerical vitals + unstructured clinical notes).

## 🚀 Project Architecture

### 1. Technical Stack
*   **Framework**: Next.js 15 (App Router)
*   **Language**: TypeScript
*   **UI/UX**: React 19, Tailwind CSS, ShadCN UI, Lucide Icons
*   **Backend & Database**: Firebase (Auth, Firestore, App Hosting)
*   **AI/ML Framework**: Firebase Genkit
*   **Models**: 
    *   **LLM**: Gemini 2.5 Flash (for clinical reasoning and multimodal fusion)
    *   **ML**: Custom k-Nearest Neighbors (k-NN) for dataset-driven risk calculation

### 2. Multimodal Nature: Why is it Multimodal?
This system is classified as **Multimodal AI** because it performs "Late Fusion" of two distinct data types:
1.  **Structured Numerical Modality**: Processes physiological vitals (HR, BP, SpO2, RR, Temp).
2.  **Unstructured Textual Modality**: Processes free-text clinical notes and doctor observations.

By analyzing both, the system can detect "hidden" deterioration where vitals might appear stable, but the patient's symptoms (captured in notes) indicate an upcoming event.

### 3. Data Flow
1.  **Authentication**: Secure doctor access via Firebase Auth.
2.  **Input**: Doctor logs physiological vitals and clinical observations.
3.  **Inference**:
    *   **ML Path**: Normalizes inputs and queries `mini_mimic_dataset.csv` for similarity-based risk scoring.
    *   **AI Path**: Genkit Flow processes current state against medical knowledge using Gemini, fusing text and numbers.
4.  **Output**: Real-time risk levels (Low/Medium/High) with feature importance and narrative rationale.

## 🛠 Features
*   **Explainable AI (XAI)**: Generates a "Medical Rationale" to help doctors understand *why* a specific risk level was assigned.
*   **Medical Weighting**: Risk logic prioritizes sensitive features like SpO2 (35%) and Heart Rate (25%).
*   **Real-time Trends**: Visualization of vitals over time using Recharts to identify downward trajectories.

## ⚖️ Security & Compliance
*   **Data Isolation**: Firestore rules ensure doctor-patient data privacy.
*   **Professional Use**: Designed as a decision-support tool for medical professionals.
