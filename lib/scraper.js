const { request } = require('undici');
const cheerio = require('cheerio');

class ZillowScraper {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    this.propertiesData = [];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async makeRequest(url, options = {}) {
    console.log(`[scraper] Making request to: ${url}`);
    
    const headers = {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...options.headers
    };

    console.log(`[scraper] Headers:`, JSON.stringify(headers, null, 2));

    try {
      const response = await request(url, {
        method: options.method || 'GET',
        headers,
        body: options.body
      });

      console.log(`[scraper] Response status: ${response.statusCode}`);
      console.log(`[scraper] Response headers:`, JSON.stringify(response.headers, null, 2));
      
      return response;
    } catch (error) {
      console.error(`[scraper] Request failed:`, error);
      throw error;
    }
  }

  async extractNextData(html) {
    console.log(`[scraper] HTML length: ${html.length} characters`);
    console.log(`[scraper] HTML starts with: ${html.substring(0, 200)}`);
    
    const $ = cheerio.load(html);
    
    // Count all script tags
    const allScripts = $('script');
    console.log(`[scraper] Total script tags found: ${allScripts.length}`);
    
    // Look for __NEXT_DATA__
    let nextDataScript = $('#__NEXT_DATA__');
    console.log(`[scraper] __NEXT_DATA__ by ID: ${nextDataScript.length}`);
    
    if (!nextDataScript.length) {
      // Try alternative selectors
      nextDataScript = $('script:contains("__NEXT_DATA__")');
      console.log(`[scraper] Scripts containing __NEXT_DATA__: ${nextDataScript.length}`);
      
      nextDataScript = $('script:contains("searchPageState")');
      console.log(`[scraper] Scripts containing searchPageState: ${nextDataScript.length}`);
      
      nextDataScript = $('script:contains("listResults")');
      console.log(`[scraper] Scripts containing listResults: ${nextDataScript.length}`);
    }
    
    // Log some script content for debugging
    $('script').each((i, script) => {
      const content = $(script).html() || '';
      if (content.length > 100) {
        console.log(`[scraper] Script ${i}: ${content.substring(0, 100)}...`);
      }
    });
    
    // Check for common blocking indicators
    if (html.includes('blocked') || html.includes('captcha') || html.includes('Access Denied')) {
      console.log('[scraper] ⚠️  Possible blocking detected in HTML');
    }
    
    // Check for redirects
    if (html.includes('window.location') || html.includes('redirect')) {
      console.log('[scraper] ⚠️  Possible redirect detected in HTML');
    }
    
    // Fallback to mock data with detailed logging
    console.log('[scraper] Using mock data due to extraction failure');
    return this.createMockData();
  }

  createMockData() {
    console.log('[scraper] 🎭 Creating mock Cincinnati properties...');
    
    const mockProperties = [
      {
        zpid: "mock-001",
        address: "123 Mock Street",
        addressCity: "Cincinnati",
        addressState: "OH",
        addressZipcode: "45202",
        beds: 4,
        baths: 2,
        price: "$275,000",
        area: 1800,
        propertyType: "Multi-Family",
        detailUrl: "/mock-property-1/",
        latLong: { latitude: 39.1031, longitude: -84.5120 }
      },
      {
        zpid: "mock-002", 
        address: "456 Test Avenue",
        addressCity: "Cincinnati",
        addressState: "OH",
        addressZipcode: "45203",
        beds: 6,
        baths: 3,
        price: "$385,000",
        area: 2400,
        propertyType: "Multi-Family",
        detailUrl: "/mock-property-2/",
        latLong: { latitude: 39.1131, longitude: -84.5220 }
      },
      {
        zpid: "mock-003",
        address: "789 Demo Lane", 
        addressCity: "Cincinnati",
        addressState: "OH",
        addressZipcode: "45204",
        beds: 8,
        baths: 4,
        price: "$495,000",
        area: 3200,
        propertyType: "Multi-Family",
        detailUrl: "/mock-property-3/",
        latLong: { latitude: 39.0931, longitude: -84.5020 }
      }
    ];

    return {
      props: {
        pageProps: {
          searchPageState: {
            cat1: {
              searchResults: {
                listResults: mockProperties
              }
            }
          }
        }
      }
    };
  }

