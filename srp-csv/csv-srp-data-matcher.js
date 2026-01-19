// csv-srp-data-matcher.js
import { saveFieldMapValues, getFieldMapValues } from '../storage/field-map-storage.js';

// Collect field transforms and validation settings from all fields
function collectFieldSettings() {
    const transforms = {};
    const validationEnabled = {};
    const fieldWrappers = document.querySelectorAll('.field-mappings > div:not(#csvFieldMapMessage)');

    fieldWrappers.forEach(wrapper => {
        // Get the field label to identify the field
        const label = wrapper.querySelector('label');
        if (!label) return;

        const fieldName = label.textContent.replace(':', '').replace('*', '').trim().toUpperCase();

        // Get validation checkbox
        const validateCheckbox = wrapper.querySelector('input[type="checkbox"]');
        if (validateCheckbox) {
            validationEnabled[fieldName] = validateCheckbox.checked;
        }

        // Get transform controls
        const selects = wrapper.querySelectorAll('select');
        const valueInput = wrapper.querySelector('input[type="text"]:not([id$="Mapping"])');

        if (selects.length >= 3 && valueInput) {
            const action = selects[0].value;
            const type = selects[1].value;
            const value = valueInput.value.trim();
            const target = selects[2].value;

            if (action && value) {
                transforms[fieldName] = { action, type, value, target };
            }
        }
    });

    console.log('🔄 Collected field transforms:', transforms);
    console.log('✅ Validation enabled for:', validationEnabled);
    return { transforms, validationEnabled };
}

