"""
Data models for the aboutwater Route Optimizer
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class Priority(int, Enum):
    """Priority levels for deliveries"""
    STANDARD = 0
    HIGH = 1
    MEDIUM = 2
    LOW = 3

class Address(BaseModel):
    """Core address model with all required fields"""
    id: Optional[str] = None
    address: str = Field(..., description="Full delivery address (MANDATORY)")
    delivery_id: Optional[str] = Field(None, description="Delivery ID (auto-generated if not provided)")
    bottles: int = Field(0, description="Number of bottles for this delivery", ge=0, le=80)
    priority: Optional[Priority] = Field(None, description="Priority level (1=high, 2=medium, 3=low)")
    
    # Geocoding results
    lat: Optional[float] = None
    lon: Optional[float] = None
    
    # Route optimization results
    tour_number: Optional[int] = None
    stop_order: Optional[int] = None
    optimized: bool = False

class HQLocation(BaseModel):
    """Headquarters location model"""
    name: str = "aboutwater HQ"
    address: str = "Planegg, Deutschland"
    lat: float = 48.1067
    lon: float = 11.4247
    is_hq: bool = True

class Tour(BaseModel):
    """Tour model representing a complete delivery route"""
    id: int
    addresses: List[Address]
    total_bottles: int = 0
    total_distance: float = 0.0
    estimated_time: int = 0  # in minutes
    hq_returns: int = 0  # number of HQ refill stops

class RouteOptimizationRequest(BaseModel):
    """Request model for route optimization"""
    addresses: List[Address]
    max_bottles_per_trip: int = Field(80, description="Maximum bottles per trip before HQ return")

class RouteOptimizationResponse(BaseModel):
    """Response model for optimized routes"""
    tours: List[Tour]
    total_addresses: int
    total_distance: float
    estimated_total_time: int