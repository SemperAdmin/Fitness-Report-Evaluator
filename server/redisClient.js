let client = null;
function getRedisClient() {
  if (client) return client;
  try {
    const url = process.env.REDIS_URL || '';
    if (!url) return null;
    const IORedis = require('ioredis');
    client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    client.on('error', () => {});
    return client;
  } catch (_) {
    return null;
  }
}
module.exports = { getRedisClient };
