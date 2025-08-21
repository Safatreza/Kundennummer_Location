// Route Optimizer Application - Clean Version
let map;
let markers;
let routeLines;
let currentLocations = [];
let currentTours = [];

// HQ Location - Planegg is always the depot
const HQ_LOCATION = {
    kundennummer: 'HQ',
    adresse: 'Planegg, Deutschland',
    lat: 48.1067,
    lon: 11.4247,
    is_depot: true,
    priority: 0,
    bottles: 0
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Route Optimizer...');
    
    // Initialize map
    initializeMap();
    
    // Setup event handlers
    setupEventHandlers();
    
    // Show HQ marker
    showHQMarker();
    
    console.log('Application initialized successfully');
});

function initializeMap() {
    console.log('Initializing map...');
    
    // Create map centered on Planegg
    map = L.map('map').setView([HQ_LOCATION.lat, HQ_LOCATION.lon], 10);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Create layer groups
    markers = L.layerGroup().addTo(map);
    routeLines = L.layerGroup().addTo(map);
    
    console.log('Map initialized');
}

function setupEventHandlers() {
    console.log('Setting up event handlers...');
    
    // Address form submission
    const addressForm = document.getElementById('addressForm');
    if (addressForm) {
        addressForm.addEventListener('submit', handleAddressSubmit);
    }
    
    // CSV file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Control buttons
    const optimizeBtn = document.getElementById('optimizeRouteBtn');
    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', optimizeRoute);
    }
    
    const exportBtn = document.getElementById('exportToGoogleMapsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToGoogleMaps);
    }
    
    const clearBtn = document.getElementById('clearAllLocationsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllLocations);
    }
    
    console.log('Event handlers setup complete');
}

function showHQMarker() {
    console.log('Showing HQ marker...');
    
    // Remove existing HQ marker
    markers.eachLayer((marker) => {
        if (marker.locationData && marker.locationData.kundennummer === 'HQ') {
            markers.removeLayer(marker);
        }
    });
    
    // Create HQ marker
    const hqMarker = L.marker([HQ_LOCATION.lat, HQ_LOCATION.lon], {
        icon: L.divIcon({
            className: 'custom-marker hq-marker',
            html: 'HQ',
            iconSize: [25, 25]
        })
    });
    
    hqMarker.locationData = HQ_LOCATION;
    hqMarker.bindPopup(`<strong>HQ - ${HQ_LOCATION.adresse}</strong><br/>Start/End Point`);
    markers.addLayer(hqMarker);
    
    console.log('HQ marker added');
}

async function handleAddressSubmit(e) {
    e.preventDefault();
    console.log('Address form submitted');
    
    const address = document.getElementById('address').value.trim();
    const kundennummer = document.getElementById('kundennummer').value.trim() || '';
    const priority = document.getElementById('priority').value || null;
    const bottles = parseInt(document.getElementById('bottles').value || '0') || 0;
    
    if (!address) {
        showError('Please enter a valid address');
        return;
    }
    
    showStatus('Geocoding address...');
    
    try {
        const customerData = {
            kundennummer: kundennummer || `C${Date.now()}`,
            adresse: address,
            priority: priority ? parseInt(priority) : null,
            bottles: bottles,
            is_depot: false
        };
        
        const response = await fetch('/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([customerData])
        });
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            if (result.error) {
                showError(result.error);
            } else {
                // Add customer data to result
                result.priority = customerData.priority;
                result.bottles = customerData.bottles;
                
                addLocationToMap(result);
                
                // Center map on new location
                map.setView([result.lat, result.lon], 12);
                
                showStatus('Address added successfully');
                
                // Clear form
                clearForm();
            }
        }
    } catch (err) {
        console.error('Geocoding error:', err);
        showError('Error geocoding address: ' + err.message);
    }
}

