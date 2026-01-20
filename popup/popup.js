// popup.js
const fieldsContainer = document.getElementById('fieldsContainer');
const addFieldBtn = document.getElementById('addFieldBtn');
const saveManualBtn = document.getElementById('saveManualSelectors');
const exportSelectorsBtn = document.getElementById('exportSelectors');
const importSelectorsInput = document.getElementById('importSelectors');
const STORAGE_KEY = 'manualVehicleSelectors';
const KEY_FIELD_STORAGE = 'primaryKeyField';
const MANDATORY_FIELDS = ['vehicleCard', 'stockNumber', 'model', 'image'];
let currentPrimaryKey = 'stockNumber'; // Default

function createFieldRow(key = '', selector = '', locked = false, isPrimaryKey = false) {
  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.fieldKey = key;

  const keyIconClass = isPrimaryKey ? 'key-icon active' : 'key-icon';
  const keyIconTitle = isPrimaryKey ? 'Primary key (used for CSV matching)' : 'Set as primary key';

  row.innerHTML = `
    <button class="key-icon-btn ${keyIconClass}" title="${keyIconTitle}">🔑</button>
    <input class="field-key" ${locked ? 'readonly' : ''} value="${key}">
    <input class="field-selector" placeholder="CSS selector" value="${selector}">
    <button class="remove-btn"${locked ? ' disabled' : ''}>🗑</button>
  `;

  const keyBtn = row.querySelector('.key-icon-btn');
  keyBtn.addEventListener('click', () => {
    const currentKey = row.querySelector('.field-key').value.trim();
    if (currentKey === 'vehicleCard') {
      alert('❌ vehicleCard cannot be used as a primary key!');
      return;
    }
    setAsPrimaryKey(row);
  });

  row.querySelector('.remove-btn').addEventListener('click', () => { if (!locked) row.remove(); });
  fieldsContainer.appendChild(row);
}

function setAsPrimaryKey(row) {
  // Remove active state from all key icons
  fieldsContainer.querySelectorAll('.key-icon-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.title = 'Set as primary key';
  });

  // Set this row as primary
  const keyBtn = row.querySelector('.key-icon-btn');
  keyBtn.classList.add('active');
  keyBtn.title = 'Primary key (used for CSV matching)';

  const fieldKey = row.querySelector('.field-key').value.trim();
  currentPrimaryKey = fieldKey;
  console.log(`🔑 Primary key set to: ${currentPrimaryKey}`);
  console.log(`⚠️ Remember to click "Save Selectors" to persist this change!`);
}

async function getCurrentDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname.replace(/^www\./, '') : 'global';
}

async function loadManualSelectors() {
  const domain = await getCurrentDomain();
  const stored = await chrome.storage.local.get([STORAGE_KEY, KEY_FIELD_STORAGE]);
  const map = stored[STORAGE_KEY] || {};
  const selectors = map[domain] || {};

  // Load primary key for this domain
  const keyFieldMap = stored[KEY_FIELD_STORAGE] || {};
  currentPrimaryKey = keyFieldMap[domain] || 'stockNumber';

  fieldsContainer.innerHTML = '';
  MANDATORY_FIELDS.forEach(m => {
    const isPrimary = m === currentPrimaryKey;
    createFieldRow(m, selectors[m] || '', true, isPrimary);
  });
  for (const [key, value] of Object.entries(selectors)) {
    if (!MANDATORY_FIELDS.includes(key)) {
      const isPrimary = key === currentPrimaryKey;
      createFieldRow(key, value, false, isPrimary);
    }
  }
  console.log(`📦 Loaded selectors for ${domain}`, selectors);
  console.log(`🔑 Primary key for ${domain}: ${currentPrimaryKey}`);
}

