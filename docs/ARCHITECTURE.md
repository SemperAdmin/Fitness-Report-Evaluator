# Architecture Overview

This document captures the high-level architecture and key flows.

## System Diagram

```mermaid
flowchart LR
    UI[Frontend (Static: index.html)] -->|fetch| API[Backend (Express)]
    API -->|GitHub REST| GH[GitHub Data Repo]
    API -->|Workflows| MainRepo[Main Repo]
    subgraph Storage
        LS[localStorage]:::store
        IDB[IndexedDB]:::store
    end
    UI --> LS
    UI --> IDB

    classDef store fill:#eef,stroke:#66f,stroke-width:1px
```

## Sequence: Evaluation Load (Login)

```mermaid
sequenceDiagram
  participant U as User
  participant F as Frontend
  participant B as Backend
  participant G as GitHub

  U->>F: Submit login
  F->>B: POST /api/account/login
  B-->>F: 200 + session cookie (SameSite)
  F->>B: GET /api/evaluations/list (credentials: include if same-origin)
  B->>G: Fetch index and detail files
  G-->>B: Evaluations data
  B-->>F: JSON evaluations
  F-->>U: Render dashboard
```

## CORS & Cookies
- Backend CORS echoes allowed origin and sets `Access-Control-Allow-Credentials` when origin is allowed.
- In local HTTP cross-origin, browsers block cross-site cookies; UI informs users to use same origin or HTTPS.

