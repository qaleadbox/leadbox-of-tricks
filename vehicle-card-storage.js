// vehicle-card-storage.js
const VEHICLE_CARD_KEY = 'vehicleCardSelectorMap';

export async function getCurrentDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return 'global';
  const url = new URL(tab.url);
  return url.hostname.replace(/^www\./, '');
}

export async function getVehicleCardSelectors(domain) {
  const stored = await chrome.storage.local.get(VEHICLE_CARD_KEY);
  if (stored[VEHICLE_CARD_KEY] && stored[VEHICLE_CARD_KEY][domain]) {
    return stored[VEHICLE_CARD_KEY][domain];
  }

  return {
    card: 'div.vehicle-card, div.vehicle-car__section',
    stockNumber: '.stock-number-value, .value__stock',
    image: '.main-img, picture img',
    model: '.vehicle-title, .title-text',
    trim: '.vehicle-trim, .subtitle'
  };
}

export async function setVehicleCardSelectors(domain, selectors) {
  const stored = await chrome.storage.local.get(VEHICLE_CARD_KEY);
  const map = stored[VEHICLE_CARD_KEY] || {};
  map[domain] = selectors;
  await chrome.storage.local.set({ [VEHICLE_CARD_KEY]: map });
  console.log(`💾 Vehicle selectors saved for ${domain}`, selectors);
}

export async function exportVehicleCardSelectors() {
  const stored = await chrome.storage.local.get(VEHICLE_CARD_KEY);
  const data = stored[VEHICLE_CARD_KEY] || {};
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vehicle_card_selectors.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importVehicleCardSelectors(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (typeof data !== 'object') throw new Error('Invalid format');
    await chrome.storage.local.set({ [VEHICLE_CARD_KEY]: data });
    console.log('✅ Vehicle selectors imported');
    return true;
  } catch (err) {
    console.error('❌ Import failed', err);
    return false;
  }
}