export async function getCurrentFieldMap() {
    const customFieldMap = {};
    const inputs = document.querySelectorAll('input[id$="Mapping"]');

    const norm = s => (s || '').toLowerCase().replace(/[\s_#"'']+/g, '').trim();
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
            files: ['/core/$data-handler.js']
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
                const fieldWrapper = document.createElement('div');
                fieldWrapper.style.cssText = 'margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 8px; background: rgba(200,200,200,0.2);';

                // Field label with validation checkbox
                const labelRow = document.createElement('div');
                labelRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';

                const validateCheckbox = document.createElement('input');
                validateCheckbox.type = 'checkbox';
                validateCheckbox.checked = true;
                validateCheckbox.id = `${header.toLowerCase().replace(/\s+/g, '_')}Validate`;
                validateCheckbox.title = 'Enable validation for this field';
                validateCheckbox.style.cssText = 'cursor: pointer;';

                const label = document.createElement('label');
                const normalizedHeader = header.toLowerCase().replace(/[\s_#"'']+/g, '');
                const isStockHeader = (
                  normalizedHeader === 'stocknumber' ||
                  normalizedHeader === 'stock' ||
                  normalizedHeader === 'stk' ||
                  normalizedHeader === 'stockno' ||
                  normalizedHeader === 'stock#'
                );
                label.innerHTML = isStockHeader ? `${header}: <span style="color: #ff4444;">*</span>` : `${header}:`;
                label.style.cssText = 'font-weight: bold; color: #000; cursor: pointer; flex: 1;';
                label.htmlFor = validateCheckbox.id;

                // Add tooltip text
                const tooltipText = document.createElement('span');
                tooltipText.textContent = '(uncheck to skip validation)';
                tooltipText.style.cssText = 'font-size: 10px; color: #666; font-weight: normal;';

                labelRow.appendChild(validateCheckbox);
                labelRow.appendChild(label);
                labelRow.appendChild(tooltipText);

                // CSS Selector input
                const selectorRow = document.createElement('div');
                selectorRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';

                const input = document.createElement('input');
                input.type = 'text';
                input.id = `${header.toLowerCase().replace(/\s+/g, '_')}Mapping`;
                input.placeholder = 'Enter CSS selector';
                input.style.cssText = 'flex: 1; padding: 4px;';
                input.className = 'field-mapping';

                if (isStockHeader) {
                  input.required = true;
                  input.dataset.isStockField = 'true';
                  input.style.borderColor = '#ff4444';
                }

                input.addEventListener('change', async () => {
                  const map = await getCurrentFieldMap();
                  if (map) await saveFieldMapValues(map);
                });

                selectorRow.appendChild(input);

                // Transform controls row
                const transformRow = document.createElement('div');
                transformRow.style.cssText = 'display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 11px; color: #333;';

                const actionSelect = document.createElement('select');
                actionSelect.style.cssText = 'padding: 4px; border-radius: 3px; font-size: 11px;';
                actionSelect.innerHTML = `
                    <option value="">No transform</option>
                    <option value="remove">Remove</option>
                    <option value="add">Add</option>
                `;

                const typeSelect = document.createElement('select');
                typeSelect.style.cssText = 'padding: 4px; border-radius: 3px; font-size: 11px;';
                typeSelect.innerHTML = `
                    <option value="suffix">Suffix</option>
                    <option value="prefix">Prefix</option>
                `;

                const valueInput = document.createElement('input');
                valueInput.type = 'text';
                valueInput.placeholder = 'e.g., .00';
                valueInput.style.cssText = 'flex: 1; min-width: 60px; padding: 4px; border-radius: 3px; font-size: 11px;';

                const targetSelect = document.createElement('select');
                targetSelect.style.cssText = 'padding: 4px; border-radius: 3px; font-size: 11px;';
                targetSelect.innerHTML = `
                    <option value="both">Both</option>
                    <option value="srp">SRP</option>
                    <option value="csv">CSV</option>
                `;

                transformRow.appendChild(actionSelect);
                transformRow.appendChild(typeSelect);
                transformRow.appendChild(valueInput);
                transformRow.appendChild(document.createTextNode(' from '));
                transformRow.appendChild(targetSelect);

                fieldWrapper.appendChild(labelRow);
                fieldWrapper.appendChild(selectorRow);
                fieldWrapper.appendChild(transformRow);
                fieldMappingsContainer.appendChild(fieldWrapper);
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

                    // Collect field settings from UI
                    const { transforms, validationEnabled } = collectFieldSettings();

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['/core/$scrolling.js', '/core/$data-handler.js']
                    });

                    // Load manual selectors into window before running
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: async () => {
                            const domain = location.hostname.replace(/^www\./, '');
                            const stored = await chrome.storage.local.get('manualVehicleSelectors');
                            const all = stored.manualVehicleSelectors || {};
                            const selectors = all[domain] || all.global || {};
                            if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
                            window.manualVehicleSelectors[domain] = selectors;
                            console.log('Loaded selectors for domain:', domain, selectors);
                        }
                    });

                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: processCSVData,
                        args: [testType, csvData, customFieldMap, transforms, validationEnabled]
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

function processCSVData(testType, csvData, customFieldMap, fieldTransforms = {}, validationEnabled = {}) {
    let scannedVehicles = 0;
    let result = {};
    let isProcessing = true;

    window.customFieldMap = customFieldMap;
    window.fieldTransforms = fieldTransforms;
    window.validationEnabled = validationEnabled;
    console.log('🔄 Field transforms loaded:', fieldTransforms);
    console.log('✅ Validation enabled for:', validationEnabled);

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

            // Get the vehicle card selector from manual selectors
            const domain = location.hostname.replace(/^www\./, '');
            const selectors = window.manualVehicleSelectors?.[domain] || window.manualVehicleSelectors?.['global'] || {};
            const vehicleCardSelector = selectors.vehicleCard || '.vehicle-car__section';

            console.log(`🔍 Using vehicle card selector: "${vehicleCardSelector}"`);
            const allVehicleCards = document.querySelectorAll(vehicleCardSelector);
            console.log(`🔍 Found ${allVehicleCards.length} vehicle cards`);

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

            // Collect field settings from UI
            const { transforms, validationEnabled } = collectFieldSettings();

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['/core/$scrolling.js', '/core/$data-handler.js']
            });

            // Load manual selectors into window before running
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    const domain = location.hostname.replace(/^www\./, '');
                    const stored = await chrome.storage.local.get('manualVehicleSelectors');
                    const all = stored.manualVehicleSelectors || {};
                    const selectors = all[domain] || all.global || {};
                    if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
                    window.manualVehicleSelectors[domain] = selectors;
                    console.log('Loaded selectors for domain:', domain, selectors);
                }
            });

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: processCSVData,
                args: [testType, csvData, customFieldMap, transforms, validationEnabled]
            });
        });
    }
});
