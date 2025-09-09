"""
Vercel serverless function entry point for aboutwater Route Optimizer
"""
import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from main import app

# Vercel expects a handler function
def handler(request, response):
    return app(request, response)

# For Vercel compatibility
application = app