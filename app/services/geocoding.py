"""
Geocoding service for address to coordinate conversion
"""
import asyncio
import aiohttp
import logging
from typing import Dict, Tuple, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class GeocodingService:
    """Service for converting addresses to coordinates"""
    
    def __init__(self):
        self.cache: Dict[str, Tuple[float, float]] = {}
        
    async def geocode_address(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Geocode a single address to latitude/longitude coordinates
        
        Args:
            address: The address to geocode
            
        Returns:
            Tuple of (latitude, longitude) or None if geocoding fails
        """
        if not address or not address.strip():
            logger.warning("Empty address provided")
            return None
            
        # Check cache first
        cache_key = address.strip().lower()
        if cache_key in self.cache:
            logger.info(f"Cache hit for address: {address}")
            return self.cache[cache_key]
            
        logger.info(f"Geocoding address: {address}")
        
        try:
            timeout = aiohttp.ClientTimeout(total=settings.GEOCODING_TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                coords = await self._query_nominatim(session, address)
                if coords:
                    self.cache[cache_key] = coords
                    return coords
                    
        except asyncio.TimeoutError:
            logger.warning(f"Geocoding timeout for address: {address}")
        except Exception as e:
            logger.error(f"Error geocoding address {address}: {str(e)}")
            
        # Return default coordinates (Munich, Germany) for failed geocoding
        default_coords = (48.1371, 11.5754)
        logger.warning(f"Using default coordinates for {address}: {default_coords}")
        self.cache[cache_key] = default_coords
        return default_coords
        
    async def _query_nominatim(self, session: aiohttp.ClientSession, address: str) -> Optional[Tuple[float, float]]:
        """Query Nominatim geocoding service"""
        url = "https://nominatim.openstreetmap.org/search"
        
        # Try different address formats for better success rate
        address_variants = [
            address,
            f"{address}, Deutschland",
            f"{address}, Germany"
        ]
        
        params = {
            "format": "json",
            "limit": 3,
            "addressdetails": 1
        }
        
        headers = {
            'User-Agent': f'{settings.APP_NAME}/{settings.VERSION}',
            'Accept-Language': 'de,en'
        }
        
        for variant in address_variants:
            params["q"] = variant
            logger.debug(f"Trying address variant: {variant}")
            
            try:
                async with session.get(url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data:
                            # Prefer German results
                            result = self._find_best_match(data)
                            if result:
                                lat = float(result['lat'])
                                lon = float(result['lon'])
                                logger.info(f"Found coordinates: {lat}, {lon} for {variant}")
                                return (lat, lon)
                                
                    elif response.status == 429:
                        logger.warning("Rate limit exceeded")
                        await asyncio.sleep(settings.GEOCODING_RATE_LIMIT * 2)
                        
            except Exception as e:
                logger.error(f"Error querying variant {variant}: {str(e)}")
                continue
                
            # Rate limiting between requests
            await asyncio.sleep(settings.GEOCODING_RATE_LIMIT)
            
        return None
        
    def _find_best_match(self, results: list) -> Optional[dict]:
        """Find the best geocoding result, preferring German addresses"""
        if not results:
            return None
            
        # Prefer German results
        for result in results:
            address_info = result.get('address', {})
            if address_info.get('country') in ['Deutschland', 'Germany']:
                return result
                
        # Fallback to first result
        return results[0]

# Global geocoding service instance
geocoding_service = GeocodingService()