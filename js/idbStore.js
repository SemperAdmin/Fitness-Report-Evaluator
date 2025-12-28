// Lightweight IndexedDB store for evaluations index and details
// Object stores: indexes (by email), details (by email|id)

(function() {
  const DB_NAME = 'fitrep-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains('indexes')) {
          db.createObjectStore('indexes', { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains('details')) {
          db.createObjectStore('details', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function putIndex(email, entries) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('indexes', 'readwrite');
        const store = tx.objectStore('indexes');
        store.put({ email, entries: entries || [], updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IDB putIndex failed:', e);
      return false;
    }
  }

  async function getIndex(email) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('indexes', 'readonly');
        const store = tx.objectStore('indexes');
        const req = store.get(email);
        req.onsuccess = () => resolve(req.result ? req.result.entries || [] : []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IDB getIndex failed:', e);
      return [];
    }
  }

  async function putDetail(email, id, evaluation) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('details', 'readwrite');
        const store = tx.objectStore('details');
        store.put({ key: `${email}|${id}`, evaluation, savedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IDB putDetail failed:', e);
      return false;
    }
  }

  async function getDetail(email, id) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('details', 'readonly');
        const store = tx.objectStore('details');
        const req = store.get(`${email}|${id}`);
        req.onsuccess = () => resolve(req.result ? req.result.evaluation || null : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IDB getDetail failed:', e);
      return null;
    }
  }

  async function clearForEmail(email) {
    try {
      const db = await openDb();
      const ok1 = await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('indexes', 'readwrite');
          const store = tx.objectStore('indexes');
          const req = store.delete(email);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
      const ok2 = await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('details', 'readwrite');
          const store = tx.objectStore('details');
          const prefix = String(email || '').trim() + '|';
          const req = store.openCursor();
          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const k = String(cursor.key || '');
              if (k.startsWith(prefix)) {
                store.delete(cursor.key);
              }
              cursor.continue();
            } else {
              resolve(true);
            }
          };
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
      return ok1 && ok2;
    } catch (e) {
      console.warn('IDB clearForEmail failed:', e);
      return false;
    }
  }

  async function clearAll() {
    try {
      const db = await openDb();
      const ok1 = await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('indexes', 'readwrite');
          const store = tx.objectStore('indexes');
          const req = store.clear();
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
      const ok2 = await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('details', 'readwrite');
          const store = tx.objectStore('details');
          const req = store.clear();
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
      return ok1 && ok2;
    } catch (e) {
      console.warn('IDB clearAll failed:', e);
      return false;
    }
  }

  // Expose
  const api = { putIndex, getIndex, putDetail, getDetail, clearForEmail, clearAll };
  if (typeof window !== 'undefined') {
    window.idbStore = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  })();
