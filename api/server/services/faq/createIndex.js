const logger = require('~/config/winston');
const { ensureCollection, getCollectionInfo } = require('./qdrant');

async function ensureQdrantCollection() {
  try {
    logger.info('[FAQ Index] Ensuring Qdrant collection exists...');
    await ensureCollection();

    const info = await getCollectionInfo();
    logger.info('[FAQ Index] Qdrant collection info:');
    logger.info(JSON.stringify(info, null, 2));
  } catch (error) {
    logger.error('[FAQ Index] Error ensuring Qdrant collection:', error);
    throw error;
  }
}

if (require.main === module) {
  (async () => {
    try {
      await ensureQdrantCollection();
      process.exit(0);
    } catch (error) {
      logger.error('[FAQ Index] Script failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  ensureQdrantCollection,
};