function addLocationToMap(location) {
    console.log('Adding location to map:', location);
    
    // Add to current locations
    currentLocations.push(location);
    
    // Create marker
    const marker = L.marker([location.lat, location.lon], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: location.kundennummer || 'C',
            iconSize: [25, 25]
        })
    });
    
    marker.locationData = location;
    
    // Create popup content
    let popupContent = `<strong>${location.kundennummer}</strong><br/>`;
    popupContent += `${location.adresse}<br/>`;
    if (location.priority) popupContent += `Priority: ${location.priority}<br/>`;
    if (location.bottles) popupContent += `Bottles: ${location.bottles}`;
    
    marker.bindPopup(popupContent);
    markers.addLayer(marker);
    
    console.log('Location added to map');
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('Processing CSV file:', file.name);
    showStatus('Processing CSV file...');
    
    try {
        const text = await file.text();
        const lines = text.split('\n');
        
        if (lines.length < 2) {
            showError('CSV file must have at least 2 lines (header + data)');
            return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const customers = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = line.split(',');
                if (values.length >= 2) {
                    const customer = {
                        kundennummer: headers.includes('kundennummer') ? 
                            values[headers.indexOf('kundennummer')]?.trim() || `C${i}` : `C${i}`,
                        adresse: values[headers.indexOf('adresse')]?.trim() || values[1]?.trim(),
                        priority: headers.includes('priority') ? 
                            parseInt(values[headers.indexOf('priority')]) || null : null,
                        bottles: headers.includes('bottles') ? 
                            parseInt(values[headers.indexOf('bottles')]) || 0 : 0,
                        is_depot: false
                    };
                    
                    if (customer.adresse) {
                        customers.push(customer);
                    }
                }
            }
        }
        
        if (customers.length === 0) {
            showError('No valid customer data found in CSV');
            return;
        }
        
        // Geocode all addresses
        showStatus(`Geocoding ${customers.length} addresses...`);
        
        const response = await fetch('/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customers)
        });
        
        const data = await response.json();
        
        if (data.results) {
            let successCount = 0;
            data.results.forEach(result => {
                if (!result.error) {
                    addLocationToMap(result);
                    successCount++;
                }
            });
            
            showStatus(`Successfully imported ${successCount} locations`);
            
            // Fit map to show all markers
            if (successCount > 0) {
                fitMapToMarkers();
            }
        }
        
    } catch (error) {
        console.error('CSV processing error:', error);
        showError('Error processing CSV: ' + error.message);
    }
}

async function optimizeRoute() {
    console.log('Optimizing route...');
    
    if (currentLocations.length === 0) {
        showError('No customer locations available for optimization');
        return;
    }
    
    showStatus('Optimizing route...');
    
    try {
        // Include HQ and all customer locations
        const allLocations = [HQ_LOCATION, ...currentLocations];
        
        const response = await fetch('/optimize-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locations: allLocations,
                force_return_to_hq: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Route optimization result:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!data.tours || !Array.isArray(data.tours) || data.tours.length === 0) {
            throw new Error('No tours returned from optimization');
        }
        
        currentTours = data.tours;
        displayRoute(data.tours[0]);
        showStatus('Route optimized successfully');
        
    } catch (error) {
        console.error('Route optimization error:', error);
        showError('Route optimization failed: ' + error.message);
    }
}

function displayRoute(tour) {
    console.log('Displaying route:', tour);
    
    // Clear existing routes
    routeLines.clearLayers();
    
    if (!tour.stops || tour.stops.length < 2) {
        showError('Tour has insufficient stops');
        return;
    }
    
    // Create route line
    const routeCoords = tour.stops.map(stop => [stop.lat, stop.lon]);
    const routeLine = L.polyline(routeCoords, {
        color: '#007bff',
        weight: 4,
        opacity: 0.8
    });
    
    routeLines.addLayer(routeLine);
    
    // Show route information
    displayRouteInfo(tour);
    
    // Fit map to route
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
}

