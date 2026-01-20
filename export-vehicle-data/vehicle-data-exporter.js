// vehicle-data-exporter.js
// This module exports vehicle data from SRP pages to CSV format

let selectedExportFields = ['stockNumber']; // Always starts with stockNumber
let availableSelectors = {}; // Generated from global manual selectors
let currentDomain = '';

document.addEventListener('DOMContentLoaded', () => {
    const exportVehicleDataButton = document.getElementById('export vehicle data to csv');
    const exportVehicleDataSection = document.getElementById('exportVehicleDataSection');

    if (exportVehicleDataButton) {
        exportVehicleDataButton.addEventListener('click', async (event) => {
            event.preventDefault();
            if (exportVehicleDataSection) {
                const allSections = document.querySelectorAll('.import-export-section, .module-section');
                allSections.forEach(sec => {
                    if (sec.id !== 'exportVehicleDataSection') sec.style.display = 'none';
                });

                if (exportVehicleDataSection.style.display === 'none' || !exportVehicleDataSection.style.display) {
                    exportVehicleDataSection.style.display = 'block';
                    await initializeExportFields();
                } else {
                    exportVehicleDataSection.style.display = 'none';
                }
            }
        });
    }

    const startExportButton = document.getElementById('startVehicleDataExport');
    if (startExportButton) {
        startExportButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await startVehicleDataExport();
        });
    }
});

async function initializeExportFields() {
    try {
        // Get current domain
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            alert('No active tab found!');
            return;
        }

        currentDomain = new URL(tab.url).hostname.replace(/^www\./, '');

        // Load manual selectors from global/domain config
        const stored = await chrome.storage.local.get('manualVehicleSelectors');
        const all = stored.manualVehicleSelectors || {};
        const selectors = all[currentDomain] || all.global || {};

        if (!Object.keys(selectors).length) {
            alert('No vehicle selectors configured for this site. Please configure selectors first in the "Mandatory Vehicle Selectors" section below.');
            return;
        }

        // Use manual selectors as base - this is our source of truth
        availableSelectors = { ...selectors };

        // Initialize with stockNumber always selected
        selectedExportFields = ['stockNumber'];

        // Render the fields as checkboxes
        renderExportFields();

    } catch (error) {
        console.error('Error initializing export fields:', error);
        alert('Error loading export fields. Please try again.');
    }
}

// Removed save/restore config - we generate fresh from manual selectors each time

function renderExportFields() {
    const container = document.getElementById('exportFieldsContainer');
    if (!container) return;

    container.innerHTML = '';

    // Get all fields from availableSelectors (except vehicleCard)
    const allFields = Object.keys(availableSelectors).filter(field => field !== 'vehicleCard');

    // Sort: stockNumber first, then rest alphabetically
    allFields.sort((a, b) => {
        if (a === 'stockNumber') return -1;
        if (b === 'stockNumber') return 1;
        return a.localeCompare(b);
    });

    allFields.forEach(fieldName => {
        const fieldWrapper = document.createElement('div');
        fieldWrapper.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px;';

        const fieldRow = document.createElement('div');
        fieldRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `export-field-${fieldName}`;
        checkbox.checked = selectedExportFields.includes(fieldName);
        checkbox.style.cssText = 'cursor: pointer; width: 18px; height: 18px;';

        const isStockNumber = fieldName === 'stockNumber';
        if (isStockNumber) {
            checkbox.disabled = true;
            checkbox.checked = true;
        } else {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!selectedExportFields.includes(fieldName)) {
                        selectedExportFields.push(fieldName);
                    }
                } else {
                    selectedExportFields = selectedExportFields.filter(f => f !== fieldName);
                }
            });
        }

        // Label
        const label = document.createElement('label');
        label.setAttribute('for', `export-field-${fieldName}`);
        label.style.cssText = 'flex: 1; cursor: pointer; font-weight: 500; color: #000;';

        if (isStockNumber) {
            label.innerHTML = `${fieldName} <span style="color: #d32f2f; font-size: 11px;">(MANDATORY)</span>`;
        } else {
            label.textContent = fieldName;
        }

        // Selector display
        const selector = availableSelectors[fieldName] || '';
        const selectorDisplay = document.createElement('div');
        selectorDisplay.textContent = `Selector: ${selector}`;
        selectorDisplay.style.cssText = 'font-size: 10px; color: #000; margin-top: 4px; margin-left: 28px;';

        fieldRow.appendChild(checkbox);
        fieldRow.appendChild(label);

        fieldWrapper.appendChild(fieldRow);
        if (selector) {
            fieldWrapper.appendChild(selectorDisplay);
        }

        container.appendChild(fieldWrapper);
    });
}


