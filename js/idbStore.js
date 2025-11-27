// Lightweight IndexedDB store for evaluations index and details
// Object stores: indexes (by email), details (by email|id)

(function() {
  const DB_NAME = 'fitrep-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  /**
   *
   */
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

  /**
   *
   * @param email
   * @param entries
   */
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

  /**
   *
   * @param email
   */
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

  /**
   *
   * @param email
   * @param id
   * @param evaluation
   */
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

  /**
   *
   * @param email
   * @param id
   */
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

  // Expose
  const api = { putIndex, getIndex, putDetail, getDetail };
  if (typeof window !== 'undefined') {
    window.idbStore = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();

