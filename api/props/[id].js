require('dotenv').config();
const dataStore = require('../../lib/dataStore');

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

    // Find property in shared store
    const property = dataStore.findProperty(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Return full property details
    res.status(200).json({
      success: true,
      data: property
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
