# 🏠 Zillow Scraper - Zero Puppeteer Edition

A serverless Zillow property scraper that runs on Vercel without browser dependencies. Uses vanilla HTTP requests to extract property data from Cincinnati, OH multi-unit homes.

## ✨ Features

- **No Browser Dependencies** - Uses HTTP requests instead of Puppeteer
- **Serverless Ready** - Designed for Vercel with 10-second timeout limits
- **Anti-Detection** - Randomized user agents and request throttling
- **Image Storage** - Downloads and serves property images locally
- **RESTful API** - Clean endpoints for property data and search
- **Free Deployment** - Runs entirely on Vercel's free tier

## 🚀 Quick Deploy to Vercel

### 1. Clone & Setup
```bash
git clone <your-repo-url>
cd zillow-scraper-vercel
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your settings (defaults work fine)
```

### 3. Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 4. Test Your API
```bash
# Check API status
curl https://your-app.vercel.app/

# Trigger scraping
curl -X POST https://your-app.vercel.app/api/scrape

# Get properties
curl https://your-app.vercel.app/api/props
```

## 📡 API Endpoints

### Core Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API information and stats |
| `POST` | `/api/scrape` | Trigger scraping job |
| `GET` | `/api/props` | List properties (paginated) |
| `GET` | `/api/props/[id]` | Property details |
| `GET` | `/api/stats` | System statistics |

### Query Parameters for `/api/props`
```
?page=1&pageSize=20&bedrooms=4&bathrooms=2&priceMin=100000&priceMax=500000&city=Cincinnati&state=OH
```

### Image Access
Property images are served at:
```
/uploads/properties/{zpid}/hero.jpg
/uploads/properties/{zpid}/gallery/01_full.jpg
```

## 🔧 Configuration

### Environment Variables
```bash
# Storage
UPLOAD_DIR=./uploads

# Scraping behavior
MAX_CONCURRENT_REQUESTS=2
REQUEST_DELAY=1000
MAX_RETRIES=3

# Anti-detection (comma-separated user agents)
USER_AGENTS="Mozilla/5.0 (Windows NT 10.0...),...""
```

### Vercel Settings
The `vercel.json` includes:
- **Cron Jobs** - Daily scraping at 2 AM UTC
- **Route Handling** - Image serving and API routing
- **Function Timeouts** - 10 second limit per function

## 🛠 How It Works

### 1. Data Extraction Method
Instead of using a browser, this scraper:

1. **Fetches HTML** from Zillow search pages
2. **Extracts JSON** from `<script id="__NEXT_DATA__">` tags
3. **Parses property data** directly from Zillow's internal API responses
4. **Downloads images** using direct HTTP requests

### 2. Anti-Detection Strategy
- Randomized user agents
- Request throttling (2 concurrent max)
- Exponential backoff on errors
- Realistic request headers

### 3. Storage System
```
uploads/
├── properties/
│   └── {zpid}/
│       ├── hero.jpg
│       └── gallery/
│           ├── 01_full.jpg
│           └── 02_full.jpg
└── data/
    └── properties.json
```

## 📊 Data Structure

### Property Object
```json
{
  "id": "123456789",
  "zillowId": "123456789",
  "address": "123 Main St",
  "city": "Cincinnati",
  "state": "OH",
  "bedrooms": 4,
  "bathrooms": 2,
  "price": 250000,
  "squareFootage": 2000,
  "unitCount": 2,
  "zillowUrl": "https://zillow.com/...",
  "images": [...],
  "scrapedAt": "2025-01-15T10:30:00Z"
}
```

## 🚨 Important Notes

### Vercel Limitations
- **10-second timeout** per function call
- **Ephemeral storage** - files reset on deployment
- **No background jobs** - uses cron triggers instead

### Data Persistence
- Properties saved to `/uploads/data/properties.json`
- Images stored in `/uploads/properties/`
- Data persists between function calls but **not deployments**
- Consider adding database for production use

### Rate Limiting
- Max 2 concurrent requests to Zillow
- 1-second delay between requests
- Built-in retry logic with backoff

## 🔍 Frontend Integration

### Fetch Properties
```javascript
const response = await fetch('/api/props?page=1&pageSize=10');
const data = await response.json();

data.data.forEach(property => {
  console.log(property.address, property.heroImage);
});
```

### Get Property Details
```javascript
const response = await fetch(`/api/props/${propertyId}`);
const property = await response.json();

// Access all images
property.data.images.forEach(image => {
  console.log(image.localPath); // /uploads/properties/123/hero.jpg
});
```

### Trigger Scraping
```javascript
const response = await fetch('/api/scrape', {
  method: 'POST'
});
const result = await response.json();
console.log(`Scraped ${result.data.newProperties} properties`);
```

## 🚀 Production Considerations

### For High-Volume Usage
1. **Add Database** - Replace JSON storage with PostgreSQL/MongoDB
2. **External Storage** - Use AWS S3/Cloudinary for images
3. **Queue System** - Add Redis/Bull for job management
4. **Monitoring** - Implement error tracking and metrics

### Scaling Options
- **Railway/Render** - For persistent storage and longer timeouts
- **Digital Ocean Apps** - For more control and resources
- **AWS Lambda** - For advanced serverless features

## 📝 License

MIT License - Feel free to modify and distribute.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Note**: This scraper is for educational purposes. Always respect website terms of service and rate limits.