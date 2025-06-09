import { checkImageWithOCR } from './Image Checker/imageCheckerByOCR.js';

function cleanupStyles() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const styleElement = document.querySelector('style[data-processing-styles]');
                if (styleElement) {
                    styleElement.remove();
                }
            }
        });
    });
}

document.getElementById('check missing images').addEventListener('click', async (event) => {
    const ocrInput = document.getElementById('ocrInput');
    const ocrKeyTextarea = document.getElementById('ocrKey');
    const saveOcrKeyButton = document.getElementById('saveOcrKey');

    // Check if we're on a page that uses OCR
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOcrRequired = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            return document.querySelector('div.lbx-paginator') !== null;
        }
    });

    if (isOcrRequired[0].result) {
        // Check if OCR key exists in storage
        const storageResult = await chrome.storage.local.get(['ocrKey']);
        if (!storageResult.ocrKey) {
            // Show OCR key input if no key is found
            ocrInput.style.display = 'block';
            return;
        }
    }

    // If OCR key exists or not required, proceed with the check
    const testType = event.target.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    cleanupStyles();
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: callFindUrlsAndModels,
        args: [testType]
    });
});

// Handle OCR key saving
document.getElementById('saveOcrKey').addEventListener('click', async () => {
    const ocrKeyTextarea = document.getElementById('ocrKey');
    const ocrInput = document.getElementById('ocrInput');
    const ocrKey = ocrKeyTextarea.value.trim();

    if (ocrKey) {
        await chrome.storage.local.set({ ocrKey });
        ocrInput.style.display = 'none';
        // Trigger the check missing images functionality after saving the key
        document.getElementById('check missing images').click();
    } else {
        alert('Please enter a valid OCR key');
    }
});

// Load saved OCR key if it exists
chrome.storage.local.get(['ocrKey'], (result) => {
    if (result.ocrKey) {
        document.getElementById('ocrKey').value = result.ocrKey;
    }
});

