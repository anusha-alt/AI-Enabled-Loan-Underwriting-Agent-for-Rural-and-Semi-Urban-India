# AI-Enabled-Loan-Underwriting-Agent-for-Rural-and-Semi-Urban-India

## Overview  
This project is a **mobile-first loan underwriting demo app** designed for rural and semi-urban India. It addresses challenges of low digital literacy, patchy connectivity, and limited credit histories by using **AI-enabled underwriting** with support for **voice-first interfaces, multilingual explanations, and simplified KYC flows**.  

The system demonstrates:  
- Simple onboarding with multiple KYC options (DigiLocker, document upload, selfie with liveness & face match).  
- AI-powered underwriting engine using financial and behavioral features.  
- Voice co-pilot that parses natural language loan requests into structured fields.  
- Explainable loan decisions in multiple Indian languages.  
- Resilient, retry-friendly uploads for low bandwidth environments.  
- Dynamic EMI and repayment options.

  ## Technologies Used  

### Frontend  
- **HTML5 / CSS3 / JavaScript** → responsive mobile-first design.  
- **Web Speech API** → for speech-to-text voice co-pilot (Hindi, English, Tamil, Bengali, Kannada).  
- **Canvas API** → capturing frames for selfie/liveness check.  

### Backend  
- **Node.js + Express** → lightweight API server.  
- **RESTful APIs** → for underwriting, KYC flows, explanations.  
- **Sigmoid Scoring Function** → to simulate AI underwriting logic.  

### AI / ML Components (Demo)  
- **Rule-based feature scoring** (income stability, transaction density, bounce history).  
- **LLM-inspired explanations** → mock text generation for reasons behind loan approval/decline.  

### KYC & Authentication (Mocked)  
- **DigiLocker API flow (simulated)** → session creation, consent, code exchange.  
- **Document OCR / extraction (mock)** → PAN, Aadhaar XML, etc.  
- **Face recognition (mock)** → liveness detection, face match scoring.  

### Resilience & Offline Mode  
- **Chunked uploads** with retry/resume logic.  
- **Lite Upload mode** → compress media, reduce chunk size for low bandwidth.  

### Deployment & Environment  
- Runs locally in **browser (Chrome/Edge)** for demo.  
- Backend runs on **http://localhost:3001**.  

