async function startVehicleDataExport() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            alert('No active tab found!');
            return;
        }

        if (selectedExportFields.length === 0) {
            alert('Please add at least one field to export!');
            return;
        }

        // Inject selectors into the page
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (selectors) => {
                const domain = location.hostname.replace(/^www\./, '');
                if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
                window.manualVehicleSelectors[domain] = selectors;
            },
            args: [availableSelectors]
        });

        // Inject required scripts
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/core/$scrolling.js', '/core/$data-handler.js']
        });

        // Execute the export process with selected fields
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: executeVehicleDataExport,
            args: [selectedExportFields]
        });

    } catch (error) {
        console.error('Error starting vehicle data export:', error);
        alert('Error starting export. Please check console for details.');
    }
}

function executeVehicleDataExport(fieldsToExport = ['stockNumber']) {
    const testType = 'VEHICLE_DATA_EXPORTER';
    let result = [];
    let isProcessing = true;

    // Store selected fields in window for access in data handler
    window.exportSelectedFields = fieldsToExport;

    console.log('🎯 executeVehicleDataExport started');
    console.log('🎯 testType:', testType);
    console.log('🎯 fieldsToExport:', fieldsToExport);
    console.log('🎯 window.$dataHandler exists?', typeof window.$dataHandler);
    console.log('🎯 window.scrollDownUntilLoadAllVehicles exists?', typeof window.scrollDownUntilLoadAllVehicles);

    async function safeSendMessage(message) {
        try {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Message send error:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(response);
                    }
                });
            });
        } catch (error) {
            console.log('Error sending message:', error);
            return null;
        }
    }

    collectVehicleData();

    async function collectVehicleData() {
        try {
            console.log('🚀 Starting vehicle data export...');
            console.log('📋 Exporting fields:', fieldsToExport);
            console.log('📋 Result array before scroll:', result);

            // Use the existing scroll mechanism to load all vehicles
            const scannedVehicles = await window.scrollDownUntilLoadAllVehicles(result, null, testType);

            console.log(`✅ Scanned ${scannedVehicles} vehicles`);
            console.log(`📊 Result array after scroll:`, result);
            console.log(`📊 Collected ${result.length} vehicle records`);

            if (result.length === 0) {
                console.error('❌ ZERO RESULTS - Result array is empty after scrolling!');
                alert('No vehicle data found to export. Please check your vehicle card selectors.');
                return;
            }

            // Send data to background script for CSV export
            console.log('📤 Sending data to background for CSV export...');
            console.log('📤 Data to export:', result);

            chrome.runtime.sendMessage({
                type: 'exportToCSV',
                data: result,
                testType: testType,
                siteName: window.location.hostname.replace('www.', '')
            }, (response) => {
                console.log('📤 Background response:', response);
                if (chrome.runtime.lastError) {
                    console.error('📤 Error sending message:', chrome.runtime.lastError);
                    alert('Error triggering CSV export: ' + chrome.runtime.lastError.message);
                } else {
                    console.log('✅ CSV export message sent successfully!');
                    alert(`Successfully exported ${result.length} vehicles to CSV!`);
                }
            });

            console.log('✅ Vehicle data export completed!');

        } catch (error) {
            console.error('💥 Error during vehicle data export:', error);
            alert('Error during export: ' + error.message);
        } finally {
            isProcessing = false;
        }
    }
}
