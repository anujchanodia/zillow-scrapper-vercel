require('dotenv').config();
const ZillowScraper = require('../../lib/scraper');

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
      message: 'Method not allowed. Use GET to fetch property details.'
    });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Property ID is required'
      });
    }

    // Initialize scraper to load data
    const scraper = new ZillowScraper();
    const allProperties = await scraper.loadPropertiesFromFile();

    // Find the property
    const property = allProperties.find(p => p.id === id || p.zillowId === id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Return full property details
    res.status(200).json({
      success: true,
      data: {
        id: property.id,
        zillowId: property.zillowId,
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        latitude: property.latitude,
        longitude: property.longitude,
        
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        price: property.price,
        squareFootage: property.squareFootage,
        lotSize: property.lotSize,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
        
        zillowUrl: property.zillowUrl,
        zestimate: property.zestimate,
        rentZestimate: property.rentZestimate,
        
        unitCount: property.unitCount,
        isMultiUnit: property.isMultiUnit,
        
        images: property.images || [],
        scrapedAt: property.scrapedAt,
        isActive: property.isActive
      }
    });

  } catch (error) {
    console.error('[api] Property detail fetch error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property details',
      error: error.message
    });
  }
};