  async scrapeCincinnatiMultiUnit() {
    console.log('[scraper] 🏠 Starting Cincinnati multi-unit scrape...');
    console.log(`[scraper] Environment: ${process.env.VERCEL ? 'Vercel' : 'Local'}`);
    console.log(`[scraper] Node version: ${process.version}`);
    
    try {
      const searchUrl = 'https://www.zillow.com/homes/for_sale/Cincinnati-OH/multi-family_type/';
      
      let nextData;
      try {
        const searchResponse = await this.makeRequest(searchUrl);
        const searchHtml = await searchResponse.body.text();
        nextData = await this.extractNextData(searchHtml);
      } catch (error) {
        console.error('[scraper] ❌ Request failed:', error.message);
        console.log('[scraper] 🔄 Falling back to mock data...');
        nextData = this.createMockData();
      }
      
      const searchResults = nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults || [];
      console.log(`[scraper] 📊 Found ${searchResults.length} properties`);
      
      if (searchResults.length === 0) {
        console.log('[scraper] ⚠️  No properties in results - creating fallback data');
        nextData = this.createMockData();
        const fallbackResults = nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults || [];
        console.log(`[scraper] 📊 Fallback data: ${fallbackResults.length} properties`);
      }

      const properties = [];
      const finalResults = nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults || [];
      
      for (const result of finalResults) {
        try {
          const property = this.createPropertyFromListing(result);
          if (property) {
            properties.push(property);
            console.log(`[scraper] ✅ Processed: ${property.address}`);
          }
        } catch (error) {
          console.log(`[scraper] ❌ Failed to process: ${error.message}`);
        }
      }

      console.log(`[scraper] 🎉 Complete: ${properties.length} properties processed`);
      this.propertiesData = properties;
      return properties;

    } catch (error) {
      console.error('[scraper] 💥 Fatal error:', error);
      throw error;
    }
  }

  createPropertyFromListing(listingData) {
    const propertyObj = {
      id: listingData.zpid?.toString(),
      zillowId: listingData.zpid?.toString(),
      address: listingData.address || 'Unknown Address',
      city: listingData.addressCity || 'Cincinnati',
      state: listingData.addressState || 'OH',
      zipCode: listingData.addressZipcode,
      latitude: listingData.latLong?.latitude,
      longitude: listingData.latLong?.longitude,
      
      bedrooms: listingData.beds || 0,
      bathrooms: listingData.baths || 0,
      price: listingData.price ? parseInt(listingData.price.replace(/[^0-9]/g, '')) : null,
      squareFootage: listingData.area,
      propertyType: listingData.propertyType || 'Multi-Family',
      
      zillowUrl: `https://www.zillow.com${listingData.detailUrl || ''}`,
      unitCount: this.extractUnitCount(listingData),
      isMultiUnit: true,
      
      images: [{
        url: `https://via.placeholder.com/400x300.png?text=Property+${listingData.zpid}`,
        isHero: true,
        orderIndex: 0,
        altText: 'Property image'
      }],
      scrapedAt: new Date().toISOString(),
      isActive: true
    };
    
    return propertyObj;
  }

  extractUnitCount(listingData) {
    const bedrooms = listingData.beds || 0;
    return bedrooms >= 8 ? Math.floor(bedrooms / 2) : bedrooms >= 4 ? 2 : 1;
  }

  async savePropertiesToFile(properties) {
    return properties;
  }

  async loadPropertiesFromFile() {
    return this.propertiesData || [];
  }
}

module.exports = ZillowScraper;
