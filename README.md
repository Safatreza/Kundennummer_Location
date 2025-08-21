# 🚛 Route Optimizer - AboutWater GmbH

A professional route optimization system for delivery planning with interactive maps, built with FastAPI and modern web technologies.

<!-- Deployment Trigger: Update for Vercel Production -->

## ✨ Features

- **Interactive Map Interface** - Built with Leaflet.js and OpenStreetMap
- **Route Optimization** - Nearest neighbor algorithm for efficient delivery routes
- **Google Maps Integration** - Export optimized routes to Google Maps
- **CSV Import/Export** - Bulk customer data management
- **Priority & Bottles Management** - Customer-specific delivery requirements
- **Responsive Design** - Works on desktop and mobile devices
- **Professional UI** - Clean, modern interface built with Bootstrap 5

## 🏗️ Technology Stack

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.8+** - Core programming language
- **Pydantic** - Data validation and settings management
- **aiohttp** - Asynchronous HTTP client/server

### Frontend
- **HTML5/CSS3** - Semantic markup and modern styling
- **JavaScript (ES6+)** - Interactive functionality
- **Bootstrap 5** - Responsive UI framework
- **Leaflet.js** - Interactive maps library

### External Services
- **OpenStreetMap** - Free map tiles and geocoding
- **Nominatim** - Address geocoding service
- **Google Maps** - Route export functionality

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/route-optimizer.git
   cd route-optimizer
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   python main.py
   ```

5. **Open your browser**
   Navigate to `http://localhost:8000`

## 📖 Usage

### Adding Customer Locations

1. **Manual Entry**
   - Enter customer number (optional)
   - Input full address
   - Set priority level (1-4)
   - Specify number of bottles
   - Click "Add to Map"

2. **CSV Import**
   - Prepare CSV file with columns: `kundennummer,adresse,priority,bottles,is_depot`
   - Upload file via the CSV Import section
   - System automatically geocodes all addresses

### Route Optimization

1. **Add multiple customer locations** to the map
2. **Click "Optimize Route"** to run the algorithm
3. **View optimized route** with red line connecting all stops
4. **Check route information** in the Route Information panel

### Google Maps Export

1. **Optimize a route** first
2. **Click "Export to Google Maps"**
3. **Route opens in Google Maps** with all waypoints
4. **Get real-time traffic** and turn-by-turn navigation

## 🗺️ Route Algorithm

The system uses a **Nearest Neighbor algorithm**:

1. **Start at Planegg HQ** (always the depot)
2. **Find closest customer** to current location
3. **Move to that customer**
4. **Repeat** until all customers visited
5. **Return to Planegg HQ**

This ensures efficient delivery routes while maintaining simplicity and reliability.

## 📁 Project Structure

```
route-optimizer/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── static/                # Static assets
│   ├── css/
│   │   └── styles.css     # Custom styles
│   └── js/
│       └── app_fixed.js   # Frontend JavaScript
├── templates/             # HTML templates
│   └── index.html         # Main application page
├── utils/                 # Utility modules
│   ├── kml_generator.py   # KML export functionality
│   └── route_optimizer.py # Route optimization algorithm
└── tests/                 # Test files
    ├── test_api.py        # API endpoint tests
    └── run_smoke.py       # Smoke tests
```

## 🌐 API Endpoints

### POST `/geocode`
Geocode addresses to coordinates
```json
{
  "addresses": [
    {
      "kundennummer": "K001",
      "adresse": "München, Deutschland"
    }
  ]
}
```

### POST `/optimize-route`
Optimize delivery route
```json
{
  "locations": [
    {
      "kundennummer": "HQ",
      "adresse": "Planegg, Deutschland",
      "lat": 48.1067,
      "lon": 11.4247,
      "is_depot": true
    }
  ],
  "force_return_to_hq": true
}
```

## 🚀 Deployment

### Vercel Deployment

1. **Connect GitHub repository** to Vercel
2. **Set build settings**:
   - Build Command: `pip install -r requirements.txt`
   - Output Directory: `.`
   - Install Command: `pip install -r requirements.txt`
3. **Deploy** - Vercel automatically builds and deploys

### Environment Variables

Set these in your Vercel dashboard:
- `PYTHON_VERSION`: `3.9` (or your preferred version)

### Custom Domain

Configure your custom domain in Vercel dashboard for professional branding.

## 🧪 Testing

Run the test suite:
```bash
# Run all tests
python -m pytest tests/

# Run smoke tests
python tests/run_smoke.py

# Run specific test file
python tests/test_api.py
```

## 🔧 Configuration

### HQ Location
The default HQ location is set to Planegg, Deutschland. To change this:

1. **Edit `static/js/app_fixed.js`**
2. **Update `HQ_LOCATION` constant**
3. **Modify coordinates and address**

### Map Settings
Customize map behavior in `static/js/app_fixed.js`:
- Default zoom level
- Map center coordinates
- Marker styles

## 📊 Performance

- **Geocoding**: ~1 second per address (with rate limiting)
- **Route Optimization**: Instant for up to 100 locations
- **Map Rendering**: Smooth 60fps interaction
- **Mobile Performance**: Optimized for mobile devices

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Email**: support@aboutwater-gmbh.de
- **Issues**: [GitHub Issues](https://github.com/yourusername/route-optimizer/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/route-optimizer/wiki)

## 🙏 Acknowledgments

- **OpenStreetMap** for free map tiles
- **Nominatim** for geocoding services
- **Leaflet.js** for interactive maps
- **Bootstrap** for responsive UI components
- **FastAPI** for modern Python web framework

---

**Built with ❤️ by AboutWater GmbH**

*Optimizing delivery routes, one address at a time.*
