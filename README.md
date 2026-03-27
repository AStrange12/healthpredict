# HealthPredict AI - Clinical Deterioration Prediction System

An AI-powered clinical decision support system designed to predict patient deterioration (ICU transfer, cardiac arrest, and mortality) using multimodal data (vitals + clinical notes).

## 🚀 Project Architecture

### 1. Technical Stack
*   **Framework**: Next.js 15 (App Router)
*   **Language**: TypeScript
*   **UI/UX**: React 19, Tailwind CSS, ShadCN UI, Lucide Icons
*   **Backend & Database**: Firebase (Auth, Firestore, App Hosting)
*   **AI/ML Framework**: Firebase Genkit
*   **Models**: 
    *   **LLM**: Gemini 2.5 Flash (for clinical reasoning and explanations)
    *   **ML**: Custom k-Nearest Neighbors (k-NN) for dataset-driven risk calculation

### 2. System Components
*   **Doctor Dashboard**: Central hub for managing patient rosters and clinical status.
*   **Prediction Engine**: Dual-mode assessment (Experimental AI vs. Data-driven ML).
*   **Explainable AI (XAI)**: Natural language generation of "Medical Rationale" to help doctors understand risk factors.
*   **Real-time Vitals Monitoring**: Time-series logging and trend visualization using Recharts.

### 3. Data Flow
1.  **Authentication**: Secure doctor access via Firebase Auth (Google/Email).
2.  **Input**: Doctor logs physiological vitals (HR, BP, SpO2, RR, Temp) and clinical observations.
3.  **Inference**:
    *   **ML**: Normalizes inputs and queries `mini_mimic_dataset.csv` for similarity-based risk scoring.
    *   **AI**: Genkit Flow processes current state against medical knowledge using Gemini.
4.  **Output**: Real-time risk levels (Low/Medium/High) with feature importance breakdowns and narrative insights.

## 🛠 Features
*   **Multimodal Analysis**: Combines numerical vitals with free-text doctor notes.
*   **Early Detection**: Predicts outcomes based on historical clinical patterns.
*   **Data Persistence**: Full time-series history of patient vital signs.
*   **Medical Weighting**: Risk logic prioritizes sensitive features like SpO2 and Respiratory Rate.

## ⚖️ Security & Compliance
*   **Data Isolation**: Firestore rules ensure doctor-patient data privacy.
*   **Professional Use**: Designed for medical professionals as a decision-support tool.
