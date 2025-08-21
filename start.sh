#!/bin/bash

echo "Starting Kundenstandorte Visualisierung..."
echo

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating one..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "Failed to create virtual environment."
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements if needed
echo "Installing requirements..."
pip install -r requirements.txt

# Start the application
echo "Starting the application..."
python start.py
