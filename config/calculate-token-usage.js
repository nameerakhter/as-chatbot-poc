const path = require('path');
const mongoose = require('mongoose');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { Transaction, Conversation } = require('@librechat/data-schemas').createModels(mongoose);
const { silentExit } = require('./helpers');
const connect = require('./connect');

/**
 * Convert token credits to USD
 * Formula from LibreChat docs: Token Value / 1,000,000 = USD
 * Where: Token Value = (Raw Amount of Tokens) × (Rate)
 * Reference: https://www.librechat.ai/docs/configuration/token_usage
 */
function creditsToUSD(credits) {
  return credits / 1000000;
}

function formatNumber(num) {
  return Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUSD(num) {
  const absNum = Math.abs(num);
  if (absNum < 0.01) {
    return absNum.toLocaleString('en-US', {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    });
  }
  return absNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

(async () => {
  await connect();

  const conversationId = process.argv[2];

  if (conversationId) {
    const pipeline = [
      {
        $match: {
          conversationId: conversationId,
          tokenType: { $in: ['prompt', 'completion'] },
        },
      },
      {
        $group: {
          _id: '$conversationId',
          totalRawTokens: { $sum: { $abs: '$rawAmount' } },
          totalTokenValue: { $sum: { $abs: '$tokenValue' } },
        },
      },
    ];

    const results = await Transaction.aggregate(pipeline);

    if (results.length === 0) {
      console.red(`No transactions found for conversation: ${conversationId}`);
      silentExit(0);
    }

    const result = results[0];
    const conversation = await Conversation.findOne({ conversationId: conversationId }).lean();

    console.white(`\n${conversation?.title || conversationId}`);
    console.white(`Total Tokens: ${formatNumber(result.totalRawTokens)}`);
    console.white(`USD Cost: $${formatUSD(creditsToUSD(result.totalTokenValue))}`);
  } else {
    const pipeline = [
      {
        $match: {
          conversationId: { $exists: true, $ne: null },
          tokenType: { $in: ['prompt', 'completion'] },
        },
      },
      {
        $group: {
          _id: '$conversationId',
          totalRawTokens: { $sum: { $abs: '$rawAmount' } },
          totalTokenValue: { $sum: { $abs: '$tokenValue' } },
        },
      },
      {
        $sort: { totalTokenValue: -1 },
      },
    ];

    const results = await Transaction.aggregate(pipeline);

    if (results.length === 0) {
      console.red('\nNo transactions found in the database.');
      console.yellow('Make sure transactions are enabled in your configuration.');
      silentExit(0);
    }

    // Get conversation titles
    const conversationIds = results.map((r) => r._id);
    const conversations = await Conversation.find({
      conversationId: { $in: conversationIds },
    })
      .select('conversationId title user')
      .lean();

    const convMap = new Map(conversations.map((c) => [c.conversationId, c]));

    const conversationsData = results.map((result) => ({
      conversationId: result._id,
      title: convMap.get(result._id)?.title || 'Untitled',
      totalRawTokens: result.totalRawTokens,
      usdCost: creditsToUSD(result.totalTokenValue),
    }));

    console.white('\nTitle'.padEnd(50) + 'Total Tokens'.padStart(15) + 'USD Cost'.padStart(15));
    console.white('-'.repeat(80));

    conversationsData.forEach((conv) => {
      const title = (conv.title || 'Untitled').substring(0, 48).padEnd(50);
      const tokensStr = formatNumber(conv.totalRawTokens).padStart(15);
      const usdStr = `$${formatUSD(conv.usdCost)}`.padStart(15);
      console.white(`${title}${tokensStr}${usdStr}`);
    });
  }

  silentExit(0);
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('There was an uncaught error:');
    console.error(err);
  }

  if (!err.message.includes('fetch failed')) {
    process.exit(1);
  }
});
