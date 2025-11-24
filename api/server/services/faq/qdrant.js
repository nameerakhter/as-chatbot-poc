const { QdrantClient } = require('@qdrant/js-client-rest');
const logger = require('~/config/winston');

const { QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION_NAME = 'faq_embeddings' } = process.env;

let qdrantClient = null;

/**
 * Initialize Qdrant client
 * @returns {QdrantClient}
 */
function getQdrantClient() {
  if (!qdrantClient) {
    const config = {
      url: QDRANT_URL,
    };

    if (QDRANT_API_KEY) {
      config.apiKey = QDRANT_API_KEY;
      logger.info(`[Qdrant] Connecting to ${QDRANT_URL}`);
    } else {
      logger.info(`[Qdrant] Attempting connection without authentication`);
    }

    qdrantClient = new QdrantClient(config);
    logger.info(`[Qdrant] Client initialized`);
  }

  return qdrantClient;
}

/**
 * Creates the FAQ collection in Qdrant if it doesn't exist
 * @returns {Promise<void>}
 */
async function ensureCollection() {
  try {
    const client = getQdrantClient();

    const collections = await client.getCollections();
    logger.info(`[Qdrant]  Connection successful.`);

    const collectionExists = collections.collections.some(
      (col) => col.name === QDRANT_COLLECTION_NAME,
    );

    if (!collectionExists) {
      logger.info(`[Qdrant] Creating collection: ${QDRANT_COLLECTION_NAME}`);

      const EMBEDDING_DIMENSIONS = Number(process.env.FAQ_EMBEDDING_DIMENSIONS) || 3072;

      await client.createCollection(QDRANT_COLLECTION_NAME, {
        vectors: {
          size: EMBEDDING_DIMENSIONS,
          distance: 'Cosine',
        },
      });

      logger.info(`[Qdrant] Collection created with ${EMBEDDING_DIMENSIONS} dimensions`);
    } else {
      logger.info(`[Qdrant]  Collection ${QDRANT_COLLECTION_NAME} already exists`);
    }
  } catch (error) {
    logger.error('[Qdrant] Error ensuring collection:', error);
    throw error;
  }
}

/**
 * Upserts a vector point in Qdrant
 * @param {string} pointId - Unique ID for the point (faqId)
 * @param {number[]} vector - Embedding vector
 * @param {Object} payload - Payload data (FAQ metadata)
 * @returns {Promise<void>}
 */
async function upsertPoint(pointId, vector, payload) {
  try {
    const client = getQdrantClient();

    await client.upsert(QDRANT_COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload,
        },
      ],
    });

    logger.debug(`[Qdrant] Upserted point: ${pointId}`);
  } catch (error) {
    logger.error(`[Qdrant] Error upserting point ${pointId}:`, error);
    throw error;
  }
}

/**
 * Upserts multiple vector points in Qdrant
 * @param {Array<{id: string, vector: number[], payload: Object}>} points - Array of points to upsert
 * @returns {Promise<void>}
 */
