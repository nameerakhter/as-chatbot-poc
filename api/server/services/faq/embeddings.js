const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('~/config/winston');

const GOOGLE_API_KEY = process.env.GOOGLE_KEY || process.env.GOOGLE_API_KEY;

const EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Generates embeddings using Google Gemini API
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_KEY is not configured');
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string');
  }

  try {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.trim() === '') {
      throw new Error('GOOGLE_KEY is empty or not set in environment variables');
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent({
      content: { parts: [{ text }] },
    });

    const embedding = result.embedding?.values;

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Failed to generate embedding: empty result');
    }

    logger.info(`[FAQ Embeddings] Generated embedding: ${embedding.length} dimensions`);
    return embedding;
  } catch (error) {
    logger.error('[FAQ Embeddings] Error generating embedding:', error);
    logger.error('[FAQ Embeddings] Error details:', error.message);
    if (error.stack) {
      logger.error('[FAQ Embeddings] Stack trace:', error.stack);
    }
    throw error;
  }
}

/**
 * Generates embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(texts) {
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const batchSize = 10;
  const embeddings = [];

  logger.info(
    `[FAQ Embeddings] Generating embeddings for ${texts.length} texts in batches of ${batchSize}...`,
  );

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);
    logger.info(
      `[FAQ Embeddings] Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)...`,
    );

    const batchPromises = batch.map((text) => generateEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);

    logger.info(
      `[FAQ Embeddings] Batch ${batchNum} completed: ${batchResults.length} embeddings generated`,
    );

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  logger.info(`[FAQ Embeddings] All embeddings generated: ${embeddings.length} total`);
  return embeddings;
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
};
