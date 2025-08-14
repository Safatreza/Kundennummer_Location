from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import aiohttp
import asyncio
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel
import uvicorn
import os
from pathlib import Path
import math

# Create static and template directories if they don't exist
STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "js").mkdir(exist_ok=True)
(STATIC_DIR / "css").mkdir(exist_ok=True)
TEMPLATES_DIR = Path("templates")
TEMPLATES_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Kundenstandorte Visualisierung")

# Configure CORS with specific settings for Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Mount static files with custom config
app.mount("/static", StaticFiles(directory="static", html=True), name="static")

# Templates with absolute path
templates = Jinja2Templates(directory="templates")
templates.env.globals.update({
    "VERCEL_URL": os.environ.get("VERCEL_URL", "http://localhost:8000")
})

class Customer(BaseModel):
    kundennummer: str
    adresse: str
    priority: Optional[int] = None  # 1..N; None => flexible
    bottles: Optional[int] = None   # Optional demand
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

# Depot configuration
HQ_ADDRESS: str = "Robert-Koch-Straße 2, 82152 Planegg"
_cached_depot_coords: Optional[Tuple[float, float]] = None

async def geocode_address(session: aiohttp.ClientSession, customer: Customer) -> GeocodingResult:
    """Geocode a single address using Nominatim API"""
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "format": "json",
            "q": customer.adresse,
            "limit": 1,
            "addressdetails": 1
        }
        headers = {
            'User-Agent': 'CustomerLocationVisualization/1.0',
            'Accept-Language': 'de,en'
        }
        
        async with session.get(url, params=params, headers=headers, timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                if data and len(data) > 0:
                    return GeocodingResult(
                        kundennummer=customer.kundennummer,
                        adresse=customer.adresse,
                        lat=float(data[0]['lat']),
                        lon=float(data[0]['lon']),
                        priority=customer.priority,
                        bottles=customer.bottles,
                        is_depot=customer.is_depot,
                    )
            
            return GeocodingResult(
                kundennummer=customer.kundennummer,
                adresse=customer.adresse,
                error="Adresse nicht gefunden",
                priority=customer.priority,
                bottles=customer.bottles,
                is_depot=customer.is_depot,
            )
            
    except asyncio.TimeoutError:
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error="Zeitüberschreitung bei der Anfrage",
            priority=customer.priority,
            bottles=customer.bottles,
            is_depot=customer.is_depot,
        )
    except Exception as e:
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error=f"Ein Fehler ist aufgetreten: {str(e)}",
            priority=customer.priority,
            bottles=customer.bottles,
            is_depot=customer.is_depot,
        )

@app.get("/")
async def home(request: Request):
    """Render the main page"""
    return templates.TemplateResponse(
        "index.html", 
        {"request": request}
    )

@app.post("/geocode")
async def geocode_addresses(customers: List[Customer]):
    """Geocode multiple addresses with gentle rate limiting."""
    print(f"Received customers: {customers}")  # Debug logging
    results: List[GeocodingResult] = []
    async with aiohttp.ClientSession() as session:
        for idx, customer in enumerate(customers):
            if idx > 0:
                await asyncio.sleep(1)
            result = await geocode_address(session, customer)
            results.append(result)
    return {"results": results}

@app.post("/geocode-single")
async def geocode_single_address(customer: Customer):
    """Geocode a single address - useful for testing"""
    async with aiohttp.ClientSession() as session:
        result = await geocode_address(session, customer)
        return {"result": result}


# ---------- Route Planning ----------

class Stop(BaseModel):
    kundennummer: str
    adresse: str
    lat: float
    lon: float
    priority: Optional[int] = None
    bottles: Optional[int] = None
    is_depot: Optional[bool] = False

class RoutePlanRequest(BaseModel):
    stops: List[Stop]
    capacity: int = 80

class RouteStep(BaseModel):
    order: int
    kundennummer: str
    adresse: str
    lat: float
    lon: float
    is_depot: bool = False
    priority: Optional[int] = None
    bottles: Optional[int] = None

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def _nearest_neighbor_order(points: List[Stop], start_lat: float, start_lon: float) -> List[Stop]:
    if not points:
        return []
    remaining = points.copy()
    ordered: List[Stop] = []
    current_lat, current_lon = start_lat, start_lon
    while remaining:
        nearest_idx = 0
        nearest_dist = float("inf")
        for idx, p in enumerate(remaining):
            d = _haversine_km(current_lat, current_lon, p.lat, p.lon)
            if d < nearest_dist:
                nearest_dist = d
                nearest_idx = idx
        nxt = remaining.pop(nearest_idx)
        ordered.append(nxt)
        current_lat, current_lon = nxt.lat, nxt.lon
    return ordered

