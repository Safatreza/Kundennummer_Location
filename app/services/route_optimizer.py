"""
Advanced route optimization service with bottle constraints and priority handling
"""
import math
import logging
from typing import List, Tuple, Optional
from app.models import Address, Tour, HQLocation, Priority
from app.config import settings

logger = logging.getLogger(__name__)

class RouteOptimizer:
    """Advanced route optimization with bottle capacity and priority constraints"""
    
    def __init__(self):
        self.hq = HQLocation()
        
    def optimize_routes(self, addresses: List[Address]) -> List[Tour]:
        """
        Optimize delivery routes with bottle capacity constraints and priority handling
        
        Args:
            addresses: List of addresses to optimize
            
        Returns:
            List of optimized tours
        """
        if not addresses:
            return []
            
        logger.info(f"Optimizing routes for {len(addresses)} addresses")
        
        # Sort addresses by priority first, then by distance from HQ
        sorted_addresses = self._sort_addresses_by_priority_and_distance(addresses)
        
        tours = []
        tour_id = 1
        remaining_addresses = sorted_addresses.copy()
        
        while remaining_addresses:
            tour = self._create_single_tour(tour_id, remaining_addresses)
            tours.append(tour)
            
            # Break if no addresses were processed (safety check)
            if not tour.addresses:
                logger.warning("No addresses processed in tour, breaking loop")
                break
            
            # Add HQ refill stop between tours if more addresses remain
            if remaining_addresses:
                hq_refill = self._create_hq_refill_stop(tour_id)
                tours.append(hq_refill)
            
            tour_id += 1
            
        logger.info(f"Created {len(tours)} optimized tours")
        return tours
        
    def _sort_addresses_by_priority_and_distance(self, addresses: List[Address]) -> List[Address]:
        """Sort addresses by priority (high first) then by distance from HQ"""
        def sort_key(addr: Address) -> Tuple[int, float]:
            # Priority: HIGH=1, MEDIUM=2, LOW=3, STANDARD=none
            # Convert to sort order: HIGH=0, MEDIUM=1, LOW=2, STANDARD=3 (highest priority first)
            if addr.priority is None:
                priority_weight = 3  # STANDARD gets lowest priority
            elif addr.priority.value == 1:  # HIGH
                priority_weight = 0  # Highest priority
            elif addr.priority.value == 2:  # MEDIUM  
                priority_weight = 1
            else:  # LOW (3)
                priority_weight = 2
            
            # Distance from HQ (closer = processed first)
            distance = self._calculate_distance(
                self.hq.lat, self.hq.lon, 
                addr.lat or 0, addr.lon or 0
            )
            
            return (priority_weight, distance)
            
        return sorted(addresses, key=sort_key)
        
    def _create_single_tour(self, tour_id: int, remaining_addresses: List[Address]) -> Tour:
        """Create a single optimized tour respecting bottle constraints"""
        tour_addresses = []
        current_bottles = 0
        current_location = (self.hq.lat, self.hq.lon)
        
        while remaining_addresses and current_bottles < settings.MAX_BOTTLES_PER_TRIP:
            # Find the best next address considering distance and remaining capacity
            next_address = self._find_next_best_address(
                current_location, 
                remaining_addresses, 
                settings.MAX_BOTTLES_PER_TRIP - current_bottles
            )
            
            if not next_address:
                break
                
            # Add address to tour
            next_address.tour_number = tour_id
            next_address.stop_order = len(tour_addresses) + 1
            next_address.optimized = True
            
            tour_addresses.append(next_address)
            current_bottles += next_address.bottles
            current_location = (next_address.lat, next_address.lon)
            
            # Remove from remaining addresses list
            remaining_addresses.remove(next_address)
            
            logger.debug(f"Added {next_address.delivery_id} to tour {tour_id}, bottles: {current_bottles}")
            
        # Calculate tour statistics
        total_distance = self._calculate_tour_distance(tour_addresses)
        estimated_time = self._calculate_tour_time(total_distance, len(tour_addresses))
        hq_returns = 1 if current_bottles > 0 else 0  # Always return to HQ at end
        
        return Tour(
            id=tour_id,
            addresses=tour_addresses,
            total_bottles=current_bottles,
            total_distance=round(total_distance, 2),
            estimated_time=estimated_time,
            hq_returns=hq_returns
        )
        
    def _create_hq_refill_stop(self, tour_id: int) -> Tour:
        """Create a special HQ refill stop between tours"""
        
        # Create HQ address entry for refill
        hq_address = Address(
            id="HQ-REFILL",
            address=self.hq.address,
            delivery_id=f"HQ-REFILL-{tour_id}",
            bottles=0,
            priority=None,
            lat=self.hq.lat,
            lon=self.hq.lon,
            tour_number=tour_id,
            stop_order=1,
            optimized=True
        )
        
        return Tour(
            id=tour_id,
            addresses=[hq_address],
            total_bottles=0,  # Refill, so no delivery bottles
            total_distance=0.0,  # Already at HQ
            estimated_time=15,  # 15 minutes for refill
            hq_returns=1
        )
        
    def _find_next_best_address(
        self, 
        current_location: Tuple[float, float], 
        candidates: List[Address], 
        remaining_capacity: int
    ) -> Optional[Address]:
        """Find the best next address using advanced multi-criteria optimization"""
        
        # Filter addresses that fit in remaining capacity
        feasible = [addr for addr in candidates if addr.bottles <= remaining_capacity]
        
        if not feasible:
            return None
        
        # If only one feasible address, return it
        if len(feasible) == 1:
            return feasible[0]
            
        # Multi-criteria optimization
        best_address = None
        best_score = float('inf')
        
        for addr in feasible:
            # 1. Distance factor (0-100, lower is better)
            distance = self._calculate_distance(
                current_location[0], current_location[1],
                addr.lat or 0, addr.lon or 0
            )
            distance_score = min(distance, 100)  # Cap at 100km
            
            # 2. Priority factor (0-45, lower is better)
            priority_score = 0
            if addr.priority:
                priority_score = (addr.priority.value - 1) * 15  # High=0, Medium=15, Low=30
            else:
                priority_score = 22.5  # Standard priority between Medium and Low
                
            # 3. Bottle efficiency factor (encourage higher bottle counts)
            bottle_efficiency = max(0, 10 - (addr.bottles * 0.125))  # More bottles = lower score
            
            # 4. Cluster bonus (look ahead to see if other nearby addresses exist)
            cluster_bonus = self._calculate_cluster_bonus(addr, feasible, remaining_capacity)
            
            # Combined weighted score
            total_score = (
                distance_score * 0.4 +        # 40% distance weight
                priority_score * 0.35 +       # 35% priority weight  
                bottle_efficiency * 0.15 +    # 15% bottle efficiency weight
                cluster_bonus * 0.1           # 10% clustering weight
            )
            
            logger.debug(f"Address {addr.delivery_id}: distance={distance:.1f}, "
                        f"priority={priority_score}, bottles={bottle_efficiency:.1f}, "
                        f"cluster={cluster_bonus:.1f}, total={total_score:.2f}")
            
            if total_score < best_score:
                best_score = total_score
                best_address = addr
                
        return best_address
        
    def _calculate_cluster_bonus(self, target: Address, candidates: List[Address], remaining_capacity: int) -> float:
        """Calculate clustering bonus for selecting addresses near other addresses"""
        if len(candidates) <= 1:
            return 0.0
            
        nearby_addresses = []
        for candidate in candidates:
            if candidate.id == target.id:
                continue
                
            distance = self._calculate_distance(
                target.lat or 0, target.lon or 0,
                candidate.lat or 0, candidate.lon or 0
            )
            
            # Consider addresses within 10km as "nearby"
            if distance <= 10.0 and candidate.bottles <= remaining_capacity - target.bottles:
                nearby_addresses.append((candidate, distance))
        
        # Bonus based on number and proximity of nearby deliverable addresses
        if not nearby_addresses:
            return 5.0  # Penalty for isolated addresses
            
        # Calculate weighted proximity bonus
        bonus = 0.0
        for candidate, distance in nearby_addresses[:3]:  # Consider up to 3 nearest
            bonus += max(0, 5.0 - distance)  # Closer addresses give bigger bonus
            
        return max(0, 5.0 - bonus)  # Convert to score (lower is better)
        
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great circle distance between two points in kilometers"""
        if not all([lat1, lon1, lat2, lon2]):
            return 0.0
            
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2)
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth radius in kilometers
        return 6371.0 * c
        
    def _calculate_tour_distance(self, addresses: List[Address]) -> float:
        """Calculate total distance for a tour including HQ start/end"""
        if not addresses:
            return 0.0
            
        total_distance = 0.0
        current_lat, current_lon = self.hq.lat, self.hq.lon
        
        # Distance from HQ to first address
        if addresses:
            total_distance += self._calculate_distance(
                current_lat, current_lon,
                addresses[0].lat or 0, addresses[0].lon or 0
            )
            
        # Distance between consecutive addresses
        for i, current_address in enumerate(addresses[:-1]):
            next_address = addresses[i + 1]
            total_distance += self._calculate_distance(
                current_address.lat or 0, current_address.lon or 0,
                next_address.lat or 0, next_address.lon or 0
            )
            
        # Distance from last address back to HQ
        if addresses:
            total_distance += self._calculate_distance(
                addresses[-1].lat or 0, addresses[-1].lon or 0,
                self.hq.lat, self.hq.lon
            )
            
        return total_distance
        
    def _calculate_tour_time(self, distance: float, num_stops: int) -> int:
        """Calculate estimated tour time in minutes"""
        # Travel time based on average speed
        travel_time = (distance / settings.AVERAGE_SPEED_KMH) * 60
        
        # Service time per stop (5 minutes per address)
        service_time = num_stops * 5
        
        # Total time in minutes
        return int(travel_time + service_time)

# Global route optimizer instance
route_optimizer = RouteOptimizer()