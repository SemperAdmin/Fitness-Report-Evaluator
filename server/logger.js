let pino = null;
try { pino = require('pino'); } catch (_) { pino = null; }

function createLogger() {
  if (pino) {
    return pino({ level: process.env.LOG_LEVEL || 'info' });
  }
  return {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log,
  };
}

function requestLogger() {
  const logger = createLogger();
  return (req, res, next) => {
    const start = Date.now();
    const reqId = 'req_' + start.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    req.reqId = reqId;
    try {
      logger.info({ msg: 'request', id: reqId, method: req.method, url: req.url });
    } catch (_) {}
    res.on('finish', () => {
      const ms = Date.now() - start;
      try {
        logger.info({ msg: 'response', id: reqId, status: res.statusCode, durationMs: ms });
      } catch (_) {}
    });
    next();
  };
}

module.exports = { createLogger, requestLogger };
