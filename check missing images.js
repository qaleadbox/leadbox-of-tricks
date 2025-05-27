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

    const paginationElement = document.querySelector('nav.page-nav.flex.justify-center.lbx-paginator-nav');
    const paginationRightArrow = document.querySelector('.right-arrow');
    const viewMoreButton = document.querySelector('button.lbx-load-more-btn');

    const isThereANextPage = paginationRightArrow != null;
    const isViewMoreVehiclesButton = viewMoreButton !== null;

    const isPagination = paginationElement !== null;

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
        let lastElementsLoaded = 0;
        let totalElementsLoaded = 0;

        while (lastElementsLoaded !== actualElementsLoaded) {

            lastElementsLoaded = actualElementsLoaded;
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            await new Promise(resolve => setTimeout(resolve, 1000));

            actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
            if (isPagination) {
                totalElementsLoaded += actualElementsLoaded;
            }
            else if ((isViewMoreVehiclesButton)
                || (!isPagination && !isViewMoreVehiclesButton)) {
                totalElementsLoaded = actualElementsLoaded;
            }
            console.warn(`${totalElementsLoaded} vehicle${totalElementsLoaded !== 1 ? 's' : ''} loaded.`);

            if (isThereANextPage) {
                lastElementsLoaded = -1;
                console.warn('Clicking pagination right arrow...');
                paginationRightArrow.click();
            }
            // FIXME - NOT READING THE WHOLE PAGE WHEN IT IS VIEW MORE BUTTON
            else if (isViewMoreVehiclesButton) {
                console.warn('Clicking "View More Vehicles" button...');
                viewMoreButton.click();
            }
            await readVehiclesAndAddResults();
        }
        console.warn("Finished scrolling, all vehicles loaded.");
        return totalElementsLoaded;
    }

    async function readVehiclesAndAddResults() {
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

                        if (isPagination) {
                            const imageSize = await getImageFileSize(imageUrl);
                            // WORKING! BUT THIS IMAGES SHOULD CAME FROM THE INPUT
                            const referenceImageLink = 'https://cardealerstg.blob.core.windows.net/autocanada/vehicles/1345850/pictures/84d20820-6ddf-4b4c-98e6-3fc53c78d928-card.jpg'
                            const imageSizeReference = await getImageFileSize(referenceImageLink);

                            if (imageSize === imageSizeReference) {
                                result.push({ model, trim, stockNumber, imageUrl });
                            }
                        } else if ((isViewMoreVehiclesButton)
                            || (!isPagination && !isViewMoreVehiclesButton)) {
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
}