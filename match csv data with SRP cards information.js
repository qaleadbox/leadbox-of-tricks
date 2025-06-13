import { saveFieldMapValues, getFieldMapValues } from './field-map-storage.js';

const FIELD_MAP = {
    STOCK_NUMBER:               { srp: ".stock_number",                     csv: "StockNumber" },
    DEALER_ID:                  { srp: "",                                  csv: "Dealer Id" },
    CONDITION:                  { srp: ".value__status",                    csv: "Condition" },
    LAST_UPDATE:                { srp: "",                                  csv: "LastUpdate" },
    YEAR:                       { srp: ".value__year",                      csv: "Year" },
    MAKE:                       { srp: ".value__make",                      csv: "Make" },
    MODEL:                      { srp: ".value__model",                     csv: "Model" },
    PHOTOS:                     { srp: ".main-img",                         csv: "Photos" },
    PHOTO_UPDATE:               { srp: "",                                  csv: "PhotoUpdate" },
    ADDITIONAL_PHOTOS:          { srp: "",                                  csv: "AdditionalPhotos" },
    ADDITIONAL_PHOTOS_UPDATE:   { srp: "",                                  csv: "AdditionalPhotosUpdate" },
    BODY:                       { srp: "",                                  csv: "Body" },
    DOORS:                      { srp: "",                                  csv: "Doors" },
    DRIVE:                      { srp: ".text__drivetrain",                 csv: "Drive" },
    ENGINE:                     { srp: ".text__engine",                     csv: "Engine" },
    MFG_EXTERIOR_COLOR:         { srp: ".value__exterior .uppercase",       csv: "MFGExteriorColor" },
    EXTERIOR_COLOR:             { srp: "",                                  csv: "ExteriorColor" },
    FUEL:                       { srp: "",                                  csv: "Fuel" },
    INTERIOR_COLOR:             { srp: "",                                  csv: "InteriorColor" },
    NO_PASSENGERS:              { srp: "",                                  csv: "NoPassengers" },
    PRICE:                      { srp: ".price__second",                    csv: "Price" },
    TRIM:                       { srp: ".value__trim",                      csv: "Trim" },
    VIN:                        { srp: ".value__vin span.uppercase",        csv: "VIN" },
    KILOMETERS:                 { srp: ".value__mileage span.uppercase",    csv: "Kilometers" },
    TRANSMISSION:               { srp: "",                                  csv: "Transmission" },
    DESCRIPTION:                { srp: "",                                  csv: "Description" },
    OPTIONS:                    { srp: "",                                  csv: "Options" },
    TYPE:                       { srp: "",                                  csv: "Type" },
    SUB_TYPE:                   { srp: "",                                  csv: "SubType" },
    VDP_URL:                    { srp: "",                                  csv: "VDP Url" },
    AGE:                        { srp: "",                                  csv: "Age" },
    IS_CGI_PICTURE:             { srp: "",                                  csv: "IsCGIPicture" },
    IS_VIN_SAVER:               { srp: "",                                  csv: "IsVinSaver" },
    IS_JUMPSTART:               { srp: "",                                  csv: "IsJumpstart" }
};

async function getCurrentFieldMap() {
    const customFieldMap = {};
    for (const [key, value] of Object.entries(FIELD_MAP)) {
        const inputField = document.getElementById(`${key.toLowerCase()}Mapping`);
        if (inputField && inputField.value.trim()) {
            customFieldMap[key] = inputField.value.trim();
        }
    }
    return customFieldMap;
}

async function refreshFieldMapInputs() {
    const savedFieldMap = await getFieldMapValues();
    if (savedFieldMap) {
        for (const [key, value] of Object.entries(savedFieldMap)) {
            const inputField = document.getElementById(`${key.toLowerCase()}Mapping`);
            if (inputField) {
                inputField.value = value;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await refreshFieldMapInputs();
});

document.getElementById('match csv data with SRP cards information').addEventListener('click', async (event) => {
    const csvInput = document.getElementById('csvInput');
    const hrefInput = document.getElementById('hrefInput');
    
    if (hrefInput.style.display === 'block') {
        hrefInput.style.display = 'none';
    }
    
    csvInput.style.display = csvInput.style.display === 'block' ? 'none' : 'block';

    if (csvInput.style.display === 'block') {
        const fieldMappingsContainer = document.querySelector('.field-mappings');
        fieldMappingsContainer.innerHTML = '<h3>Vehicle Card Class Names</h3>';

        for (const [key, value] of Object.entries(FIELD_MAP)) {
            const fieldMapping = document.createElement('div');
            fieldMapping.className = 'field-mapping';
            
            const label = document.createElement('label');
            label.textContent = `${key}:`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `${key.toLowerCase()}Mapping`;
            input.placeholder = `Current value is '${value.srp}'`;
            
            input.addEventListener('change', async () => {
                const customFieldMap = await getCurrentFieldMap();
                await saveFieldMapValues(customFieldMap);
            });
            
            fieldMapping.appendChild(label);
            fieldMapping.appendChild(input);
            fieldMappingsContainer.appendChild(fieldMapping);
        }

        await refreshFieldMapInputs();
    }
});

document.getElementById('toggleClassNames').addEventListener('click', (event) => {
    event.preventDefault();
    const fieldMappings = document.querySelector('.field-mappings');
    const toggleLink = document.getElementById('toggleClassNames');
    
    if (fieldMappings.style.display === 'none') {
        fieldMappings.style.display = 'block';
        toggleLink.textContent = 'Hide Vehicle Card Class Names Customization';
    } else {
        fieldMappings.style.display = 'none';
        toggleLink.textContent = 'Edit Vehicle Card Class Names (Optional)';
    }
});

document.getElementById('processCSV').addEventListener('click', async () => {
    const csvData = document.getElementById('csvData').value;
    if (!csvData.trim()) {
        alert('Please enter CSV data');
        return;
    }

    const customFieldMap = await getCurrentFieldMap();
    const testType = 'CSV_SRP_DATA_MATCHER';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scrolling.js', 'readVehiclesAndAddResults.js']
    });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: callFindUrlsAndModels,
        args: [testType, csvData, FIELD_MAP, customFieldMap]
    });
});

function callFindUrlsAndModels(testType, csvData, fieldMap, customFieldMap) {
    let scannedVehicles = 0;
    let result = {};
    let isProcessing = true;
    let globalStyleElement = null;

    window.fieldMap = fieldMap;
    window.customFieldMap = customFieldMap;

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

    safeSendMessage({ type: 'startProcessing' }).then(response => {
        if (!response || !response.success) {
            console.log('Failed to start processing');
        }
    });

    findUrlsAndModels(testType, csvData);

    async function findUrlsAndModels(testType, csvData) {
        try {
            scannedVehicles = await window.scrollDownUntilLoadAllVehicles(result, csvData);
            
            const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
            result = await window.readVehiclesAndAddResults(allVehicleCards, csvData, result, testType);

            const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
            console.log(message);
            
            await safeSendMessage({
                type: 'exportToCSV',
                data: result,
                testType: testType,
                siteName: window.location.hostname.replace('www.', '')
            });
        } finally {
            if (globalStyleElement) {
                globalStyleElement.remove();
            }
            await safeSendMessage({ type: 'stopProcessing' });
            isProcessing = false;
        }
    }
}