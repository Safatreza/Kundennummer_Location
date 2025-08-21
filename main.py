from fastapi import FastAPI, Request, File, UploadFile
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import aiohttp
import asyncio
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel
from utils.route_optimizer import RouteOptimizer, Location, Tour
from utils.kml_generator import LocationData, create_kml_response
import uvicorn
import os
from pathlib import Path
import math
import re
import json
import logging
import csv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create static and template directories if they don't exist
STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "js").mkdir(exist_ok=True)
(STATIC_DIR / "css").mkdir(exist_ok=True)
TEMPLATES_DIR = Path("templates")
TEMPLATES_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Kundenstandorte Visualisierung")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Mount static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")

# Templates configuration
templates = Jinja2Templates(directory="templates")
templates.env.globals.update({
    "VERCEL_URL": os.environ.get("VERCEL_URL", "http://127.0.0.1:8000")
})

class Customer(BaseModel):
    kundennummer: str
    adresse: str
    priority: Optional[int] = None
    bottles: Optional[int] = None
    is_depot: Optional[bool] = False

class GeocodingResult(BaseModel):
    kundennummer: str
    adresse: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    error: Optional[str] = None
    priority: Optional[int] = None
    bottles: Optional[int] = None
    is_depot: Optional[bool] = False

# Cache for geocoding results
_geocode_cache: Dict[str, Tuple[float, float]] = {}

def _derive_kundennummer_from_address(address: str) -> str:
    """Create a short identifier from an address when kundennummer is missing."""
    if not address:
        return "UNBEKANNT"
    s = re.sub(r"\s+", "-", address.strip())
    s = re.sub(r"[^A-Za-z0-9ÄÖÜäöüß\-]", "", s)
    return s[:24]

async def geocode_address(session: aiohttp.ClientSession, customer: Customer) -> GeocodingResult:
    """Geocode a single address using Nominatim API"""
    try:
        # Log incoming request
        logger.info(f"Geocoding address: {customer.adresse}")

        # Basic validation
        if not customer.adresse or not customer.adresse.strip():
            logger.warning("Empty address provided")
            return GeocodingResult(
                kundennummer=customer.kundennummer,
                adresse=customer.adresse,
                error="Keine Adresse angegeben"
            )

        # Check cache
        cache_key = customer.adresse.strip().lower()
        if cache_key in _geocode_cache:
            logger.info(f"Cache hit for address: {customer.adresse}")
            lat, lon = _geocode_cache[cache_key]
            return GeocodingResult(
                kundennummer=customer.kundennummer,
                adresse=customer.adresse,
                lat=lat,
                lon=lon,
                priority=customer.priority,
                bottles=customer.bottles,
                is_depot=customer.is_depot
            )

        # Log cache miss
        logger.info(f"Cache miss for address: {customer.adresse}")

        # Prepare geocoding request
        url = "https://nominatim.openstreetmap.org/search"
        address_query = customer.adresse.strip()
        
        # Try different address formats for better geocoding success
        address_variants = [
            address_query,
            address_query + ', Deutschland',
            address_query + ', Germany',
            address_query.replace('Deutschland', 'Germany'),
            address_query.replace('Germany', 'Deutschland')
        ]
        
        # Remove country code restriction to get more results
        params = {
            "format": "json",
            "q": address_query,
            "limit": 3,  # Get more results to find the best match
            "addressdetails": 1
        }
        headers = {
            'User-Agent': 'CustomerLocationVisualization/1.0',
            'Accept-Language': 'de,en'
        }

        # Log request details
        logger.info(f"Sending request to Nominatim: {address_query}")

        # Try multiple address variants if the first one fails
        for variant in address_variants:
            params["q"] = variant
            logger.info(f"Trying address variant: {variant}")
            
            async with session.get(url, params=params, headers=headers) as response:
                status = response.status
                logger.info(f"Nominatim response status: {status}")

                if status == 200:
                    try:
                        data = await response.json()
                        if data and len(data) > 0:
                            # Find the best match (prefer German results)
                            best_match = None
                            for result in data:
                                if result.get('address', {}).get('country') in ['Deutschland', 'Germany']:
                                    best_match = result
                                    break
                            if not best_match and data:
                                best_match = data[0]  # Use first result if no German match
                            
                            if best_match:
                                lat = float(best_match['lat'])
                                lon = float(best_match['lon'])
                                logger.info(f"Found coordinates: {lat}, {lon} for variant: {variant}")
                                _geocode_cache[cache_key] = (lat, lon)
                                return GeocodingResult(
                                    kundennummer=customer.kundennummer,
                                    adresse=customer.adresse,
                                    lat=lat,
                                    lon=lon,
                                    priority=customer.priority,
                                    bottles=customer.bottles,
                                    is_depot=customer.is_depot
                                )
                    except Exception as e:
                        logger.error(f"Error parsing response for variant {variant}: {str(e)}")
                        continue
                elif status == 429:
                    logger.error("Rate limit exceeded")
                    return GeocodingResult(
                        kundennummer=customer.kundennummer,
                        adresse=customer.adresse,
                        error="Rate limit erreicht. Bitte warten Sie einen Moment."
                    )
                else:
                    logger.warning(f"Status {status} for variant {variant}, trying next...")
                    continue
        
        # If all variants failed
        logger.warning(f"No results found for any address variant: {customer.adresse}")
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error="Adresse nicht gefunden"
        )

    except asyncio.TimeoutError:
        logger.error(f"Timeout while geocoding: {customer.adresse}")
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error="Zeitüberschreitung bei der Anfrage"
        )
    except Exception as e:
        logger.error(f"Error geocoding address {customer.adresse}: {str(e)}")
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error=f"Fehler: {str(e)}"
        )

