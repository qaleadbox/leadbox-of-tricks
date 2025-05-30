document.getElementById('check missing images').addEventListener('click', async (event) => {
    const testType = event.target.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: callFindUrlsAndModels,
        args: [testType]
    });
});

function callFindUrlsAndModels(testType) {
    let scannedVehicles = 0;
    let result = [];

    findUrlsAndModels(testType);

    async function findUrlsAndModels(testType) {
        scannedVehicles = await scrollDownUntilLoadAllVehicles();

        const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
        console.log(message);
        console.log(result);

        exportToCSVFile(result, testType);
    }

    async function scrollDownUntilLoadAllVehicles() {
        let actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
        let totalElementsLoaded = 0;

        let isMoreVehicleAvailable = true;

        while (isMoreVehicleAvailable) {
            const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
            const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();

            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (PAGINATION_SCROLL_TYPE) {
                totalElementsLoaded += actualElementsLoaded;
                if (isThereANextPage()) {
                    getPaginationArrow().click();
                    console.warn('Clicking pagination next page arrow...');
                }
                else {
                    isMoreVehicleAvailable = false;
                }
            }
            else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {
                totalElementsLoaded = actualElementsLoaded;
                if (isViewMoreButtonVisible()) {

                    getViewMoreButton().click();
                    console.warn('Clicking "View More Vehicles" button...');
                }
                else {
                    isMoreVehicleAvailable = false;
                }
            }
            else {
                if (actualElementsLoaded != totalElementsLoaded) {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    console.warn('Scrolling to see more vehicles...');
                    totalElementsLoaded = actualElementsLoaded;
                }
                else {
                    isMoreVehicleAvailable = false;
                }
            }
            console.warn(`${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);
            await readVehiclesAndAddResults();
        }
        console.warn("Finished scrolling, all vehicles loaded.");
        return totalElementsLoaded;
    }

    async function readVehiclesAndAddResults() {
        const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
        const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();
        const elements = document.querySelectorAll('.vehicle-car__section');

        elements.forEach(async element => {
            const modelElement = element.querySelector('.value__model');
            const trimElement = element.querySelector('.value__trim');
            const stockNumberElement = element.querySelector('.stock_number');
            const imageUrlElement = element.querySelector('.main-img');

            try {
                if (modelElement && trimElement && stockNumberElement && imageUrlElement) {
                    const model = modelElement.textContent.trim();
                    const trim = trimElement.textContent.trim();
                    const stockNumber = stockNumberElement.textContent.trim();
                    const imageUrl = imageUrlElement.dataset.src;

                    if (imageUrl) {
                        if (PAGINATION_SCROLL_TYPE) {                         

                            if (await isComingSoonImageByChatGPT(imageUrl)) {
                                result.push({ model, trim, stockNumber, imageUrl });
                            }
                        } 
                        else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {

                            if (imageUrl.includes('better-photo.jpg')) {
                                const alreadyExists = result.some(item => item.stockNumber === stockNumber);
                                if (!alreadyExists) {
                                    result.push({ model, trim, stockNumber, imageUrl });
                                }
                            }
                        } else {
                            console.error("Scrolling method not implemented.")
                        }
                    }
                }
            } catch (error) {
                console.error("An error occurred while processing elements:", error);
            }
        });
    }

    function exportToCSVFile(data, testType) {
        if (data.length === 0) {
            alert('No data to export!');
            return;
        }

        const siteName = window.location.hostname.replace('www.', '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
        const filename = `${siteName}_${testType.toUpperCase()}_${timestamp}.csv`;

        const headers = ['Model', 'Trim', 'Stock Number', 'Image URL'];
        const rows = data.map(item => [item.model, item.trim, item.stockNumber, item.imageUrl]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(value => `"${value}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = `${filename}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    //======================================= HELPERS ===============================================

    async function isComingSoonImageByChatGPT(imageUrl) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'checkImage',
                imageUrl: imageUrl
            });
            
            if (response.success) {
                return response.result;
            } else {
                console.error('Error checking image:', response.error);
                return false;
            }
        } catch (error) {
            console.error('Error sending message to background script:', error);
            return false;
        }
    }

    async function getImageFileSize(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const size = response.headers.get('Content-Length');
            return size ? parseInt(size, 10) : 0;
        } catch (err) {
            console.warn('Could not fetch image size:', url, err);
            return 0;
        }
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
}