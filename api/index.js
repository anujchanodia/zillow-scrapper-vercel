require('dotenv').config();
const StorageManager = require('../lib/storage');

// Main API endpoint
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // Get basic stats
    const storage = new StorageManager();
    const stats = storage.getStorageStats();
    const recentProperties = await storage.listRecentProperties(5);

    res.status(200).json({
      success: true,
      message: 'Zillow Scraper API - Zero Puppeteer Edition',
      environment: 'vercel',
      timestamp: new Date().toISOString(),
      
      endpoints: {
        root: 'GET /',
        scrape: 'POST /api/scrape - Trigger scraping job',
        properties: 'GET /api/props - List all properties (with pagination & filters)',
        propertyDetail: 'GET /api/props/[id] - Get single property details',
        images: 'GET /uploads/properties/[zpid]/[filename] - Serve property images',
        stats: 'GET /api/stats - System statistics',
        cleanup: 'POST /api/cleanup - Clean old files (admin)'
      },
      
      queryParams: {
        properties: {
          page: 'Page number (default: 1)',
          pageSize: 'Items per page (default: 20)',
          bedrooms: 'Minimum bedrooms',
          bathrooms: 'Minimum bathrooms',
          priceMin: 'Minimum price',
          priceMax: 'Maximum price',
          city: 'City filter',
          state: 'State filter'
        }
      },

      storage: stats,
      
      recentActivity: recentProperties.map(p => ({
        propertyId: p.propertyId,
        scrapedAt: p.createdAt,
        lastModified: p.modifiedAt
      })),

      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    });

  } catch (error) {
    console.error('[api] Root endpoint error:', error);
    
    res.status(500).json({
      success: false,
      message: 'API error',
      error: error.message
    });
  }
};