async def _get_depot_coords() -> Tuple[float, float]:
    global _cached_depot_coords
    if _cached_depot_coords is not None:
        return _cached_depot_coords
    async with aiohttp.ClientSession() as session:
        result = await geocode_address(session, Customer(kundennummer="DEPOT", adresse=HQ_ADDRESS))
        if result.lat is None or result.lon is None:
            # Fallback to Planegg approximate center if geocoding fails
            _cached_depot_coords = (48.106, 11.425)
        else:
            _cached_depot_coords = (result.lat, result.lon)
    return _cached_depot_coords

def _split_by_priority(stops: List[Stop]) -> Dict[str, List[Stop]]:
    buckets: Dict[str, List[Stop]] = {"flex": []}
    for s in stops:
        if s.priority is None:
            buckets["flex"].append(s)
        else:
            key = str(s.priority)
            buckets.setdefault(key, []).append(s)
    return buckets

def _apply_capacity_and_build_route(segments: List[List[Stop]], depot_lat: float, depot_lon: float, capacity: int) -> List[Stop]:
    route: List[Stop] = []
    current_lat, current_lon = depot_lat, depot_lon
    current_load = 0
    # Helper to append a depot stop
    def append_depot():
        route.append(Stop(kundennummer="DEPOT", adresse=HQ_ADDRESS, lat=depot_lat, lon=depot_lon, is_depot=True))
    # Start at depot
    append_depot()
    for seg in segments:
        ordered = _nearest_neighbor_order(seg, current_lat, current_lon)
        for s in ordered:
            demand = max(0, int(s.bottles)) if s.bottles is not None else 0
            if current_load + demand > capacity:
                # Return to depot to reset load
                append_depot()
                current_lat, current_lon = depot_lat, depot_lon
                current_load = 0
            route.append(s)
            current_lat, current_lon = s.lat, s.lon
            current_load += demand
    # End at depot
    append_depot()
    return route

@app.post("/route-plan")
async def route_plan(req: RoutePlanRequest):
    """Compute a route plan respecting priorities and vehicle capacity."""
    if not req.stops:
        return {"route": []}

    # Determine depot
    provided_depots = [s for s in req.stops if s.is_depot]
    if provided_depots:
        depot_lat, depot_lon = provided_depots[0].lat, provided_depots[0].lon
    else:
        depot_lat, depot_lon = await _get_depot_coords()

    # Split by explicit depot boundaries (user-added depot rows)
    chunks: List[List[Stop]] = []
    current_chunk: List[Stop] = []
    for s in req.stops:
        if s.is_depot:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = []
        else:
            current_chunk.append(s)
    if current_chunk:
        chunks.append(current_chunk)

    # If no chunks (only depots provided), return just start/end depot
    if not chunks:
        route_stops: List[Stop] = [Stop(kundennummer="DEPOT", adresse=HQ_ADDRESS, lat=depot_lat, lon=depot_lon, is_depot=True)]
        route_stops.append(Stop(kundennummer="DEPOT", adresse=HQ_ADDRESS, lat=depot_lat, lon=depot_lon, is_depot=True))
    else:
        full_route: List[Stop] = []
        is_first_chunk = True
        for chunk in chunks:
            # Group this chunk by priority
            buckets = _split_by_priority(chunk)
            numeric_priorities = sorted([int(k) for k in buckets.keys() if k != "flex" and k.isdigit()])
            segments: List[List[Stop]] = []
            for p in numeric_priorities:
                segments.append(buckets.get(str(p), []))
            segments.append(buckets.get("flex", []))

            # Build route for this chunk; this will add start and end depot
            chunk_route = _apply_capacity_and_build_route(segments, depot_lat, depot_lon, req.capacity)
            if is_first_chunk:
                full_route.extend(chunk_route)
                is_first_chunk = False
            else:
                # Avoid duplicate depot at junction: drop first element (start depot) of chunk_route
                if chunk_route:
                    full_route.extend(chunk_route[1:])
        route_stops = full_route

    steps: List[RouteStep] = []
    for idx, s in enumerate(route_stops, start=1):
        steps.append(RouteStep(
            order=idx,
            kundennummer=s.kundennummer,
            adresse=s.adresse,
            lat=s.lat,
            lon=s.lon,
            is_depot=bool(s.is_depot),
            priority=s.priority,
            bottles=s.bottles,
        ))
    return {"route": steps}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
