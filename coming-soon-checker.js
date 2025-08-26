document.getElementById('check missing images').addEventListener('click', async (event) => {
    const methodSelectionDiv = document.getElementById('methodSelectionDiv');
    const ocrInput = document.getElementById('ocrInput');
    const openaiInput = document.getElementById('openaiInput');
    const ocrKeyTextarea = document.getElementById('ocrKey');
    const openaiKeyTextarea = document.getElementById('openaiKey');
    const saveOcrKeyButton = document.getElementById('saveOcrKey');
    const saveOpenAIKeyButton = document.getElementById('saveOpenAIKey');

    if (methodSelectionDiv.style.display === 'none') {
        methodSelectionDiv.style.display = 'block';
        return;
    } else {
        methodSelectionDiv.style.display = 'none';
        ocrInput.style.display = 'none';
        openaiInput.style.display = 'none';
        return;
    }
});

async function startImageScanning() {
    const selectedMethod = document.querySelector('input[name="imageCheckMethod"]:checked')?.value || 'ocr';
    const ocrInput = document.getElementById('ocrInput');
    const openaiInput = document.getElementById('openaiInput');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isApiRequired = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            return document.querySelector('div.lbx-paginator') !== null;
        }
    });

    if (isApiRequired[0].result) {
        if (selectedMethod === 'ocr') {
            const storageResult = await chrome.storage.local.get(['ocrKey']);
            if (!storageResult.ocrKey) {
                ocrInput.style.display = 'block';
                openaiInput.style.display = 'none';
                return;
            }
        } else if (selectedMethod === 'openai') {
            const storageResult = await chrome.storage.local.get(['openaiKey']);
            if (!storageResult.openaiKey) {
                openaiInput.style.display = 'block';
                ocrInput.style.display = 'none';
                return;
            }
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
}

document.getElementById('startScanning').addEventListener('click', async () => {
    await startImageScanning();
});

document.getElementById('saveOcrKey').addEventListener('click', async () => {
    const ocrKeyTextarea = document.getElementById('ocrKey');
    const ocrInput = document.getElementById('ocrInput');
    const ocrKey = ocrKeyTextarea.value.trim();

    if (ocrKey) {
        await chrome.storage.local.set({ ocrKey });
        ocrInput.style.display = 'none';
        await startImageScanning();
    } else {
        alert('Please enter a valid OCR key');
    }
});

document.getElementById('saveOpenAIKey').addEventListener('click', async () => {
    const openaiKeyTextarea = document.getElementById('openaiKey');
    const openaiInput = document.getElementById('openaiInput');
    const openaiKey = openaiKeyTextarea.value.trim();

    if (openaiKey) {
        await chrome.storage.local.set({ openaiKey });
        openaiInput.style.display = 'none';
        await startImageScanning();
    } else {
        alert('Please enter a valid OpenAI key');
    }
});

chrome.storage.local.get(['ocrKey', 'openaiKey', 'selectedImageCheckMethod'], (result) => {
    if (result.ocrKey) {
        document.getElementById('ocrKey').value = result.ocrKey;
    }
    if (result.openaiKey) {
        document.getElementById('openaiKey').value = result.openaiKey;
    }
    
    const savedMethod = result.selectedImageCheckMethod || 'ocr';
    document.getElementById(savedMethod + 'Method').checked = true;
    console.log('Popup: Loaded saved method:', savedMethod);
});

document.querySelectorAll('input[name="imageCheckMethod"]').forEach(radio => {
    radio.addEventListener('change', async (event) => {
        const ocrInput = document.getElementById('ocrInput');
        const openaiInput = document.getElementById('openaiInput');
        
        await chrome.storage.local.set({ selectedImageCheckMethod: event.target.value });
        console.log('Popup: Saved method selection:', event.target.value);
        
        if (event.target.value === 'ocr') {
            ocrInput.style.display = 'none';
            openaiInput.style.display = 'none';
        } else if (event.target.value === 'openai') {
            ocrInput.style.display = 'none';
            openaiInput.style.display = 'none';
        }
    });
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

    window.isComingSoonImageByChatGPT = async function(imageUrl) {
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
    };

    window.isComingSoonImage = async function(imageUrl) {
        let selectedMethod = 'ocr';
        
        try {
            const storageResult = await chrome.storage.local.get(['selectedImageCheckMethod']);
            selectedMethod = storageResult.selectedImageCheckMethod || 'ocr';
            console.log('Using image check method:', selectedMethod);
        } catch (error) {
            console.warn('Could not get selected method from storage, defaulting to OCR:', error);
            selectedMethod = 'ocr';
        }
        
        if (selectedMethod === 'ocr') {
            console.log('Calling OCR image check for:', imageUrl);
            return await window.isComingSoonImageByOCR(imageUrl);
        } else if (selectedMethod === 'openai') {
            console.log('Calling OpenAI image check for:', imageUrl);
            return await window.isComingSoonImageByChatGPT(imageUrl);
        }
        return false;
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

    findUrlsAndModels(testType);
}
