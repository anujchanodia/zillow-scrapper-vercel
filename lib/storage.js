class StorageManager {
  constructor() {
    // Serverless-friendly storage manager
  }

  ensureDirectories() {
    // No-op for serverless
    console.log('[storage] Serverless mode - no directories needed');
  }

  getStorageStats() {
    return {
      totalSize: '0 Bytes',
      totalSizeBytes: 0,
      totalFiles: 0,
      propertiesCount: 0,
      imagesCount: 0
    };
  }

  getDiskUsageWarning() {
    return { warning: false };
  }

  async listRecentProperties(limit = 10) {
    return [];
  }

  validateImagePath(imagePath) {
    return true;
  }

  getImageUrl(localPath) {
    return localPath;
  }
}

module.exports = StorageManager;
