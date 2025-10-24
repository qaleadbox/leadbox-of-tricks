// Detect SRP structure
function detectVehicleCardStructure() {
	if (document.querySelector('div.vehicle-card.vehicle-card-6')) return 'vehicleCardV6';
	if (document.querySelector('div.vehicle-car__section.vehicle-car-1')) return 'vehicleCardV12345';
	return 'unknown';
}

function getVehicleCardSelector() {
	const s = detectVehicleCardStructure();
	if (s === 'vehicleCardV6') return 'div.vehicle-card.vehicle-card-6';
	if (s === 'vehicleCardV12345') return 'div.vehicle-car__section.vehicle-car-1';
	return 'div.vehicle-card.vehicle-card-6, div.vehicle-car__section.vehicle-car-1';
}

function getFieldSelectors(s) {
	if (s === 'vehicleCardV6')
		return { model: '.title-text', trim: '.title-text', stockNumber: '.stock-value', image: '.main-img' };
	if (s === 'vehicleCardV12345')
		return { model: '.value__model', trim: '.value__trim', stockNumber: '.stock_label, .stock_number, .value__stock', image: '.main-img' };
	return { model: '.title-text', trim: '.title-text', stockNumber: '.stock-value', image: '.main-img' };
}

function extractFields(element) {
	const fields = { stockNumber: '', model: '', trim: '' };
	const stockSelectors = ['.value__stock', '.stock_number', '.stock_label', '.stock-value', '[data-stock-number]'];
	const modelSelectors = ['.value__model', '.title-text', '.vehicle-title', '[data-model]'];
	const trimSelectors = ['.value__trim', '.trim', '.subtitle'];
	for (const q of stockSelectors) {
		const el = element.querySelector(q);
		if (el && el.textContent.trim()) { fields.stockNumber = el.textContent.trim(); break; }
	}
	for (const q of modelSelectors) {
		const el = element.querySelector(q);
		if (el && el.textContent.trim()) { fields.model = el.textContent.trim(); break; }
	}
	for (const q of trimSelectors) {
		const el = element.querySelector(q);
		if (el && el.textContent.trim()) { fields.trim = el.textContent.trim(); break; }
	}
	if (fields.stockNumber && /stock\s*#?:/i.test(fields.stockNumber))
		fields.stockNumber = fields.stockNumber.replace(/stock\s*#?:/i, '').trim();
	return fields;
}

function detectScrollMode() {
	if (document.querySelector('div.lbx-paginator')) return 'pagination';
	if (document.querySelector('button.lbx-load-more-btn')) return 'viewmore';
	return 'infinite';
}

// ===== MAIN HANDLER =====
window.$dataHandler = async function (allVehicleCards, csvData, result, testType, highlightCard) {
	const structure = detectVehicleCardStructure();
	const fieldSelectors = getFieldSelectors(structure);
	const cards = document.querySelectorAll(getVehicleCardSelector());
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

			let csvMap = {};
			if (csvData) csvMap = await csvParser(csvData);
			if (!result || Array.isArray(result)) result = {};

			const csvHeaders = Object.keys(csvMap[Object.keys(csvMap)[0]] || {});
			const fieldToCsvMapping = {};
			Object.keys(window.customFieldMap).forEach(fieldKey => {
				if (csvHeaders.includes(fieldKey)) fieldToCsvMapping[fieldKey] = fieldKey;
				else {
					const match = csvHeaders.find(h => h.toLowerCase() === fieldKey.toLowerCase());
					if (match) fieldToCsvMapping[fieldKey] = match;
					else console.warn(`No matching CSV header found for field: ${fieldKey}`);
				}
			});

			let processedVehicles = 0, vehiclesWithMismatches = 0;

			for (const srpVehicle of allVehicleCards) {
				const stockSel = window.customFieldMap.STOCKNUMBER;
				const srpStockNumber = await getTextFromVehicleCard(srpVehicle, stockSel);
				const csvVehicle = csvMap[srpStockNumber];
				if (srpStockNumber && csvVehicle && typeof csvVehicle === 'object') {
					processedVehicles++;
					let hasMismatches = false, mismatches = {};
					for (const [field, selector] of Object.entries(window.customFieldMap)) {
						if (!selector) continue;
						const srpRaw = await getTextFromVehicleCard(srpVehicle, selector);
						const csvHeader = fieldToCsvMapping[field];
						const csvRaw = csvHeader ? csvVehicle[csvHeader] : undefined;
						const csvNorm = normalizeValue(field, csvRaw);
						const srpNorm = normalizeValue(field, srpRaw);
						if (await isExceptionValue(field, csvNorm, srpNorm)) continue;
						if (srpNorm !== csvNorm) {
							hasMismatches = true;
							mismatches[field] = { csv: csvNorm, srp: srpNorm };
						}
					}
					if (hasMismatches) {
						vehiclesWithMismatches++;
						result[srpStockNumber] = { mismatches };
					}
				}
			}
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
				const { stockNumber, model, trim } = extractFields(element);

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

			for (const element of cards) {
				if (scrollMode !== 'infinite' && element.classList.contains('processed-card')) continue;

				const start = performance.now();
				element.classList.remove('waiting-card');
				element.classList.add('processing-card');
				if (typeof updateProcessingInfo === 'function') updateProcessingInfo(element, 0, lastProcessingTime);

				const img = element.querySelector(fieldSelectors.image) || element.querySelector('img');
				const imageUrl = (img?.dataset?.src || img?.src || '').trim();
				const { stockNumber, model, trim } = extractFields(element);

				try {
					if (model && stockNumber && imageUrl) {
						const exists = result.some(v => v.stockNumber === stockNumber);

						const isComingSoonOrBetter = await highlightCard(element, async () => {
							if (window._ocrCache[imageUrl] !== undefined) {
								return window._ocrCache[imageUrl];
							}

							const betterPhoto = window.isBetterPhotoImage(imageUrl);
							if (betterPhoto) {
								window._ocrCache[imageUrl] = true;
								return true;
							}

							const ocrResult = await window.isComingSoonImage(imageUrl);
							window._ocrCache[imageUrl] = ocrResult;
							return ocrResult;
						});

						const elapsed = (performance.now() - start) / 1000;
						if (typeof updateProcessingInfo === 'function')
							updateProcessingInfo(element, elapsed, lastProcessingTime, true, !!isComingSoonOrBetter, 'COMING_SOON_DETECTOR');

						if (isComingSoonOrBetter && !exists) {
							element.classList.add('coming-soon-card');
							result.push({ model, trim, stockNumber, imageUrl });
							console.log(`✅ Coming Soon / BetterPhoto ${stockNumber} (${model}) - Total: ${result.length}`);
						}

						lastProcessingTime = elapsed;
					} else {
						element.classList.remove('processing-card');
						element.classList.add('processed-card');
						if (typeof updateProcessingInfo === 'function')
							updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'COMING_SOON_DETECTOR');
						console.log('⚠️ Missing data', { hasModel: !!model, hasStockNumber: !!stockNumber, hasImage: !!imageUrl });
					}
				} catch (e) {
					element.classList.remove('processing-card');
					element.classList.add('processed-card');
					if (typeof updateProcessingInfo === 'function')
						updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'COMING_SOON_DETECTOR');
					console.error('💥 Error processing coming soon:', e);
				}
			}
			break;
		}
	}

	return result;
};

