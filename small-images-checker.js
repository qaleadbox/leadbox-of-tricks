document.getElementById('check small images').addEventListener('click', async (event) => {
    
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
                files: ['$card-highlighter.js', '$scrolling.js', '$data-handler.js']
            });

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: callFindSmallImages,
                args: [testType]
            });
        } catch (error) {
            console.error('Error executing small image detection:', error);
        } finally {
            chrome.runtime.sendMessage({ type: 'stopProcessing' });
        }
    });
});

const testType = 'SMALL_IMAGE_DETECTOR';

function callFindSmallImages(testType) {
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
                        const isSmall = fileSizeKB < 10;
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
    async function highlightCard(element, isSmallImageCallback) {
        const currentTime = Date.now();
        
        try {
            const { isSmall, fileSizeKB } = await isSmallImageCallback();
            
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
            updateProcessingInfo(element, currentTime, lastProcessingTime, true, testType);
            
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