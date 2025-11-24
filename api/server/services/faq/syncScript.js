const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
require('module-alias')({ base: path.resolve(__dirname, '../../..') });
const logger = require('~/config/winston');
const { syncFaqs } = require('./sync');
const { ensureQdrantCollection } = require('./createIndex');
const { testConnection } = require('./qdrant');

async function main() {
  try {
    logger.info('[FAQ Sync Script] Generating embeddings from FAQ API');
    const qdrantTest = await testConnection();
    if (!qdrantTest.connected) {
      logger.error('[FAQ Sync Script] Qdrant connection failed');
      process.exit(1);
    }
    logger.info('');

    logger.info('[FAQ Sync Script] Setting up Qdrant collection');
    await ensureQdrantCollection();

    const qdrantTestAfter = await testConnection();
    logger.info(
      `[FAQ Sync Script] Qdrant ready: ${qdrantTestAfter.pointCount || 0} vectors stored`,
    );
    logger.info('');

    logger.info('[FAQ Sync Script] Step 5: Syncing FAQs and generating embeddings...');
    logger.info('');
    const result = await syncFaqs();
    logger.info('');

    logger.info('[FAQ Sync Script] Step 6: Final verification...');
    const finalTest = await testConnection();
    logger.info('');

    logger.info('='.repeat(60));
    logger.info(`  - FAQs synced: ${result.synced}`);
    logger.info(`  - FAQs updated: ${result.updated}`);
    logger.info(`  - Errors: ${result.errors}`);
    logger.info(`  - Total vectors in Qdrant: ${finalTest.pointCount || 0}`);
    logger.info('='.repeat(60));

    process.exit(0);
  } catch (error) {
    logger.error('[FAQ Sync Script] Sync failed:', error);
    process.exit(1);
  }
}

main();
