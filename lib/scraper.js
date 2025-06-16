const { request } = require('undici');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

class ZillowScraper {
  constructor() {
    this.userAgents = process.env.USER_AGENTS?.split(',') || [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    ];
    
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 1000;
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(url, options = {}) {
    const headers = {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...options.headers
    };

    const response = await request(url, {
      method: options.method || 'GET',
      headers,
      body: options.body
    });

    return response;
  }

  async extractNextData(html) {
    const $ = cheerio.load(html);
    const nextDataScript = $('#__NEXT_DATA__');
    
    if (!nextDataScript.length) {
      throw new Error('__NEXT_DATA__ script not found');
    }

    try {
      return JSON.parse(nextDataScript.html());
    } catch (error) {
      throw new Error('Failed to parse __NEXT_DATA__ JSON');
    }
  }

  async scrapeCincinnatiMultiUnit() {
    console.log('[scraper] Starting Cincinnati multi-unit scrape...');
    
    try {
      // Step 1: Get the search page HTML
      const searchUrl = 'https://www.zillow.com/homes/for_sale/Cincinnati-OH/multi-family_type/';
      console.log('[scraper] Fetching search page:', searchUrl);
      
      const searchResponse = await this.makeRequest(searchUrl);
      const searchHtml = await searchResponse.body.text();
      
      // Step 2: Extract __NEXT_DATA__
      const nextData = await this.extractNextData(searchHtml);
      console.log('[scraper] Extracted search page data');
      
      // Step 3: Get search results from the data
      const searchResults = nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults || [];
      console.log(`[scraper] Found ${searchResults.length} properties`);
      
      if (searchResults.length === 0) {
        console.log('[scraper] No properties found in search results');
        return [];
      }

      // Step 4: Process each property with rate limiting
      const properties = [];
      let successCount = 0;
      let failCount = 0;

      for (const result of searchResults.slice(0, 10)) { // Limit to first 10 for serverless
        try {
          const property = await this.scrapePropertyDetails(result);
          if (property) {
            properties.push(property);
            successCount++;
            console.log(`[scraper] ✓ Scraped: ${property.address}`);
          }
          
          // Rate limiting - wait between requests
          await this.sleep(this.requestDelay);
          
        } catch (error) {
          failCount++;
          console.log(`[scraper] ✗ Failed: ${result.address || 'Unknown'} - ${error.message}`);
        }
      }

      console.log(`[scraper] Complete: success=${successCount} fail=${failCount}`);
      return properties;

    } catch (error) {
      console.error('[scraper] Fatal error:', error);
      throw error;
    }
  }

  async scrapePropertyDetails(listingData) {
    const detailUrl = `https://www.zillow.com${listingData.detailUrl}`;
    
    try {
      // Get property detail page
      const detailResponse = await this.makeRequest(detailUrl);
      const detailHtml = await detailResponse.body.text();
      
      // Extract property data
      const detailNextData = await this.extractNextData(detailHtml);
      const propertyData = detailNextData?.props?.pageProps?.gdpClientCache || {};
      
      // Find the main property object
      const propertyKey = Object.keys(propertyData).find(key => 
        key.includes('Property:') && propertyData[key]?.photos
      );
      
      if (!propertyKey) {
        throw new Error('Property data not found in detail page');
      }
      
      const property = propertyData[propertyKey];
      
      // Process images (simplified for serverless)
      const images = await this.processPropertyImages(property.photos || [], listingData.zpid);
      
      // Build property object
      const propertyObj = {
        id: listingData.zpid?.toString(),
        zillowId: listingData.zpid?.toString(),
        address: listingData.address || property.streetAddress || 'Unknown',
        city: listingData.addressCity || 'Cincinnati',
        state: listingData.addressState || 'OH',
        zipCode: listingData.addressZipcode || property.zipcode,
        latitude: listingData.latLong?.latitude || property.latitude,
        longitude: listingData.latLong?.longitude || property.longitude,
        
        bedrooms: listingData.beds || property.bedrooms || 0,
        bathrooms: listingData.baths || property.bathrooms || 0,
        price: listingData.price ? parseInt(listingData.price.replace(/[^0-9]/g, '')) : null,
        squareFootage: listingData.area || property.livingArea,
        lotSize: property.lotSize,
        yearBuilt: property.yearBuilt,
        propertyType: listingData.propertyType || property.homeType,
        
        zillowUrl: detailUrl,
        zestimate: property.zestimate,
        rentZestimate: property.rentZestimate,
        
        unitCount: this.extractUnitCount(listingData, property),
        isMultiUnit: true,
        
        images: images,
        scrapedAt: new Date().toISOString(),
        isActive: true
      };
      
      return propertyObj;
      
    } catch (error) {
      console.error(`[scraper] Error scraping ${detailUrl}:`, error.message);
      return null;
    }
  }

  extractUnitCount(listingData, propertyData) {
    // Try to extract unit count from various sources
    const description = propertyData.description || '';
    const unitMatch = description.match(/(\d+)\s*unit/i);
    
    if (unitMatch) {
      return parseInt(unitMatch[1]);
    }
    
    // Fallback: estimate based on bedrooms (rough heuristic)
    const bedrooms = listingData.beds || propertyData.bedrooms || 0;
    return bedrooms >= 8 ? Math.floor(bedrooms / 2) : bedrooms >= 4 ? 2 : 1;
  }

  async processPropertyImages(photos, zpid) {
    if (!photos || photos.length === 0) {
      return [];
    }

    const processedImages = [];
    
    // For serverless, we'll just store image URLs instead of downloading
    for (let i = 0; i < Math.min(photos.length, 5); i++) { // Limit to 5 images
      const photo = photos[i];
      const isHero = i === 0;
      
      try {
        const imageUrl = photo.mixedSources?.jpeg?.[0]?.url || photo.url;
        if (!imageUrl) continue;
        
        processedImages.push({
          url: imageUrl,
          localPath: null, // Not downloading in serverless
          fileName: isHero ? 'hero.jpg' : `gallery/${String(i).padStart(2, '0')}_full.jpg`,
          width: photo.width,
          height: photo.height,
          isHero: isHero,
          orderIndex: i,
          altText: `${isHero ? 'Hero' : 'Gallery'} image ${i + 1}`
        });
        
      } catch (error) {
        console.error(`[scraper] Failed to process image ${i}:`, error.message);
      }
    }
    
    return processedImages;
  }

  async savePropertiesToFile(properties) {
    const dataDir = path.join(this.uploadDir, 'data');
    
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const filePath = path.join(dataDir, 'properties.json');
    
    // Load existing data
    let existingData = [];
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        console.error('[scraper] Error reading existing data:', error.message);
      }
    }
    
    // Merge new properties (avoid duplicates by zillowId)
    const existingIds = new Set(existingData.map(p => p.zillowId));
    const newProperties = properties.filter(p => !existingIds.has(p.zillowId));
    
    const updatedData = [...existingData, ...newProperties];
    
    // Save updated data
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
    
    console.log(`[scraper] Saved ${newProperties.length} new properties (${updatedData.length} total)`);
    return updatedData;
  }

  async loadPropertiesFromFile() {
    const filePath = path.join(this.uploadDir, 'data', 'properties.json');
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error('[scraper] Error loading properties:', error.message);
      return [];
    }
  }
}

module.exports = ZillowScraper;
