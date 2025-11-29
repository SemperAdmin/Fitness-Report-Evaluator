const jobs = new Map();

function genId() {
  return 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function createJob(type, handler) {
  const id = genId();
  const job = { id, type, status: 'queued', startedAt: null, finishedAt: null, result: null, error: null };
  jobs.set(id, job);
  setImmediate(async () => {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    try {
      job.result = await handler();
      job.status = 'completed';
    } catch (e) {
      job.error = e?.message || String(e);
      job.status = 'failed';
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  });
  return id;
}

function getJob(id) {
  return jobs.get(id) || null;
}

module.exports = { createJob, getJob };
