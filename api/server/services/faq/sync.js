const axios = require('axios');
const logger = require('~/config/winston');
const { generateEmbeddingsBatch } = require('./embeddings');
const { ensureCollection, upsertPoints } = require('./qdrant');

const { FAQ_API_URL, FAQ_API_TIMEOUT_MS = 4000 } = process.env ?? {};

const DEFAULT_TIMEOUT = Number(FAQ_API_TIMEOUT_MS) || 4000;

/**
 * Combines FAQ text from English and Hindi fields for embedding
 * @param {Object} faq - FAQ object
 * @returns {string} Combined text
 */
function combineFaqText(faq) {
  const parts = [];

  if (faq.questionEnglish) {
    parts.push(faq.questionEnglish);
  }
  if (faq.answerEnglish) {
    parts.push(faq.answerEnglish);
  }
  if (faq.questionHindi) {
    parts.push(faq.questionHindi);
  }
  if (faq.answerHindi) {
    parts.push(faq.answerHindi);
  }

  return parts.join(' ').trim();
}

/**
 * Gets FAQ ID from the API data
 * @param {Object} faq - FAQ object
 * @returns {string} FAQ ID
 */
function getFaqId(faq) {
  if (!faq.id) {
    throw new Error('FAQ missing required id field');
  }
  return String(faq.id);
}

/**
 * Fetches FAQs from the configured API
 * @returns {Promise<Array>} Array of FAQ objects
 */
async function fetchFaqs() {
  if (!FAQ_API_URL) {
    logger.warn('[FAQ Sync] FAQ_API_URL is not configured. Skipping FAQ fetch.');
    return [];
  }

  try {
    const { data } = await axios.get(FAQ_API_URL, {
      timeout: DEFAULT_TIMEOUT,
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error(`[FAQ Sync] Failed to fetch FAQs from ${FAQ_API_URL}:`, error.message);
    throw error;
  }
}

/**
 * Syncs FAQs from API, generates embeddings, and stores them in Qdrant
 * @returns {Promise<{synced: number, updated: number, errors: number}>}
 */
async function syncFaqs() {
  try {
    logger.info('[FAQ Sync] Starting FAQ sync...');

    await ensureCollection();

    const faqs = await fetchFaqs();

    if (!faqs.length) {
      return { synced: 0, updated: 0, errors: 0 };
    }

    logger.info(`[FAQ Sync] Fetched ${faqs.length} FAQs`);

    const faqData = faqs.map((faq) => {
      const faqId = getFaqId(faq);
      const text = combineFaqText(faq);

      return {
        faqId,
        questionEnglish: faq.questionEnglish || '',
        questionHindi: faq.questionHindi || '',
        answerEnglish: faq.answerEnglish || '',
        answerHindi: faq.answerHindi || '',
        category: faq.category || '',
        text,
      };
    });

    logger.info(`[FAQ Sync] Generating embeddings for ${faqData.length} FAQs...`);
    const texts = faqData.map((faq) => faq.text);
    const embeddings = await generateEmbeddingsBatch(texts);

    if (embeddings.length !== faqData.length) {
      logger.error(
        `[FAQ Sync] Embedding count mismatch: expected ${faqData.length}, got ${embeddings.length}`,
      );
      throw new Error(
        `Embedding count mismatch: expected ${faqData.length}, got ${embeddings.length}`,
      );
    }

    logger.info(`[FAQ Sync] Successfully generated ${embeddings.length} embeddings`);

    const qdrantPoints = faqData.map((faq, index) => ({
      id: faq.faqId,
      vector: embeddings[index],
      payload: {
        questionEnglish: faq.questionEnglish,
        questionHindi: faq.questionHindi,
        answerEnglish: faq.answerEnglish,
        answerHindi: faq.answerHindi,
        category: faq.category,
        text: faq.text,
      },
    }));

    logger.info('[FAQ Sync] Storing vectors in Qdrant...');
    await upsertPoints(qdrantPoints);

    logger.info(`[FAQ Sync] Completed: ${faqData.length} FAQs synced to Qdrant`);

    return { synced: faqData.length, updated: 0, errors: 0 };
  } catch (error) {
    logger.error('[FAQ Sync] Sync failed:', error);
    throw error;
  }
}

module.exports = {
  syncFaqs,
  fetchFaqs,
};
