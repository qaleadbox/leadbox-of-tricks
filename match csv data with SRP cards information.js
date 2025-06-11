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
            await new Promise(resolve => setTimeout(resolve, 2000));

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
                    await new Promise(resolve => setTimeout(resolve, 2000));

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
    
        for (const srpVehicle of allVehicleCards) {
            const stockSelector = customFieldMap.STOCK_NUMBER || fieldMap.STOCK_NUMBER.srp;
            const srpStockNumber = await getTextFromVehicleCard(srpVehicle, stockSelector);
            const csvVehicle = csvMap[srpStockNumber];
    
            if (srpStockNumber && csvVehicle && typeof csvVehicle === 'object') {
                for (const [map_key, map] of Object.entries(fieldMap)) {
                    const srpSelector = customFieldMap[map_key] || map.srp;
                    const csvKey = map.csv;

                    if (!csvKey || !srpSelector) continue;
    
                    const srpRaw = await getTextFromVehicleCard(srpVehicle, srpSelector);
                    const csvRaw = csvVehicle[csvKey];
                        
                    const csvNormalizedValue = normalizeValue(map_key, csvRaw);
                    const srpNormalizedValue = normalizeValue(map_key, srpRaw);

                    if (await isExceptionValue(map_key, csvNormalizedValue, srpNormalizedValue)) {
                        continue;
                    }
    
                    let matched = srpNormalizedValue === csvNormalizedValue;  
                    
                    if (!matched) {
                        let isNotOnResultsYet = !result[srpStockNumber];
                        
                        if (isNotOnResultsYet) {
                            result[srpStockNumber] = { mismatches: {} };
                        }
                    
                        result[srpStockNumber].mismatches[map_key] = {
                            csv: csvNormalizedValue,
                            srp: srpNormalizedValue
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
        const lines = ['StockNumber,Field,CSV,SRP'];
    
        for (const stockNumber in data) {
            const mismatches = data[stockNumber].mismatches;
            for (const field in mismatches) {
                const { srp, csv } = mismatches[field];
                lines.push(`"${stockNumber}","${field}","${csv}","${srp}"`);
            }
        }
    
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    async function isExceptionValue(csv_key, csv_value, srp_value) {
        if (!srp_value && !csv_value) return true;        
    
        let mismatcheExceptions = [
            { srp: [""], csv: ["SKIP"] },
            { srp: ["–"], csv: ["0"] },
            { srp: ["contactus"],  csv: [""] }
        ];

        for (const exception of mismatcheExceptions) {
            if (
                exception.srp.includes(srp_value) &&
                (exception.csv.includes(csv_value) || exception.csv.includes("SKIP"))
            ) {
                return true;
            }
        }

        switch (csv_key) {
            case 'PHOTOS':
                const isSpinner = srp_value.includes('spinner.gif');
                return isSpinner;
            default:
                return false;
        }
    }

    function normalizeValue(key, value) {
        if (!value) return '';

        let normalized = value.toString().trim();
    
        switch (key){
            case 'CONDITION':
                return normalized.toLowerCase();
            case 'PRICE':
                normalized = normalized.toLowerCase();
                return normalized.replace(/[$,]/g, '');
            case 'KILOMETERS':
                normalized = normalized.toLowerCase();
                return normalized.replace(/[km\s]|\.00000/g, '');
            default:
                return normalized;
        }
    }

    async function getTextFromVehicleCard(vehicleCard, selector) {
        try {
            if (!vehicleCard) return "";
            
            const vehicleCardElement = vehicleCard.querySelector(selector);
            if (!vehicleCardElement) return "";
            
            switch (vehicleCardElement.tagName) {
                case "IMG":
                    return handleImageElement(vehicleCardElement);
                default:
                    return handleTextElement(vehicleCardElement);
            }
        } catch (error) {
            console.error("An error occurred while getting the text:", error);
            return "";
        }
    }

    function handleImageElement(imgElement) {
        const imgSrc = imgElement.src || "";
        const imgSrcCardByThirdpartyReplacement = imgSrc.replace("-card.", "-THIRDPARTY.");
        return imgSrcCardByThirdpartyReplacement || "";
    }

    function handleTextElement(element) {
        let textSurroundingSpacesTrimmed = element.textContent.trim();
        return textSurroundingSpacesTrimmed.includes("Stock#:") ? textSurroundingSpacesTrimmed.replace("Stock#:", "").trim() : textSurroundingSpacesTrimmed;
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
