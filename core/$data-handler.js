// data-handler.js
(async () => {
	try {
		const domain = window.location.hostname.replace(/^www\./, '');
		const stored = await chrome.storage.local.get('manualVehicleSelectors');
		const all = stored.manualVehicleSelectors || {};
		const selectors = all[domain] || all.global || {};
		if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
		window.manualVehicleSelectors[domain] = selectors;
		console.log(`♻️ Updated manualVehicleSelectors for ${domain}`, selectors);
	} catch (err) {
		console.warn('⚠️ Failed to initialize manualVehicleSelectors:', err);
	}
})();

window.toggleModuleSection = function (buttonId, sectionId) {
	const btn = document.getElementById(buttonId);
	const section = document.getElementById(sectionId);
	if (!btn || !section) return;
	btn.addEventListener('click', () => {
		document.querySelectorAll('.import-export-section, .module-section').forEach(sec => {
			if (sec.id !== sectionId) sec.style.display = 'none';
		});
		section.style.display = section.style.display === 'block' ? 'none' : 'block';
	});
};

document.addEventListener('DOMContentLoaded', () => {
	toggleModuleSection('check small images', 'smallImageSettingsDiv');
	toggleModuleSection('check missing images', 'methodSelectionDiv');
	toggleModuleSection('match csv data with SRP cards information', 'csvInput');
});

async function getVehicleInfoFromElement(element) {
	const { stockNumber, model, trim, image } = await extractFields(element);
	if (!stockNumber || !model) {
		console.warn("⚠️ Missing stockNumber or model", { stockNumber, model, element });
	}
	return { stockNumber, model, trim, image };
}

async function loadManualSelectors() {
	const domain = window.location.hostname.replace(/^www\./, '');

	if (window.manualVehicleSelectors?.[domain]) {
		return window.manualVehicleSelectors[domain];
	}

	try {
		const stored = await chrome.storage.local.get('manualVehicleSelectors');
		const all = stored.manualVehicleSelectors || {};
		const selectors = all[domain] || all.global || {};

		if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
		window.manualVehicleSelectors[domain] = selectors;

		console.log(`📦 Loaded manualVehicleSelectors for ${domain}`, selectors);
		return selectors;
	} catch (err) {
		console.warn('⚠️ Could not read manualVehicleSelectors from storage:', err);
		return {};
	}
}

async function getVehicleCardSelector() {
	const domain = window.location.hostname.replace(/^www\./, '');
	const selectors = await loadManualSelectors();

	const selector = selectors.vehicleCard || selectors.card || null;
	if (!selector) {
		console.warn(`⚠️ Missing 'vehicleCard' selector for ${domain}. Please configure in popup.`);
		return null;
	}

	return selector;
}

async function getFieldSelectors() {
	const selectors = await loadManualSelectors();
	if (!Object.keys(selectors).length) {
		console.warn("⚠️ No field selectors available. Popup configuration required.");
	}
	return selectors;
}

