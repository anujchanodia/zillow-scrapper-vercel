const fs = require('fs');
const path = require('path');

class StorageManager {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
  }

  ensureDirectories() {
    const dirs = [
      this.uploadDir,
      path.join(this.uploadDir, 'properties'),
      path.join(this.uploadDir, 'data')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[storage] Created directory: ${dir}`);
      }
    });
  }

  getStorageStats() {
    if (!fs.existsSync(this.uploadDir)) {
      return {
        totalSize: 0,
        totalFiles: 0,
        propertiesCount: 0,
        imagesCount: 0
      };
    }

    let totalSize = 0;
    let totalFiles = 0;
    let imagesCount = 0;
    let propertiesCount = 0;

    const calculateDirSize = (dirPath) => {
      if (!fs.existsSync(dirPath)) return;

      const items = fs.readdirSync(dirPath);
      
      items.forEach(item => {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          if (dirPath.includes('properties')) {
            propertiesCount++;
          }
          calculateDirSize(itemPath);
        } else {
          totalSize += stats.size;
          totalFiles++;
          
          if (item.endsWith('.jpg') || item.endsWith('.jpeg') || item.endsWith('.png')) {
            imagesCount++;
          }
        }
      });
    };

    calculateDirSize(this.uploadDir);

    return {
      totalSize: this.formatBytes(totalSize),
      totalSizeBytes: totalSize,
      totalFiles,
      propertiesCount,
      imagesCount
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  cleanupOldFiles() {
    if (!fs.existsSync(this.uploadDir)) {
      console.log('[storage] Upload directory does not exist, nothing to cleanup');
      return { deleted: 0, errors: 0 };
    }

    const propertiesDir = path.join(this.uploadDir, 'properties');
    if (!fs.existsSync(propertiesDir)) {
      console.log('[storage] Properties directory does not exist');
      return { deleted: 0, errors: 0 };
    }

    let deletedCount = 0;
    let errorCount = 0;
    const cutoffTime = Date.now() - this.maxAge;

    try {
      const propertyDirs = fs.readdirSync(propertiesDir);
      
      propertyDirs.forEach(propertyId => {
        const propertyPath = path.join(propertiesDir, propertyId);
        
        try {
          const stats = fs.statSync(propertyPath);
          
          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            this.deleteDirectory(propertyPath);
            deletedCount++;
            console.log(`[storage] Deleted old property: ${propertyId}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`[storage] Error processing ${propertyId}:`, error.message);
        }
      });

    } catch (error) {
      console.error('[storage] Error during cleanup:', error.message);
      errorCount++;
    }

    console.log(`[storage] Cleanup complete: deleted=${deletedCount} errors=${errorCount}`);
    return { deleted: deletedCount, errors: errorCount };
  }

  deleteDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        this.deleteDirectory(itemPath);
      } else {
        fs.unlinkSync(itemPath);
      }
    });
    
    fs.rmdirSync(dirPath);
  }

  validateImagePath(imagePath) {
    // Security: ensure the path is within uploads directory
    const absoluteUploadDir = path.resolve(this.uploadDir);
    const absoluteImagePath = path.resolve(imagePath);
    
    if (!absoluteImagePath.startsWith(absoluteUploadDir)) {
      throw new Error('Invalid image path: outside upload directory');
    }
    
    if (!fs.existsSync(absoluteImagePath)) {
      throw new Error('Image file not found');
    }
    
    return true;
  }

  getImageUrl(localPath) {
    // Convert local path to URL path
    const relativePath = path.relative(this.uploadDir, localPath);
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }

  async backupData() {
    const dataFile = path.join(this.uploadDir, 'data', 'properties.json');
    
    if (!fs.existsSync(dataFile)) {
      console.log('[storage] No data file to backup');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.uploadDir, 'data', `properties-backup-${timestamp}.json`);
    
    try {
      fs.copyFileSync(dataFile, backupFile);
      console.log(`[storage] Data backed up to: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('[storage] Backup failed:', error.message);
      throw error;
    }
  }

  getDiskUsageWarning() {
    const stats = this.getStorageStats();
    const maxSizeBytes = 500 * 1024 * 1024; // 500MB warning threshold
    
    if (stats.totalSizeBytes > maxSizeBytes) {
      return {
        warning: true,
        message: `Storage usage (${stats.totalSize}) exceeds recommended limit. Consider cleanup.`,
        usage: stats.totalSize,
        threshold: this.formatBytes(maxSizeBytes)
      };
    }
    
    return { warning: false };
  }

  async listRecentProperties(limit = 10) {
    const propertiesDir = path.join(this.uploadDir, 'properties');
    
    if (!fs.existsSync(propertiesDir)) {
      return [];
    }

    try {
      const dirs = fs.readdirSync(propertiesDir);
      const propertiesWithDates = [];

      dirs.forEach(dir => {
        const dirPath = path.join(propertiesDir, dir);
        const stats = fs.statSync(dirPath);
        
        if (stats.isDirectory()) {
          propertiesWithDates.push({
            propertyId: dir,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            path: dirPath
          });
        }
      });

      // Sort by creation date (newest first)
      propertiesWithDates.sort((a, b) => b.createdAt - a.createdAt);
      
      return propertiesWithDates.slice(0, limit);

    } catch (error) {
      console.error('[storage] Error listing properties:', error.message);
      return [];
    }
  }
}

module.exports = StorageManager;