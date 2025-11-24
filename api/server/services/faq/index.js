const logger = require('~/config/winston');
const { generateEmbedding } = require('./embeddings');
const { searchVectors } = require('./qdrant');

const DEFAULT_LIMIT = 5;
const CONTEXT_CHAR_LIMIT = 2000;
const SCORE_THRESHOLD = 0.5;

/**
 * Formats FAQs into a compact context string.
 * @param {Array<{questionEnglish?: string, answerEnglish?: string, score?: number}>} faqs
 * @returns {string}
 */
function formatFaqContext(faqs) {
  if (!faqs.length) {
    return '';
  }

  const formatted = faqs
    .map((faq, idx) => {
      const question = faq.questionEnglish || 'Question unavailable';
      const answer = faq.answerEnglish || 'Answer unavailable';
      return `FAQ ${idx + 1}:\nQuestion: ${question}\nAnswer: ${answer}`;
    })
    .join('\n\n');

  return formatted.slice(0, CONTEXT_CHAR_LIMIT);
}

/**
 * Retrieves formatted FAQ context for a given query using Qdrant vector search.
 * @param {string} query - User query
 * @returns {Promise<string|null>} Formatted FAQ context or null
 */
async function getFaqContext(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return null;
  }

  try {
    logger.info(
      `[FAQ] Processing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`,
    );
    const queryEmbedding = await generateEmbedding(query.trim());

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      logger.warn('[FAQ] Failed to generate query embedding');
      return null;
    }

    logger.info(`[FAQ] Query embedding generated: ${queryEmbedding.length} dimensions`);

    logger.info('[FAQ] Searching Qdrant for similar FAQs...');
    const relevantFaqs = await searchVectors(queryEmbedding, DEFAULT_LIMIT, SCORE_THRESHOLD);

    if (!relevantFaqs || relevantFaqs.length === 0) {
      logger.warn('[FAQ] No relevant FAQs found (below threshold or empty collection)');
      return null;
    }

    logger.info(
      `[FAQ] Found ${relevantFaqs.length} relevant FAQs (scores: ${relevantFaqs.map((f) => f.score?.toFixed(3)).join(', ')})`,
    );

    return formatFaqContext(relevantFaqs);
  } catch (error) {
    logger.error('[FAQ] Error retrieving FAQ context:', error);
    return null;
  }
}

module.exports = {
  getFaqContext,
};
