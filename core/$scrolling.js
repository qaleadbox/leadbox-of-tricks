// $scrolling.js
console.log('🔥 $scrolling.js loaded - VERSION 2.0 - WITH EXPORT SUPPORT');

async function getVehicleCardSelector() {
	if (window.manualVehicleSelectors) {
		const domain = location.hostname.replace(/^www\./, '');
		const selectors = window.manualVehicleSelectors[domain] || window.manualVehicleSelectors['global'] || {};
		if (selectors.vehicleCard) return selectors.vehicleCard;
	}

	console.warn('⚠️ No manual vehicleCard selector found for this site.');
	return null;
}

window.scrollDownUntilLoadAllVehicles = async function (result, csvData, testType) {
	console.log('🌊🌊🌊 scrollDownUntilLoadAllVehicles CALLED 🌊🌊🌊');
	console.log('🌊 testType:', testType);
	console.log('🌊 result:', result);
	console.log('🌊 result is array?', Array.isArray(result));
	console.log('🌊 csvData:', csvData);
	console.log('🌊 window.$dataHandler exists?', typeof window.$dataHandler);

	window.debugMode = false;

	const vehicleSelector = await getVehicleCardSelector();
	console.log('🌊 Vehicle selector:', vehicleSelector);
	if (!vehicleSelector) {
		console.error('💥 No valid vehicle selector returned.');
		return 0;
	}

	let actualElementsLoaded = document.querySelectorAll(vehicleSelector).length;
	let totalElementsLoaded = 0;
	let isMoreVehicleAvailable = true;

	// Detect scroll mode
	const hasPagination = isPaginationScrollType();
	const hasViewMore = isViewMoreScrollType();
	console.log('🌊 Scroll mode detection:', {
		hasPagination,
		hasViewMore,
		mode: hasPagination ? 'PAGINATION' : hasViewMore ? 'VIEW_MORE' : 'INFINITE'
	});

	if (actualElementsLoaded === 0) {
		if (window.debugMode) console.warn('Waiting for initial vehicles to load...');
		await new Promise(resolve => setTimeout(resolve, 3000));
		actualElementsLoaded = document.querySelectorAll(vehicleSelector).length;
		if (actualElementsLoaded === 0) {
			console.error('No vehicles found after initial wait');
			return 0;
		}
	}

	totalElementsLoaded = actualElementsLoaded;
	console.log(`🌊 Initial load: ${totalElementsLoaded} vehicles`);

	// CRITICAL: Process initial vehicles for ALL scroll types, not just pagination!
	console.log('🌊 Processing initial vehicles...');
	const allVehicleCards = document.querySelectorAll(vehicleSelector);
	console.log(`🌊 Found ${allVehicleCards.length} initial vehicle cards`);

	if (testType === "COMING_SOON_DETECTOR") {
		await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
	} else if (testType === "VEHICLE_DATA_EXPORTER") {
		console.log('🌊 Calling $dataHandler for VEHICLE_DATA_EXPORTER with', allVehicleCards.length, 'cards');
		await window.$dataHandler(allVehicleCards, null, result, testType);
		console.log('🌊 After $dataHandler, result length:', result.length);
	} else {
		await window.$dataHandler(allVehicleCards, csvData, result, testType);
	}

	console.log('🌊 Initial processing complete. Result length:', result.length);

	while (isMoreVehicleAvailable) {
		const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
		const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();

		console.log('🌊 In while loop - scroll type:', {
			pagination: PAGINATION_SCROLL_TYPE,
			viewMore: VIEW_MORE_VEHICLES_SCROLL_TYPE,
			actualElements: actualElementsLoaded
		});

		if (!PAGINATION_SCROLL_TYPE) {
			console.log('🌊 Not pagination, scrolling down...');
			window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		actualElementsLoaded = document.querySelectorAll(vehicleSelector).length;

		if (PAGINATION_SCROLL_TYPE) {
			console.log('🌊 Processing PAGINATION type');
			if (isThereANextPage()) {
				getPaginationArrow().click();
				if (window.debugMode) console.warn('Clicking pagination next page arrow...');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const allVehicleCards = document.querySelectorAll(vehicleSelector);
				const currentPageElements = allVehicleCards.length;
				if (window.debugMode) console.warn(`Processing page with ${currentPageElements} vehicles. Current result length: ${Array.isArray(result) ? result.length : Object.keys(result).length}`);

				if (testType === "COMING_SOON_DETECTOR") {
					await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
				} else if (testType === "VEHICLE_DATA_EXPORTER") {
					await window.$dataHandler(allVehicleCards, null, result, testType);
				} else {
					await window.$dataHandler(allVehicleCards, csvData, result, testType);
				}

				if (window.debugMode) console.warn(`After processing page. Result length: ${Array.isArray(result) ? result.length : Object.keys(result).length}`);
				totalElementsLoaded = currentPageElements;
			} else {
				const allVehicleCards = document.querySelectorAll(vehicleSelector);
				if (testType === "COMING_SOON_DETECTOR") {
					await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
				} else if (testType === "VEHICLE_DATA_EXPORTER") {
					await window.$dataHandler(allVehicleCards, null, result, testType);
				} else {
					await window.$dataHandler(allVehicleCards, csvData, result, testType);
				}
				isMoreVehicleAvailable = false;
			}
		}
		else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {
			const allVehicleCards = document.querySelectorAll(vehicleSelector);
			if (testType === "COMING_SOON_DETECTOR") {
				await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
			} else if (testType === "VEHICLE_DATA_EXPORTER") {
				await window.$dataHandler(allVehicleCards, null, result, testType);
			} else {
				await window.$dataHandler(allVehicleCards, csvData, result, testType);
			}

			if (isViewMoreButtonVisible()) {
				getViewMoreButton().click();
				if (window.debugMode) console.warn('Clicking "View More Vehicles" button...');
				await new Promise(resolve => setTimeout(resolve, 2000));
				totalElementsLoaded = actualElementsLoaded;
			} else {
				isMoreVehicleAvailable = false;
			}
		}
		else {
			console.log('🌊 Processing INFINITE SCROLL type');
			if (actualElementsLoaded != totalElementsLoaded) {
				console.log(`🌊 New vehicles loaded: ${actualElementsLoaded} (was ${totalElementsLoaded})`);
				const allVehicleCards = document.querySelectorAll(vehicleSelector);
				if (testType === "COMING_SOON_DETECTOR") {
					await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
				} else if (testType === "VEHICLE_DATA_EXPORTER") {
					console.log('🌊 Calling $dataHandler for VEHICLE_DATA_EXPORTER with', allVehicleCards.length, 'cards');
					await window.$dataHandler(allVehicleCards, null, result, testType);
					console.log('🌊 After $dataHandler, result length:', result.length);
				} else {
					await window.$dataHandler(allVehicleCards, csvData, result, testType);
				}

				window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
				await new Promise(resolve => setTimeout(resolve, 2000));
				if (window.debugMode) console.warn('Scrolling to see more vehicles...');
				totalElementsLoaded = actualElementsLoaded;
			} else {
				console.log('🌊 No new vehicles, stopping infinite scroll');
				isMoreVehicleAvailable = false;
			}
		}

		if (window.debugMode) console.warn(`${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);
	}

	if (window.debugMode) console.warn("Finished scrolling, all vehicles loaded.");
	return totalElementsLoaded;
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