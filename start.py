#!/usr/bin/env python3
"""
Startup script for Kundenstandorte Visualisierung
This script provides better error handling and startup information.
"""

import sys
import os
import uvicorn
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are available"""
    try:
        import fastapi
        import uvicorn
        import aiohttp
        import numpy
        import scipy
        import pydantic
        print("✅ All dependencies are available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_files():
    """Check if all required files exist"""
    required_files = [
        "main.py",
        "templates/index.html",
        "static/js/app_fixed.js",
        "static/css/styles.css",
        "utils/route_optimizer.py",
        "utils/kml_generator.py"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("❌ Missing required files:")
        for file_path in missing_files:
            print(f"   - {file_path}")
        return False
    
    print("✅ All required files are present")
    return True

def main():
    """Main startup function"""
    print("🚀 Starting Kundenstandorte Visualisierung...")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check files
    if not check_files():
        sys.exit(1)
    
    print("=" * 50)
    print("🌐 Starting web server...")
    print("📱 Open your browser and go to: http://localhost:8000")
    print("⏹️  Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        # Start the server
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
