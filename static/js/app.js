// Global variables
let map;
let markers = [];
let routePolyline = null;
const MAX_ROWS = 30;
const DEFAULT_MAP_CENTER = [51.1657, 10.4515]; // Center of Germany
const DEFAULT_ZOOM = 6;
const DEPOT_ADDRESS = 'Robert-Koch-Straße 2, 82152 Planegg';
let depotMarker = null;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing application...');
    initializeMap();
    initializeForm();
    addInitialRow();
});

/**
 * Initializes the Leaflet map with default settings
 */
function initializeMap() {
    console.log('Initializing map...');
    map = L.map('map').setView(DEFAULT_MAP_CENTER, DEFAULT_ZOOM);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Always show depot on the map (approximate coordinates, refined when geocoded in flow)
    addDepotToMap();
}

/**
 * Initializes form event listeners and buttons
 */
function initializeForm() {
    console.log('Initializing form...');
    const form = document.getElementById('customerForm');
    const addRowButton = document.getElementById('addRow');
    const resetButton = document.getElementById('resetButton');
    const addDepotButton = document.getElementById('addDepotRow');
    const planRouteButton = document.getElementById('planRouteButton');

    if (!form || !addRowButton || !resetButton) {
        console.error('Required form elements not found!');
        return;
    }

    form.addEventListener('submit', handleFormSubmit);
    addRowButton.addEventListener('click', addNewRow);
    resetButton.addEventListener('click', resetApplication);
    if (addDepotButton) addDepotButton.addEventListener('click', addDepotRow);
    if (planRouteButton) planRouteButton.addEventListener('click', planRoute);
}

/**
 * Adds a new input row to the form
 */
function addNewRow() {
    console.log('Adding new row...');
    const container = document.getElementById('customerInputs');
    if (!container) {
        console.error('Customer inputs container not found!');
        return;
    }

    const rowCount = container.children.length;

    if (rowCount >= MAX_ROWS) {
        showError('Maximale Anzahl von 30 Einträgen erreicht.');
        return;
    }

    const row = document.createElement('div');
    row.className = 'customer-row';
    row.innerHTML = `
        <div class="remove-row" onclick="removeRow(this)">&times;</div>
        <div class="row">
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control" placeholder="Kundennummer" 
                       required pattern="[A-Za-z0-9-]+" title="Nur Buchstaben, Zahlen und Bindestriche erlaubt">
            </div>
            <div class="col-md-5 mb-2">
                <input type="text" class="form-control" placeholder="Adresse" required>
            </div>
            <div class="col-md-2 mb-2">
                <select class="form-select" title="Priorität">
                    <option value="">Flexibel</option>
                </select>
            </div>
            <div class="col-md-2 mb-2">
                <input type="number" class="form-control" placeholder="Flaschen" min="0">
            </div>
        </div>
    `;

    container.appendChild(row);
    refreshPriorityOptions();
    updateAddRowButtonState();
}

/**
 * Removes a row from the form
 */
function removeRow(element) {
    console.log('Removing row...');
    element.closest('.customer-row').remove();
    updateAddRowButtonState();
    refreshPriorityOptions();
}

/**
 * Updates the state of the "Add Row" button based on current row count
 */
function updateAddRowButtonState() {
    const container = document.getElementById('customerInputs');
    const addRowButton = document.getElementById('addRow');
    if (!container || !addRowButton) {
        console.error('Required elements not found!');
        return;
    }
    addRowButton.disabled = container.children.length >= MAX_ROWS;
}

function addDepotRow() {
    const container = document.getElementById('customerInputs');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'customer-row';
    row.dataset.depot = 'true';
    row.innerHTML = `
        <div class="remove-row" onclick="removeRow(this)">&times;</div>
        <div class="row">
            <div class="col-md-3 mb-2">
                <input type="text" class="form-control" value="DEPOT" readonly>
            </div>
            <div class="col-md-5 mb-2">
                <input type="text" class="form-control" value="${DEPOT_ADDRESS}" readonly>
            </div>
            <div class="col-md-2 mb-2">
                <select class="form-select" disabled><option>Depot</option></select>
            </div>
            <div class="col-md-2 mb-2">
                <input type="number" class="form-control" placeholder="Flaschen" min="0" value="0" readonly>
            </div>
        </div>
    `;
    container.appendChild(row);
    updateAddRowButtonState();
}

