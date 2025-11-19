// csv-srp-data-matcher.js
import { saveFieldMapValues, getFieldMapValues } from '../storage/field-map-storage.js';

export async function getCurrentFieldMap() {
    const customFieldMap = {};
    const inputs = document.querySelectorAll('.field-mapping input');
  
    const norm = s => (s || '').toLowerCase().replace(/[\s_#"'’]+/g, '').trim();
    const looksLikeStock = name => {
      const n = norm(name);
      return n === 'stocknumber' || n === 'stock' || n === 'stk' || n === 'stockno' || n === 'stock#';
    };
  
    if (inputs.length > 0) {
      let stockSelectorFromInputs = '';
  
      inputs.forEach(input => {
        const originalFieldName = input.id.replace('Mapping', '');
        const fieldNameUpper = originalFieldName.toUpperCase();
        const selectorVal = input.value.trim();
  
        if (!selectorVal) return;
  
        customFieldMap[fieldNameUpper] = selectorVal;
  
        if (input.dataset && input.dataset.isStockField === 'true') {
          stockSelectorFromInputs = selectorVal;
        }
      });
  
      if (!customFieldMap.STOCKNUMBER && stockSelectorFromInputs) {
        customFieldMap.STOCKNUMBER = stockSelectorFromInputs;
      }
  
      if (!customFieldMap.STOCKNUMBER) {
        const maybe = Object.keys(customFieldMap).find(k => looksLikeStock(k));
        if (maybe) customFieldMap.STOCKNUMBER = customFieldMap[maybe];
      }
  
      if (!customFieldMap.STOCKNUMBER) {
        const msg = document.getElementById('csvFieldMapMessage');
        if (msg) {
          msg.textContent = 'Please set the selector for a stock field (e.g., Stock, Stock #, STK).';
          msg.style.color = '#c22';
        } else {
          alert('Please set the Stock field selector (Stock, Stock #, STK, or StockNumber).');
        }
        return null;
      }
  
      return customFieldMap;
    }
  
    const savedFieldMap = await getFieldMapValues();
    if (savedFieldMap && typeof savedFieldMap === 'object') {
      Object.assign(customFieldMap, savedFieldMap);
  
      if (!customFieldMap.STOCKNUMBER) {
        const maybe = Object.keys(customFieldMap).find(k => looksLikeStock(k));
        if (maybe) customFieldMap.STOCKNUMBER = customFieldMap[maybe];
      }
  
      if (!customFieldMap.STOCKNUMBER) {
        const msg = document.getElementById('csvFieldMapMessage');
        if (msg) {
          msg.textContent = 'Please set the Stock selector in the mappings.';
          msg.style.color = '#c22';
        } else {
          alert('Please set the Stock selector in the mappings.');
        }
        return null;
      }
  
      return customFieldMap;
    }
  
    const msg = document.getElementById('csvFieldMapMessage');
    if (msg) {
      msg.textContent = 'No mappings found. Paste CSV and reveal headers first.';
      msg.style.color = '#c22';
    } else {
      alert('No mappings found. Paste CSV and reveal headers first.');
    }
    return null;
  }
  

export async function refreshFieldMapInputs() {
    const savedFieldMap = await getFieldMapValues();
    console.log('Retrieved saved field map:', savedFieldMap);
    
    if (!savedFieldMap) {
        console.log('No saved field map found');
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    
    Object.entries(savedFieldMap).forEach(([field, selector]) => {
        const input = document.getElementById(`${field.toLowerCase()}Mapping`);
        if (input) {
            input.value = selector;
            console.log('Set saved value for', field, ':', selector);
        } else {
            console.log('Input not found for field:', field, 'with ID:', `${field.toLowerCase()}Mapping`);
        }
    });
}

async function initializeDataHandler() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['./core/$data-handler.js']
        });
    } catch (error) {
        console.error('Error initializing data handler:', error);
    }
}

