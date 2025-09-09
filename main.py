"""
aboutwater Route Optimizer - Modern FastAPI Application
Version 3.0.1 - Professional Route Optimization System
"""
import logging
import uuid
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn

from app.config import settings
from app.api.routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Generate unique server ID
SERVER_ID = str(uuid.uuid4())[:8].upper()
SERVER_START_TIME = datetime.now()

# Create directories
(Path(__file__).parent / "static").mkdir(exist_ok=True)
(Path(__file__).parent / "templates").mkdir(exist_ok=True)

# Lifespan handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")
    logger.info(f"📍 HQ Location: {settings.HQ_ADDRESS}")
    logger.info(f"🆔 Server ID: {SERVER_ID}")
    logger.info(f"🌐 Environment: {settings.ENVIRONMENT}")
    logger.info(f"🔧 Max bottles per trip: {settings.MAX_BOTTLES_PER_TRIP}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down aboutwater Route Optimizer")

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    lifespan=lifespan,
    contact={
        "name": "aboutwater GmbH",
        "url": "https://aboutwater.com"
    },
    license_info={
        "name": "Proprietary",
        "url": "https://aboutwater.com/license"
    }
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Include API routes
app.include_router(router, prefix="/api/v1")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main application page"""
    return templates.TemplateResponse("index.html", {
        "request": request,
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "server_id": SERVER_ID
    })

@app.get("/server-info")
async def get_server_info():
    """Get server information"""
    uptime = datetime.now() - SERVER_START_TIME
    return {
        "server_id": SERVER_ID,
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "start_time": SERVER_START_TIME.isoformat(),
        "uptime_seconds": int(uptime.total_seconds()),
        "uptime_human": str(uptime).split('.')[0],  # Remove microseconds
        "status": "running",
        "hq_location": {
            "name": settings.HQ_NAME,
            "address": settings.HQ_ADDRESS,
            "lat": settings.HQ_LAT,
            "lon": settings.HQ_LON
        },
        "constraints": {
            "max_bottles_per_trip": settings.MAX_BOTTLES_PER_TRIP,
            "max_addresses_per_session": settings.MAX_ADDRESSES_PER_SESSION
        }
    }

if __name__ == "__main__":
    # Run the application
    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    
    uvicorn.run(
        "main:app" if settings.DEBUG else app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        access_log=True,
        log_level="info"
    )