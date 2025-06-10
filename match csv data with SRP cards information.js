const FIELD_MAP = {
    STOCK_NUMBER:               { srp: ".stock_number",                     csv: "StockNumber" },
    DEALER_ID:                  { srp: "",                                  csv: "Dealer Id" },
    CONDITION:                  { srp: ".value__status",                    csv: "Condition" },
    LAST_UPDATE:                { srp: "",                                  csv: "LastUpdate" },
    YEAR:                       { srp: ".value__year",                      csv: "Year" },
    MAKE:                       { srp: ".value__make",                      csv: "Make" },
    MODEL:                      { srp: ".value__model",                     csv: "Model" },
    PHOTOS:                     { srp: "",                                  csv: "Photos" },
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
            
            fieldMapping.appendChild(label);
            fieldMapping.appendChild(input);
            fieldMappingsContainer.appendChild(fieldMapping);
        }
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

    const customFieldMap = {};
    for (const [key, value] of Object.entries(FIELD_MAP)) {
        const inputField = document.getElementById(`${key.toLowerCase()}Mapping`);
        if (inputField && inputField.value.trim()) {
            customFieldMap[key] = inputField.value.trim();
        }
    }

    const testType = 'match-csv-data-with-srp-cards-information';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

    chrome.runtime.sendMessage({ 
        type: 'startProcessing'
    }, (response) => {
        if (!response || !response.success) {
            console.error('Failed to start processing');
            return;
        }
    });

    findUrlsAndModels(testType, csvData);

    async function findUrlsAndModels(testType, csvData) {
        try {
            scannedVehicles = await scrollDownUntilLoadAllVehicles(result, csvData);

            const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
            console.log(message);
            console.log(result);
            
            exportToCSVFile(result, testType);
        } finally {
            if (globalStyleElement) {
                globalStyleElement.remove();
            }
            chrome.runtime.sendMessage({ 
                type: 'stopProcessing'
            }, (response) => {
                if (!response || !response.success) {
                    console.error('Failed to stop processing');
                }
                isProcessing = false;
            });
        }
    }

    async function scrollDownUntilLoadAllVehicles(result, csvData) {
        let actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
        let totalElementsLoaded = 0;
        let isMoreVehicleAvailable = true;

        while (isMoreVehicleAvailable) {
            const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
            const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();

            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (PAGINATION_SCROLL_TYPE) {
                totalElementsLoaded += actualElementsLoaded;
                if (isThereANextPage()) {
                    getPaginationArrow().click();
                    console.warn('Clicking pagination next page arrow...');
                }
                else {
                    isMoreVehicleAvailable = false;
                }
            }
            else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {
                totalElementsLoaded = actualElementsLoaded;
                if (isViewMoreButtonVisible()) {
                    getViewMoreButton().click();
                    console.warn('Clicking "View More Vehicles" button...');
                }
                else {
                    isMoreVehicleAvailable = false;
                }
            }
            else {
                if (actualElementsLoaded != totalElementsLoaded) {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    console.warn('Scrolling to see more vehicles...');
                    totalElementsLoaded = actualElementsLoaded;
                }
                else {
                    isMoreVehicleAvailable = false;
                }
            }
            console.warn(`${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);
            await readVehiclesAndAddResults(result, csvData);
        }
        console.warn("Finished scrolling, all vehicles loaded.");
        return totalElementsLoaded;
    }

    async function readVehiclesAndAddResults(result, csvData) {
        const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
        const csvMap = await csvParser(csvData);
    
        const mismatcheExceptions = [
            { srp: [""], csv: ["SKIP"] },
            { srp: ["–"], csv: ["0"] },
            { srp: ["contactus"],  csv: [""] }
        ];
    
        for (const srpVehicle of allVehicleCards) {
            const stockSelector = customFieldMap.STOCK_NUMBER || fieldMap.STOCK_NUMBER.srp;
            const srpStockNumber = await getTextFromVehicleCard(srpVehicle, stockSelector);
            const csvVehicle = csvMap[srpStockNumber];
    
            if (srpStockNumber && csvVehicle && typeof csvVehicle === 'object') {
                for (const [map_key, map] of Object.entries(fieldMap)) {
                    const srpSelector = customFieldMap[map_key] || map.srp;
                    const csvKey = map.csv;

                    if (!srpSelector || !csvKey) continue;
    
                    const srpRaw = await getTextFromVehicleCard(srpVehicle, srpSelector);
                    const csvRaw = csvVehicle[csvKey];
    
                    const srpValue = normalizeValue(srpRaw, map_key);
                    const csvValue = normalizeValue(csvRaw, map_key);
    
                    const matched = srpValue === csvValue;                  
    
                    let shouldSkip = false;

                    for (const exception of mismatcheExceptions) {
                        if (
                            exception.srp.includes(srpValue) &&
                            (exception.csv.includes(csvValue) || exception.csv.includes("SKIP"))
                        ) {
                            shouldSkip = true;
                            break;
                        }
                    }

                    if (shouldSkip) continue;
                    
                    if (!matched) {
                        if (!result[srpStockNumber]) {
                            result[srpStockNumber] = { mismatches: {} };
                        }
                    
                        result[srpStockNumber].mismatches[map_key] = {
                            srp: srpRaw,
                            csv: csvRaw
                        };
                    }
                }
            }
        }
    
        return allVehicleCards.length;
    }

    function exportToCSVFile(data, testType) {
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            alert('No data to export!');
            return;
        }
    
        const filename = `${window.location.hostname.replace('www.', '')}_${testType.toUpperCase()}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}.csv`;
        const lines = ['StockNumber,Field,SRP,CSV'];
    
        for (const stockNumber in data) {
            const mismatches = data[stockNumber].mismatches;
            for (const field in mismatches) {
                const { srp, csv } = mismatches[field];
                lines.push(`"${stockNumber}","${field}","${srp}","${csv}"`);
            }
        }
    
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    function normalizeValue(value, field) {
        if (!value) return '';
    
        let normalized = value.toString().toLowerCase().trim();
    
        normalized = normalized.replace(/[,$\s]|km|\.00000/g, '');
    
        if (['KILOMETERS', 'PRICE'].includes(field)) {
            const asInt = parseInt(normalized);
            return isNaN(asInt) ? normalized : asInt.toString();
        }
    
        return normalized;
    }

    async function getTextFromVehicleCard(vehicleCardElement, selector) {
        try {
            if(vehicleCardElement) {
                vehicleCard = vehicleCardElement.querySelector(selector);
                if (!vehicleCard) return "";
                let text = vehicleCard.textContent.trim();
                if (text.includes("Stock#:")) {
                    text = text.replace("Stock#:", "").trim();
                }
                return text;
            }
        } catch (error) {
            console.error("An error occurred while getting the text:", error);
            return "";
        }
    }
    
    async function csvParser(csvVehicle) {
        const lines = csvVehicle.trim().split('\n');
        const headers = lines[0].split('|');
      
        const stockDataMap = {};
        let values, entry = {};
      
        for (let i = 1; i < lines.length; i++) {
            values = lines[i].split('|');
            entry = {};
      
            headers.forEach((key, index) => {
                entry[key.trim()] = values[index]?.trim() ?? '';
            });
      
            const stockNumber = entry['StockNumber'];
            if (stockNumber) {
                stockDataMap[stockNumber] = entry;
            }
        }
        return stockDataMap;
    }

    function isPaginationScrollType() {
        return document.querySelector('div.lbx-paginator') !== null;
    }
    function getPaginationArrow() {
        return document.querySelector('.right-arrow');
    }
    function isThereANextPage() {
        const rightArrow = getPaginationArrow();
        return rightArrow && rightArrow.offsetParent !== null;
    }

    function isViewMoreScrollType() {
        return document.querySelector('button.lbx-load-more-btn') !== null;
    }
    function getViewMoreButton() {
        return document.querySelector('button.lbx-load-more-btn');
    }
    function isViewMoreButtonVisible() {
        const btn = document.querySelector('button.lbx-load-more-btn');
        return btn && btn.offsetParent !== null;
    }
}
