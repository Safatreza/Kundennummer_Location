/**
 * aboutwater Route Optimizer - Static Version
 * Version 3.0.1 - Client-Side Route Optimization System
 */

class StaticRouteOptimizerApp {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.routeLines = [];
        this.addresses = new Map();
        this.optimizedTours = [];
        
        // Static configuration
        this.config = {
            app_name: "aboutwater Route Optimizer",
            version: "3.0.1",
            server_id: "STATIC-" + Math.random().toString(36).substr(2, 8).toUpperCase(),
            hq_location: {
                name: "aboutwater HQ",
                address: "Planegg, Deutschland",
                lat: 48.1067,
                lon: 11.4247
            },
            constraints: {
                max_bottles_per_trip: 80,
                max_addresses_per_session: 100
            }
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing aboutwater Route Optimizer v3.0.1 (Static Mode)');
        
        try {
            this.initializeMap();
            this.setupEventListeners();
            this.loadFromLocalStorage();
            
            console.log('✅ Application initialized successfully in static mode');
        } catch (error) {
            console.error('❌ Error initializing application:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    initializeMap() {
        const mapElement = document.getElementById('map');
        const loadingElement = mapElement.querySelector('.map-loading');
        
        try {
            // Initialize Leaflet map
            this.map = L.map('map').setView([48.1067, 11.4247], 10);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);
            
            // Add HQ marker
            this.addHQMarker();
            
            // Remove loading indicator
            if (loadingElement) {
                loadingElement.remove();
            }
            
            // Force resize after initialization
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
            
            console.log('🗺️ Map initialized successfully');
            
        } catch (error) {
            console.error('Error initializing map:', error);
            if (loadingElement) {
                loadingElement.innerHTML = '<p>Failed to load map. Please refresh the page.</p>';
            }
        }
    }

    addHQMarker() {
        if (!this.map) return;
        
        const hqIcon = L.divIcon({
            html: '<div class="hq-marker">HQ</div>',
            className: 'custom-hq-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const hq = this.config.hq_location;
        const hqMarker = L.marker([hq.lat, hq.lon], { icon: hqIcon })
            .addTo(this.map)
            .bindPopup(`<strong>${hq.name}</strong><br>${hq.address}<br><em>Start & End Point</em>`);
            
        this.markers.set('HQ', hqMarker);
    }

    setupEventListeners() {
        // Address form submission
        const addressForm = document.getElementById('addressForm');
        addressForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addAddress();
        });

        // Action buttons
        document.getElementById('optimizeBtn').addEventListener('click', () => {
            this.optimizeRoutes();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllAddresses();
        });

        // Map controls
        document.getElementById('fitMapBtn').addEventListener('click', () => {
            this.fitMapToMarkers();
        });

        document.getElementById('resetMapBtn').addEventListener('click', () => {
            this.resetMapView();
        });
    }

    async addAddress() {
        const form = document.getElementById('addressForm');
        const formData = new FormData(form);
        
        const addressData = {
            address: formData.get('address').trim(),
            delivery_id: formData.get('deliveryId').trim() || this.generateDeliveryId(),
            bottles: parseInt(formData.get('bottles')) || 0,
            priority: formData.get('priority') ? parseInt(formData.get('priority')) : null
        };

        if (!addressData.address) {
            this.showError('Address is required');
            return;
        }

        this.showLoading(true);

        try {
            // Geocode the address using Nominatim (OpenStreetMap)
            const coordinates = await this.geocodeAddress(addressData.address);
            
            const newAddress = {
                id: this.generateId(),
                ...addressData,
                lat: coordinates.lat,
                lon: coordinates.lon,
                tour_number: null,
                stop_order: null,
                optimized: false
            };

            this.addresses.set(newAddress.id, newAddress);
            
            this.addAddressToMap(newAddress);
            this.updateAddressList();
            this.updateStatistics();
            this.saveToLocalStorage();
            
            form.reset();
            
            console.log(`✅ Added address: ${newAddress.delivery_id}`);
            
        } catch (error) {
            console.error('Error adding address:', error);
            this.showError('Failed to geocode address: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async geocodeAddress(address) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const data = await response.json();
            
            if (data.length === 0) {
                throw new Error('Address not found');
            }
            
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        } catch (error) {
            throw new Error('Geocoding failed: ' + error.message);
        }
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    generateDeliveryId() {
        return 'ADDR' + (this.addresses.size + 1).toString().padStart(3, '0');
    }

    addAddressToMap(address) {
        if (!this.map || !address.lat || !address.lon) return;

        const className = address.optimized ? 'tour-marker' : 'address-marker';
        const content = address.optimized ? address.stop_order : address.bottles;
        const tourClass = address.optimized ? `tour-${address.tour_number}` : '';

        const icon = L.divIcon({
            html: `<div class="${className} ${tourClass}">${content}</div>`,
            className: 'custom-marker',
            iconSize: address.optimized ? [32, 32] : [28, 28],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([address.lat, address.lon], { icon })
            .addTo(this.map)
            .bindPopup(this.createPopupContent(address));

        this.markers.set(address.id, marker);
    }

    createPopupContent(address) {
        const priority = address.priority ? this.getPriorityLabel(address.priority) : 'Standard';
        const tourInfo = address.optimized ? `<br><strong>Tour:</strong> ${address.tour_number}, Stop: ${address.stop_order}` : '';
        
        return `
            <strong>${address.delivery_id}</strong><br>
            ${address.address}<br>
            <strong>Bottles:</strong> ${address.bottles}<br>
            <strong>Priority:</strong> ${priority}
            ${tourInfo}
        `;
    }

    getPriorityLabel(priority) {
        const labels = { 1: 'High (1)', 2: 'Medium (2)', 3: 'Low (3)' };
        return labels[priority] || 'Standard';
    }

    removeAddress(addressId) {
        if (!confirm('Are you sure you want to remove this address?')) return;

        // Remove from local state
        this.addresses.delete(addressId);
        
        // Remove marker from map
        const marker = this.markers.get(addressId);
        if (marker) {
            this.map.removeLayer(marker);
            this.markers.delete(addressId);
        }
        
        this.updateAddressList();
        this.updateStatistics();
        this.clearOptimization();
        this.saveToLocalStorage();
    }

    clearAllAddresses() {
        if (!confirm('Are you sure you want to clear all addresses?')) return;

        // Clear local state
        this.addresses.clear();
        this.optimizedTours = [];
        
        // Remove all markers except HQ
        this.markers.forEach((marker, key) => {
            if (key !== 'HQ') {
                this.map.removeLayer(marker);
            }
        });
        this.markers = new Map([['HQ', this.markers.get('HQ')]]);
        
        // Clear route lines
        this.clearRouteLines();
        
        this.updateAddressList();
        this.updateStatistics();
        this.resetMapView();
        this.saveToLocalStorage();
        
        document.getElementById('exportSection').style.display = 'none';
    }

    optimizeRoutes() {
        if (this.addresses.size === 0) {
            this.showError('Please add addresses before optimizing');
            return;
        }

        this.showLoading(true);

        try {
            // Simple client-side optimization
            const addressList = Array.from(this.addresses.values());
            const tours = this.clientSideOptimization(addressList);
            
            this.optimizedTours = tours;
            
            // Update address objects with optimization results
            tours.forEach(tour => {
                tour.addresses.forEach((address, index) => {
                    if (this.addresses.has(address.id)) {
                        const localAddress = this.addresses.get(address.id);
                        localAddress.optimized = true;
                        localAddress.tour_number = tour.id;
                        localAddress.stop_order = index + 1;
                    }
                });
            });
            
            this.displayOptimizedRoutes();
            this.updateAddressList();
            this.updateStatistics();
            this.showExportSection();
            this.saveToLocalStorage();
            
            console.log(`✅ Optimized ${addressList.length} addresses into ${tours.length} tours`);
            
        } catch (error) {
            console.error('Error optimizing routes:', error);
            this.showError('Optimization failed: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    clientSideOptimization(addresses) {
        // Sort by priority first, then by distance from HQ
        const sorted = addresses.sort((a, b) => {
            const priorityA = a.priority || 4;
            const priorityB = b.priority || 4;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB; // Lower number = higher priority
            }
            
            const distA = this.calculateDistance(this.config.hq_location.lat, this.config.hq_location.lon, a.lat, a.lon);
            const distB = this.calculateDistance(this.config.hq_location.lat, this.config.hq_location.lon, b.lat, b.lon);
            
            return distA - distB;
        });

        const tours = [];
        let tourId = 1;
        let currentTour = [];
        let currentBottles = 0;

        for (const address of sorted) {
            if (currentBottles + address.bottles > this.config.constraints.max_bottles_per_trip) {
                // Start new tour
                if (currentTour.length > 0) {
                    tours.push({
                        id: tourId++,
                        addresses: [...currentTour],
                        total_bottles: currentBottles,
                        total_distance: this.calculateTourDistance(currentTour),
                        estimated_time: Math.round(this.calculateTourDistance(currentTour) * 2.4) // rough estimate
                    });
                    currentTour = [];
                    currentBottles = 0;
                }
            }
            
            currentTour.push(address);
            currentBottles += address.bottles;
        }

        // Add final tour
        if (currentTour.length > 0) {
            tours.push({
                id: tourId,
                addresses: [...currentTour],
                total_bottles: currentBottles,
                total_distance: this.calculateTourDistance(currentTour),
                estimated_time: Math.round(this.calculateTourDistance(currentTour) * 2.4)
            });
        }

        return tours;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateTourDistance(addresses) {
        if (addresses.length === 0) return 0;
        
        let totalDistance = 0;
        const hq = this.config.hq_location;
        
        // Distance from HQ to first address
        totalDistance += this.calculateDistance(hq.lat, hq.lon, addresses[0].lat, addresses[0].lon);
        
        // Distance between addresses
        for (let i = 0; i < addresses.length - 1; i++) {
            totalDistance += this.calculateDistance(
                addresses[i].lat, addresses[i].lon,
                addresses[i + 1].lat, addresses[i + 1].lon
            );
        }
        
        // Distance back to HQ
        const lastAddress = addresses[addresses.length - 1];
        totalDistance += this.calculateDistance(lastAddress.lat, lastAddress.lon, hq.lat, hq.lon);
        
        return Math.round(totalDistance * 100) / 100; // Round to 2 decimal places
    }

    displayOptimizedRoutes() {
        this.clearRouteLines();
        
        const hq = this.config.hq_location;
        const tourColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
        
        this.optimizedTours.forEach((tour, index) => {
            const color = tourColors[index % tourColors.length];
            
            // Create route coordinates
            const routeCoords = [
                [hq.lat, hq.lon],
                ...tour.addresses.map(addr => [addr.lat, addr.lon]),
                [hq.lat, hq.lon]
            ];
            
            // Create polyline
            const routeLine = L.polyline(routeCoords, {
                color: color,
                weight: 4,
                opacity: 0.9
            }).addTo(this.map);
            
            this.routeLines.push(routeLine);
            
            // Update markers
            tour.addresses.forEach((address) => {
                const localAddress = this.addresses.get(address.id);
                if (localAddress) {
                    const oldMarker = this.markers.get(address.id);
                    if (oldMarker) {
                        this.map.removeLayer(oldMarker);
                    }
                    this.addAddressToMap(localAddress);
                }
            });
        });
    }

    showExportSection() {
        const exportSection = document.getElementById('exportSection');
        const exportTours = document.getElementById('exportTours');
        
        exportTours.innerHTML = '';
        
        // Add individual tour buttons
        this.optimizedTours.forEach(tour => {
            const button = document.createElement('button');
            button.className = 'btn btn-primary btn-sm';
            button.innerHTML = `📍 Tour ${tour.id} <span class="tour-details">(${tour.addresses.length} stops, ${tour.total_bottles} bottles)</span>`;
            button.onclick = () => this.exportTourToGoogleMaps(tour.id);
            exportTours.appendChild(button);
        });
        
        exportSection.style.display = 'block';
    }

    exportTourToGoogleMaps(tourId) {
        const tour = this.optimizedTours.find(t => t.id === tourId);
        if (!tour) return;

        const hq = this.config.hq_location;
        const waypoints = tour.addresses.map(addr => addr.address).join('|');
        const url = `https://www.google.com/maps/dir/${encodeURIComponent(hq.address)}/${waypoints}/${encodeURIComponent(hq.address)}`;
        
        window.open(url, '_blank');
        console.log(`📍 Exported Tour ${tourId} to Google Maps`);
    }

    clearRouteLines() {
        this.routeLines.forEach(line => this.map.removeLayer(line));
        this.routeLines = [];
    }

    clearOptimization() {
        this.optimizedTours = [];
        
        this.addresses.forEach(address => {
            address.optimized = false;
            address.tour_number = null;
            address.stop_order = null;
        });
        
        this.clearRouteLines();
        
        this.markers.forEach((marker, key) => {
            if (key !== 'HQ') {
                this.map.removeLayer(marker);
            }
        });
        
        this.addresses.forEach(address => {
            this.addAddressToMap(address);
        });
        
        document.getElementById('exportSection').style.display = 'none';
    }

    updateAddressList() {
        const listContainer = document.getElementById('addressList');
        const addressCount = document.getElementById('addressCount');
        
        listContainer.innerHTML = '';
        addressCount.textContent = this.addresses.size;
        
        if (this.addresses.size === 0) {
            listContainer.innerHTML = '<p class="help-text">No addresses added yet</p>';
            return;
        }
        
        const sortedAddresses = Array.from(this.addresses.values()).sort((a, b) => {
            if (a.optimized && b.optimized) {
                if (a.tour_number !== b.tour_number) {
                    return a.tour_number - b.tour_number;
                }
                return a.stop_order - b.stop_order;
            }
            if (a.optimized) return -1;
            if (b.optimized) return 1;
            return 0;
        });
        
        sortedAddresses.forEach(address => {
            const addressElement = this.createAddressElement(address);
            listContainer.appendChild(addressElement);
        });
    }

    createAddressElement(address) {
        const div = document.createElement('div');
        div.className = `address-item ${address.optimized ? 'optimized' : ''}`;
        
        const priorityBadge = address.priority ? 
            `<span class="priority-badge priority-${address.priority}">${this.getPriorityLabel(address.priority)}</span>` : '';
        
        const tourBadge = address.optimized ? 
            `<span class="tour-badge">Tour ${address.tour_number}</span>` : '';
        
        div.innerHTML = `
            <div class="address-header">
                <span class="address-title">${address.delivery_id}</span>
                ${tourBadge}
            </div>
            <div class="address-details">
                <strong>Address:</strong> ${address.address}<br>
                <strong>Bottles:</strong> ${address.bottles}
                ${priorityBadge ? `<br><strong>Priority:</strong> ${priorityBadge}` : ''}
                ${address.optimized ? `<br><strong>Stop Order:</strong> ${address.stop_order}` : ''}
            </div>
            <div class="address-actions">
                <button class="btn btn-danger btn-sm" onclick="app.removeAddress('${address.id}')">Remove</button>
            </div>
        `;
        
        return div;
    }

    updateStatistics() {
        const totalBottles = Array.from(this.addresses.values()).reduce((sum, addr) => sum + addr.bottles, 0);
        const estimatedTours = Math.max(1, Math.ceil(totalBottles / this.config.constraints.max_bottles_per_trip));
        
        document.getElementById('totalBottles').textContent = totalBottles;
        document.getElementById('estimatedTours').textContent = estimatedTours;
        
        const statsElement = document.getElementById('statistics');
        if (this.addresses.size > 0) {
            statsElement.style.display = 'grid';
        } else {
            statsElement.style.display = 'none';
        }
    }

    fitMapToMarkers() {
        if (this.markers.size <= 1) {
            this.resetMapView();
            return;
        }
        
        const group = new L.featureGroup([...this.markers.values()]);
        this.map.fitBounds(group.getBounds().pad(0.1));
    }

    resetMapView() {
        const hq = this.config.hq_location;
        this.map.setView([hq.lat, hq.lon], 10);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    saveToLocalStorage() {
        try {
            const data = {
                addresses: Array.from(this.addresses.values()),
                optimizedTours: this.optimizedTours
            };
            localStorage.setItem('aboutwater-route-optimizer', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('aboutwater-route-optimizer');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Restore addresses
                data.addresses.forEach(address => {
                    this.addresses.set(address.id, address);
                    this.addAddressToMap(address);
                });
                
                // Restore tours
                if (data.optimizedTours && data.optimizedTours.length > 0) {
                    this.optimizedTours = data.optimizedTours;
                    this.displayOptimizedRoutes();
                    this.showExportSection();
                }
                
                this.updateAddressList();
                this.updateStatistics();
                
                if (this.addresses.size > 0) {
                    setTimeout(() => this.fitMapToMarkers(), 500);
                }
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }
}

// Initialize application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StaticRouteOptimizerApp();
});

// Global functions for button callbacks
window.app = {
    removeAddress: (id) => app?.removeAddress(id)
};