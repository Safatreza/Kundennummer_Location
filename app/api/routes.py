"""
API routes for the aboutwater Route Optimizer
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
import logging
import io

from pydantic import BaseModel
from app.models import (
    Address, Priority, RouteOptimizationRequest, 
    RouteOptimizationResponse, Tour
)
from app.services.address_manager import address_manager
from app.services.route_optimizer import route_optimizer
from app.services.file_processor import file_processor
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Address Management Endpoints

class AddAddressRequest(BaseModel):
    address: str
    delivery_id: Optional[str] = None
    bottles: int = 0
    priority: Optional[Priority] = None

@router.post("/addresses", response_model=Address)
async def add_address(request: AddAddressRequest):
    """Add a new delivery address"""
    try:
        new_address = address_manager.add_address(
            address=request.address,
            delivery_id=request.delivery_id,
            bottles=request.bottles,
            priority=request.priority
        )
        
        # Geocode the address immediately
        await address_manager.geocode_addresses([new_address.id])
        
        return address_manager.get_address(new_address.id)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding address: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/addresses", response_model=List[Address])
async def get_all_addresses():
    """Get all addresses"""
    return address_manager.get_all_addresses()

@router.get("/addresses/{address_id}", response_model=Address)
async def get_address(address_id: str):
    """Get a specific address by ID"""
    address = address_manager.get_address(address_id)
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    return address

@router.put("/addresses/{address_id}", response_model=Address)
async def update_address(
    address_id: str,
    address: Optional[str] = None,
    delivery_id: Optional[str] = None,
    bottles: Optional[int] = None,
    priority: Optional[Priority] = None
):
    """Update an existing address"""
    updates = {}
    if address is not None:
        updates['address'] = address
    if delivery_id is not None:
        updates['delivery_id'] = delivery_id
    if bottles is not None:
        if bottles < 0 or bottles > 80:
            raise HTTPException(status_code=400, detail="Bottles must be between 0 and 80")
        updates['bottles'] = bottles
    if priority is not None:
        updates['priority'] = priority
    
    updated_address = address_manager.update_address(address_id, **updates)
    if not updated_address:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Re-geocode if address changed
    if 'address' in updates:
        updated_address.lat = None
        updated_address.lon = None
        await address_manager.geocode_addresses([address_id])
    
    return address_manager.get_address(address_id)

@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str):
    """Delete an address"""
    success = address_manager.remove_address(address_id)
    if not success:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"message": "Address deleted successfully"}

@router.delete("/addresses")
async def clear_all_addresses():
    """Clear all addresses"""
    address_manager.clear_all_addresses()
    return {"message": "All addresses cleared"}

# Route Optimization Endpoints

@router.post("/optimize", response_model=RouteOptimizationResponse)
async def optimize_routes():
    """Optimize routes for all addresses"""
    addresses = address_manager.get_all_addresses()
    
    if not addresses:
        raise HTTPException(status_code=400, detail="No addresses to optimize")
    
    # Ensure all addresses are geocoded
    ungeocode_count = len([addr for addr in addresses if not addr.lat])
    if ungeocode_count > 0:
        logger.info(f"Geocoding {ungeocode_count} addresses before optimization")
        await address_manager.geocode_addresses()
    
    # Filter out addresses that couldn't be geocoded
    geocoded_addresses = [addr for addr in addresses if addr.lat and addr.lon]
    
    if not geocoded_addresses:
        raise HTTPException(status_code=400, detail="No addresses could be geocoded")
    
    # Optimize routes
    optimized_tours = route_optimizer.optimize_routes(geocoded_addresses)
    
    # Calculate totals
    total_distance = sum(tour.total_distance for tour in optimized_tours)
    estimated_total_time = sum(tour.estimated_time for tour in optimized_tours)
    
    return RouteOptimizationResponse(
        tours=optimized_tours,
        total_addresses=len(geocoded_addresses),
        total_distance=round(total_distance, 2),
        estimated_total_time=estimated_total_time
    )

@router.get("/summary")
async def get_summary():
    """Get summary statistics"""
    return address_manager.get_summary()

# Google Maps Export Endpoint

@router.get("/export/googlemaps/{tour_id}")
async def export_tour_to_google_maps(tour_id: int):
    """Generate Google Maps URLs for a specific tour"""
    addresses = address_manager.get_all_addresses()
    tour_addresses = [addr for addr in addresses if addr.tour_number == tour_id]
    
    if not tour_addresses:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    # Sort by stop order
    tour_addresses.sort(key=lambda x: x.stop_order or 0)
    
    # Create waypoints
    waypoints = []
    for addr in tour_addresses:
        waypoints.append({
            "address": addr.address,
            "delivery_id": addr.delivery_id,
            "bottles": addr.bottles,
            "lat": addr.lat,
            "lon": addr.lon
        })
    
    # Generate URLs for different platforms
    urls = _generate_google_maps_urls(waypoints)
    
    return {
        "tour_id": tour_id,
        "waypoints": waypoints,
        "urls": urls
    }

def _generate_google_maps_urls(waypoints: List[dict]) -> dict:
    """Generate Google Maps URLs for different platforms"""
    if not waypoints:
        return {}
    
    hq_address = f"{settings.HQ_ADDRESS}"
    
    # Web URL
    waypoint_addrs = "|".join([wp["address"] for wp in waypoints])
    web_url = f"https://www.google.com/maps/dir/{hq_address}/{waypoint_addrs}/{hq_address}"
    
    # Android intent URL
    android_url = f"geo:0,0?q={waypoints[0]['address']}"
    
    # iOS URLs
    ios_google_maps = f"comgooglemaps://?saddr={hq_address}&daddr={hq_address}&waypoints={waypoint_addrs}&directionsmode=driving"
    ios_apple_maps = f"maps://?saddr={hq_address}&daddr={hq_address}&dirflg=d"
    
    return {
        "web": web_url,
        "android": android_url,
        "ios_google_maps": ios_google_maps,
        "ios_apple_maps": ios_apple_maps
    }

# Utility Endpoints

# File Upload Endpoints

@router.post("/upload")
async def upload_addresses_file(file: UploadFile = File(...)):
    """Upload Excel/CSV file with addresses"""
    try:
        result = await file_processor.process_upload(file)
        
        if result['success']:
            return {
                "message": result['message'],
                "total_rows": result['total_rows'],
                "addresses_added": result['addresses_added'],
                "addresses_failed": result['addresses_failed'],
                "failed_addresses": result['failed_addresses'],
                "warnings": result['warnings'],
                "geocoded_count": result['geocoded_count']
            }
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": result['error'],
                    "validation_errors": result['validation_errors'],
                    "warnings": result['warnings']
                }
            )
            
    except Exception as e:
        logger.error(f"Error processing file upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sample-file/{format_type}")
async def download_sample_file(format_type: str):
    """Download sample Excel/CSV file"""
    if format_type.lower() not in ['excel', 'csv']:
        raise HTTPException(status_code=400, detail="Format must be 'excel' or 'csv'")
    
    try:
        content, filename = file_processor.generate_sample_file(format_type)
        
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format_type.lower() == 'excel' else "text/csv"
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error generating sample file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "app_name": settings.APP_NAME
    }