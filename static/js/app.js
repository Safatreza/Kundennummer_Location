// Global variables
let map;
let markers = [];
const MAX_ROWS = 30;
const DEFAULT_MAP_CENTER = [51.1657, 10.4515]; // Center of Germany
const DEFAULT_ZOOM = 6;

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
}

/**
 * Initializes form event listeners and buttons
 */
function initializeForm() {
    console.log('Initializing form...');
    const form = document.getElementById('customerForm');
    const addRowButton = document.getElementById('addRow');
    const resetButton = document.getElementById('resetButton');

    if (!form || !addRowButton || !resetButton) {
        console.error('Required form elements not found!');
        return;
    }

    form.addEventListener('submit', handleFormSubmit);
    addRowButton.addEventListener('click', addNewRow);
    resetButton.addEventListener('click', resetApplication);
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
            <div class="col-md-4 mb-2">
                <input type="text" class="form-control" placeholder="Kundennummer" 
                       required pattern="[A-Za-z0-9-]+" title="Nur Buchstaben, Zahlen und Bindestriche erlaubt">
            </div>
            <div class="col-md-8 mb-2">
                <input type="text" class="form-control" placeholder="Adresse" required>
            </div>
        </div>
    `;

    container.appendChild(row);
    updateAddRowButtonState();
}

/**
 * Removes a row from the form
 */
function removeRow(element) {
    console.log('Removing row...');
    element.closest('.customer-row').remove();
    updateAddRowButtonState();
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

    try {
        const customers = [];
        const rows = document.querySelectorAll('.customer-row');

        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const customerNumber = inputs[0].value.trim();
            const address = inputs[1].value.trim();

            if (customerNumber && address) {
                customers.push({
                    kundennummer: customerNumber,
                    adresse: address
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