async function extractFields(element) {
	const domain = window.location.hostname.replace(/^www\./, '');
	const stored = (await chrome.storage.local.get('manualVehicleSelectors')).manualVehicleSelectors || {};
	const selectors =
		stored[domain] ||
		stored.global ||
		window.manualVehicleSelectors?.[domain] ||
		{};

	const fields = { stockNumber: '', model: '', trim: '', image: '' };

	if (!Object.keys(selectors).length) {
		console.warn(`⚠️ extractFields(): No selectors found for ${domain}`);
		return fields;
	}

	const normalized = {};
	for (const [key, val] of Object.entries(selectors)) {
		normalized[key.toLowerCase()] = val;
	}

	const map = {
		stockNumber: normalized.stocknumber || normalized['stock_number'] || normalized.stock || '',
		model: normalized.model || '',
		trim: normalized.trim || '',
		image: normalized.image || ''
	};

	for (const [key, sel] of Object.entries(map)) {
		if (!sel) continue;
		const el = element.querySelector(sel);
		if (!el) {
			console.debug(`⚠️ ${domain} → selector not found for ${key}: ${sel}`);
			continue;
		}

		if (el.tagName === 'IMG') {
			fields[key] = el.src || el.dataset.src || '';
		} else {
			fields[key] = el.textContent.replace(/Stock#?:?/i, '').trim();
		}
	}

	if (!fields.stockNumber) {
		const alt = element.querySelector('.stock-number, .value__stock, .stock_label, [data-stock]');
		if (alt) {
			fields.stockNumber = alt.textContent.replace(/Stock#?:?/i, '').trim();
			console.log(`🪄 Fallback stockNumber extracted for ${domain}:`, fields.stockNumber);
		} else {
			console.warn(`⚠️ No stockNumber found for card on ${domain}`, element);
		}
	}

	console.log(`🔍 extractFields() for ${domain}`, fields);
	return fields;
}

function detectScrollMode() {
	if (document.querySelector('div.lbx-paginator')) return 'pagination';
	if (document.querySelector('button.lbx-load-more-btn')) return 'viewmore';
	return 'infinite';
}

window.$dataHandler = async function (allVehicleCards, csvData, result, testType, highlightCard) {
	const fieldSelectors = await getFieldSelectors();
	const vehicleSelector = await getVehicleCardSelector();
	if (!vehicleSelector) {
		alert("⚠️ No vehicleCard selector found. Please configure it in the popup first.");
		return [];
	}

	const cards = document.querySelectorAll(vehicleSelector);
	const scrollMode = detectScrollMode();
	let lastProcessingTime = 0;

	if (typeof addProcessingStyles === 'function') addProcessingStyles();

	cards.forEach(card => {
		if (!card.classList.contains('processed-card') &&
			!card.classList.contains('coming-soon-card') &&
			!card.classList.contains('small-image-card')) {
			card.classList.remove('processing-card');
			card.classList.add('waiting-card');
			card.setAttribute('data-processing-info', 'Waiting...');
		}
	});

	switch (testType) {
		case "CSV_SRP_DATA_MATCHER": {
			startProcessingSpinner();

			// Debug: Log the vehicle cards being processed
			console.log(`🔍 DEBUG: Total vehicle cards to process: ${allVehicleCards.length}`);
			console.log(`🔍 DEBUG: customFieldMap:`, window.customFieldMap);

			if (allVehicleCards.length === 0) {
				console.error(`❌ No vehicle cards found! Check your vehicle card selector.`);
				stopProcessingSpinner();
				return result;
			}

			if (!window.customFieldMap || !window.customFieldMap.STOCKNUMBER) {
				console.error(`❌ customFieldMap.STOCKNUMBER is not set!`, window.customFieldMap);
				stopProcessingSpinner();
				return result;
			}

			let csvMap = {};
			if (csvData) csvMap = await csvParser(csvData);
			if (!result || Array.isArray(result)) result = {};

			const normalizeKey = k => k ? k.replace(/^"+|"+$/g, '').trim().toUpperCase() : '';

			const keySynonyms = {
				STOCKNUMBER: ['STOCK', 'STK', 'STOCK#', 'STOCK_NO', 'STOCK_NO.', 'STOCKNUMBER']
			};

			const csvHeaders = Object.keys(csvMap[Object.keys(csvMap)[0]] || []);
			const csvHeadersNorm = csvHeaders.map(h => normalizeKey(h));
			const fieldToCsvMapping = {};

			for (const fieldKey of Object.keys(window.customFieldMap)) {
				const normalizedField = normalizeKey(fieldKey);
				let matchIdx = csvHeadersNorm.indexOf(normalizedField);
				if (matchIdx === -1) {
					const synonyms = keySynonyms[normalizedField] || [];
					matchIdx = csvHeadersNorm.findIndex(h =>
						synonyms.some(s => normalizeKey(s) === h)
					);
				}
				if (matchIdx !== -1) {
					fieldToCsvMapping[fieldKey] = csvHeaders[matchIdx];
				} else {
					console.warn(`⚠️ No matching CSV header found for field: ${fieldKey}`);
				}
			}

			let processedVehicles = 0;
			let vehiclesWithMismatches = 0;
			const srpStocksMap = {};
			const unmatchedStocks = [];

			for (const srpVehicle of allVehicleCards) {
				const stockSel = window.customFieldMap.STOCKNUMBER;
				console.log(`🔍 DEBUG: Trying to get stock with selector: "${stockSel}"`);

				// Test if the selector finds an element
				const testEl = srpVehicle.querySelector(stockSel);
				console.log(`🔍 DEBUG: Element found:`, testEl);
				console.log(`🔍 DEBUG: Element text:`, testEl?.textContent);

				let srpStockNumber = await getTextFromVehicleCard(srpVehicle, stockSel);
				console.log(`🔍 DEBUG: Raw stock from getTextFromVehicleCard: "${srpStockNumber}"`);

				srpStockNumber = srpStockNumber?.replace(/^0+/, '').trim().replace(/['"]+/g, '');
				console.log(`🔍 DEBUG: Stock after cleanup: "${srpStockNumber}"`);

				if (!srpStockNumber) {
					console.warn(`⚠️ DEBUG: Skipping vehicle - no stock number found`);
					continue;
				}

				// Log all SRP stock values detected
				console.log(`🔍 SRP Stock Detected: "${srpStockNumber}"`);

				const csvVehicle = Object.entries(csvMap).find(([key]) =>
					normalizeKey(key) === normalizeKey(srpStockNumber)
				)?.[1];

				if (!csvVehicle) {
					console.warn(`🚫 CSV vehicle not found for stock: ${srpStockNumber}`);
					srpStocksMap[srpStockNumber] = { detected: true, matched: false, reason: 'Not in CSV' };
					unmatchedStocks.push(srpStockNumber);

					// Get all field values from SRP card even when not matched
					const srpCardData = {};
					for (const [field, selector] of Object.entries(window.customFieldMap)) {
						if (!selector) continue;
						const srpRaw = await getTextFromVehicleCard(srpVehicle, selector);
						const srpTransformed = applyFieldTransform((srpRaw || '').toString().trim(), field, 'srp');
						srpCardData[field] = normalizeValue(field, srpTransformed);
					}
					console.log(`📋 Unmatched Stock "${srpStockNumber}" SRP Data:`, srpCardData);
					continue;
				}

				srpStocksMap[srpStockNumber] = { detected: true, matched: true };
				processedVehicles++;
				let hasMismatches = false;
				const mismatches = {};
				const matchedStockData = { csv: {}, srp: {} };

				for (const [field, selector] of Object.entries(window.customFieldMap)) {
					if (!selector || field.toUpperCase() === "STOCKNUMBER") continue;

					// Check if validation is enabled for this field
					const fieldUpper = field.toUpperCase();
					const shouldValidate = window.validationEnabled?.[fieldUpper] !== false;

					if (!shouldValidate) {
						console.log(`⏭️  Skipping validation for field "${field}" (disabled by user)`);
						continue;
					}

					const csvHeader = fieldToCsvMapping[field];
					const csvRaw = csvHeader ? csvVehicle[csvHeader] : undefined;
					const srpRaw = await getTextFromVehicleCard(srpVehicle, selector);

					// Apply field-specific transformation (add/remove prefix/suffix) BEFORE normalization
					const csvTransformed = applyFieldTransform((csvRaw || '').toString().trim(), field, 'csv');
					const srpTransformed = applyFieldTransform((srpRaw || '').toString().trim(), field, 'srp');

					// Apply normalization
					const csvNorm = normalizeValue(field, csvTransformed);
					const srpNorm = normalizeValue(field, srpTransformed);

					console.log(`🔍 Field "${field}": CSV="${csvRaw}" → transformed:"${csvTransformed}" → normalized:"${csvNorm}", SRP="${srpRaw}" → transformed:"${srpTransformed}" → normalized:"${srpNorm}"`);

					// Store all values for matched stock logging
					matchedStockData.csv[field] = csvNorm;
					matchedStockData.srp[field] = srpNorm;

					if (await isExceptionValue(field, csvNorm, srpNorm)) continue;
					if (srpNorm !== csvNorm) {
						hasMismatches = true;
						mismatches[field] = { csv: csvNorm, srp: srpNorm };
						console.log(`❌ Mismatch for ${srpStockNumber} → ${field}: CSV="${csvNorm}" SRP="${srpNorm}"`);
					}
				}

				// Log all data for matched stock
				console.log(`✅ Matched Stock "${srpStockNumber}" Full Data:`, matchedStockData);

				if (hasMismatches) {
					vehiclesWithMismatches++;
					if (!result[srpStockNumber]) result[srpStockNumber] = { mismatches };
					else Object.assign(result[srpStockNumber].mismatches, mismatches);
				}
			}

			const matchedStocks = Object.keys(srpStocksMap).filter(s => srpStocksMap[s].matched);
			const totalDetected = Object.keys(srpStocksMap).length;

			console.log("🚗 ALL DETECTED SRP STOCKS:", srpStocksMap);
			console.log(`📊 STOCK SUMMARY:
  Total SRP Stocks Detected: ${totalDetected}
  Matched in CSV: ${matchedStocks.length}
  Not Matched in CSV: ${unmatchedStocks.length}
  Vehicles with Mismatches: ${vehiclesWithMismatches}`);
			console.log("✅ Matched Stocks:", matchedStocks);
			console.log("❌ Unmatched Stocks:", unmatchedStocks);
			console.log(`✅ CSV matcher done: ${processedVehicles} processed, ${vehiclesWithMismatches} mismatched.`);
			stopProcessingSpinner();
			return result;
		}

		case "SMALL_IMAGE_DETECTOR": {

			startProcessingSpinner();

			if (!Array.isArray(result)) result = [];
			for (const element of cards) {
				if (element.classList.contains('small-image-card')) continue;
				if (scrollMode !== 'infinite' && element.classList.contains('processed-card')) continue;

				const start = performance.now();
				element.classList.remove('waiting-card');
				element.classList.add('processing-card');
				if (typeof updateProcessingInfo === 'function') updateProcessingInfo(element, 0, lastProcessingTime);

				const img = element.querySelector(fieldSelectors.image) || element.querySelector('img');
				const imageUrl = (img?.dataset?.src || img?.src || '').trim();
				const { stockNumber, model, trim, image } = await extractFields(element);

				console.log("🔍 ExtractFields Debug", {
					usedSelectors: await getFieldSelectors(),
					stockNumber,
					model,
					trim,
					image,
					elementPreview: element.outerHTML.substring(0, 200) + '...'
				});

				try {
					if (model && stockNumber && imageUrl) {
						const exists = result.some(v => v.stockNumber === stockNumber);
						const res = await window.isSmallImageByUrl(imageUrl);
						const elapsed = (performance.now() - start) / 1000;
						element.classList.remove('processing-card');
						if (res && res.isSmall && !exists) {
							element.classList.add('small-image-card');
							if (typeof updateProcessingInfo === 'function')
								updateProcessingInfo(element, elapsed, lastProcessingTime, true, true, 'SMALL_IMAGE_DETECTOR');
							result.push({ model, trim, stockNumber, imageSize: res.fileSizeKB, imageUrl, timestamp: new Date().toISOString() });
							console.log(`✅ Small Image ${stockNumber} (${model})`);
						} else {
							element.classList.add('processed-card');
							if (typeof updateProcessingInfo === 'function')
								updateProcessingInfo(element, elapsed, lastProcessingTime, true, false, 'SMALL_IMAGE_DETECTOR');
						}
						lastProcessingTime = elapsed;
					} else {
						element.classList.remove('processing-card');
						element.classList.add('processed-card');
						if (typeof updateProcessingInfo === 'function')
							updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'SMALL_IMAGE_DETECTOR');
						console.warn("⚠️ Missing data", { model, stockNumber, imageUrl });
					}
				} catch (e) {
					element.classList.remove('processing-card');
					element.classList.add('processed-card');
					if (typeof updateProcessingInfo === 'function')
						updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'SMALL_IMAGE_DETECTOR');
					console.error('💥 Error processing small image:', e);
				}
			}
			stopProcessingSpinner();
			return result;
		}

		case 'COMING_SOON_DETECTOR': {
			if (typeof highlightCard !== 'function') {
				console.error('highlightCard function is required for COMING_SOON_DETECTOR');
				return result;
			}

			if (!window._ocrCache) window._ocrCache = {};

			const vehicleSelector = await getVehicleCardSelector();
			const cards = document.querySelectorAll(vehicleSelector);
			const fieldSelectors = await getFieldSelectors();

			console.log("🚀 COMING_SOON_DETECTOR using dynamic selectors", fieldSelectors);

			for (const element of cards) {
				const start = performance.now();
				const { stockNumber, model, trim, image } = await getVehicleInfoFromElement(element);
				const imageUrl = image || '';

				if (!stockNumber || !model || !imageUrl) {
					console.warn("⚠️ Skipping card: Missing info", { stockNumber, model, image });
					continue;
				}

				const exists = result.some(v => v.stockNumber === stockNumber);

				const isComingSoonOrBetter = await highlightCard(element, async () => {
					if (window._ocrCache[imageUrl] !== undefined) {
						console.log('📦 Using cached result for', imageUrl, '→', window._ocrCache[imageUrl]);
						return window._ocrCache[imageUrl];
					}

					const betterPhoto = window.isBetterPhotoImage(imageUrl);
					if (betterPhoto) {
						console.log('📸 BetterPhoto detected:', imageUrl);
						window._ocrCache[imageUrl] = true;
						return true;
					}

					const ocrResult = await window.isComingSoonImage(imageUrl);
					console.log('🔍 API returned for', imageUrl, '→', ocrResult);
					window._ocrCache[imageUrl] = ocrResult;
					return ocrResult;
				}, 0, null, 'COMING_SOON_DETECTOR');

				console.log('💡 highlightCard returned:', isComingSoonOrBetter, 'for stock:', stockNumber);

				if (isComingSoonOrBetter && !exists) {
					result.push({ model, trim, stockNumber, imageUrl });
					console.log(`✅ ADDED TO RESULTS: Coming Soon - ${stockNumber} (${model}) - Total: ${result.length}`);
				} else if (!isComingSoonOrBetter) {
					console.log(`❌ NOT coming soon - ${stockNumber} (${model}) - SKIPPING`);
				} else if (exists) {
					console.log(`⏭️  Already in results - ${stockNumber}`);
				}
			}

			console.log('📊 FINAL RESULTS SUMMARY:', result.length, 'coming soon images detected');
			console.log('📋 Results array:', result);
			break;
		}
	}
	return result;
};

window.isBetterPhotoImage = function(imageUrl) {
	return imageUrl.includes('better-photo.jpg');
};

// ===== CSV UTILS =====
async function csvParser(csvText) {
    if (!csvText || typeof csvText !== "string") return {};

    const lines = csvText
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);

    if (lines.length < 2) return {};

    const possibleDelimiters = [',', '|', ';', '\t'];
    const headerLine = lines[0];

    const delimiter = possibleDelimiters.find(d => headerLine.includes(d)) || ',';

    const clean = s =>
        (s || "")
            .trim()
            .replace(/^"+|"+$/g, "")
            .replace(/^'+|'+$/g, "")
            .trim();

    const rawHeaders = headerLine.split(delimiter);
    const headers = rawHeaders.map(h => clean(h));

    const uniqueHeaders = [];
    headers.forEach(h => {
        if (!uniqueHeaders.includes(h)) uniqueHeaders.push(h);
    });

    console.log("🧭 FINAL HEADERS:", uniqueHeaders);

    const map = {};

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter);
        const entry = {};

        uniqueHeaders.forEach((h, idx) => {
            entry[h] = clean(cols[idx]);
        });

        const stock = clean(
            entry["StockNumber"] ||
            entry["STOCKNUMBER"] ||
            entry["Stock"] ||
            entry["Stk"]
        );

        if (stock) {
            map[stock] = entry;
        }
    }

    console.log("📦 FINAL CSV MAP:", map);

    return map;
}

