/**
 * aboutwater Route Optimizer - Modern Frontend Application
 * Version 3.0.1 - Professional Route Optimization System
 */

class RouteOptimizerApp {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.routeLines = [];
        this.addresses = new Map();
        this.optimizedTours = [];
        this.serverInfo = null;
        
        // API base URL
        this.apiBase = '/api/v1';
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing aboutwater Route Optimizer v3.0.1');
        
        try {
            await this.loadServerInfo();
            this.initializeMap();
            this.setupEventListeners();
            await this.loadExistingAddresses();
            
            console.log('✅ Application initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing application:', error);
            this.showError('Failed to initialize application');
        }
    }

    async loadServerInfo() {
        try {
            const response = await fetch('/server-info');
            this.serverInfo = await response.json();
            console.log(`📡 Connected to server ${this.serverInfo.server_id}`);
        } catch (error) {
            console.warn('Could not load server info:', error);
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
        if (!this.map || !this.serverInfo) return;
        
        const hqIcon = L.divIcon({
            html: '<div class="hq-marker">HQ</div>',
            className: 'custom-hq-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const hq = this.serverInfo.hq_location;
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
            delivery_id: formData.get('deliveryId').trim() || null,
            bottles: parseInt(formData.get('bottles')) || 0,
            priority: formData.get('priority') ? parseInt(formData.get('priority')) : null
        };

        if (!addressData.address) {
            this.showError('Address is required');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`${this.apiBase}/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addressData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to add address');
            }

            const newAddress = await response.json();
            this.addresses.set(newAddress.id, newAddress);
            
            this.addAddressToMap(newAddress);
            this.updateAddressList();
            this.updateStatistics();
            
            form.reset();
            
            console.log(`✅ Added address: ${newAddress.delivery_id}`);
            
        } catch (error) {
            console.error('Error adding address:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async loadExistingAddresses() {
        try {
            const response = await fetch(`${this.apiBase}/addresses`);
            const addresses = await response.json();
            
            this.addresses.clear();
            addresses.forEach(address => {
                this.addresses.set(address.id, address);
                this.addAddressToMap(address);
            });
            
            this.updateAddressList();
            this.updateStatistics();
            
            if (addresses.length > 0) {
                setTimeout(() => this.fitMapToMarkers(), 500);
            }
            
        } catch (error) {
            console.warn('Could not load existing addresses:', error);
        }
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
        const labels = { 1: 'Low (1)', 2: 'Medium (2)', 3: 'High (3)' };
        return labels[priority] || 'Standard';
    }

    async removeAddress(addressId) {
        if (!confirm('Are you sure you want to remove this address?')) return;

        this.showLoading(true);

        try {
            const response = await fetch(`${this.apiBase}/addresses/${addressId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to remove address');
            }

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
            
        } catch (error) {
            console.error('Error removing address:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async clearAllAddresses() {
        if (!confirm('Are you sure you want to clear all addresses?')) return;

        this.showLoading(true);

        try {
            const response = await fetch(`${this.apiBase}/addresses`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to clear addresses');
            }

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
            
            document.getElementById('exportSection').style.display = 'none';
            
        } catch (error) {
            console.error('Error clearing addresses:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async optimizeRoutes() {
        if (this.addresses.size === 0) {
            this.showError('Please add addresses before optimizing');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`${this.apiBase}/optimize`, {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to optimize routes');
            }

            const result = await response.json();
            this.optimizedTours = result.tours;
            
            // Update address objects with optimization results
            result.tours.forEach(tour => {
                tour.addresses.forEach(address => {
                    if (this.addresses.has(address.id)) {
                        const localAddress = this.addresses.get(address.id);
                        localAddress.optimized = true;
                        localAddress.tour_number = tour.id;
                        localAddress.stop_order = address.stop_order;
                    }
                });
            });
            
            this.displayOptimizedRoutes();
            this.updateAddressList();
            this.updateStatistics();
            this.showExportSection();
            
            console.log(`✅ Optimized ${result.total_addresses} addresses into ${result.tours.length} tours`);
            
        } catch (error) {
            console.error('Error optimizing routes:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    displayOptimizedRoutes() {
        // Clear existing route lines
        this.clearRouteLines();
        
        if (!this.serverInfo) return;
        
        const hq = this.serverInfo.hq_location;
        const tourColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
        
        let deliveryTourNumber = 1;
        
        this.optimizedTours.forEach((tour, index) => {
            const isRefillStop = tour.addresses.length === 1 && tour.addresses[0].delivery_id?.includes('HQ-REFILL');
            
            if (isRefillStop) {
                // Handle HQ refill stop - add visual indicator
                this.addRefillStopIndicator(tour, index);
            } else {
                // Handle regular delivery tour
                const color = tourColors[(deliveryTourNumber - 1) % tourColors.length];
                
                // Create route coordinates
                const routeCoords = [
                    [hq.lat, hq.lon], // Start at HQ
                    ...tour.addresses.map(addr => [addr.lat, addr.lon]),
                    [hq.lat, hq.lon]  // Return to HQ
                ];
                
                // Create polyline with enhanced styling
                const routeLine = L.polyline(routeCoords, {
                    color: color,
                    weight: 4,
                    opacity: 0.9,
                    dashArray: deliveryTourNumber > 1 ? '10, 5' : null  // Dashed lines for tours after first
                }).addTo(this.map);
                
                // Add tour label
                const midPoint = this.calculateMidpoint(routeCoords);
                const tourLabel = L.marker(midPoint, {
                    icon: L.divIcon({
                        html: `<div class="tour-label" style="background-color: ${color}">Tour ${deliveryTourNumber}</div>`,
                        className: 'custom-tour-label',
                        iconSize: [60, 25],
                        iconAnchor: [30, 12]
                    })
                }).addTo(this.map);
                
                this.routeLines.push(routeLine);
                this.routeLines.push(tourLabel);
                
                // Update markers with tour-specific styling
                tour.addresses.forEach((address, stopIndex) => {
                    const localAddress = this.addresses.get(address.id);
                    if (localAddress) {
                        // Remove old marker
                        const oldMarker = this.markers.get(address.id);
                        if (oldMarker) {
                            this.map.removeLayer(oldMarker);
                        }
                        
                        // Add new optimized marker with enhanced styling
                        this.addOptimizedAddressToMap(localAddress, deliveryTourNumber, color, stopIndex + 1);
                    }
                });
                
                deliveryTourNumber++;
            }
        });
    }
    
    addRefillStopIndicator(tour, index) {
        if (!this.serverInfo) return;
        
        const hq = this.serverInfo.hq_location;
        const refillIcon = L.divIcon({
            html: '<div class="refill-indicator">⛽</div>',
            className: 'custom-refill-indicator',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const refillMarker = L.marker([hq.lat, hq.lon], { icon: refillIcon })
            .bindPopup(`<strong>HQ Refill Stop</strong><br>Refill bottles for next tour<br><em>Duration: 15 minutes</em>`)
            .addTo(this.map);
        
        this.routeLines.push(refillMarker);
        
        // Add animated pulse effect
        setTimeout(() => {
            if (refillMarker._icon) {
                refillMarker._icon.classList.add('refill-pulse');
            }
        }, 500);
    }
    
    calculateMidpoint(coordinates) {
        if (coordinates.length < 2) return coordinates[0];
        
        const midIndex = Math.floor(coordinates.length / 2);
        return coordinates[midIndex];
    }
    
    addOptimizedAddressToMap(address, tourNumber, tourColor, stopOrder) {
        if (!address.lat || !address.lon) return;
        
        // Create priority-based icon styling
        let priorityClass = 'priority-standard';
        let prioritySymbol = '●';
        
        if (address.priority === 1) {
            priorityClass = 'priority-high';
            prioritySymbol = '🔴';
        } else if (address.priority === 2) {
            priorityClass = 'priority-medium'; 
            prioritySymbol = '🟡';
        } else if (address.priority === 3) {
            priorityClass = 'priority-low';
            prioritySymbol = '🟢';
        }
        
        const markerIcon = L.divIcon({
            html: `
                <div class="optimized-marker ${priorityClass}" style="border-color: ${tourColor}">
                    <span class="stop-number">${stopOrder}</span>
                    <span class="priority-indicator">${prioritySymbol}</span>
                </div>
            `,
            className: 'custom-optimized-marker',
            iconSize: [35, 35],
            iconAnchor: [17, 17]
        });
        
        const marker = L.marker([address.lat, address.lon], { icon: markerIcon })
            .bindPopup(`
                <div class="marker-popup">
                    <strong>Tour ${tourNumber} - Stop ${stopOrder}</strong><br>
                    <strong>${address.delivery_id}</strong><br>
                    ${address.address}<br>
                    <strong>Bottles:</strong> ${address.bottles}<br>
                    ${address.priority ? `<strong>Priority:</strong> ${this.getPriorityLabel(address.priority)}` : ''}
                </div>
            `)
            .addTo(this.map);
        
        this.markers.set(address.id, marker);
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
        addressCount.textContent = this.addresses.size;
        
        if (this.addresses.size === 0) {
            listContainer.innerHTML = '<p class="help-text">No addresses added yet</p>';
            return;
        }
        
        // Sort addresses by tour and order if optimized
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
        const estimatedTours = Math.max(1, Math.ceil(totalBottles / 80));
        
        document.getElementById('totalBottles').textContent = totalBottles;
        document.getElementById('estimatedTours').textContent = estimatedTours;
        
        const statsElement = document.getElementById('statistics');
        if (this.addresses.size > 0) {
            statsElement.style.display = 'grid';
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

    async exportTourToGoogleMaps(tourId) {
        try {
            const response = await fetch(`${this.apiBase}/export/googlemaps/${tourId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Failed to generate export URLs');
            }
            
            // Detect platform and open appropriate URL
            this.openGoogleMapsUrl(data.urls, `Tour ${tourId}`);
            
        } catch (error) {
            console.error('Error exporting to Google Maps:', error);
            this.showError(error.message);
        }
    }

    async exportAllToursToGoogleMaps() {
        try {
            // Export each tour sequentially with delay to avoid overwhelming
            for (let i = 0; i < this.optimizedTours.length; i++) {
                const tour = this.optimizedTours[i];
                await this.exportTourToGoogleMaps(tour.id);
                
                // Add delay between exports (except for last one)
                if (i < this.optimizedTours.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            
            console.log(`📍 Exported all ${this.optimizedTours.length} tours to Google Maps`);
            this.showSuccess(`Successfully exported all ${this.optimizedTours.length} tours to Google Maps!`);
            
        } catch (error) {
            console.error('Error exporting all tours:', error);
            this.showError('Failed to export all tours: ' + error.message);
        }
    }

    openGoogleMapsUrl(urls, tourName) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
            // Try Google Maps app first, fallback to Apple Maps
            window.open(urls.ios_google_maps, '_blank');
            setTimeout(() => {
                if (urls.ios_apple_maps) {
                    window.open(urls.ios_apple_maps, '_blank');
                }
            }, 1000);
        } else if (isAndroid) {
            window.open(urls.android, '_blank');
        } else {
            // Desktop - open web version
            window.open(urls.web, '_blank');
        }
        
        console.log(`📍 Exported ${tourName} to Google Maps`);
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
        if (!this.serverInfo) return;
        const hq = this.serverInfo.hq_location;
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
        this.updateUploadStatus('Uploading file...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.apiBase}/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail?.message || result.detail || 'Upload failed');
            }

            // Show success results
            this.showUploadResults(result, true);
            
            // Refresh addresses and map
            await this.loadExistingAddresses();
            
            // Reset file input
            document.getElementById('fileInput').value = '';

        } catch (error) {
            console.error('Upload error:', error);
            this.showUploadResults({ error: error.message }, false);
        } finally {
            this.showUploadProgress(false);
        }
    }

    downloadSampleFile(format) {
        const url = `${this.apiBase}/sample-file/${format}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = `aboutwater_sample_addresses.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        `<li><strong>${f.data.address || 'Unknown'}:</strong> ${f.error}</li>`
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

    showError(message) {
        // Simple error display - could be enhanced with toast notifications
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // Simple success display - could be enhanced with toast notifications
        alert(`Success: ${message}`);
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