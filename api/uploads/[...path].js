require('dotenv').config();
const fs = require('fs');
const path = require('path');
const StorageManager = require('../../lib/storage');

// Serverless function handler for serving images
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET to fetch images.'
    });
  }

  try {
    const { path: imagePath } = req.query;
    
    if (!imagePath || !Array.isArray(imagePath)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image path'
      });
    }

    // Reconstruct the full path
    const fullPath = imagePath.join('/');
    const storage = new StorageManager();
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, fullPath);

    // Security check
    try {
      storage.validateImagePath(filePath);
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set appropriate headers
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Last-Modified', stats.mtime.toUTCString());

    // Check if client has cached version
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
      return res.status(304).end();
    }

    // Stream the file
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

  } catch (error) {
    console.error('[api] Image serve error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to serve image',
      error: error.message
    });
  }
};
