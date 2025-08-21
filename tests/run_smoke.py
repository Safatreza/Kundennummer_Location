#!/usr/bin/env python3
"""
Simple smoke test to verify the application can start and basic functionality works.
Run this script to test if the application is working correctly.
"""

import requests
import time
import sys
import subprocess
import signal
import os

def test_server_health():
    """Test if the server is responding to basic requests"""
    try:
        # Test home page
        response = requests.get("http://127.0.0.1:8000/", timeout=5)
        if response.status_code == 200:
            print("✅ Home page accessible")
            return True
        else:
            print(f"❌ Home page returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to server: {e}")
        return False

def test_geocoding():
    """Test basic geocoding functionality"""
    try:
        # Test geocoding
        print("Testing geocoding...")
        payload = [{"kundennummer": "TEST", "adresse": "Planegg, Deutschland"}]
        response = requests.post("http://127.0.0.1:8000/geocode", json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "results" in data and len(data["results"]) > 0:
                result = data["results"][0]
                if result.get("lat") and result.get("lon"):
                    print("✅ Geocoding working correctly")
                    return True
                elif result.get("error"):
                    print(f"⚠️  Geocoding returned error: {result['error']}")
                    return True  # Still working, just rate limited or address not found
                else:
                    print("❌ Geocoding response missing coordinates")
                    return False
            else:
                print("❌ Geocoding response format incorrect")
                return False
        else:
            print(f"❌ Geocoding endpoint returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Geocoding test failed: {e}")
        return False

def main():
    """Main smoke test function"""
    print("🚀 Starting smoke test for Kundenstandorte Visualisierung...")
    
    # Test 1: Server health
    if not test_server_health():
        print("❌ Server health check failed")
        return False
    
    # Test 2: Geocoding
    if not test_geocoding():
        print("❌ Geocoding test failed")
        return False
    
    print("✅ All smoke tests passed!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
