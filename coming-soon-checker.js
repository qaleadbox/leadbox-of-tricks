document.getElementById('check missing images').addEventListener('click', async (event) => {
    const ocrInput = document.getElementById('ocrInput');
    const ocrKeyTextarea = document.getElementById('ocrKey');
    const saveOcrKeyButton = document.getElementById('saveOcrKey');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOcrRequired = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            return document.querySelector('div.lbx-paginator') !== null;
        }
    });

    if (isOcrRequired[0].result) {
        const storageResult = await chrome.storage.local.get(['ocrKey']);
        if (!storageResult.ocrKey) {
            ocrInput.style.display = 'block';
            return;
        }
    }

    const testType = "COMING_SOON_DETECTOR";

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['$card-highlighter.js', '$scrolling.js', '$data-handler.js']
    });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: callFindUrlsAndModels,
        args: [testType]
    });

    cleanupStyles();
});

document.getElementById('saveOcrKey').addEventListener('click', async () => {
    const ocrKeyTextarea = document.getElementById('ocrKey');
    const ocrInput = document.getElementById('ocrInput');
    const ocrKey = ocrKeyTextarea.value.trim();

    if (ocrKey) {
        await chrome.storage.local.set({ ocrKey });
        ocrInput.style.display = 'none';
        document.getElementById('check missing images').click();
    } else {
        alert('Please enter a valid OCR key');
    }
});

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
    let isProcessing = true;

    try {
        chrome.runtime.sendMessage({ 
            type: 'startProcessing'
        }).catch(error => {
            console.warn('Could not send startProcessing message:', error);
        });
    } catch (error) {
        console.warn('Error sending startProcessing message:', error);
    }

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

    window.isComingSoonImageByOCR = async function(imageUrl) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'checkImageByOCR',
                imageUrl: imageUrl
            });
            
            if (response && response.success && response.result) {
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Error checking image with OCR:', error);
            return false;
        }
    };

    addProcessingStyles(globalStyleElement);

    document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').forEach(card => {
        card.classList.remove('processed-card', 'coming-soon-card', 'processing-card');
        card.classList.add('waiting-card');
        card.setAttribute('data-processing-info', 'Waiting...');
    });

    async function findUrlsAndModels(testType) {
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
            if (observer) {
                observer.disconnect();
            }
            try {
                await chrome.runtime.sendMessage({ type: 'stopProcessing' });
            } catch (error) {
                console.warn('Could not send stopProcessing message:', error);
            }
            isProcessing = false;
        }
    }

    async function isComingSoonImageByChatGPT(imageUrl) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'checkImageByOpenAI',
                imageUrl: imageUrl
            });
            
            if (response && response.success) {
                return response.result;
            }
            console.warn('Error checking image:', response?.error || 'Unknown error');
            return false;
        } catch (error) {
            console.warn('Error sending message to background script:', error);
            return false;
        }
    }
    findUrlsAndModels(testType);
}