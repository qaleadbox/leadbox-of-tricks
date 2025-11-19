// $small-images-checker.js
document.getElementById('check small images').addEventListener('click', async (event) => {
    const smallImageSettingsDiv = document.getElementById('smallImageSettingsDiv');
    
    if (smallImageSettingsDiv.style.display === 'none') {
        smallImageSettingsDiv.style.display = 'block';
        return;
    } else {
        smallImageSettingsDiv.style.display = 'none';
        return;
    }
});

document.getElementById('startSmallImageScanning').addEventListener('click', async () => {
    await startSmallImageScanning();
});

async function loadSiteThreshold() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const siteName = tab.url ? new URL(tab.url).hostname.replace('www.', '') : '';
    
    const result = await chrome.storage.local.get(['siteImageThresholds']);
    const siteThresholds = result.siteImageThresholds || {};
    
    if (siteThresholds[siteName]) {
        document.getElementById('imageSizeThreshold').value = siteThresholds[siteName];
    } else {
        document.getElementById('imageSizeThreshold').value = 10;
    }
    
    const siteLabel = document.getElementById('siteLabel');
    if (siteLabel) {
        siteLabel.textContent = `Image Size Threshold for ${siteName}:`;
    }
}

document.getElementById('imageSizeThreshold').addEventListener('change', async (event) => {
    const threshold = parseInt(event.target.value) || 10;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const siteName = tab.url ? new URL(tab.url).hostname.replace('www.', '') : '';
    
    const result = await chrome.storage.local.get(['siteImageThresholds']);
    const siteThresholds = result.siteImageThresholds || {};
    siteThresholds[siteName] = threshold;
    
    await chrome.storage.local.set({ siteImageThresholds: siteThresholds });
    console.log(`Saved threshold ${threshold}KB for site: ${siteName}`);
});

loadSiteThreshold();

async function startSmallImageScanning() {
    chrome.runtime.sendMessage({ type: 'startProcessing' });
    
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        if (!tab) {
            console.error('No active tab found');
            chrome.runtime.sendMessage({ type: 'stopProcessing' });
            return;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const styleElement = document.querySelector('style[data-small-image-styles]');
                    if (styleElement) {
                        styleElement.remove();
                    }
                    document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').forEach(card => {
                        card.classList.remove('processed-card', 'small-image-card', 'processing-card', 'waiting-card');
                        card.removeAttribute('data-processing-info');
                    });
                    const cleanupButton = document.querySelector('#cleanup-small-image-highlights-button');
                    if (cleanupButton) {
                        cleanupButton.remove();
                    }
                }
            });

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['./core/$card-highlighter.js', './core/$scrolling.js', './core/$data-handler.js']
            });

            const threshold = parseInt(document.getElementById('imageSizeThreshold').value) || 10;
            
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: callFindSmallImages,
                args: [testType, threshold]
            });
        } catch (error) {
            console.error('Error executing small image detection:', error);
        } finally {
            chrome.runtime.sendMessage({ type: 'stopProcessing' });
        }
    });
}

const testType = 'SMALL_IMAGE_DETECTOR';

function callFindSmallImages(testType, threshold = 10) {
    let scannedVehicles = 0;
    let result = [];
    let lastProcessingTime = 0;
    let globalStyleElement = null;
    let isProcessing = true;

    window.isSmallImageByUrl = function(imageUrl) {
        if (!imageUrl.toLowerCase().includes('.jpg')) {
            return { isSmall: false, fileSizeKB: 0 };
        }
        
        return new Promise((resolve) => {
            fetch(imageUrl, { method: 'HEAD' })
                .then(response => {
                    const contentLength = response.headers.get('content-length');
                    if (contentLength) {
                        const fileSizeKB = parseInt(contentLength) / 1024;
                        const isSmall = fileSizeKB < threshold;
                        resolve({ isSmall, fileSizeKB });
                    } else {
                        resolve({ isSmall: false, fileSizeKB: 0 });
                    }
                })
                .catch(error => {
                    resolve({ isSmall: false, fileSizeKB: 0 });
                });
        });
    };

    // PENDING TO MERGED TO $card-highlighter.js
    function cleanupSmallImageStyles() {
        const styleElement = document.querySelector('style[data-small-image-styles]');
        if (styleElement) {
            styleElement.remove();
        }
        document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').forEach(card => {
            card.classList.remove('processed-card', 'small-image-card', 'processing-card', 'waiting-card');
            card.removeAttribute('data-processing-info');
        });
        const cleanupButton = document.querySelector('#cleanup-small-image-highlights-button');
        if (cleanupButton) {
            cleanupButton.remove();
        }
    }

    // PENDING TO MERGED TO $card-highlighter.js
    async function highlightCard(element) {
        const currentTime = Date.now();
        
        try {
            const imageUrl = element.querySelector('img')?.src || '';
            const { isSmall, fileSizeKB } = await window.isSmallImageByUrl(imageUrl);
            
            if (isSmall) {
                element.classList.add('small-image-card');
                
                const stockNumberElement = element.querySelector('.stock_label') || element.querySelector('.stock_number') || element.querySelector('.value__stock');
                const modelElement = element.querySelector('.value__model');
                
                let stockNumber = '';
                if (stockNumberElement) {
                    if (stockNumberElement.classList.contains('stock_label')) {
                        const stockNumberText = stockNumberElement.textContent.trim();
                        stockNumber = stockNumberText.split('Stock#:')[1]?.trim() || '';
                    } else {
                        stockNumber = stockNumberElement.textContent.trim();
                    }
                }
                
                const model = modelElement ? modelElement.textContent.trim() : '';
                
                result.push({
                    stockNumber: stockNumber,
                    model: model,
                    imageSize: fileSizeKB,
                    timestamp: new Date().toISOString()
                });
            }
            
            element.classList.remove('processing-card', 'waiting-card');
            element.classList.add('processed-card');
            updateProcessingInfo(element, currentTime, lastProcessingTime, isProcessing, isSmall, testType);
            
            scannedVehicles++;
            lastProcessingTime = currentTime;
        } catch (error) {
            console.error('Error in highlightCard:', error);
            element.classList.remove('processing-card', 'waiting-card');
            element.classList.add('processed-card');
            element.setAttribute('data-processing-info', 'Error');
        }
    }

    window.highlightCard = highlightCard;

    addProcessingStyles();

    document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').forEach(card => {
        card.classList.remove('processed-card', 'small-image-card', 'processing-card');
        card.classList.add('waiting-card');
        card.setAttribute('data-processing-info', 'Waiting...');
    });

    async function findSmallImages(testType) {
        try {
            scannedVehicles = await window.scrollDownUntilLoadAllVehicles(result, "", testType);
            
            const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
            await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);

            const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
            console.log(message);
            console.log(result);

            chrome.runtime.sendMessage({
                type: 'exportToCSV',
                data: result,
                testType: testType,
                siteName: window.location.hostname.replace('www.', '')
            });
            
            addCleanupButton();
        } finally {
            try {
                await chrome.runtime.sendMessage({ type: 'stopProcessing' });
            } catch (error) {
                console.warn('Could not send stopProcessing message:', error);
            }
            isProcessing = false;
        }
    }

    findSmallImages(testType);
} 