# FAQ Vector Search Service with Qdrant

This service provides FAQ context retrieval using Gemini embeddings and Qdrant vector database.

## Overview

- **Embeddings**: Uses Google Gemini's `gemini-embedding-001` model (768 dimensions)
- **Vector Storage**: Qdrant vector database for efficient similarity search
- **Metadata Storage**: MongoDB for FAQ metadata (without embeddings)

## Setup

### 1. Set Up Qdrant

**Option A: Qdrant Cloud (Recommended for Production)**

1. Sign up at https://cloud.qdrant.io/
2. Create a free cluster
3. Get your cluster credentials:
   - Go to your cluster dashboard
   - Click on your cluster name
   - Find the **Cluster URL** (e.g., `https://xxxxx-xxxxx.us-east-1-0.aws.cloud.qdrant.io`)
   - Go to **API Keys** section
   - Create a new API key or use the default one
   - Copy the API key

**Option B: Docker (Local Development)**

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Option C: Local Installation**

Follow instructions at: https://qdrant.tech/documentation/guides/installation/

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Google API key for embeddings
GOOGLE_KEY=your_google_api_key

# FAQ API endpoint
FAQ_API_URL=http://localhost:3002/faqs

# MongoDB connection (for metadata storage)
MONGO_URI=mongodb://localhost:27017/LibreChat

# Qdrant configuration
# For Qdrant Cloud: Use your cluster URL from the dashboard
# For local: Use http://localhost:6333
QDRANT_URL=https://your-cluster-id.us-east-1-0.aws.cloud.qdrant.io
QDRANT_API_KEY=your_api_key_here  # Required for Qdrant Cloud, optional for local
QDRANT_COLLECTION_NAME=faq_embeddings

# Vector search configuration
FAQ_MAX_RESULTS=5
FAQ_CONTEXT_CHAR_LIMIT=2000
FAQ_SCORE_THRESHOLD=0.5  # Minimum similarity score (0-1)
```

### 3. Install Dependencies

```bash
npm install
```

This will install `@qdrant/js-client-rest` package.

### 4. Sync FAQs and Generate Embeddings

Run the sync script to fetch FAQs and generate embeddings:

```bash
node api/server/services/faq/syncScript.js
```

This will:

- Fetch FAQs from `FAQ_API_URL`
- Generate embeddings using Gemini
- Store vectors in Qdrant
- Store FAQ metadata in MongoDB

### 5. Verify Qdrant Collection

The collection is automatically created on first sync. You can verify it's working:

```bash
curl http://localhost:6333/collections/faq_embeddings
```

## Architecture

### Data Flow

1. **Sync Process**:
   - Fetch FAQs from API → Generate embeddings → Store in Qdrant + MongoDB

2. **Query Process**:
   - User query → Generate embedding → Search Qdrant → Return relevant FAQs

### Storage Strategy

- **Qdrant**: Stores vectors (embeddings) and FAQ payload (question/answer text)
- **MongoDB**: Stores FAQ metadata for easy querying and management (without vectors)

## Usage

The FAQ service is automatically integrated into the agent chat flow. When a user sends a message:

1. Query embedding is generated using Gemini
2. Qdrant vector search finds relevant FAQs
3. FAQ context is added to the agent's prompt

## API

### `getFaqContext(query)`

Retrieves relevant FAQ context for a user query.

**Parameters:**

- `query` (string): User query text

**Returns:**

- `Promise<string|null>`: Formatted FAQ context or null if no relevant FAQs found

### `syncFaqs()`

Syncs FAQs from API and generates embeddings.

**Returns:**

- `Promise<{synced: number, updated: number, errors: number}>`

## Files

- `index.js` - Main FAQ service with Qdrant vector search
- `qdrant.js` - Qdrant client wrapper and operations
- `embeddings.js` - Gemini embedding generation
- `sync.js` - FAQ sync and embedding generation
- `syncScript.js` - Standalone sync script
- `createIndex.js` - Index creation utilities

## Qdrant Operations

### Collection Structure

- **Collection Name**: `faq_embeddings` (configurable)
- **Vector Size**: 768 dimensions
- **Distance Metric**: Cosine similarity
- **Payload**: FAQ metadata (question, answer, etc.)

### Points Structure

Each point in Qdrant:

- **ID**: `faqId` (unique identifier)
- **Vector**: 768-dimensional embedding
- **Payload**:
  ```json
  {
    "question": "...",
    "questionEnglish": "...",
    "questionHindi": "...",
    "answer": "...",
    "answerEnglish": "...",
    "answerHindi": "...",
    "text": "..."
  }
  ```

## Troubleshooting

### Qdrant Connection Issues

- Verify Qdrant is running: `curl http://localhost:6333/health`
- Check `QDRANT_URL` environment variable
- For authenticated instances, set `QDRANT_API_KEY`

### Embeddings not generating

- Check `GOOGLE_KEY` is set correctly
- Verify Gemini API quota/limits

### No FAQs found

- Run sync script: `node api/server/services/faq/syncScript.js`
- Check `FAQ_API_URL` is accessible
- Verify Qdrant collection exists: `curl http://localhost:6333/collections/faq_embeddings`
- Check MongoDB connection

### Low similarity scores

- Adjust `FAQ_SCORE_THRESHOLD` (lower = more results, higher = more relevant)
- Default is 0.5 (50% similarity)

## Performance

- **Vector Search**: Qdrant provides fast approximate nearest neighbor search
- **Batch Operations**: Embeddings are generated in batches to avoid rate limits
- **Caching**: FAQ metadata is cached in MongoDB for quick access

## Migration from MongoDB Atlas

If you were previously using MongoDB Atlas vector search:

1. Install and start Qdrant
2. Update environment variables (remove Atlas-specific vars)
3. Run sync script to populate Qdrant
4. The system will automatically use Qdrant for vector search