function normalizeValue(k, v) {
	if (v == null) return '';
	let n = String(v)
		.replace(/^"+|"+$/g, '')
		.replace(/[\n\r\t]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	const key = k.toUpperCase();

	if (/(PRICE|SELLINGPRICE|MSRP|INVOICE|BOOKVALUE|INTERNET_PRICE)/.test(key)) {
		return n.replace(/[^0-9.]/g, '');
	}

	if (/(KM|KILOMETERS|MILE|ODOMETER)/.test(key)) {
		return n.replace(/[^\d]/g, '');
	}

	if (key.includes('STOCK')) {
		return n.toUpperCase().replace(/\s+/g, '');
	}

	if (key === 'CONDITION') {
		return n.toLowerCase();
	}

	return n.replace(/-card\.jpg|-THIRDPARTY\.jpg/gi, '').trim();
}

async function isExceptionValue(k, cv, sv) {
	if (!sv && !cv) return true;
	if (k === 'STOCKNUMBER') return true;
	if (k === 'KILOMETERS' && sv.length === 17) return true;
	if (k === 'VIN' && sv.length !== 17) return true;
	const any = "*.*";
	const exc = [{ csv: [any], srp: [""] }, { csv: ["0"], srp: ["–"] }, { csv: [""], srp: ["contactus"] }, { csv: [""], srp: ["contact us"] }];
	return exc.some(e => e.srp.includes(sv) && (e.csv.includes(cv) || e.csv.includes(any)));
}

function applyFieldTransform(value, field, target) {
	if (!window.fieldTransforms || typeof window.fieldTransforms !== 'object') {
		return value;
	}

	const fieldUpper = field.toUpperCase();
	const transform = window.fieldTransforms[fieldUpper];

	if (!transform || !transform.value) {
		return value;
	}

	// Check if transform applies to this target (srp, csv, or both)
	if (transform.target !== 'both' && transform.target !== target) {
		return value;
	}

	let result = value;

	// Apply transformation based on action (remove or add) and type (prefix or suffix)
	if (transform.action === 'remove') {
		if (transform.type === 'suffix' && result.endsWith(transform.value)) {
			result = result.slice(0, -transform.value.length);
			console.log(`🔄 Removed suffix "${transform.value}" from ${target.toUpperCase()} ${field}: "${value}" → "${result}"`);
		} else if (transform.type === 'prefix' && result.startsWith(transform.value)) {
			result = result.slice(transform.value.length);
			console.log(`🔄 Removed prefix "${transform.value}" from ${target.toUpperCase()} ${field}: "${value}" → "${result}"`);
		}
	} else if (transform.action === 'add') {
		if (transform.type === 'suffix' && !result.endsWith(transform.value)) {
			result = result + transform.value;
			console.log(`🔄 Added suffix "${transform.value}" to ${target.toUpperCase()} ${field}: "${value}" → "${result}"`);
		} else if (transform.type === 'prefix' && !result.startsWith(transform.value)) {
			result = transform.value + result;
			console.log(`🔄 Added prefix "${transform.value}" to ${target.toUpperCase()} ${field}: "${value}" → "${result}"`);
		}
	}

	return result;
}

async function getTextFromVehicleCard(vehicleCard, selector) {
	if (!vehicleCard) return "";
	const el = vehicleCard.querySelector(selector);
	if (!el) return "";
	if (el.tagName === "IMG") return el.src || el.dataset.src || "";
	// Remove various stock prefixes: "Stock#:", "Stock #:", "Stock:", "#", etc.
	return el.textContent.trim().replace(/^(Stock\s*#?\s*:?\s*|#)/i, "").trim();
}

window.extractCSVHeaders = function (csvData) {
	if (!csvData || typeof csvData !== 'string') return [];

	const delimiters = ['|', ',', ';', '\t'];
	const lines = csvData.trim().split(/\r?\n/).filter(Boolean);
	if (lines.length === 0) return [];

	const headerLine = lines[0];
	const detected = delimiters.find(d => headerLine.includes(d)) || ',';

	const headers = headerLine.split(detected).map(h => h.trim().replace(/^"|"$/g, ''));

	console.log(`🧩 Detected delimiter: '${detected}' → Headers:`, headers);
	return headers;
};

globalThis.extractCSVHeaders = window.extractCSVHeaders;

function startProcessingSpinner() {
	try {
		chrome.runtime.sendMessage({ type: 'startProcessing' });
		console.log('🌀 Spinner started via popup message');
	} catch (e) {
		console.warn('Failed to start spinner:', e);
	}
}

function stopProcessingSpinner() {
	try {
		chrome.runtime.sendMessage({ type: 'stopProcessing' });
		console.log('✅ Spinner stopped via popup message');
	} catch (e) {
		console.warn('Failed to stop spinner:', e);
	}
}
