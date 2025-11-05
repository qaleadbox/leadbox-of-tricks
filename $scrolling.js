// $scrolling.js
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
	window.debugMode = false;

	const vehicleSelector = await getVehicleCardSelector();
	if (!vehicleSelector) {
		console.error('💥 No valid vehicle selector returned.');
		return 0;
	}

	let actualElementsLoaded = document.querySelectorAll(vehicleSelector).length;
	let totalElementsLoaded = 0;
	let isMoreVehicleAvailable = true;

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
	if (window.debugMode)
		console.warn(`Initial load: ${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);

	if (isPaginationScrollType()) {
		const allVehicleCards = document.querySelectorAll(vehicleSelector);
		if (window.debugMode)
			console.warn(`Processing first page with ${allVehicleCards.length} vehicles.`);

		if (testType === "COMING_SOON_DETECTOR") {
			await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
		} else {
			await window.$dataHandler(allVehicleCards, csvData, result, testType);
		}
	}

	while (isMoreVehicleAvailable) {
		const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
		const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();

		if (!PAGINATION_SCROLL_TYPE) {
			window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		actualElementsLoaded = document.querySelectorAll(vehicleSelector).length;

		if (PAGINATION_SCROLL_TYPE) {
			if (isThereANextPage()) {
				getPaginationArrow().click();
				if (window.debugMode) console.warn('Clicking pagination next page arrow...');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const allVehicleCards = document.querySelectorAll(vehicleSelector);
				const currentPageElements = allVehicleCards.length;
				if (window.debugMode) console.warn(`Processing page with ${currentPageElements} vehicles. Current result length: ${Array.isArray(result) ? result.length : Object.keys(result).length}`);

				if (testType === "COMING_SOON_DETECTOR") {
					await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
				} else {
					await window.$dataHandler(allVehicleCards, csvData, result, testType);
				}

				if (window.debugMode) console.warn(`After processing page. Result length: ${Array.isArray(result) ? result.length : Object.keys(result).length}`);
				totalElementsLoaded = currentPageElements;
			} else {
				const allVehicleCards = document.querySelectorAll(vehicleSelector);
				if (testType === "COMING_SOON_DETECTOR") {
					await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
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
			if (actualElementsLoaded != totalElementsLoaded) {
				const allVehicleCards = document.querySelectorAll(vehicleSelector);
				if (testType === "COMING_SOON_DETECTOR") {
					await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
				} else {
					await window.$dataHandler(allVehicleCards, csvData, result, testType);
				}

				window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
				await new Promise(resolve => setTimeout(resolve, 2000));
				if (window.debugMode) console.warn('Scrolling to see more vehicles...');
				totalElementsLoaded = actualElementsLoaded;
			} else {
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