function isBetterPhotoImage(imageUrl) {
	return imageUrl.includes('better-photo.jpg');
}

// ===== CSV UTILS =====
async function csvParser(csvVehicle) {
	const lines = csvVehicle.trim().split('\n');
	const headers = lines[0].split('|');
	const map = {};
	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split('|');
		const entry = {};
		headers.forEach((key, idx) => entry[key.trim()] = values[idx]?.trim() ?? '');
		const stockNumber = entry['StockNumber'];
		if (stockNumber) map[stockNumber] = entry;
	}
	return map;
}

function normalizeValue(k, v) {
	if (!v) return '';
	let n = v.toString();
	switch (k) {
		case 'CONDITION': return n.toLowerCase();
		case 'PRICE': return n.replace(/[$,]/g, '').toLowerCase();
		case 'KILOMETERS': return n.replace(/[km\s,]|\.00000/g, '');
		default: return n.replace(/-card\.jpg|-THIRDPARTY\.jpg/g, '').trim();
	}
}

async function isExceptionValue(k, cv, sv) {
	if (!sv && !cv) return true;
	if (k === 'STOCKNUMBER') return true;
	if (k === 'KILOMETERS' && sv.length === 17) return true;
	if (k === 'VIN' && sv.length !== 17) return true;
	const any = "*.*";
	const exc = [{ csv: [any], srp: [""] }, { csv: ["0"], srp: ["–"] }, { csv: [""], srp: ["contactus"] }];
	return exc.some(e => e.srp.includes(sv) && (e.csv.includes(cv) || e.csv.includes(any)));
}

async function getTextFromVehicleCard(vehicleCard, selector) {
	if (!vehicleCard) return "";
	const el = vehicleCard.querySelector(selector);
	if (!el) return "";
	if (el.tagName === "IMG") return el.src || el.dataset.src || "";
	return el.textContent.trim().replace("Stock#:", "").trim();
}

window.extractCSVHeaders = function (csvData) {

	if (!csvData || typeof csvData !== 'string') {
		console.warn("Invalid CSV data");
		return [];
	}

	const lines = csvData.split('\n');

	if (lines.length === 0) {
		console.warn("No lines found in CSV");
		return [];
	}

	const firstLine = lines[0];

	const delimiters = [',', '|', '\t'];
	let bestHeaders = [];
	let maxFields = 0;

	for (const delimiter of delimiters) {
		const headers = firstLine.split(delimiter).map(header => header.trim()).filter(Boolean);
		if (headers.length > maxFields) {
			maxFields = headers.length;
			bestHeaders = headers;
		}
	}
	return bestHeaders;
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