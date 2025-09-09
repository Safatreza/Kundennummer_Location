#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script to validate route optimization logic
"""
import requests
import json
import time
import sys
import io

# Fix Windows unicode output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1"

def clear_addresses():
    """Clear all existing addresses"""
    response = requests.delete(f"{BASE_URL}/addresses")
    print(f"✅ Cleared addresses: {response.json()}")

def add_address(address, bottles, priority=None, delivery_id=None):
    """Add a single address"""
    data = {
        "address": address,
        "bottles": bottles
    }
    if priority:
        data["priority"] = priority
    if delivery_id:
        data["delivery_id"] = delivery_id
    
    response = requests.post(f"{BASE_URL}/addresses", json=data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Added: {result['delivery_id']} - {address} ({bottles} bottles, priority: {priority})")
        return result
    else:
        print(f"❌ Failed to add {address}: {response.text}")
        return None

def optimize_routes():
    """Run route optimization"""
    response = requests.post(f"{BASE_URL}/optimize")
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Optimization failed: {response.text}")
        return None

def print_tour_analysis(optimization_result):
    """Print detailed analysis of tour results"""
    print("\n" + "="*80)
    print("📊 OPTIMIZATION ANALYSIS")
    print("="*80)
    
    tours = optimization_result['tours']
    total_addresses = optimization_result['total_addresses']
    total_distance = optimization_result['total_distance']
    total_time = optimization_result['estimated_total_time']
    
    print(f"Total Addresses: {total_addresses}")
    print(f"Total Distance: {total_distance:.2f} km")
    print(f"Total Time: {total_time} minutes")
    print(f"Number of Tours: {len(tours)}")
    print()
    
    for i, tour in enumerate(tours, 1):
        print(f"🚚 TOUR {tour['id']}")
        print(f"   Addresses: {len(tour['addresses'])}")
        print(f"   Total Bottles: {tour['total_bottles']}")
        print(f"   Distance: {tour['total_distance']} km")
        print(f"   Time: {tour['estimated_time']} minutes")
        print(f"   HQ Returns: {tour['hq_returns']}")
        
        for j, addr in enumerate(tour['addresses'], 1):
            priority_str = f"P{addr['priority']}" if addr['priority'] else "STD"
            print(f"     {j:2d}. {addr['delivery_id']} - {addr['address'][:30]:<30} ({addr['bottles']:2d} bottles, {priority_str})")
        print()

# Test Scenario 1: 30 addresses, 5 bottles each = 150 bottles total
def test_scenario_1():
    """Test Scenario 1: Should create 2 tours (80 + 70 bottles)"""
    print("\n🧪 TESTING SCENARIO 1: 30 addresses × 5 bottles = 150 bottles")
    print("Expected: 2 tours (16 addresses × 5 = 80 bottles + 14 addresses × 5 = 70 bottles)")
    
    clear_addresses()
    
    cities = [
        "München, Deutschland", "Berlin, Deutschland", "Hamburg, Deutschland", 
        "Köln, Deutschland", "Frankfurt, Deutschland", "Stuttgart, Deutschland",
        "Düsseldorf, Deutschland", "Dortmund, Deutschland", "Essen, Deutschland",
        "Leipzig, Deutschland", "Bremen, Deutschland", "Dresden, Deutschland",
        "Hannover, Deutschland", "Nürnberg, Deutschland", "Duisburg, Deutschland",
        "Bochum, Deutschland", "Wuppertal, Deutschland", "Bielefeld, Deutschland",
        "Bonn, Deutschland", "Münster, Deutschland", "Karlsruhe, Deutschland",
        "Mannheim, Deutschland", "Augsburg, Deutschland", "Wiesbaden, Deutschland",
        "Gelsenkirchen, Deutschland", "Mönchengladbach, Deutschland", "Braunschweig, Deutschland",
        "Chemnitz, Deutschland", "Kiel, Deutschland", "Aachen, Deutschland"
    ]
    
    # Add 30 addresses with 5 bottles each
    for i, city in enumerate(cities):
        add_address(city, 5, delivery_id=f"C{i+1:03d}")
        time.sleep(0.1)  # Small delay to avoid overwhelming
    
    # Optimize routes
    result = optimize_routes()
    if result:
        print_tour_analysis(result)
        
        # Validate results
        tours = result['tours']
        bottle_sum = sum(tour['total_bottles'] for tour in tours)
        
        print("🔍 SCENARIO 1 VALIDATION:")
        print(f"   Total bottles delivered: {bottle_sum}")
        print(f"   Expected bottles: 150")
        print(f"   Tours created: {len(tours)}")
        print(f"   Expected tours: 2-3 (with HQ refills)")
        print(f"   ✅ Bottles match: {bottle_sum == 150}")

# Test Scenario 2: Mixed priorities
def test_scenario_2():
    """Test mixed priority handling"""
    print("\n🧪 TESTING SCENARIO 2: Mixed priorities")
    print("Expected: HIGH priority first, then MEDIUM, then LOW, then STANDARD")
    
    clear_addresses()
    
    # Add addresses with mixed priorities (deliberately out of order)
    add_address("Standard City 1, Deutschland", 10, priority=None, delivery_id="STD1")
    add_address("Low Priority City, Deutschland", 15, priority=3, delivery_id="LOW1")  
    add_address("High Priority City 1, Deutschland", 20, priority=1, delivery_id="HIGH1")
    add_address("Medium Priority City, Deutschland", 12, priority=2, delivery_id="MED1")
    add_address("High Priority City 2, Deutschland", 8, priority=1, delivery_id="HIGH2")
    add_address("Standard City 2, Deutschland", 5, priority=None, delivery_id="STD2")
    
    # Optimize routes  
    result = optimize_routes()
    if result:
        print_tour_analysis(result)
        
        # Validate priority ordering
        print("🔍 SCENARIO 2 VALIDATION:")
        if result['tours']:
            first_tour = result['tours'][0]
            delivery_order = [addr['delivery_id'] for addr in first_tour['addresses']]
            print(f"   Delivery order: {delivery_order}")
            print("   Expected order: HIGH1, HIGH2, MED1, LOW1, STD1, STD2 (roughly)")

if __name__ == "__main__":
    print("🚀 STARTING ROUTE OPTIMIZATION TESTS")
    
    try:
        test_scenario_1()
        time.sleep(2)
        test_scenario_2() 
        print("\n✅ ALL TESTS COMPLETED")
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")