/**
 * Get the base API URL considering the deployment environment
 */
function getBaseUrl() {
    // Use window.location.origin for all environments
    // This works for both local development and Vercel
    return window.location.origin;
    
    // Log the URL being used (for debugging)
    console.log('Using API URL:', window.location.origin);
}

/**
 * Check for duplicate customer numbers and modify them if needed
 * @param {Array} customers - Array of customer objects
 * @returns {Object} - Object containing modified customers array and warnings
 */
function handleDuplicateCustomers(customers) {
    const customerMap = new Map(); // Map to store customer numbers and their counts
    const addressMap = new Map(); // Map to store addresses and their customer numbers
    const warnings = [];
    const modifiedCustomers = [];

    customers.forEach(customer => {
        // Handle duplicate customer numbers
        if (customerMap.has(customer.kundennummer)) {
            const count = customerMap.get(customer.kundennummer) + 1;
            const originalKundennummer = customer.kundennummer;
            customer.kundennummer = `${customer.kundennummer}(${count})`;
            warnings.push(`Warnung: Doppelte Kundennummer "${originalKundennummer}" wurde zu "${customer.kundennummer}" geändert.`);
            customerMap.set(originalKundennummer, count);
        } else {
            customerMap.set(customer.kundennummer, 1);
        }

        // Track addresses and their associated customer numbers
        if (addressMap.has(customer.adresse)) {
            const existingCustomers = addressMap.get(customer.adresse);
            existingCustomers.push(customer.kundennummer);
            warnings.push(`Hinweis: Die Adresse "${customer.adresse}" wird von mehreren Kunden verwendet: ${existingCustomers.join(', ')}`);
        } else {
            addressMap.set(customer.adresse, [customer.kundennummer]);
        }

        modifiedCustomers.push(customer);
    });

    return { modifiedCustomers, warnings };
}

/**
 * Handles form submission and initiates geocoding
 */
