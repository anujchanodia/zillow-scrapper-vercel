require('dotenv').config();
const ZillowScraper = require('../lib/scraper');
const dataStore = require('../lib/dataStore');

// Serverless function handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to trigger scraping.'
    });
  }

  const startTime = Date.now();
  console.log('[api] Scrape job started at:', new Date().toISOString());

  try {
    // Initialize scraper
    const scraper = new ZillowScraper();
    
    // Perform scraping
    console.log('[api] Starting Cincinnati multi-unit scraping...');
    const properties = await scraper.scrapeCincinnatiMultiUnit();
    
    if (properties.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Scraping completed but no properties found',
        data: {
          newProperties: 0,
          totalProperties: 0,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Store in shared data store
    dataStore.setProperties(properties);
    
    const duration = Date.now() - startTime;
    console.log(`[api] Scrape job completed in ${duration}ms`);

    // Success response
    res.status(200).json({
      success: true,
      message: 'Scraping completed successfully',
      data: {
        newProperties: properties.length,
        totalProperties: properties.length,
        duration: duration,
        timestamp: new Date().toISOString(),
        storage: {
          type: 'shared-memory',
          totalProperties: properties.length
        }
      },
      samples: properties.slice(0, 3).map(p => ({
        id: p.id,
        address: p.address,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        price: p.price,
        images: p.images.length,
        zillowUrl: p.zillowUrl
      }))
    });

  } catch (error) {
    console.error('[api] Scrape job failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Scraping failed',
      error: error.message,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }
};