async function saveManualSelectors() {
  const domain = await getCurrentDomain();
  console.log('💾 Saving for domain:', domain);
  console.log('💾 Current primary key:', currentPrimaryKey);

  const stored = await chrome.storage.local.get([STORAGE_KEY, KEY_FIELD_STORAGE]);
  const map = stored[STORAGE_KEY] || {};
  const rows = fieldsContainer.querySelectorAll('.field-row');
  const selectors = {};
  rows.forEach(row => {
    const key = row.querySelector('.field-key').value.trim();
    const selector = row.querySelector('.field-selector').value.trim();
    if (key && selector) selectors[key] = selector;
  });
  map[domain] = selectors;

  // Save primary key for this domain
  const keyFieldMap = stored[KEY_FIELD_STORAGE] || {};
  console.log('💾 Previous keyFieldMap:', keyFieldMap);
  keyFieldMap[domain] = currentPrimaryKey;
  console.log('💾 New keyFieldMap:', keyFieldMap);

  await chrome.storage.local.set({
    [STORAGE_KEY]: map,
    [KEY_FIELD_STORAGE]: keyFieldMap
  });

  console.log(`💾 Saved selectors for ${domain}`, selectors);
  console.log(`🔑 Saved primary key for ${domain}: ${currentPrimaryKey}`);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (domain, selectors, primaryKey) => {
        if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
        window.manualVehicleSelectors[domain] = selectors;
        window.primaryKeyField = primaryKey;
        window.dispatchEvent(new CustomEvent('selectorsUpdated', { detail: { domain, selectors, primaryKey } }));
      },
      args: [domain, selectors, currentPrimaryKey]
    });
  }
  alert(`✅ Selectors saved for ${domain}!\n🔑 Primary key: ${currentPrimaryKey}`);
}

addFieldBtn.addEventListener('click', () => createFieldRow());
saveManualBtn.addEventListener('click', saveManualSelectors);

async function exportVehicleSelectors() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const blob = new Blob([JSON.stringify(stored[STORAGE_KEY] || {}, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vehicle-selectors-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
exportSelectorsBtn.addEventListener('click', exportVehicleSelectors);

importSelectorsInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    await loadManualSelectors();
    alert('✅ Import successful!');
  } catch {
    alert('❌ Invalid JSON file.');
  }
});

loadManualSelectors();


document.addEventListener('DOMContentLoaded', async () => {
    const module = await import(chrome.runtime.getURL('../storage/vehicle-card-storage.js'));
    const {
      getCurrentDomain,
      getVehicleCardSelectors,
      setVehicleCardSelectors,
      exportVehicleCardSelectors,
      importVehicleCardSelectors
    } = module;
  
    const inputs = {
      card: document.getElementById('vehicleCardSelector'),
      stockNumber: document.getElementById('stockNumberSelector'),
      image: document.getElementById('imageSelector'),
      model: document.getElementById('modelSelector'),
      trim: document.getElementById('trimSelector')
    };
  
    let currentDomain = await getCurrentDomain();
    document.body.dataset.domain = currentDomain;
  
    async function loadSelectors() {
        try {
          if (!currentDomain) {
            currentDomain = await getCurrentDomain();
          }
          const data = (await getVehicleCardSelectors(currentDomain)) || {};
          for (const key in inputs) {
            if (inputs[key]) {
              inputs[key].value = data[key] || '';
            }
          }
          console.log(`📦 Loaded selectors for ${currentDomain}`, data);
        } catch (err) {
          console.warn(`⚠️ loadSelectors failed for ${currentDomain}:`, err);
        }
      }
      
      async function saveSelectors() {
        try {
          if (!currentDomain) {
            currentDomain = await getCurrentDomain();
          }
      
          const data = {};
          for (const key in inputs) {
            if (inputs[key]) {
              const val = inputs[key].value?.trim();
              if (val) data[key] = val;
            }
          }
      
          if (Object.keys(data).length === 0) {
            console.warn('⚠️ saveSelectors skipped: no valid inputs.');
            return;
          }
      
          await setVehicleCardSelectors(currentDomain, data);
          console.log(`💾 Saved selectors for ${currentDomain}`, data);
        } catch (err) {
          console.warn(`⚠️ saveSelectors failed for ${currentDomain}:`, err);
        }
      }
  
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.vehicleCardSelectorMap) {
        loadSelectors();
      }
    });
  
    for (const key in inputs) {
        const el = inputs[key];
        if (el) {
          el.addEventListener('input', () => {
            queueMicrotask(() => saveSelectors());
          });
          el.addEventListener('change', saveSelectors);
        }
      }

    document.getElementById('saveSelectors').addEventListener('click', saveSelectors);
    document.getElementById('exportSelectors').addEventListener('click', exportVehicleCardSelectors);
    document.getElementById('importSelectors').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await importVehicleCardSelectors(file);
      alert(ok ? '✅ Import successful!' : '❌ Import failed!');
      loadSelectors();
    });
  
    await loadSelectors();
    console.log('✨ Popup persistent system ready');
  });

const overlay = document.getElementById('loadingOverlay');

