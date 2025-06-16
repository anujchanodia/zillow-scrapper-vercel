// Simple in-memory data store for serverless functions
let propertiesCache = [];

module.exports = {
  setProperties: (properties) => {
    propertiesCache = properties;
    console.log(`[dataStore] Stored ${properties.length} properties`);
  },
  
  getProperties: () => {
    console.log(`[dataStore] Retrieved ${propertiesCache.length} properties`);
    return propertiesCache;
  },
  
  findProperty: (id) => {
    const property = propertiesCache.find(p => p.id === id || p.zillowId === id);
    console.log(`[dataStore] Looking for property ${id}: ${property ? 'found' : 'not found'}`);
    return property;
  },
  
  clearProperties: () => {
    propertiesCache = [];
    console.log('[dataStore] Cleared all properties');
  }
};
