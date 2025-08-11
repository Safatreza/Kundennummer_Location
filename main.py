from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import aiohttp
import asyncio
from typing import List, Optional
from pydantic import BaseModel
import uvicorn
import os
from pathlib import Path

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

class GeocodingResult(BaseModel):
    kundennummer: str
    adresse: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    error: Optional[str] = None

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
                        lon=float(data[0]['lon'])
                    )
            
            return GeocodingResult(
                kundennummer=customer.kundennummer,
                adresse=customer.adresse,
                error="Adresse nicht gefunden"
            )
            
    except asyncio.TimeoutError:
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error="Zeitüberschreitung bei der Anfrage"
        )
    except Exception as e:
        return GeocodingResult(
            kundennummer=customer.kundennummer,
            adresse=customer.adresse,
            error=f"Ein Fehler ist aufgetreten: {str(e)}"
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
    """Geocode multiple addresses"""
    async with aiohttp.ClientSession() as session:
        tasks = []
        for customer in customers:
            # Add delay between requests to respect rate limits
            if tasks:
                await asyncio.sleep(1)
            tasks.append(geocode_address(session, customer))
        
        results = await asyncio.gather(*tasks)
        return {"results": results}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