function toggleLoading(show) {
    if (show) {
        overlay.classList.add('visible');
    } else {
        overlay.classList.remove('visible');
    }
}

async function sendMessageToBackground(message) {
    try {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
}

chrome.runtime.sendMessage({ type: 'checkProcessingState' }, (response) => {
    if (response && response.isProcessing) {
        toggleLoading(true);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'startProcessing') {
        console.log('Starting processing...');
        toggleLoading(true);
        sendResponse({ success: true });
    } else if (message.type === 'stopProcessing') {
        console.log('Stopping processing...');
        setTimeout(() => {
            toggleLoading(false);
        }, 500);
        sendResponse({ success: true });
    } else if (message.type === 'exportToCSV') {
        console.log('Received export message:', {
            testType: message.testType,
            dataType: typeof message.data,
            isArray: Array.isArray(message.data),
            keys: Object.keys(message.data || {}),
            sample: message.data ? Object.values(message.data)[0] : null
        });
        exportToCSVFile(message.data, message.testType, message.siteName, message.primaryKeyField);
        sendResponse({ success: true });
    }
    return true;
});

window.addEventListener('unload', async () => {
    try {
        await sendMessageToBackground({ type: 'stopProcessing' });
    } catch (error) {
        console.error('Error stopping processing on unload:', error);
    }
});

window.addEventListener('blur', async () => {
    try {
        await sendMessageToBackground({ type: 'stopProcessing' });
    } catch (error) {
        console.error('Error stopping processing on blur:', error);
    }
});

const docsButton = document.querySelector('.docs-button');
const docsPopup = document.querySelector('.docs-popup');
let docsHideTimeout;

docsButton.addEventListener('mouseenter', function () {
    clearTimeout(docsHideTimeout);
    docsPopup.style.display = 'block';
    setTimeout(() => docsPopup.classList.add('visible'), 10);
});

docsButton.addEventListener('mouseleave', function () {
    docsHideTimeout = setTimeout(() => {
        docsPopup.classList.remove('visible');
        setTimeout(() => {
            if (!docsPopup.matches(':hover')) {
                docsPopup.style.display = 'none';
            }
        }, 200);
    }, 100);
});

docsPopup.addEventListener('mouseenter', function () {
    clearTimeout(docsHideTimeout);
    docsPopup.classList.add('visible');
});

docsPopup.addEventListener('mouseleave', function () {
    docsHideTimeout = setTimeout(() => {
        docsPopup.classList.remove('visible');
        setTimeout(() => {
            if (!docsButton.matches(':hover')) {
                docsPopup.style.display = 'none';
            }
        }, 200);
    }, 100);
});

const featuresButton = document.querySelector('.features-button');
const featuresList = document.querySelector('.features-list');
let featuresHideTimeout;

featuresButton.addEventListener('mouseenter', function () {
    clearTimeout(featuresHideTimeout);
    featuresList.style.display = 'block';
    setTimeout(() => featuresList.classList.add('visible'), 10);
});

featuresButton.addEventListener('mouseleave', function () {
    featuresHideTimeout = setTimeout(() => {
        featuresList.classList.remove('visible');
        setTimeout(() => {
            if (!featuresList.matches(':hover')) {
                featuresList.style.display = 'none';
            }
        }, 200);
    }, 100);
});

featuresList.addEventListener('mouseenter', function () {
    clearTimeout(featuresHideTimeout);
    featuresList.classList.add('visible');
});

featuresList.addEventListener('mouseleave', function () {
    featuresHideTimeout = setTimeout(() => {
        featuresList.classList.remove('visible');
        setTimeout(() => {
            if (!featuresButton.matches(':hover')) {
                featuresList.style.display = 'none';
            }
        }, 200);
    }, 100);
});

import { exportFieldMapsToJson, importFieldMapsFromJson } from '../storage/field-map-storage.js';
import { exportToCSVFile } from '../core/$csv-exporter.js';
import { IntellisenseSystem } from '../intellisense/intellisense-system.js';

const SETTINGS_KEY = 'featureSettings';
const toggleEditIconEl    = document.getElementById('toggleEditIcon');
const togglePrinterIconEl = document.getElementById('togglePrinterIcon');
const toggleAutofillEl    = document.getElementById('toggleAutofill');

async function loadSettings() {
    const { featureSettings } = await chrome.storage.local.get([SETTINGS_KEY]);
    const s = featureSettings || {};

    const leadsEditIcon = (typeof s.leadsEditIcon !== 'undefined') ? s.leadsEditIcon : (typeof s.editIcon !== 'undefined' ? s.editIcon : true);
    const leadsPrinterIcon = (typeof s.leadsPrinterIcon !== 'undefined') ? s.leadsPrinterIcon : (typeof s.printerIcon !== 'undefined' ? s.printerIcon : true);
    const autofill = (typeof s.autofill !== 'undefined') ? s.autofill : true;

    if (toggleEditIconEl) toggleEditIconEl.checked = !!leadsEditIcon;
    if (togglePrinterIconEl) togglePrinterIconEl.checked = !!leadsPrinterIcon;
    if (toggleAutofillEl) toggleAutofillEl.checked = !!autofill;

    await chrome.storage.local.set({
        [SETTINGS_KEY]: { ...s, leadsEditIcon, leadsPrinterIcon, autofill }
    });
}

async function saveSettings(partial) {
    const { featureSettings } = await chrome.storage.local.get([SETTINGS_KEY]);
    const next = { ...(featureSettings || {}), ...partial };

    if (typeof partial.leadsPrinterIcon !== 'undefined') {
        next.printerIcon = partial.leadsPrinterIcon;
    }
    if (typeof partial.leadsEditIcon !== 'undefined') {
        next.editIcon = partial.leadsEditIcon;
    }

    await chrome.storage.local.set({ [SETTINGS_KEY]: next });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'featureSettingsUpdated', settings: next }, () => {
                void chrome.runtime.lastError;
            });
  
        }
    });
}

