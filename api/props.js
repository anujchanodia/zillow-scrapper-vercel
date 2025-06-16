require('dotenv').config();
const dataStore = require('../lib/dataStore');

// Serverless function handler
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
      message: 'Method not allowed. Use GET to fetch properties.'
    });
  }

  try {
    // Get query parameters
    const {
      page = '1',
      pageSize = '20',
      bedrooms,
      bathrooms,
      priceMin,
      priceMax,
      city,
      state
    } = req.query;

    // Get properties from shared store
    const allProperties = dataStore.getProperties();

    if (allProperties.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No properties found. Run /api/scrape first to collect data.',
        data: [],
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalCount: 0,
          totalPages: 0
        }
      });
    }

    // Apply filters
    let filteredProperties = allProperties.filter(property => {
      // Basic filters
      if (bedrooms && property.bedrooms < parseInt(bedrooms)) return false;
      if (bathrooms && property.bathrooms < parseFloat(bathrooms)) return false;
      if (priceMin && (!property.price || property.price < parseInt(priceMin))) return false;
      if (priceMax && (!property.price || property.price > parseInt(priceMax))) return false;
      if (city && !property.city.toLowerCase().includes(city.toLowerCase())) return false;
      if (state && property.state.toLowerCase() !== state.toLowerCase()) return false;
      
      return property.isActive;
    });

    // Pagination
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const totalCount = filteredProperties.length;
    const totalPages = Math.ceil(totalCount / pageSizeNum);
    const skip = (pageNum - 1) * pageSizeNum;
    
    // Get page data
    const pageProperties = filteredProperties
      .slice(skip, skip + pageSizeNum)
      .map(property => ({
        id: property.id,
        zillowId: property.zillowId,
        address: property.address,
        city: property.city,
        state: property.state,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        price: property.price,
        squareFootage: property.squareFootage,
        propertyType: property.propertyType,
        unitCount: property.unitCount,
        zillowUrl: property.zillowUrl,
        heroImage: property.images?.find(img => img.isHero)?.url || null,
        imageCount: property.images?.length || 0,
        scrapedAt: property.scrapedAt
      }));

    res.status(200).json({
      success: true,
      data: pageProperties,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalCount,
        totalPages
      },
      filters: {
        bedrooms,
        bathrooms,
        priceMin,
        priceMax,
        city,
        state
      }
    });

  } catch (error) {
    console.error('[api] Properties fetch error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message
    });
  }
};