function callFindUrlsAndModels(testType) {
    let scannedVehicles = 0;
    let result = [];
    let lastProcessingTime = 0;
    let globalStyleElement = null;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const cards = node.classList?.contains('vehicle-car__section') 
                        ? [node] 
                        : node.querySelectorAll('div.vehicle-car__section.vehicle-car-1');
                    
                    cards.forEach(card => {
                        if (!card.classList.contains('processed-card') && 
                            !card.classList.contains('coming-soon-card') &&
                            !card.classList.contains('waiting-card')) {
                            card.classList.add('waiting-card');
                            card.setAttribute('data-processing-info', 'Waiting...');
                        }
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function addProcessingStyles() {
        if (globalStyleElement) {
            globalStyleElement.remove();
        }
        
        globalStyleElement = document.createElement('style');
        globalStyleElement.setAttribute('data-processing-styles', 'true');
        globalStyleElement.textContent = `
            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
                    transform: scale(1);
                }
                50% {
                    box-shadow: 0 0 20px 10px rgba(0, 123, 255, 0.4);
                    transform: scale(1.02);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
                    transform: scale(1);
                }
            }
            @keyframes blink {
                0% {
                    filter: none;
                }
                50% {
                    filter: sepia(50%) saturate(200%) hue-rotate(-30deg);
                }
                100% {
                    filter: none;
                }
            }
            @keyframes waiting {
                0% {
                    border-color: rgba(108, 117, 125, 0.5);
                }
                50% {
                    border-color: rgba(108, 117, 125, 0.8);
                }
                100% {
                    border-color: rgba(108, 117, 125, 0.5);
                }
            }
            .processing-card {
                animation: pulse 1.5s infinite;
                transition: all 0.3s ease;
                border: 2px solid rgba(0, 123, 255, 0.5);
                border-radius: 12px;
                position: relative;
                z-index: 1;
            }
            .processed-card {
                border: 2px solid rgba(40, 167, 69, 0.5);
                border-radius: 12px;
                position: relative;
                z-index: 1;
            }
            .coming-soon-card {
                border: 2px solid rgb(255, 0, 0);
                border-radius: 12px;
                position: relative;
                z-index: 1;
            }
            .waiting-card {
                animation: waiting 2s infinite;
                border: 2px solid rgba(108, 117, 125, 0.5);
                border-radius: 12px;
                position: relative;
                z-index: 1;
            }
            .coming-soon-card .main-img {
                animation: blink 1s infinite;
                border: 2px solid rgb(255, 0, 0);
                border-radius: 8px;
            }
            .processing-card::before,
            .processed-card::before,
            .coming-soon-card::before,
            .waiting-card::before {
                content: attr(data-processing-info);
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                z-index: 2;
            }
            .processing-card::before {
                background: rgba(0, 123, 255, 0.9);
                color: white;
            }
            .processed-card::before {
                background: rgba(40, 167, 69, 0.9);
                color: white;
            }
            .coming-soon-card::before {
                background: rgb(255, 0, 0);
                color: white;
            }
            .waiting-card::before {
                background: rgba(108, 117, 125, 0.9);
                color: white;
            }
        `;
        document.head.appendChild(globalStyleElement);
        return globalStyleElement;
    }

    addProcessingStyles();

    // Reset all cards to waiting state at start
    document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').forEach(card => {
        card.classList.remove('processed-card', 'coming-soon-card', 'processing-card');
        card.classList.add('waiting-card');
        card.setAttribute('data-processing-info', 'Waiting...');
    });

    function updateProcessingInfo(element, currentTime, lastTime, isProcessed = false, isComingSoon = false) {
        let timeInfo;
        if (isComingSoon) {
            timeInfo = `Coming Soon (${currentTime.toFixed(2)}s)`;
        } else if (isProcessed) {
            timeInfo = `Processed in ${currentTime.toFixed(2)}s`;
        } else {
            timeInfo = lastTime > 0 
                ? `Processing... (Last: ${lastTime.toFixed(2)}s)`
                : 'Processing...';
        }
        element.setAttribute('data-processing-info', timeInfo);
    }

    async function highlightCard(element, processingFunction) {
        addProcessingStyles();
        element.classList.add('processing-card');
        
        const startTime = performance.now();
        let timerInterval;
        
        timerInterval = setInterval(() => {
            const currentTime = (performance.now() - startTime) / 1000;
            updateProcessingInfo(element, currentTime, lastProcessingTime);
        }, 100);
        
        updateProcessingInfo(element, 0, lastProcessingTime);
        
        try {
            const result = await processingFunction();
            const endTime = performance.now();
            const processingTime = (endTime - startTime) / 1000;
            lastProcessingTime = processingTime;
            
            clearInterval(timerInterval);
            
            element.classList.remove('processing-card');
            if (result) {
                element.classList.add('coming-soon-card');
                updateProcessingInfo(element, processingTime, lastProcessingTime, true, true);
            } else {
                element.classList.add('processed-card');
                updateProcessingInfo(element, processingTime, lastProcessingTime, true);
            }
            
            return result;
        } catch (error) {
            clearInterval(timerInterval);
            element.classList.remove('processing-card');
            element.classList.add('processed-card');
            updateProcessingInfo(element, (performance.now() - startTime) / 1000, lastProcessingTime, true);
            throw error;
        }
    }

    async function readVehiclesAndAddResults() {
        const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
        const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();
        const elements = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1');

        for (const element of elements) {
            const modelElement = element.querySelector('.value__model');
            const trimElement = element.querySelector('.value__trim');
            const stockNumberElement = element.querySelector('.stock_label') || element.querySelector('.stock_number') || element.querySelector('.value__stock');
            const imageUrlElement = element.querySelector('.main-img');
            const sourceElement = element.querySelector('source');

            try {
                if (modelElement && stockNumberElement && (imageUrlElement || sourceElement)) {
                    const model = modelElement.textContent.trim();
                    const trim = trimElement ? trimElement.textContent.trim() : '';
                    
                    let stockNumber = '';
                    if (stockNumberElement.classList.contains('stock_label')) {
                        const stockNumberText = stockNumberElement.textContent.trim();
                        stockNumber = stockNumberText.split('Stock#:')[1]?.trim() || '';
                    } else {
                        stockNumber = stockNumberElement.textContent.trim();
                    }

                    let imageUrl = '';
                    if (imageUrlElement?.dataset.src) {
                        imageUrl = imageUrlElement.dataset.src;
                    } else if (sourceElement?.srcset) {
                        imageUrl = sourceElement.srcset;
                    } else if (imageUrlElement?.src) {
                        imageUrl = imageUrlElement.src;
                    }

                    if (imageUrl && stockNumber) {
                        element.classList.remove('waiting-card');
                        
                        if (PAGINATION_SCROLL_TYPE) {
                            const isComingSoon = await highlightCard(element, async () => {
                                return await isComingSoonImageByOCR(imageUrl);
                            });
                            
                            if (isComingSoon) {
                                result.push({ model, trim, stockNumber, imageUrl });
                            }
                        } 
                        else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {
                            await highlightCard(element, async () => {
                                
                                if (isBetterPhotoImage(imageUrl)) {
                                    const alreadyExists = result.some(item => item.stockNumber === stockNumber);
                                    if (!alreadyExists) {
                                        result.push({ model, trim, stockNumber, imageUrl });
                                        return true;
                                    }
                                }
                                return false;
                            });
                        } else {
                            const previousVehicleCount = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
                            
                            await highlightCard(element, async () => {
                                if (isBetterPhotoImage(imageUrl)) {
                                    const alreadyExists = result.some(item => item.stockNumber === stockNumber);
                                    if (!alreadyExists) {
                                        result.push({ model, trim, stockNumber, imageUrl });
                                        return true;
                                    }
                                }
                                return false;
                            });

                            const waitingCards = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1.waiting-card').length;
                            if (waitingCards === 0) {
                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                await new Promise(resolve => setTimeout(resolve, 200));
                                const currentVehicleCount = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
                                
                                if (currentVehicleCount === previousVehicleCount) {
                                    isMoreVehicleAvailable = false;
                                    break;
                                }
                            }
                        }
                    } else {
                        console.log('Missing required data:', {
                            hasImageUrl: !!imageUrl,
                            hasStockNumber: !!stockNumber
                        });
                        element.classList.remove('waiting-card');
                        element.classList.add('processed-card');
                        element.setAttribute('data-processing-info', 'Missing data');
                    }
                } else {
                    console.log('Missing required elements:', {
                        hasModel: !!modelElement,
                        hasStockNumber: !!stockNumberElement,
                        hasImage: !!(imageUrlElement || sourceElement)
                    });
                    element.classList.remove('waiting-card');
                    element.classList.add('processed-card');
                    element.setAttribute('data-processing-info', 'Missing elements');
                }
            } catch (error) {
                console.error("An error occurred while processing elements:", error);
                element.classList.remove('waiting-card');
                element.classList.add('processed-card');
                element.setAttribute('data-processing-info', 'Error processing');
            }
        }
    }

    findUrlsAndModels(testType);

    async function findUrlsAndModels(testType) {
        scannedVehicles = await scrollDownUntilLoadAllVehicles();

        const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
        console.log(message);
        console.log(result);

        exportToCSVFile(result, testType);
    }

    async function scrollDownUntilLoadAllVehicles() {
        let actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
        let totalElementsLoaded = 0;
        let isMoreVehicleAvailable = true;

        while (isMoreVehicleAvailable) {
            const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
            const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();

            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            actualElementsLoaded = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').length;
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

    async function isComingSoonImageByOCR(imageUrl){        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'checkImageByOCR',
                imageUrl: imageUrl
            });
            
            if (response.success && response.result) {
                return true;
            }
        } catch (error) {
            console.error('Error checking image with OCR:', error);
            return false;
        }
    }

    async function isComingSoonImageByChatGPT(imageUrl) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'checkImageByOpenAI',
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

    function isBetterPhotoImage(imageUrl) {
        return imageUrl.includes('better-photo.jpg') || imageUrl.includes('spinner.gif');
    }
}