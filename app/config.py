"""
Configuration settings for AboutWater Route Optimizer
"""
import os

class Settings:
    """Application configuration settings"""
    
    # Server Configuration
    APP_NAME: str = "aboutwater Route Optimizer"
    VERSION: str = "3.0.1"
    DESCRIPTION: str = "Professional route optimization system for water bottle deliveries"
    
    # Server Settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = ENVIRONMENT == "development"
    
    # HQ Configuration
    HQ_NAME: str = "aboutwater HQ"
    HQ_ADDRESS: str = "Planegg, Deutschland"
    HQ_LAT: float = 48.1067
    HQ_LON: float = 11.4247
    
    # Vehicle Constraints
    MAX_BOTTLES_PER_TRIP: int = 80
    AVERAGE_SPEED_KMH: float = 50.0
    
    # API Configuration
    GEOCODING_SERVICE: str = "nominatim"
    GEOCODING_RATE_LIMIT: float = 1.0  # seconds between requests
    GEOCODING_TIMEOUT: int = 10
    
    # Map Configuration
    DEFAULT_ZOOM: int = 10
    MAP_TILE_URL: str = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    MAP_ATTRIBUTION: str = "© OpenStreetMap contributors"
    
    # UI Configuration
    MAX_ADDRESSES_PER_SESSION: int = 100
    
    # CORS Settings
    ALLOWED_ORIGINS: list = ["*"]  # Configure for production
    
    class Config:
        env_file = ".env"

# Global settings instance
settings = Settings()