document.getElementById('match csv data with SRP cards information').addEventListener('click', async (event) => {
    const csvInput = document.getElementById('csvInput');
    const hrefInput = document.getElementById('hrefInput');
    
    if (hrefInput.style.display === 'block') {
        hrefInput.style.display = 'none';
    }
    
    csvInput.style.display = csvInput.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('processCSV').addEventListener('click', async () => {
    const csvData = document.getElementById('csvData').value;
    if (!csvData.trim()) {
        alert('Please enter CSV data');
        return;
    }

    chrome.storage.local.set({ 'csvData': csvData }, async () => {
        const testType = 'match-csv-data-with-srp-cards-information';
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: callFindUrlsAndModels,
            args: [testType]
        });
    });
});

function callFindUrlsAndModels(testType) {
    findUrlsAndModels(testType);

    async function findUrlsAndModels(testType) {
		let scannedVehicles = 0;
        let result = {};

		scannedVehicles = await scrollDownUntilLoadAllVehicles(scannedVehicles, result);

		const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
		console.log(message);
		console.log(result);
        
		exportToCSVFile(result, testType);
    }

	async function scrollDownUntilLoadAllVehicles(scannedVehicles, result) {
		let actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
		let lastElementsLoaded = 0;
        let totalElementsLoaded = 0;

		while (actualElementsLoaded !== lastElementsLoaded) {
			lastElementsLoaded = actualElementsLoaded;
			window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            
            const viewMoreButton = document.querySelector('button.lbx-load-more-btn');
            const paginationRightArrow = document.querySelector('.right-arrow');
            if (viewMoreButton) {
                console.warn('Clicking "View More Vehicles" button...');
                viewMoreButton.click();
            }
            else if (paginationRightArrow){
                lastElementsLoaded = -1;
                console.warn('Clicking pagination right arrow...');
                paginationRightArrow.click();
            }

			await new Promise(resolve => setTimeout(resolve, 1000));

			actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
                
            const windowLocationHostname = window.location.hostname;

            switch (windowLocationHostname){            
                
                case "landrovertoronto.ca":
                case "jaguartoronto.com":
                case "countychevroletessex.com":
                    totalElementsLoaded = actualElementsLoaded;
                    break;

                case "www.bridgesgm.com":
                case "mcnaughtbuickgmc.kinsta.cloud":
                case "nursechevrolet.kinsta.cloud":
                    totalElementsLoaded += actualElementsLoaded;
                    break;
                }            
                console.warn(`${totalElementsLoaded} elements loaded.`);
                scannedVehicles = await readVehiclesAndAddResults(result);           
		}
		console.warn("Finished scrolling, all vehicles loaded.");
        return scannedVehicles;
	}

    async function readVehiclesAndAddResults(result) {
        const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
    
        const FIELD_MAP = {
            DEALER_ID:                  { srp: "",                              csv: "Dealer Id" },
            CONDITION:                  { srp: ".value__status",                csv: "Condition" },
            LAST_UPDATE:                { srp: "",                              csv: "LastUpdate" },
            YEAR:                       { srp: ".value__year",                  csv: "Year" },
            MAKE:                       { srp: ".value__make",                  csv: "Make" },
            MODEL:                      { srp: ".value__model",                 csv: "Model" },
            PHOTOS:                     { srp: "",                              csv: "Photos" },
            PHOTO_UPDATE:               { srp: "",                              csv: "PhotoUpdate" },
            ADDITIONAL_PHOTOS:          { srp: "",                              csv: "AdditionalPhotos" },
            ADDITIONAL_PHOTOS_UPDATE:   { srp: "",                              csv: "AdditionalPhotosUpdate" },
            BODY:                       { srp: "",                              csv: "Body" },
            DOORS:                      { srp: "",                              csv: "Doors" },
            DRIVE:                      { srp: "",                              csv: "Drive" },
            ENGINE:                     { srp: ".text__engine",                 csv: "Engine" },
            MFG_EXTERIOR_COLOR:         { srp: ".value__exterior .uppercase",   csv: "MFGExteriorColor" },
            EXTERIOR_COLOR:             { srp: "",                              csv: "ExteriorColor" },
            FUEL:                       { srp: "",                              csv: "Fuel" },
            INTERIOR_COLOR:             { srp: "",                              csv: "InteriorColor" },
            NO_PASSENGERS:              { srp: "",                              csv: "NoPassengers" },
            PRICE:                      { srp: ".price__second",                csv: "Price" },
            STOCK_NUMBER:               { srp: ".stock_number",                 csv: "StockNumber" },
            TRIM:                       { srp: ".value__trim",                  csv: "Trim" },
            VIN:                        { srp: ".value__vin span.uppercase",    csv: "VIN" },
            KILOMETERS:                 { srp: ".text__mileage",                csv: "Kilometers" },
            TRANSMISSION:               { srp: "",                              csv: "Transmission" },
            DESCRIPTION:                { srp: "",                              csv: "Description" },
            OPTIONS:                    { srp: "",                              csv: "Options" },
            TYPE:                       { srp: "",                              csv: "Type" },
            SUB_TYPE:                   { srp: "",                              csv: "SubType" },
            VDP_URL:                    { srp: "",                              csv: "VDP Url" },
            AGE:                        { srp: "",                              csv: "Age" },
            IS_CGI_PICTURE:             { srp: "",                              csv: "IsCGIPicture" },
            IS_VIN_SAVER:               { srp: "",                              csv: "IsVinSaver" },
            IS_JUMPSTART:               { srp: "",                              csv: "IsJumpstart" }
        };

        const mismatcheExceptions = [
            { srp: [""], csv: ["SKIP"] },
            { srp: ["–"], csv: ["0"] },
            { srp: ["contactus"],  csv: [""] }
        ];
    
        for (const srpVehicle of allVehicleCards) {
            const srpStockNumber = await getTextFromVehicleCard(srpVehicle, FIELD_MAP["STOCK_NUMBER"].srp);
            const csvStockNumber = await getVehicleValue(srpStockNumber, FIELD_MAP["STOCK_NUMBER"].csv);
            const csvVehicle = await getCSVVehicleData(srpStockNumber);
    
            if (srpStockNumber === csvStockNumber && csvVehicle && typeof csvVehicle === 'object') {
                for (const [map_key, map] of Object.entries(FIELD_MAP)) {
                    const srpSelector = map.srp;
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
    
    

    //======================================= HELPERS ===============================================

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

        try{
            if(vehicleCardElement) {

                vehicleCard = vehicleCardElement.querySelector(selector);
                if (!vehicleCard) return "";
                const text = vehicleCard.textContent.trim();
                return text;
            }
        } catch (error) {
            console.error("An error occurred while getting the text:", error);
            return "";
        }
    }

    async function fetchCSVData() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['csvData'], function(result) {
                if (chrome.runtime.lastError) {
                    console.error("Error fetching CSV data:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                
                if (!result.csvData) {
                    console.error("No CSV data found in storage");
                    reject(new Error("No CSV data found. Please provide CSV data through the popup."));
                    return;
                }
                
                resolve(result.csvData);
            });
        });
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

    async function getCSVVehicleData(stockNumber) {
        let cachedCSVMap = null; 
        const csvVehicle = await fetchCSVData(); 

        cachedCSVMap = await csvParser(csvVehicle);
        
        return cachedCSVMap[stockNumber] || null;
    }
        
    async function getVehicleValue(stockNumber, valueKey) {
        const vehicleData = await getCSVVehicleData(stockNumber);
        if (!vehicleData) return null;
        
        return vehicleData[valueKey] ?? null;
    }      
}