function displayRouteInfo(tour) {
    const routeInfoPanel = document.getElementById('routeInfoPanel');
    const routeDetails = document.getElementById('routeDetails');
    
    if (!routeInfoPanel || !routeDetails) return;
    
    routeDetails.innerHTML = '';
    
    const stops = tour.stops || [];
    const totalBottles = tour.total_bottles || 0;
    const totalDistance = tour.total_distance || 0;
    const totalTime = tour.total_time || 0;
    
    let html = `
        <div class="mb-3">
            <h6>Route Summary</h6>
            <p><strong>Total Bottles:</strong> ${totalBottles}</p>
            <p><strong>Total Distance:</strong> ${totalDistance.toFixed(2)} km</p>
            <p><strong>Estimated Time:</strong> ${Math.floor(totalTime / 60)}h ${totalTime % 60}min</p>
        </div>
        <div>
            <h6>Route Sequence</h6>
            <ol>
    `;
    
    stops.forEach(stop => {
        html += `<li>${stop.kundennummer} - ${stop.adresse}</li>`;
    });
    
    html += `</ol></div>`;
    
    routeDetails.innerHTML = html;
    routeInfoPanel.style.display = 'block';
}

function exportToGoogleMaps() {
    console.log('Exporting to Google Maps...');
    
    if (!currentTours || currentTours.length === 0) {
        showError('No optimized routes available. Please optimize a route first.');
        return;
    }
    
    try {
        const tour = currentTours[0];
        const stops = tour.stops || [];
        
        if (stops.length < 2) {
            showError('Not enough stops for Google Maps export');
            return;
        }
        
        // Extract addresses
        const addresses = stops
            .map(stop => stop.adresse)
            .filter(addr => addr && addr.trim() !== '');
        
        if (addresses.length < 2) {
            showError('Not enough valid addresses for export');
            return;
        }
        
        // Build Google Maps URL
        const origin = encodeURIComponent(addresses[0]);
        const destination = encodeURIComponent(addresses[addresses.length - 1]);
        const waypoints = addresses.slice(1, -1).map(addr => encodeURIComponent(addr));
        
        let url = `https://www.google.com/maps/dir/${origin}/`;
        
        if (waypoints.length > 0) {
            waypoints.forEach(waypoint => {
                url += `${waypoint}/`;
            });
        }
        
        url += `${destination}/`;
        url += `data=!3m1!4b1!4m2!4m1!3e0`; // Driving mode
        
        console.log('Google Maps URL:', url);
        
        // Open in new tab
        const newWindow = window.open(url, '_blank');
        
        if (newWindow) {
            newWindow.focus();
            showStatus('Route opened in Google Maps successfully');
        } else {
            showError('Popup blocked. Please allow popups for this site.');
        }
        
    } catch (error) {
        console.error('Google Maps export error:', error);
        showError('Failed to export to Google Maps: ' + error.message);
    }
}

function clearAllLocations() {
    console.log('Clearing all locations...');
    
    // Clear customer markers (keep HQ)
    const layersToRemove = [];
    markers.eachLayer((marker) => {
        if (marker.locationData && !marker.locationData.is_depot) {
            layersToRemove.push(marker);
        }
    });
    
    layersToRemove.forEach(marker => {
        markers.removeLayer(marker);
    });
    
    // Clear routes
    routeLines.clearLayers();
    
    // Clear data
    currentLocations = [];
    currentTours = [];
    
    // Hide route info panel
    const routeInfoPanel = document.getElementById('routeInfoPanel');
    if (routeInfoPanel) {
        routeInfoPanel.style.display = 'none';
    }
    
    showStatus('All customer locations cleared');
}

function clearForm() {
    document.getElementById('address').value = '';
    document.getElementById('kundennummer').value = '';
    document.getElementById('priority').value = '';
    document.getElementById('bottles').value = '0';
}

function fitMapToMarkers() {
    if (currentLocations.length === 0) return;
    
    const bounds = L.latLngBounds();
    
    // Add HQ to bounds
    bounds.extend([HQ_LOCATION.lat, HQ_LOCATION.lon]);
    
    // Add all customer locations
    currentLocations.forEach(location => {
        bounds.extend([location.lat, location.lon]);
    });
    
    map.fitBounds(bounds, { padding: [20, 20] });
}

function showStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'small text-success';
    }
    console.log('Status:', message);
}

function showError(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'small text-danger';
    }
    console.error('Error:', message);
}