async function handleFormSubmit(event) {
    console.log('Handling form submission...');
    event.preventDefault();
    
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (!loadingSpinner) {
        console.error('Loading spinner not found!');
        return;
    }

    loadingSpinner.classList.remove('d-none');
    clearMarkers();
    clearRoute();

    try {
        const customers = [];
        const rows = document.querySelectorAll('.customer-row');

        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const customerNumber = inputs[0].value.trim();
            const address = inputs[1].value.trim();
            const isDepot = row.dataset.depot === 'true';
            const prioritySelect = row.querySelector('select');
            const priorityVal = prioritySelect ? prioritySelect.value : '';
            const bottlesInput = inputs[2];
            const bottlesVal = bottlesInput ? bottlesInput.value.trim() : '';

            if (customerNumber && address) {
                customers.push({
                    kundennummer: customerNumber,
                    adresse: address,
                    priority: priorityVal ? parseInt(priorityVal, 10) : null,
                    bottles: bottlesVal ? parseInt(bottlesVal, 10) : null,
                    is_depot: isDepot
                });
            }
        });

        if (customers.length === 0) {
            showError('Bitte geben Sie mindestens einen Kunden ein.');
            return;
        }

        // Handle duplicates and get warnings
        const { modifiedCustomers, warnings } = handleDuplicateCustomers(customers);

        // Show warnings if any
        if (warnings.length > 0) {
            const warningMessage = warnings.join('\n\n');
            const proceed = await showConfirmDialog(
                'Hinweise zu Duplikaten',
                warningMessage + '\n\nMöchten Sie fortfahren?'
            );
            if (!proceed) {
                return;
            }
        }

        const baseUrl = getBaseUrl();
        console.log('Sending request to:', `${baseUrl}/geocode`);
        const response = await fetch(`${baseUrl}/geocode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(modifiedCustomers)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        handleGeocodingResults(data.results);

    } catch (error) {
        console.error('Error:', error);
        showError('Ein Fehler ist aufgetreten: ' + error.message);
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

/**
 * Handles the geocoding results and updates the map
 */
function handleGeocodingResults(results) {
    console.log('Handling geocoding results:', results);
    const bounds = L.latLngBounds();
    let validLocations = 0;
    let errors = [];

    results.forEach(result => {
        if (result.lat && result.lon) {
            // Check if there's already a marker at this location
            const existingMarker = markers.find(m => 
                m.getLatLng().lat === result.lat && 
                m.getLatLng().lng === result.lon
            );

            if (existingMarker) {
                // Add this customer to the existing marker's popup and tooltip
                const existingContent = existingMarker.getPopup().getContent();
                const newContent = existingContent.replace(
                    '</div>',
                    `<hr><strong>Kundennummer:</strong> ${result.kundennummer}<br>` +
                    `<strong>Adresse:</strong> ${result.adresse}</div>`
                );
                existingMarker.setPopupContent(newContent);
                
                // Update the tooltip to show all customer numbers
                const existingTooltip = existingMarker.getTooltip();
                const currentTooltipContent = existingTooltip.getContent();
                existingMarker.setTooltipContent(`${currentTooltipContent}, ${result.kundennummer}`);
            } else {
                // Create a new marker with a div wrapper for the content
                const marker = L.marker([result.lat, result.lon], {
                    title: result.kundennummer // This shows on hover
                })
                .bindTooltip(result.kundennummer, {
                    permanent: true, // Make the tooltip always visible
                    direction: 'top', // Show above the marker
                    offset: [0, -30], // Offset to position above the marker
                    className: 'customer-tooltip' // Custom CSS class for styling
                })
                .bindPopup(
                    `<div class="marker-popup">` +
                    `<strong>Kundennummer:</strong> ${result.kundennummer}<br>` +
                    `<strong>Adresse:</strong> ${result.adresse}` +
                    (result.priority ? `<br><strong>Priorität:</strong> ${result.priority}` : '') +
                    (result.bottles != null ? `<br><strong>Flaschen:</strong> ${result.bottles}` : '') +
                    (result.is_depot ? `<br><span class="badge bg-primary">Depot</span>` : '') +
                    `</div>`
                );
            
                marker.addTo(map);
                markers.push(marker);
                bounds.extend([result.lat, result.lon]);
                validLocations++;
            }
        } else if (result.error) {
            errors.push(`Fehler bei ${result.kundennummer}: ${result.error}`);
        }
    });

    if (validLocations > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    if (errors.length > 0) {
        showError('Einige Adressen konnten nicht gefunden werden:\n' + errors.join('\n'));
    }
}

/**
 * Clears all markers from the map
 */
function clearMarkers() {
    console.log('Clearing markers...');
    markers.forEach(marker => marker.remove());
    markers = [];
    if (depotMarker) depotMarker.addTo(map);
}

/**
 * Resets the application to its initial state
 */
function resetApplication() {
    console.log('Resetting application...');
    const container = document.getElementById('customerInputs');
    if (!container) {
        console.error('Customer inputs container not found!');
        return;
    }

    container.innerHTML = '';
    clearMarkers();
    map.setView(DEFAULT_MAP_CENTER, DEFAULT_ZOOM);
    addInitialRow();
    updateAddRowButtonState();
    clearRoute();
}

/**
 * Shows an error message in a modal
 */
function showError(message) {
    console.log('Showing error:', message);
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    const errorMessage = document.getElementById('errorMessage');
    
    if (!errorModal || !errorMessage) {
        console.error('Error modal elements not found!');
        return;
    }

    errorMessage.textContent = message;
    errorModal.show();
}

/**
 * Shows a confirmation dialog with custom message
 * @param {string} title - The title of the dialog
 * @param {string} message - The message to display
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(title, message) {
    console.log('Showing confirmation dialog:', title);
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p style="white-space: pre-line;">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                        <button type="button" class="btn btn-primary" id="confirmButton">Fortfahren</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const modalInstance = new bootstrap.Modal(modal);
        const confirmButton = modal.querySelector('#confirmButton');

        confirmButton.addEventListener('click', () => {
            modalInstance.hide();
            resolve(true);
        });

        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
            resolve(false);
        });

        modalInstance.show();
    });
}

/**
 * Adds the initial row to the form
 */
function addInitialRow() {
    console.log('Adding initial row...');
    addNewRow();
}

function refreshPriorityOptions() {
    const container = document.getElementById('customerInputs');
    const rows = container ? Array.from(container.children) : [];
    const total = rows.filter(r => r.dataset.depot !== 'true').length;
    rows.forEach(row => {
        const select = row.querySelector('select');
        if (!select || row.dataset.depot === 'true') return;
        const current = select.value;
        select.innerHTML = `<option value="">Flexibel</option>`;
        for (let i = 1; i <= Math.max(total, 1); i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = String(i);
            select.appendChild(opt);
        }
        if (current && parseInt(current, 10) <= total) {
            select.value = current;
        }
    });
}

function addDepotToMap() {
    if (depotMarker) return;
    depotMarker = L.marker([48.106, 11.425], { title: 'Depot' })
        .bindTooltip('Depot', { permanent: true, direction: 'top', offset: [0, -30], className: 'customer-tooltip' })
        .bindPopup(`<div class="marker-popup"><strong>Depot:</strong> ${DEPOT_ADDRESS}</div>`);
    depotMarker.addTo(map);
}

function clearRoute() {
    if (routePolyline) {
        routePolyline.remove();
        routePolyline = null;
    }
}

async function planRoute() {
    const baseUrl = getBaseUrl();
    const rows = document.querySelectorAll('.customer-row');
    const capacityInput = document.getElementById('capacityInput');
    const capacity = Math.min(80, Math.max(1, parseInt((capacityInput && capacityInput.value) ? capacityInput.value : '80', 10)));

    const entries = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const cust = inputs[0].value.trim();
        const addr = inputs[1].value.trim();
        const isDepot = row.dataset.depot === 'true';
        const prioritySelect = row.querySelector('select');
        const priorityVal = prioritySelect ? prioritySelect.value : '';
        const bottlesInput = inputs[2];
        const bottlesVal = bottlesInput ? bottlesInput.value.trim() : '';
        if (cust && addr) {
            entries.push({
                kundennummer: cust,
                adresse: addr,
                priority: priorityVal ? parseInt(priorityVal, 10) : null,
                bottles: bottlesVal ? parseInt(bottlesVal, 10) : null,
                is_depot: isDepot,
            });
        }
    });

    if (entries.length === 0) {
        showError('Bitte fügen Sie Adressen hinzu.');
        return;
    }

    const withAutoDepots = [];
    let load = 0;
    let hasExplicitDepot = entries.some(e => e.is_depot);
    for (const e of entries) {
        const demand = e.bottles ? Math.max(0, e.bottles) : 0;
        if (!hasExplicitDepot && load + demand > capacity) {
            withAutoDepots.push({ kundennummer: 'DEPOT', adresse: DEPOT_ADDRESS, is_depot: true });
            load = 0;
        }
        withAutoDepots.push(e);
        load += demand;
    }

    const geoRes = await fetch(`${baseUrl}/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(withAutoDepots)
    });
    if (!geoRes.ok) {
        showError('Fehler bei der Geokodierung.');
        return;
    }
    const geoData = await geoRes.json();
    const valid = (geoData.results || []).filter(r => r.lat && r.lon);

    const stops = valid.map(r => ({
        kundennummer: r.kundennummer,
        adresse: r.adresse,
        lat: r.lat,
        lon: r.lon,
        priority: r.priority ?? null,
        bottles: r.bottles ?? null,
        is_depot: r.is_depot === true || r.kundennummer === 'DEPOT'
    }));

    const routeRes = await fetch(`${baseUrl}/route-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ stops, capacity })
    });
    if (!routeRes.ok) {
        showError('Fehler bei der Routenplanung.');
        return;
    }
    const routeData = await routeRes.json();
    drawRoute(routeData.route || []);
}

function drawRoute(route) {
    clearRoute();
    if (!route || route.length === 0) return;
    // Update depot marker position if present in route
    const depotStep = route.find(s => s.is_depot);
    if (depotStep) {
        if (!depotMarker) {
            depotMarker = L.marker([depotStep.lat, depotStep.lon], { title: 'Depot' })
                .bindTooltip('Depot', { permanent: true, direction: 'top', offset: [0, -30], className: 'customer-tooltip' })
                .bindPopup(`<div class="marker-popup"><strong>Depot:</strong> ${DEPOT_ADDRESS}</div>`)
                .addTo(map);
        } else {
            depotMarker.setLatLng([depotStep.lat, depotStep.lon]);
        }
    }
    const latlngs = route.map(s => [s.lat, s.lon]);
    routePolyline = L.polyline(latlngs, { color: 'blue', weight: 4, opacity: 0.8 });
    routePolyline.addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
}