if (toggleEditIconEl) {
    toggleEditIconEl.addEventListener('change', async (e) => {
        await saveSettings({ leadsEditIcon: e.target.checked });
    });
}
if (togglePrinterIconEl) {
    togglePrinterIconEl.addEventListener('change', async (e) => {
        await saveSettings({ leadsPrinterIcon: e.target.checked });
    });
}
if (toggleAutofillEl) {
    toggleAutofillEl.addEventListener('change', async (e) => {
        await saveSettings({ autofill: e.target.checked });
    });
}

loadSettings();


document.getElementById('exportButton').addEventListener('click', async () => {
    try {
        toggleLoading(true);
        await exportFieldMapsToJson();
    } catch (error) {
        console.error('Error exporting field maps:', error);
        alert('Error exporting field maps. Please try again.');
    } finally {
        toggleLoading(false);
    }
});

document.getElementById('importFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        toggleLoading(true);
        const success = await importFieldMapsFromJson(file);
        if (success) {
            alert('Field maps imported successfully!');
            window.location.reload();
        } else {
            alert('Error importing field maps. Please check the file format and try again.');
        }
    } catch (error) {
        console.error('Error importing field maps:', error);
        alert('Error importing field maps. Please try again.');
    } finally {
        toggleLoading(false);
        event.target.value = '';
    }
});

document.getElementById('exportIntellisenseProfile').addEventListener('click', async () => {
    try {
        toggleLoading(true);
        if (window.intellisenseSystem) {
            await window.intellisenseSystem.exportSiteProfile();
        } else {
            alert('Intellisense system not initialized');
        }
    } catch (error) {
        console.error('Error exporting intellisense profile:', error);
        alert('Error exporting intellisense profile. Please try again.');
    } finally {
        toggleLoading(false);
    }
});

document.getElementById('importIntellisenseFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        toggleLoading(true);
        const text = await file.text();
        if (window.intellisenseSystem) {
            const success = await window.intellisenseSystem.importSiteProfile(text);
            if (success) {
                alert('Intellisense profile imported successfully!');
            } else {
                alert('Error importing intellisense profile. Please check the file format.');
            }
        } else {
            alert('Intellisense system not initialized');
        }
    } catch (error) {
        console.error('Error importing intellisense profile:', error);
        alert('Error importing intellisense profile. Please try again.');
    } finally {
        toggleLoading(false);
        event.target.value = '';
    }
});

document.getElementById('showIntellisenseStats').addEventListener('click', async () => {
    try {
        if (window.intellisenseSystem) {
            const stats = window.intellisenseSystem.getProfileStats();
            const statsText = `
Site: ${stats.site}
Total Suggestions: ${stats.totalSuggestions}
            `;
            alert(statsText);
        } else {
            alert('Intellisense system not initialized');
        }
    } catch (error) {
        console.error('Error getting intellisense stats:', error);
        alert('Error getting intellisense statistics.');
    }
});