@app.get("/debug")
async def debug_page(request: Request):
    """Debug page to test JavaScript functionality"""
    return templates.TemplateResponse(
        "debug.html", 
        {"request": request}
    )

@app.get("/")
async def home(request: Request):
    """Render the main page"""
    return templates.TemplateResponse(
        "index.html", 
        {"request": request}
    )

@app.post("/export-kml")
async def export_to_kml(locations: List[LocationData]):
    """Export geocoded locations to KML format for Google Maps"""
    return create_kml_response(locations)

# Input model for optimization (accepts optional lat/lon from the frontend)
class InputLocation(BaseModel):
    kundennummer: Optional[str] = None
    adresse: str
    priority: Optional[int] = None
    bottles: Optional[int] = None
    is_depot: Optional[bool] = False
    lat: Optional[float] = None
    lon: Optional[float] = None

@app.post("/geocode")
async def geocode_addresses(customers: List[Customer]):
    """Geocode multiple addresses with gentle rate limiting"""
    logger.info(f"Received geocoding request for {len(customers)} addresses")
    results: List[GeocodingResult] = []
    
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for customer in customers:
                try:
                    if len(results) > 0:
                        await asyncio.sleep(1)  # Rate limiting
                    result = await geocode_address(session, customer)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error processing customer {customer.kundennummer}: {str(e)}")
                    results.append(GeocodingResult(
                        kundennummer=customer.kundennummer,
                        adresse=customer.adresse,
                        error=f"Verarbeitungsfehler: {str(e)}"
                    ))
        
        logger.info(f"Completed geocoding request with {len(results)} results")
        return {"results": results}
    
    except Exception as e:
        logger.error(f"Error in geocode_addresses: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Server-Fehler: {str(e)}",
                "results": results
            }
        )

class RouteOptimizationRequest(BaseModel):
    locations: List[InputLocation]
    force_return_to_hq: bool = False

