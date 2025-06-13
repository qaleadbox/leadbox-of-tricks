window.scrollDownUntilLoadAllVehicles = async function(result, csvData, testType) {
    let actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
    let totalElementsLoaded = 0;
    let isMoreVehicleAvailable = true;

    if (actualElementsLoaded === 0) {
        console.warn('Waiting for initial vehicles to load...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
        if (actualElementsLoaded === 0) {
            console.error('No vehicles found after initial wait');
            return 0;
        }
    }

    totalElementsLoaded = actualElementsLoaded;
    console.warn(`Initial load: ${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);

    while (isMoreVehicleAvailable) {
        const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
        const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();

        if (!PAGINATION_SCROLL_TYPE) {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;

        if (PAGINATION_SCROLL_TYPE) {
            if (isThereANextPage()) {
                const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
                if (testType === "COMING_SOON_DETECTOR") {
                    await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
                } else {
                    await window.$dataHandler(allVehicleCards, csvData, result, testType);
                }
                
                getPaginationArrow().click();
                console.warn('Clicking pagination next page arrow...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                totalElementsLoaded += actualElementsLoaded;
            } else {
                const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
                if (testType === "COMING_SOON_DETECTOR") {
                    await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
                } else {
                    await window.$dataHandler(allVehicleCards, csvData, result, testType);
                }
                isMoreVehicleAvailable = false;
            }
        }
        else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {
            const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
            if (testType === "COMING_SOON_DETECTOR") {
                await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
            } else {
                await window.$dataHandler(allVehicleCards, csvData, result, testType);
            }

            if (isViewMoreButtonVisible()) {
                getViewMoreButton().click();
                console.warn('Clicking "View More Vehicles" button...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                totalElementsLoaded = actualElementsLoaded;
            } else {
                isMoreVehicleAvailable = false;
            }
        }
        else {
            if (actualElementsLoaded != totalElementsLoaded) {
                const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
                if (testType === "COMING_SOON_DETECTOR") {
                    await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);
                } else {
                    await window.$dataHandler(allVehicleCards, csvData, result, testType);
                }

                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.warn('Scrolling to see more vehicles...');
                totalElementsLoaded = actualElementsLoaded;
            } else {
                isMoreVehicleAvailable = false;
            }
        }

        console.warn(`${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);
    }

    console.warn("Finished scrolling, all vehicles loaded.");
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