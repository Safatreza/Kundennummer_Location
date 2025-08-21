from typing import List, Dict, Optional
from pydantic import BaseModel
from dataclasses import dataclass
import numpy as np
from datetime import datetime
import logging
import urllib.parse
import math

logger = logging.getLogger(__name__)

class Location(BaseModel):
    kundennummer: str
    adresse: str
    lat: float
    lon: float
    priority: Optional[int] = None
    bottles: Optional[int] = 0
    is_depot: bool = False
    sequence: Optional[int] = None  # Added sequence field for route optimization

class Tour(BaseModel):
    stops: List[Location]  # Changed from TourStop to Location for frontend compatibility
    total_bottles: int
    total_distance: float
    total_time: int  # in minutes

class RouteOptimizer:
    # Planegg is the HQ/depot location - drivers always start and end here
    HQ_ADDRESS = "Planegg, Deutschland"
    HQ_LAT = 48.1067
    HQ_LON = 11.4247
    
    def __init__(self):
        self.hq_location = Location(
            kundennummer="HQ",
            adresse=self.HQ_ADDRESS,
            lat=self.HQ_LAT,
            lon=self.HQ_LON,
            is_depot=True,
            priority=0,
            bottles=0
        )
    
    def get_hq_location(self):
        """Get the Planegg HQ location"""
        return self.hq_location

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the great circle distance between two points on Earth"""
        # Convert decimal degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in kilometers
        r = 6371
        return c * r

    def optimize_route(self, locations: List[Location], force_return_to_hq: bool = True) -> List[Tour]:
        """
        Optimize route using simple nearest neighbor algorithm.
        Always starts and ends at Planegg HQ.
        
        Args:
            locations: List of customer locations (excluding HQ)
            force_return_to_hq: Always true - drivers must return to Planegg
            
        Returns:
            List of optimized tours
        """
        if not locations:
            return []
        
        # Filter out any existing depot locations from input
        customer_locations = [loc for loc in locations if not loc.is_depot]
        
        if not customer_locations:
            # Only HQ, return single tour
            return [Tour(
                stops=[self.hq_location],
                total_distance=0.0,
                total_time=0,
                total_bottles=0
            )]
        
        # Start with HQ
        tour_stops = [self.hq_location]
        remaining_customers = customer_locations.copy()
        total_distance = 0.0
        total_bottles = sum(loc.bottles or 0 for loc in customer_locations)
        
        # Simple nearest neighbor algorithm
        current_location = self.hq_location
        
        while remaining_customers:
            # Find the closest customer to current location
            closest_customer = None
            min_distance = float('inf')
            
            for customer in remaining_customers:
                distance = self._haversine_distance(
                    current_location.lat, current_location.lon,
                    customer.lat, customer.lon
                )
                if distance < min_distance:
                    min_distance = distance
                    closest_customer = customer
            
            if closest_customer:
                # Add closest customer to tour
                tour_stops.append(closest_customer)
                total_distance += min_distance
                current_location = closest_customer
                remaining_customers.remove(closest_customer)
            else:
                break
        
        # Always return to HQ (Planegg)
        if force_return_to_hq and tour_stops[-1] != self.hq_location:
            final_distance = self._haversine_distance(
                current_location.lat, current_location.lon,
                self.hq_location.lat, self.hq_location.lon
            )
            tour_stops.append(self.hq_location)
            total_distance += final_distance
        
        # Add sequence numbers
        tour_stops_with_sequence = []
        for i, stop in enumerate(tour_stops):
            stop_dict = stop.dict()
            stop_dict['sequence'] = i + 1
            tour_stops_with_sequence.append(Location(**stop_dict))
        
        # Estimate time: 50 km/h average speed
        total_time = int((total_distance / 50.0) * 60)  # Convert to minutes
        
        return [Tour(
            stops=tour_stops_with_sequence,
            total_distance=round(total_distance, 2),
            total_time=total_time,
            total_bottles=total_bottles
        )]
