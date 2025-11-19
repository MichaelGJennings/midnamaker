/**
 * Browser Storage for MIDNAM files
 * Uses IndexedDB for persistent storage when deployed on Vercel
 */

const DB_NAME = 'MidnamakerDB';
const DB_VERSION = 1;
const STORE_NAME = 'midnam_files';

class BrowserStorage {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB failed to open:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    
                    // Create indexes for searching
                    objectStore.createIndex('file_path', 'file_path', { unique: true });
                    objectStore.createIndex('manufacturer', 'manufacturer', { unique: false });
                    objectStore.createIndex('model', 'model', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    
                    console.log('Created IndexedDB object store');
                }
            };
        });
    }

    async ensureReady() {
        if (!this.db) {
            await this.initPromise;
        }
    }

    /**
     * Save a MIDNAM file to browser storage
     * @param {Object} data - The MIDNAM data to save
     * @param {string} data.file_path - Unique identifier/path for the file
     * @param {Object} data.midnam - The MIDNAM structure
     * @param {string} data.manufacturer - Manufacturer name
     * @param {string} data.model - Device model name
     * @returns {Promise<Object>} Result with success status
     */
    async saveMidnam(data) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Check if file already exists
            const index = store.index('file_path');
            const getRequest = index.get(data.file_path);

            getRequest.onsuccess = () => {
                const existingFile = getRequest.result;
                
                const fileData = {
                    file_path: data.file_path,
                    midnam: data.midnam,
                    manufacturer: data.manufacturer || 'Unknown',
                    model: data.model || 'Unknown Device',
                    timestamp: Date.now(),
                    original_timestamp: existingFile ? existingFile.original_timestamp : Date.now()
                };

                // If exists, update with same ID; otherwise add new
                if (existingFile) {
                    fileData.id = existingFile.id;
                    const updateRequest = store.put(fileData);
                    
                    updateRequest.onsuccess = () => {
                        resolve({
                            success: true,
                            message: 'File updated in browser storage',
                            id: fileData.id,
                            isUpdate: true
                        });
                    };
                    
                    updateRequest.onerror = () => {
                        reject(updateRequest.error);
                    };
                } else {
                    const addRequest = store.add(fileData);
                    
                    addRequest.onsuccess = () => {
                        resolve({
                            success: true,
                            message: 'File saved to browser storage',
                            id: addRequest.result,
                            isUpdate: false
                        });
                    };
                    
                    addRequest.onerror = () => {
                        reject(addRequest.error);
                    };
                }
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Get a single MIDNAM file by file_path
     */
    async getMidnam(file_path) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('file_path');
            const request = index.get(file_path);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all saved MIDNAM files
     */
    async getAllMidnams() {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by timestamp (most recent first)
                const results = request.result || [];
                results.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete a MIDNAM file by file_path
     */
    async deleteMidnam(file_path) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('file_path');
            const getRequest = index.getKey(file_path);

            getRequest.onsuccess = () => {
                const id = getRequest.result;
                if (id !== undefined) {
                    const deleteRequest = store.delete(id);
                    
                    deleteRequest.onsuccess = () => {
                        resolve({ success: true, message: 'File deleted from browser storage' });
                    };
                    
                    deleteRequest.onerror = () => {
                        reject(deleteRequest.error);
                    };
                } else {
                    resolve({ success: false, message: 'File not found' });
                }
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    /**
     * Clear all stored MIDNAM files
     */
    async clearAll() {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                resolve({ success: true, message: 'All files cleared from browser storage' });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get storage statistics
     */
    async getStats() {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const files = request.result || [];
                const totalSize = files.reduce((sum, file) => {
                    return sum + JSON.stringify(file.midnam).length;
                }, 0);

                resolve({
                    fileCount: files.length,
                    totalSize: totalSize,
                    totalSizeFormatted: this.formatBytes(totalSize),
                    manufacturers: [...new Set(files.map(f => f.manufacturer))].length
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

// Create singleton instance
export const browserStorage = new BrowserStorage();