export async function callFindUrlsAndModels() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const csvData = document.getElementById('csvData').value;
        
        if (!csvData.trim()) {
            alert('Please enter CSV data');
            return;
        }

        await initializeDataHandler();

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (data) => {
                return window.extractCSVHeaders(data);
            },
            args: [csvData]
        });

        if (results && results[0] && results[0].result) {
            const headers = results[0].result;
            console.log('Extracted headers:', headers);

            const fieldMappingsContainer = document.querySelector('.field-mappings');
            if (!fieldMappingsContainer) {
                console.error('Field mappings container not found');
                return;
            }

            fieldMappingsContainer.style.display = 'block';
            fieldMappingsContainer.innerHTML = '<h3>Vehicle Card Class Names</h3>';

            headers.forEach(header => {
                const fieldMapping = document.createElement('div');
                fieldMapping.className = 'field-mapping';
              
                const label = document.createElement('label');
                label.textContent = `${header}:`;
              
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `${header.toLowerCase().replace(/\s+/g, '_')}Mapping`;
                input.placeholder = 'Enter CSS selector';
              
                const normalizedHeader = header.toLowerCase().replace(/[\s_#"'’]+/g, '');
                const isStockHeader = (
                  normalizedHeader === 'stocknumber' ||
                  normalizedHeader === 'stock' ||
                  normalizedHeader === 'stk' ||
                  normalizedHeader === 'stockno' ||
                  normalizedHeader === 'stock#'
                );
              
                if (isStockHeader) {
                  input.required = true;
                  input.dataset.isStockField = 'true';
                  input.style.borderColor = '#ff4444';
                  label.innerHTML = `${header}: <span style="color: #ff4444;">*</span>`;
                }
              
                input.addEventListener('change', async () => {
                  const map = await getCurrentFieldMap();
                  if (map) await saveFieldMapValues(map);
                });
              
                fieldMapping.appendChild(label);
                fieldMapping.appendChild(input);
                fieldMappingsContainer.appendChild(fieldMapping);
              });
              
              let msg = document.getElementById('csvFieldMapMessage');
              if (!msg) {
                msg = document.createElement('div');
                msg.id = 'csvFieldMapMessage';
                msg.style.marginTop = '6px';
                fieldMappingsContainer.appendChild(msg);
              }
              

            await refreshFieldMapInputs();

            const processButton = document.getElementById('processCSV');
            if (processButton) {
                processButton.textContent = 'Process CSV';
                processButton.removeEventListener('click', callFindUrlsAndModels);
                processButton.addEventListener('click', async () => {
                    await refreshFieldMapInputs();
                    
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    const customFieldMap = await getCurrentFieldMap();
                    
                    if (!customFieldMap) {
                        console.error('Invalid field map, cannot process CSV');
                        return;
                    }
                    
                    const testType = 'CSV_SRP_DATA_MATCHER';

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['./core/$scrolling.js', './core/$data-handler.js']
                    });

                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: processCSVData,
                        args: [testType, csvData, customFieldMap]
                    });
                });
            }
        } else {
            console.error('No headers found in CSV data');
            alert('No headers found in CSV data. Please check your CSV format.');
        }
    } catch (error) {
        console.error('Error processing CSV:', error);
        alert('Error processing CSV data. Please try again.');
    }
}

function processCSVData(testType, csvData, customFieldMap) {
    let scannedVehicles = 0;
    let result = {};
    let isProcessing = true;

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

    findUrlsAndModels(testType, csvData);

    async function findUrlsAndModels(testType, csvData) {
        try {
            scannedVehicles = await window.scrollDownUntilLoadAllVehicles(result, csvData, testType);
            
            const allVehicleCards = document.querySelectorAll('.vehicle-car__section');

            await window.$dataHandler(allVehicleCards, csvData, result, testType);
            
            if (Object.keys(result).length > 0) {
                
                chrome.runtime.sendMessage({
                    type: 'exportToCSV',
                    data: result,
                    testType: testType,
                    siteName: window.location.hostname.replace('www.', '')
                });
            } else {
                console.log('No mismatches found to export');
            }
        } finally {
            isProcessing = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const matchCsvButton = document.getElementById('match csv data with SRP cards information');
    if (matchCsvButton) {
        matchCsvButton.addEventListener('click', async (event) => {
            event.preventDefault();
            const csvInput = document.getElementById('csvInput');
            const hrefInput = document.getElementById('hrefInput');
            
            if (hrefInput && hrefInput.style.display === 'block') {
                hrefInput.style.display = 'none';
            }
            
            if (csvInput.style.display === 'none' || !csvInput.style.display) {
                csvInput.style.display = 'block';
            } else {
                csvInput.style.display = 'none';
            }
        });
    }

    const revealHeaderButton = document.getElementById('revealHeader');
    if (revealHeaderButton) {
        revealHeaderButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await callFindUrlsAndModels();
        });
    }

    const processCSVButton = document.getElementById('processCSV');
    if (processCSVButton) {
        processCSVButton.addEventListener('click', async (event) => {
            event.preventDefault();
            const csvData = document.getElementById('csvData').value;
            if (!csvData.trim()) {
                alert('Please enter CSV data');
                return;
            }

            await refreshFieldMapInputs();
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const customFieldMap = await getCurrentFieldMap();
            
            if (!customFieldMap) {
                console.error('Invalid field map, cannot process CSV');
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const testType = 'CSV_SRP_DATA_MATCHER';

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['./core/$scrolling.js', './core/$data-handler.js']
            });

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: processCSVData,
                args: [testType, csvData, customFieldMap]
            });
        });
    }
});