# Apuni Sarkar Chatbot POC

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
FAQ_API_URL=http://localhost:3002/faqs
FAQ_API_TIMEOUT_MS=4000
FAQ_CACHE_TTL_MS=60000
FAQ_MAX_RESULTS=5
```

3. Start the backend:
```bash
npm run backend:dev
```

4. Start the frontend (in another terminal):
```bash
npm run frontend:dev
```
