require('dotenv').config();
const ZillowScraper = require('../lib/scraper');
const StorageManager = require('../lib/storage');

// Statistics endpoint
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
      message: 'Method not allowed. Use GET to fetch statistics.'
    });
  }

  try {
    // Load properties data
    const scraper = new ZillowScraper();
    const allProperties = await scraper.loadPropertiesFromFile();
    
    // Storage stats
    const storage = new StorageManager();
    const storageStats = storage.getStorageStats();
    const diskWarning = storage.getDiskUsageWarning();

    // Calculate property statistics
    const activeProperties = allProperties.filter(p => p.isActive);
    const propertiesWithPrice = activeProperties.filter(p => p.price && p.price > 0);
    
    // Price statistics
    const prices = propertiesWithPrice.map(p => p.price);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    
    // Bedroom distribution
    const bedroomStats = activeProperties.reduce((acc, p) => {
      const bedrooms = p.bedrooms || 0;
      acc[bedrooms] = (acc[bedrooms] || 0) + 1;
      return acc;
    }, {});

    // City distribution
    const cityStats = activeProperties.reduce((acc, p) => {
      const city = p.city || 'Unknown';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    // Property type distribution
    const typeStats = activeProperties.reduce((acc, p) => {
      const type = p.propertyType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Recent scraping activity
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentProperties = activeProperties.filter(p => 
      new Date(p.scrapedAt) > last24Hours
    );

    // Unit count statistics
    const unitCounts = activeProperties.filter(p => p.unitCount).map(p => p.unitCount);
    const avgUnits = unitCounts.length > 0 ? Math.round(unitCounts.reduce((a, b) => a + b, 0) / unitCounts.length) : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProperties: allProperties.length,
          activeProperties: activeProperties.length,
          propertiesWithImages: activeProperties.filter(p => p.images && p.images.length > 0).length,
          lastScrapedAt: activeProperties.length > 0 ? 
            Math.max(...activeProperties.map(p => new Date(p.scrapedAt).getTime())) : null
        },

        pricing: {
          averagePrice: avgPrice,
          minPrice: minPrice,
          maxPrice: maxPrice,
          propertiesWithPrice: propertiesWithPrice.length,
          priceRanges: {
            under100k: propertiesWithPrice.filter(p => p.price < 100000).length,
            '100k-200k': propertiesWithPrice.filter(p => p.price >= 100000 && p.price < 200000).length,
            '200k-300k': propertiesWithPrice.filter(p => p.price >= 200000 && p.price < 300000).length,
            '300k-500k': propertiesWithPrice.filter(p => p.price >= 300000 && p.price < 500000).length,
            over500k: propertiesWithPrice.filter(p => p.price >= 500000).length
          }
        },

        property: {
          averageUnits: avgUnits,
          bedroomDistribution: Object.keys(bedroomStats)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .reduce((acc, key) => {
              acc[key + (key === '1' ? ' bedroom' : ' bedrooms')] = bedroomStats[key];
              return acc;
            }, {}),
          
          topCities: Object.entries(cityStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([city, count]) => ({ city, count })),
          
          propertyTypes: Object.entries(typeStats)
            .sort(([,a], [,b]) => b - a)
            .map(([type, count]) => ({ type, count }))
        },

        activity: {
          recentlyScraped: recentProperties.length,
          totalImages: storageStats.imagesCount,
          oldestProperty: activeProperties.length > 0 ? 
            Math.min(...activeProperties.map(p => new Date(p.scrapedAt).getTime())) : null
        },

        storage: {
          ...storageStats,
          warning: diskWarning.warning ? diskWarning.message : null
        }
      },
      
      meta: {
        generatedAt: new Date().toISOString(),
        dataFreshness: activeProperties.length > 0 ? 
          `Last updated ${Math.round((Date.now() - Math.max(...activeProperties.map(p => new Date(p.scrapedAt).getTime()))) / (1000 * 60 * 60))} hours ago` : 
          'No data available'
      }
    });

  } catch (error) {
    console.error('[api] Stats error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate statistics',
      error: error.message
    });
  }
};