@app.post("/optimize-route")
async def optimize_route(request: RouteOptimizationRequest):
    """Optimize delivery route for multiple locations.

    This endpoint accepts locations with optional lat/lon. If lat/lon are missing
    the server will geocode them using the same `geocode_address` helper.
    """
    try:
        logger.info(f"Received route optimization request for {len(request.locations)} locations")

        if not request.locations:
            return JSONResponse(
                status_code=400,
                content={"error": "Keine Standorte für die Routenoptimierung angegeben"}
            )

        # Prepare aiohttp session for any server-side geocoding
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            processed_locations: List[Location] = []
            for inp in request.locations:
                # If lat/lon provided, use them directly
                if inp.lat is not None and inp.lon is not None:
                    loc = Location(
                        kundennummer=inp.kundennummer or _derive_kundennummer_from_address(inp.adresse),
                        adresse=inp.adresse,
                        lat=float(inp.lat),
                        lon=float(inp.lon),
                        priority=inp.priority,
                        bottles=inp.bottles or 0,
                        is_depot=inp.is_depot or False
                    )
                else:
                    # Geocode on server
                    geo_req = Customer(
                        kundennummer=inp.kundennummer or _derive_kundennummer_from_address(inp.adresse),
                        adresse=inp.adresse,
                        priority=inp.priority,
                        bottles=inp.bottles,
                        is_depot=inp.is_depot or False
                    )
                    geores = await geocode_address(session, geo_req)
                    if geores.error or geores.lat is None or geores.lon is None:
                        logger.warning(f"Skipping location due to geocoding error: {inp.adresse} -> {geores.error}")
                        continue
                    loc = Location(
                        kundennummer=geores.kundennummer,
                        adresse=geores.adresse,
                        lat=geores.lat,
                        lon=geores.lon,
                        priority=geores.priority,
                        bottles=geores.bottles or 0,
                        is_depot=geores.is_depot or False
                    )
                processed_locations.append(loc)

        if not processed_locations:
            return JSONResponse(
                status_code=400,
                content={"error": "Keine gültigen Standorte nach der Geocodierung gefunden"}
            )

        optimizer = RouteOptimizer()
        tours = optimizer.optimize_route(
            locations=processed_locations,
            force_return_to_hq=request.force_return_to_hq
        )

        # Serialize tours into JSON-safe structure
        serialized = []
        for tour in tours:
            stops = []
            for stop in tour.stops:
                stops.append({
                    "kundennummer": stop.kundennummer,
                    "adresse": stop.adresse,
                    "lat": stop.lat,
                    "lon": stop.lon,
                    "sequence": getattr(stop, 'sequence', 0),
                    "priority": stop.priority,
                    "bottles": stop.bottles,
                    "is_depot": stop.is_depot
                })
            serialized.append({
                "stops": stops,
                "total_bottles": tour.total_bottles,
                "total_distance": round(tour.total_distance, 2),
                "total_time": tour.total_time
            })

        return {"tours": serialized}

    except Exception as e:
        logger.error(f"Error in route optimization: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Fehler bei der Routenoptimierung: {str(e)}"}
        )

@app.post("/manual-entry")
async def manual_entry(customers: List[Customer]):
    """Manually add customer data."""
    logger.info(f"Received manual entry for {len(customers)} customers")
    return {"message": "Customers added successfully", "data": customers}

@app.post("/import-csv")
async def import_csv(file: UploadFile = File(...)):
    """Import customer data from a CSV file"""
    logger.info("Received request to import CSV file")
    
    try:
        contents = await file.read()
        decoded_contents = contents.decode('utf-8-sig')
        reader = csv.DictReader(decoded_contents.splitlines())
        
        customers = []
        for row in reader:
            try:
                customer = Customer(
                    kundennummer=row["kundennummer"],
                    adresse=row["adresse"],
                    priority=int(row["priority"]) if row.get("priority") else None,
                    bottles=int(row["bottles"]) if row.get("bottles") else None,
                    is_depot=row.get("is_depot", "").lower() == "true"
                )
                customers.append(customer)
            except Exception as e:
                logger.warning(f"Skipping invalid row {row}: {str(e)}")
        
        logger.info(f"Successfully imported {len(customers)} customers from CSV")
        return {"message": "CSV import successful", "data": customers}
    
    except Exception as e:
        logger.error(f"Error importing CSV file: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Fehler beim Importieren der CSV-Datei: {str(e)}"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