async function upsertPoints(points) {
  try {
    if (!points || points.length === 0) {
      return;
    }

    const client = getQdrantClient();
    logger.info(
      `[Qdrant] Upserting ${points.length} vectors to collection ${QDRANT_COLLECTION_NAME}...`,
    );

    const preparedPoints = points.map((point, index) => {
      if (!point.id) {
        throw new Error(`Point ${index} missing ID`);
      }
      if (!point.vector || !Array.isArray(point.vector)) {
        throw new Error(`Point ${index} (${point.id}) missing or invalid vector`);
      }
      if (point.vector.length !== 3072) {
        logger.warn(
          `[Qdrant] Point ${index} (${point.id}) has ${point.vector.length} dimensions, expected 3072`,
        );
      }

      let pointId;
      if (typeof point.id === 'string' && point.id.startsWith('faq_')) {
        const hash = point.id.replace('faq_', '');
        pointId =
          parseInt(hash, 10) ||
          Math.abs(hash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
      } else {
        pointId =
          parseInt(point.id, 10) ||
          Math.abs(
            String(point.id)
              .split('')
              .reduce((acc, char) => acc + char.charCodeAt(0), 0),
          );
      }

      return {
        id: pointId,
        vector: point.vector,
        payload: point.payload || {},
      };
    });

    logger.debug(
      `[Qdrant] Sample point: ID=${preparedPoints[0]?.id} (type: ${typeof preparedPoints[0]?.id}), Vector length=${preparedPoints[0]?.vector?.length}`,
    );

    await client.upsert(QDRANT_COLLECTION_NAME, {
      wait: true,
      points: preparedPoints,
    });

    logger.info(`[Qdrant]  Successfully upserted ${points.length} vectors`);
  } catch (error) {
    logger.error('[Qdrant] Error upserting points:', error.message || error);
    if (error.response?.data) {
      logger.error('[Qdrant] Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response) {
      logger.error('[Qdrant] Error response:', JSON.stringify(error.response, null, 2));
    }
    if (error.stack) {
      logger.error('[Qdrant] Stack trace:', error.stack);
    }
    throw error;
  }
}

/**
 * Searches for similar vectors in Qdrant
 * @param {number[]} queryVector - Query embedding vector
 * @param {number} limit - Maximum number of results
 * @param {number} scoreThreshold - Minimum similarity score (0-1)
 * @returns {Promise<Array>} Array of search results with scores
 */
async function searchVectors(queryVector, limit = 5, scoreThreshold = 0) {
  try {
    const client = getQdrantClient();
    logger.info(
      `[Qdrant] Searching for ${limit} similar vectors (threshold: ${scoreThreshold})...`,
    );

    const searchResult = await client.search(QDRANT_COLLECTION_NAME, {
      vector: queryVector,
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    logger.info(`[Qdrant] Found ${searchResult.length} results from vector search`);

    const results = searchResult.map((result) => ({
      faqId: result.id,
      score: result.score,
      ...result.payload,
    }));

    if (results.length > 0) {
      logger.info(`[Qdrant] Top result score: ${results[0].score.toFixed(4)}`);
    }

    return results;
  } catch (error) {
    logger.error('[Qdrant] Error searching vectors:', error.message || error);
    if (
      error.message?.includes('Forbidden') ||
      error.message?.includes('401') ||
      error.message?.includes('403') ||
      error.status === 403 ||
      error.status === 401
    ) {
      logger.error('[Qdrant] Authentication failed! Qdrant Cloud requires an API key.');
      logger.error('[Qdrant] Please set QDRANT_API_KEY in your .env file');
      logger.error('[Qdrant] Get your API key from: https://cloud.qdrant.io/');
    }
    throw error;
  }
}

/**
 * Deletes a point from Qdrant
 * @param {string} pointId - ID of the point to delete
 * @returns {Promise<void>}
 */
async function deletePoint(pointId) {
  try {
    const client = getQdrantClient();

    await client.delete(QDRANT_COLLECTION_NAME, {
      wait: true,
      points: [pointId],
    });

    logger.debug(`[Qdrant] Deleted point: ${pointId}`);
  } catch (error) {
    logger.error(`[Qdrant] Error deleting point ${pointId}:`, error);
    throw error;
  }
}

/**
 * Gets collection info
 * @returns {Promise<Object>} Collection information
 */
async function getCollectionInfo() {
  try {
    const client = getQdrantClient();
    return await client.getCollection(QDRANT_COLLECTION_NAME);
  } catch (error) {
    logger.error('[Qdrant] Error getting collection info:', error);
    throw error;
  }
}

/**
 * Tests Qdrant connection and collection status
 * @returns {Promise<{connected: boolean, collectionExists: boolean, pointCount?: number}>}
 */
async function testConnection() {
  try {
    logger.info('[Qdrant] Testing connection...');
    const client = getQdrantClient();

    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(
      (col) => col.name === QDRANT_COLLECTION_NAME,
    );

    let pointCount = 0;
    let vectorSize = null;
    if (collectionExists) {
      const info = await getCollectionInfo();
      pointCount = info.points_count || 0;
      vectorSize = info.config?.params?.vectors?.size || null;
      logger.info(`[Qdrant]  Collection exists: ${pointCount} vectors stored`);
      if (vectorSize) {
        logger.info(`[Qdrant] Collection vector size: ${vectorSize} dimensions`);
      }
    } else {
      logger.warn(`[Qdrant]  Collection does not exist yet. Run sync script to create it.`);
    }

    return {
      connected: true,
      collectionExists,
      pointCount,
      vectorSize,
    };
  } catch (error) {
    logger.error('[Qdrant] Connection test failed:', error.message || error);
    if (
      error.message?.includes('Forbidden') ||
      error.message?.includes('401') ||
      error.message?.includes('403') ||
      error.status === 403 ||
      error.status === 401
    )
      return {
        connected: false,
        collectionExists: false,
        error: error.message || String(error),
      };
  }
}

module.exports = {
  getQdrantClient,
  ensureCollection,
  upsertPoint,
  upsertPoints,
  searchVectors,
  deletePoint,
  getCollectionInfo,
  testConnection,
};
