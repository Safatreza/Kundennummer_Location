"""
Address management service for handling delivery addresses
"""
import uuid
import re
import logging
from typing import List, Optional, Dict
from app.models import Address, Priority
from app.services.geocoding import geocoding_service

logger = logging.getLogger(__name__)

class AddressManager:
    """Service for managing delivery addresses"""
    
    def __init__(self):
        self.addresses: Dict[str, Address] = {}
        
    def add_address(
        self, 
        address: str, 
        delivery_id: Optional[str] = None, 
        bottles: int = 0, 
        priority: Optional[Priority] = None
    ) -> Address:
        """
        Add a new address to the system
        
        Args:
            address: Full delivery address (MANDATORY)
            delivery_id: Optional delivery ID (auto-generated if not provided)  
            bottles: Number of bottles (0-80)
            priority: Priority level (1=low, 2=medium, 3=high)
            
        Returns:
            Address object with generated ID
        """
        if not address or not address.strip():
            raise ValueError("Address is mandatory and cannot be empty")
            
        if bottles < 0 or bottles > 80:
            raise ValueError("Bottles must be between 0 and 80")
            
        # Generate unique ID
        addr_id = str(uuid.uuid4())
        
        # Auto-generate delivery ID if not provided
        if not delivery_id:
            delivery_id = self._generate_delivery_id(address)
            
        # Create address object
        new_address = Address(
            id=addr_id,
            address=address.strip(),
            delivery_id=delivery_id,
            bottles=bottles,
            priority=priority
        )
        
        # Store address
        self.addresses[addr_id] = new_address
        
        logger.info(f"Added new address: {delivery_id} - {address}")
        return new_address
        
    def get_address(self, address_id: str) -> Optional[Address]:
        """Get address by ID"""
        return self.addresses.get(address_id)
        
    def get_all_addresses(self) -> List[Address]:
        """Get all addresses"""
        return list(self.addresses.values())
        
    def update_address(
        self, 
        address_id: str, 
        **updates
    ) -> Optional[Address]:
        """Update an existing address"""
        if address_id not in self.addresses:
            return None
            
        address = self.addresses[address_id]
        
        # Update fields
        for field, value in updates.items():
            if hasattr(address, field):
                setattr(address, field, value)
                
        logger.info(f"Updated address {address.delivery_id}")
        return address
        
    def remove_address(self, address_id: str) -> bool:
        """Remove address by ID"""
        if address_id in self.addresses:
            removed = self.addresses.pop(address_id)
            logger.info(f"Removed address {removed.delivery_id}")
            return True
        return False
        
    def clear_all_addresses(self):
        """Clear all addresses"""
        count = len(self.addresses)
        self.addresses.clear()
        logger.info(f"Cleared {count} addresses")
        
    async def geocode_addresses(self, address_ids: Optional[List[str]] = None) -> int:
        """
        Geocode addresses to get coordinates
        
        Args:
            address_ids: Optional list of specific address IDs to geocode
            
        Returns:
            Number of successfully geocoded addresses
        """
        if address_ids:
            addresses_to_geocode = [
                addr for addr_id, addr in self.addresses.items() 
                if addr_id in address_ids and not addr.lat
            ]
        else:
            addresses_to_geocode = [
                addr for addr in self.addresses.values() 
                if not addr.lat
            ]
            
        success_count = 0
        
        for address in addresses_to_geocode:
            try:
                coords = await geocoding_service.geocode_address(address.address)
                if coords:
                    address.lat, address.lon = coords
                    success_count += 1
                    logger.info(f"Geocoded {address.delivery_id}: {coords}")
                else:
                    logger.warning(f"Failed to geocode {address.delivery_id}")
                    
            except Exception as e:
                logger.error(f"Error geocoding {address.delivery_id}: {str(e)}")
                
        logger.info(f"Successfully geocoded {success_count} of {len(addresses_to_geocode)} addresses")
        return success_count
        
    def _generate_delivery_id(self, address: str) -> str:
        """Generate a delivery ID from address"""
        # Extract meaningful parts from address
        words = re.findall(r'\b[A-Za-z]+\b', address)
        
        # Take first 2-3 significant words
        significant_words = [w for w in words if len(w) > 2][:2]
        
        if significant_words:
            prefix = ''.join(word[:2].upper() for word in significant_words)
        else:
            prefix = "DEL"
            
        # Add timestamp suffix
        suffix = str(uuid.uuid4())[:4].upper()
        
        return f"{prefix}{suffix}"
        
    def get_summary(self) -> Dict:
        """Get summary statistics"""
        addresses = list(self.addresses.values())
        
        total_bottles = sum(addr.bottles for addr in addresses)
        priority_counts = {}
        
        for addr in addresses:
            priority_key = addr.priority.name if addr.priority else "STANDARD"
            priority_counts[priority_key] = priority_counts.get(priority_key, 0) + 1
            
        geocoded_count = sum(1 for addr in addresses if addr.lat and addr.lon)
        
        return {
            "total_addresses": len(addresses),
            "total_bottles": total_bottles,
            "geocoded_addresses": geocoded_count,
            "priority_breakdown": priority_counts,
            "estimated_tours": max(1, (total_bottles + 79) // 80)  # Ceiling division
        }

# Global address manager instance
address_manager = AddressManager()