/**
 * aboutwater Route Optimizer - Static Client Application
 * Version 3.0.1 - Professional Route Optimization System
 */

class RouteOptimizerApp {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.routeLines = [];
        // Clear any pre-existing addresses - start fresh
        localStorage.removeItem('aboutwater_addresses');
        localStorage.removeItem('aboutwater_next_id');
        this.addresses = [];
        this.optimizedTours = [];
        this.nextId = 1;
        
        // Static HQ location (aboutwater HQ - Munich area)
        this.hqLocation = {
            lat: 48.1375,
            lng: 11.5755,
            name: "aboutwater HQ",
            address: "München, Deutschland"
        };
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing aboutwater Route Optimizer v3.0.1 (Static)');
        
        try {
            this.initializeMap();
            this.setupEventListeners();
            this.loadExistingAddresses();
            
            console.log('✅ Application initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing application:', error);
            this.showError('Failed to initialize application');
        }
    }

    initializeMap() {
        const mapElement = document.getElementById('map');
        const loadingElement = mapElement.querySelector('.map-loading');
        
        try {
            // Initialize Leaflet map centered on Munich
            this.map = L.map('map').setView([this.hqLocation.lat, this.hqLocation.lng], 10);
            
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
        
        const hqMarker = L.marker([this.hqLocation.lat, this.hqLocation.lng], { icon: hqIcon })
            .addTo(this.map)
            .bindPopup(`<strong>${this.hqLocation.name}</strong><br>${this.hqLocation.address}<br><em>Start & End Point</em>`);
            
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

        // File upload controls
        document.getElementById('uploadArea').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadFile(e.target.files[0]);
            }
        });

        document.getElementById('downloadExcelBtn').addEventListener('click', () => {
            this.downloadSampleFile('excel');
        });

        document.getElementById('downloadCsvBtn').addEventListener('click', () => {
            this.downloadSampleFile('csv');
        });

        // Drag and drop functionality
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
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
            // Geocode address using Nominatim
            const coordinates = await this.geocodeAddress(addressData.address);
            
            const newAddress = {
                id: this.nextId++,
                ...addressData,
                lat: coordinates.lat,
                lng: coordinates.lng,
                timestamp: new Date().toISOString(),
                optimized: false
            };

            this.addresses.push(newAddress);
            this.saveToLocalStorage();
            
            this.addAddressToMap(newAddress);
            this.updateAddressList();
            this.updateStatistics();
            
            form.reset();
            
            console.log(`✅ Added address: ${newAddress.delivery_id}`);
            
        } catch (error) {
            console.error('Error adding address:', error);
            this.showError('Could not find the address. Please check and try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async geocodeAddress(address) {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }
        
        const data = await response.json();
        if (data.length === 0) {
            throw new Error('Address not found');
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
        };
    }

    generateDeliveryId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `AW-${timestamp}-${random}`;
    }

    saveToLocalStorage() {
        localStorage.setItem('aboutwater_addresses', JSON.stringify(this.addresses));
        localStorage.setItem('aboutwater_next_id', this.nextId.toString());
    }

    loadExistingAddresses() {
        try {
            // Addresses are already loaded from localStorage in constructor
            if (this.addresses.length > 0) {
                this.addresses.forEach(address => {
                    this.addAddressToMap(address);
                });
                
                this.updateAddressList();
                this.updateStatistics();
                
                setTimeout(() => this.fitMapToMarkers(), 500);
            }
            
        } catch (error) {
            console.warn('Could not load existing addresses:', error);
        }
    }

    addAddressToMap(address) {
        if (!this.map || !address.lat || !address.lng) return;

        const className = address.optimized ? 'tour-marker' : 'address-marker';
        const content = address.optimized ? address.stop_order : address.bottles;
        const tourClass = address.optimized ? `tour-${address.tour_number}` : '';

        const icon = L.divIcon({
            html: `<div class="${className} ${tourClass}">${content}</div>`,
            className: 'custom-marker',
            iconSize: address.optimized ? [32, 32] : [28, 28],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([address.lat, address.lng], { icon })
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

        this.showLoading(true);

        try {
            // Remove from local state
            this.addresses = this.addresses.filter(addr => addr.id !== addressId);
            this.saveToLocalStorage();
            
            // Remove marker from map
            const marker = this.markers.get(addressId);
            if (marker) {
                this.map.removeLayer(marker);
                this.markers.delete(addressId);
            }
            
            this.updateAddressList();
            this.updateStatistics();
            this.clearOptimization();
            
            console.log(`🗑️ Removed address: ${addressId}`);
            
        } catch (error) {
            console.error('Error removing address:', error);
            this.showError('Failed to remove address');
        } finally {
            this.showLoading(false);
        }
    }

    clearAllAddresses() {
        if (!confirm('Are you sure you want to clear all addresses?')) return;

        this.showLoading(true);

        try {
            // Clear local state
            this.addresses = [];
            this.optimizedTours = [];
            this.saveToLocalStorage();
            
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
            
            document.getElementById('exportSection').style.display = 'none';
            
            console.log('🧹 Cleared all addresses');
            
        } catch (error) {
            console.error('Error clearing addresses:', error);
            this.showError('Failed to clear addresses');
        } finally {
            this.showLoading(false);
        }
    }

    optimizeRoutes() {
        if (this.addresses.length === 0) {
            this.showError('Please add addresses before optimizing');
            return;
        }

        this.showLoading(true);

        try {
            // Create optimized tours using static algorithm
            this.optimizedTours = this.createOptimizedTours();
            
            // Update addresses with tour information
            this.optimizedTours.forEach(tour => {
                tour.addresses.forEach((address, index) => {
                    const localAddress = this.addresses.find(addr => addr.id === address.id);
                    if (localAddress) {
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
            
            console.log(`✅ Optimized ${this.addresses.length} addresses into ${this.optimizedTours.length} tours`);
            
        } catch (error) {
            console.error('Error optimizing routes:', error);
            this.showError('Failed to optimize routes');
        } finally {
            this.showLoading(false);
        }
    }

    createOptimizedTours() {
        const MAX_BOTTLES_PER_TOUR = 80;
        const tours = [];
        let currentTour = [];
        let currentBottles = 0;

        // Sort addresses by priority (1=High, 2=Medium, 3=Low, null=Standard)
        const priorityOrder = { 1: 1, 2: 2, 3: 3, null: 4 };
        const sortedAddresses = [...this.addresses].sort((a, b) => {
            return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
        });

        for (const address of sortedAddresses) {
            const bottles = address.bottles || 0;
            
            // If adding this address would exceed the bottle limit, start a new tour
            if (currentBottles + bottles > MAX_BOTTLES_PER_TOUR && currentTour.length > 0) {
                tours.push({
                    id: tours.length + 1,
                    addresses: [...currentTour],
                    total_bottles: currentBottles,
                    distance: this.calculateTourDistance(currentTour)
                });
                currentTour = [];
                currentBottles = 0;
            }
            
            currentTour.push(address);
            currentBottles += bottles;
        }

        // Add the last tour if it has addresses
        if (currentTour.length > 0) {
            tours.push({
                id: tours.length + 1,
                addresses: [...currentTour],
                total_bottles: currentBottles,
                distance: this.calculateTourDistance(currentTour)
            });
        }

        return tours;
    }

    calculateTourDistance(addresses) {
        if (addresses.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 0; i < addresses.length - 1; i++) {
            const dist = this.calculateDistance(
                addresses[i].lat, addresses[i].lng,
                addresses[i + 1].lat, addresses[i + 1].lng
            );
            totalDistance += dist;
        }
        return Math.round(totalDistance);
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    displayOptimizedRoutes() {
        // Clear existing route lines
        this.clearRouteLines();
        
        const tourColors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];
        
        this.optimizedTours.forEach((tour, index) => {
            const color = tourColors[index % tourColors.length];
            
            // Create route coordinates
            const routeCoords = [
                [this.hqLocation.lat, this.hqLocation.lng], // Start at HQ
                ...tour.addresses.map(addr => [addr.lat, addr.lng]),
                [this.hqLocation.lat, this.hqLocation.lng]  // Return to HQ
            ];
            
            // Create polyline
            const routeLine = L.polyline(routeCoords, {
                color: color,
                weight: 4,
                opacity: 0.7
            }).addTo(this.map);
            
            this.routeLines.push(routeLine);
            
            // Update markers with tour-specific styling
            tour.addresses.forEach((address) => {
                const oldMarker = this.markers.get(address.id);
                if (oldMarker) {
                    this.map.removeLayer(oldMarker);
                }
                this.addAddressToMap(address);
            });
        });
    }

    clearRouteLines() {
        this.routeLines.forEach(line => this.map.removeLayer(line));
        this.routeLines = [];
    }

    clearOptimization() {
        this.optimizedTours = [];
        
        // Reset address optimization status
        this.addresses.forEach(address => {
            address.optimized = false;
            address.tour_number = null;
            address.stop_order = null;
        });
        
        this.clearRouteLines();
        
        // Re-add all markers without optimization
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
        addressCount.textContent = this.addresses.length;
        
        if (this.addresses.length === 0) {
            listContainer.innerHTML = '<p class="help-text">No addresses added yet</p>';
            return;
        }
        
        // Sort addresses by tour and order if optimized
        const sortedAddresses = [...this.addresses].sort((a, b) => {
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
                <button class="btn btn-outline btn-sm" onclick="app.removeAddress(${address.id})">Remove</button>
            </div>
        `;
        
        return div;
    }

    updateStatistics() {
        const totalBottles = this.addresses.reduce((sum, addr) => sum + (addr.bottles || 0), 0);
        const estimatedTours = Math.max(1, Math.ceil(totalBottles / 80));
        
        document.getElementById('totalBottles').textContent = totalBottles;
        document.getElementById('estimatedTours').textContent = estimatedTours;
        
        const statsElement = document.getElementById('statistics');
        if (this.addresses.length > 0) {
            statsElement.style.display = 'flex';
        } else {
            statsElement.style.display = 'none';
        }
    }

    showExportSection() {
        const exportSection = document.getElementById('exportSection');
        const exportTours = document.getElementById('exportTours');
        
        exportTours.innerHTML = '';
        
        // Add "Export All Tours" button if multiple tours
        if (this.optimizedTours.length > 1) {
            const exportAllButton = document.createElement('button');
            exportAllButton.className = 'btn btn-success btn-sm export-all-btn';
            exportAllButton.innerHTML = `🗺️ Export All Tours (${this.optimizedTours.length} tours)`;
            exportAllButton.onclick = () => this.exportAllToursToGoogleMaps();
            exportTours.appendChild(exportAllButton);
            
            // Add separator
            const separator = document.createElement('div');
            separator.className = 'export-separator';
            separator.textContent = 'or export individual tours:';
            exportTours.appendChild(separator);
        }
        
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

    async exportAllToursToGoogleMaps() {
        try {
            // Export each tour sequentially with delay to avoid overwhelming
            for (let i = 0; i < this.optimizedTours.length; i++) {
                const tour = this.optimizedTours[i];
                this.exportTourToGoogleMaps(tour.id);
                
                // Add delay between exports (except for last one)
                if (i < this.optimizedTours.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`📍 Exported all ${this.optimizedTours.length} tours to Google Maps`);
            
        } catch (error) {
            console.error('Error exporting all tours:', error);
            this.showError('Failed to export all tours: ' + error.message);
        }
    }

    exportTourToGoogleMaps(tourId) {
        try {
            const tour = this.optimizedTours.find(t => t.id === tourId);
            if (!tour) return;

            // Create comprehensive route including HQ as start and end
            const waypoints = [
                encodeURIComponent(this.hqLocation.address), // Start at HQ
                ...tour.addresses.map(addr => encodeURIComponent(addr.address)), // All delivery stops
                encodeURIComponent(this.hqLocation.address)  // Return to HQ
            ];

            // Detect platform and create appropriate URLs
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isAndroid = /Android/.test(navigator.userAgent);
            
            let primaryUrl, fallbackUrl;

            if (isIOS) {
                // iOS: Try Google Maps app first, then Apple Maps
                primaryUrl = `comgooglemaps://?saddr=${waypoints[0]}&daddr=${waypoints[waypoints.length - 1]}&waypoints=${waypoints.slice(1, -1).join('|')}`;
                fallbackUrl = `http://maps.apple.com/?saddr=${waypoints[0]}&daddr=${waypoints[waypoints.length - 1]}`;
                
                // Try Google Maps app first
                window.location.href = primaryUrl;
                
                // Fallback to Apple Maps after a delay
                setTimeout(() => {
                    window.open(fallbackUrl, '_blank');
                }, 1500);
                
            } else if (isAndroid) {
                // Android: Google Maps app
                primaryUrl = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
                window.open(primaryUrl, '_blank');
                
            } else {
                // Desktop: Web Google Maps with optimized route
                primaryUrl = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
                window.open(primaryUrl, '_blank');
            }
            
            console.log(`📍 Exported Tour ${tourId} to Google Maps (${tour.addresses.length} stops)`);
            this.showSuccess(`Tour ${tourId} exported to Google Maps with ${tour.addresses.length} stops!`);
            
        } catch (error) {
            console.error('Error exporting to Google Maps:', error);
            this.showError('Failed to export to Google Maps');
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
        this.map.setView([this.hqLocation.lat, this.hqLocation.lng], 10);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }

    showError(message) {
        alert(`Error: ${message}`);
        console.error('Error:', message);
    }

    showSuccess(message) {
        alert(`Success: ${message}`);
        console.log('Success:', message);
    }

    async uploadFile(file) {
        // Validate file type
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            this.showError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('File size must be less than 10MB');
            return;
        }

        // Show progress
        this.showUploadProgress(true);
        this.updateUploadStatus('Reading file...');

        try {
            const data = await this.readFile(file);
            this.updateUploadStatus('Processing addresses...');
            
            const result = await this.processFileData(data);
            this.showUploadResults(result, true);
            
            // Reset file input
            document.getElementById('fileInput').value = '';

        } catch (error) {
            console.error('Upload error:', error);
            this.showUploadResults({ error: error.message }, false);
        } finally {
            this.showUploadProgress(false);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Get first worksheet
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('Failed to read file. Please check the format.'));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    async processFileData(rows) {
        const result = {
            total_rows: rows.length - 1, // Exclude header
            addresses_added: 0,
            addresses_failed: 0,
            geocoded_count: 0,
            warnings: [],
            failed_addresses: []
        };

        if (rows.length < 2) {
            throw new Error('File is empty or has no data rows');
        }

        // Expected headers: Address, DeliveryID, Bottles, Priority
        const headers = rows[0].map(h => h?.toString().toLowerCase());
        const addressCol = headers.findIndex(h => h?.includes('address'));
        const deliveryIdCol = headers.findIndex(h => h?.includes('delivery') || h?.includes('id'));
        const bottlesCol = headers.findIndex(h => h?.includes('bottle'));
        const priorityCol = headers.findIndex(h => h?.includes('priority'));

        if (addressCol === -1) {
            throw new Error('Address column not found. Expected column with "address" in the name.');
        }

        const dataRows = rows.slice(1);
        let successCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNum = i + 2; // Excel row number (header is row 1)

            try {
                if (!row[addressCol] || row[addressCol].toString().trim() === '') {
                    result.warnings.push(`Row ${rowNum}: Empty address field, skipping`);
                    continue;
                }

                const addressData = {
                    address: row[addressCol].toString().trim(),
                    delivery_id: deliveryIdCol >= 0 && row[deliveryIdCol] ? 
                        row[deliveryIdCol].toString().trim() : this.generateDeliveryId(),
                    bottles: bottlesCol >= 0 && row[bottlesCol] ? 
                        parseInt(row[bottlesCol]) || 0 : 0,
                    priority: priorityCol >= 0 && row[priorityCol] ? 
                        parseInt(row[priorityCol]) || null : null
                };

                // Geocode address
                this.updateUploadStatus(`Geocoding address ${successCount + 1}/${dataRows.length}...`);
                
                const coordinates = await this.geocodeAddress(addressData.address);
                
                const newAddress = {
                    id: this.nextId++,
                    ...addressData,
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                    timestamp: new Date().toISOString(),
                    optimized: false
                };

                this.addresses.push(newAddress);
                this.addAddressToMap(newAddress);
                
                result.addresses_added++;
                result.geocoded_count++;
                successCount++;

                // Small delay to avoid overwhelming the geocoding service
                if (successCount % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error) {
                result.addresses_failed++;
                result.failed_addresses.push({
                    row: rowNum,
                    data: { address: row[addressCol] },
                    error: error.message
                });
            }
        }

        // Save to localStorage and update UI
        this.saveToLocalStorage();
        this.updateAddressList();
        this.updateStatistics();
        
        if (result.addresses_added > 0) {
            setTimeout(() => this.fitMapToMarkers(), 500);
        }

        return result;
    }

    downloadSampleFile(format) {
        // Create sample data
        const sampleData = [
            ['Address', 'DeliveryID', 'Bottles', 'Priority'],
            ['München, Deutschland', 'AW-001', '20', '1'],
            ['Berlin, Deutschland', 'AW-002', '15', '2'],
            ['Hamburg, Deutschland', 'AW-003', '25', '3'],
            ['Frankfurt am Main, Deutschland', '', '30', '']
        ];

        if (format === 'excel') {
            // Create Excel workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(sampleData);
            
            // Set column widths
            ws['!cols'] = [
                { wch: 30 }, // Address
                { wch: 15 }, // DeliveryID
                { wch: 10 }, // Bottles
                { wch: 12 }  // Priority
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'Addresses');
            XLSX.writeFile(wb, 'aboutwater_sample_addresses.xlsx');
        } else {
            // Create CSV
            const csvContent = sampleData.map(row => 
                row.map(cell => `"${cell}"`).join(',')
            ).join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'aboutwater_sample_addresses.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
        
        console.log(`📄 Downloaded ${format.toUpperCase()} sample file`);
    }

    showUploadProgress(show) {
        const progressDiv = document.getElementById('uploadProgress');
        const resultsDiv = document.getElementById('uploadResults');
        
        if (show) {
            progressDiv.style.display = 'block';
            resultsDiv.style.display = 'none';
            // Animate progress bar
            const progressFill = progressDiv.querySelector('.progress-fill');
            progressFill.style.width = '70%';
        } else {
            progressDiv.style.display = 'none';
            const progressFill = progressDiv.querySelector('.progress-fill');
            progressFill.style.width = '0%';
        }
    }

    updateUploadStatus(message) {
        document.getElementById('uploadStatus').textContent = message;
    }

    showUploadResults(result, success) {
        const resultsDiv = document.getElementById('uploadResults');
        const summaryDiv = document.getElementById('uploadSummary');
        const warningsDiv = document.getElementById('uploadWarnings');
        const errorsDiv = document.getElementById('uploadErrors');

        resultsDiv.style.display = 'block';

        if (success) {
            summaryDiv.className = 'upload-summary';
            summaryDiv.innerHTML = `
                <strong>✅ Upload Successful!</strong><br>
                📊 <strong>Total rows processed:</strong> ${result.total_rows}<br>
                ➕ <strong>Addresses added:</strong> ${result.addresses_added}<br>
                🗺️ <strong>Successfully geocoded:</strong> ${result.geocoded_count}<br>
                ${result.addresses_failed > 0 ? `❌ <strong>Failed:</strong> ${result.addresses_failed}<br>` : ''}
            `;

            // Show warnings if any
            if (result.warnings && result.warnings.length > 0) {
                warningsDiv.style.display = 'block';
                warningsDiv.innerHTML = `
                    <h4>⚠️ Warnings:</h4>
                    <ul>${result.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
                `;
            } else {
                warningsDiv.style.display = 'none';
            }

            // Show failed addresses if any
            if (result.failed_addresses && result.failed_addresses.length > 0) {
                errorsDiv.style.display = 'block';
                errorsDiv.innerHTML = `
                    <h4>❌ Failed Addresses:</h4>
                    <ul>${result.failed_addresses.map(f => 
                        `<li><strong>Row ${f.row}:</strong> ${f.error}</li>`
                    ).join('')}</ul>
                `;
            } else {
                errorsDiv.style.display = 'none';
            }

        } else {
            summaryDiv.className = 'upload-summary error';
            summaryDiv.innerHTML = `
                <strong>❌ Upload Failed</strong><br>
                ${result.error}
            `;
            
            warningsDiv.style.display = 'none';
            errorsDiv.style.display = 'none';
        }

        // Auto-hide results after 10 seconds if successful
        if (success) {
            setTimeout(() => {
                resultsDiv.style.display = 'none';
            }, 10000);
        }
    }
}

// Initialize application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new RouteOptimizerApp();
});

// Global functions for button callbacks
window.app = {
    removeAddress: (id) => app?.removeAddress(id)
};