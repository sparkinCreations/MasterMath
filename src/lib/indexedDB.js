// IndexedDB utility for storing problem history locally

const DB_NAME = 'MathMasterDB';
const STORE_NAME = 'problemHistory';
const DB_VERSION = 1;

let db = null;

// Initialize the database
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });

        // Create indexes for querying
        objectStore.createIndex('topic', 'topic', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// Ensure DB is initialized
async function ensureDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

// Get all problem history entries
export async function getAllProblems() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => {
      // Sort by createdAt descending (newest first)
      const results = request.result.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// Add a new problem to history
export async function addProblem(problemData) {
  const database = await ensureDB();

  // Add timestamp if not present
  if (!problemData.createdAt) {
    problemData.createdAt = new Date().toISOString();
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.add(problemData);

    request.onsuccess = () => {
      resolve({ ...problemData, id: request.result });
    };
    request.onerror = () => reject(request.error);
  });
}

// Update an existing problem
export async function updateProblem(id, updateData) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    // First get the existing entry
    const getRequest = objectStore.get(id);

    getRequest.onsuccess = () => {
      const existingData = getRequest.result;
      if (!existingData) {
        reject(new Error('Problem not found'));
        return;
      }

      // Merge with updates
      const updatedData = { ...existingData, ...updateData };
      const putRequest = objectStore.put(updatedData);

      putRequest.onsuccess = () => resolve(updatedData);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Delete a problem
export async function deleteProblem(id) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Clear all problem history
export async function clearAllProblems() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Get problems by topic
export async function getProblemsByTopic(topic) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('topic');
    const request = index.getAll(topic);

    request.onsuccess = () => {
      const results = request.result.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}
