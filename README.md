# JuriSight

JuriSight is an AI-assisted legal analysis platform designed to support criminal case review and legal research workflows. It helps analyze FIRs, charge sheets, and case narratives by combining document processing, deterministic legal-rule evaluation, legal-authority retrieval, and contextual AI reasoning.

![JuriSight](public/jurisight.jpg)

---

## About

JuriSight streamlines the review of criminal case documents by transforming unstructured legal records into structured analyses.

The platform combines:

- Document extraction
- Procedural and statutory rule evaluation
- Bail eligibility analysis
- Legal-authority retrieval
- Contextual AI reasoning
- Case-specific legal conversations

It is designed for educational, research, and productivity purposes and is not intended to replace professional legal advice.

---

## Features

- PDF upload and document extraction
- FIR and charge-sheet analysis
- Bail eligibility assessment
- Deterministic statutory-rule evaluation
- Legal-authority retrieval with source provenance
- Risk and procedural evaluation
- Applicable legal-section identification
- Context-aware legal conversations
- Persistent case history
- Shareable case summaries

---

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

### Backend

- Next.js API Routes
- Prisma ORM
- PostgreSQL

### AI & Document Processing

- Groq API
- PDF parsing
- Structured prompting
- Rule-based legal validation
- Legal-authority retrieval

---

## Architecture

```text
User Input
     │
     ▼
Document Extraction
     │
     ▼
Procedural & Statutory Validation
     │
     ▼
Deterministic Legal Analysis
     │
     ▼
Legal Authority Retrieval
     │
     ▼
AI Contextual Reasoning
     │
     ▼
Structured Legal Analysis
