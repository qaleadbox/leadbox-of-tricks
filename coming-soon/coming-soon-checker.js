// coming-soon-checker.js

// Toggle expansion of method selection div
document.getElementById('check missing images').addEventListener('click', async (event) => {
    const methodSelectionDiv = document.getElementById('methodSelectionDiv');
    const ocrInput = document.getElementById('ocrInput');
    const openaiInput = document.getElementById('openaiInput');

    if (methodSelectionDiv.style.display === 'none' || methodSelectionDiv.style.display === '') {
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

    // Check if API key exists
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

    const testType = "COMING_SOON_DETECTOR";

    // Inject required scripts
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/core/$card-highlighter.js', '/core/$scrolling.js', '/core/$data-handler.js']
    });

    // Load manual selectors into window before running
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
            const domain = location.hostname.replace(/^www\./, '');
            const stored = await chrome.storage.local.get('manualVehicleSelectors');
            const all = stored.manualVehicleSelectors || {};
            const selectors = all[domain] || all.global || {};
            if (!window.manualVehicleSelectors) window.manualVehicleSelectors = {};
            window.manualVehicleSelectors[domain] = selectors;
            console.log('Loaded selectors for domain:', domain, selectors);
        }
    });

    // Inject and run the scanner
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: callFindUrlsAndModels,
        args: [testType]
    });
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

// Load saved API keys, selected method, and cache setting
chrome.storage.local.get(['ocrKey', 'openaiKey', 'selectedImageCheckMethod', 'enableComingSoonCache'], (result) => {
    if (result.ocrKey) {
        document.getElementById('ocrKey').value = result.ocrKey;
    }
    if (result.openaiKey) {
        document.getElementById('openaiKey').value = result.openaiKey;
    }

    const savedMethod = result.selectedImageCheckMethod || 'ocr';
    document.getElementById(savedMethod + 'Method').checked = true;
    console.log('Popup: Loaded saved method:', savedMethod);

    // Load cache setting (default to true for backward compatibility)
    const cacheEnabled = result.enableComingSoonCache !== undefined ? result.enableComingSoonCache : true;
    document.getElementById('enableComingSoonCache').checked = cacheEnabled;
    console.log('Popup: Loaded cache setting:', cacheEnabled);
});

// Save selected method on change
document.querySelectorAll('input[name="imageCheckMethod"]').forEach(radio => {
    radio.addEventListener('change', async (event) => {
        const ocrInput = document.getElementById('ocrInput');
        const openaiInput = document.getElementById('openaiInput');

        await chrome.storage.local.set({ selectedImageCheckMethod: event.target.value });
        console.log('Popup: Saved method selection:', event.target.value);

        // Hide API key inputs when changing method
        ocrInput.style.display = 'none';
        openaiInput.style.display = 'none';
    });
});

// Save cache setting on change
document.getElementById('enableComingSoonCache').addEventListener('change', async (event) => {
    const cacheEnabled = event.target.checked;
    await chrome.storage.local.set({ enableComingSoonCache: cacheEnabled });
    console.log('Popup: Saved cache setting:', cacheEnabled);

    // Clear cache if disabling
    if (!cacheEnabled) {
        await chrome.storage.local.remove('comingSoonImageSizes');
        console.log('Popup: Cleared comingSoonImageSizes cache');
    }
});

// Main function to inject into page
function callFindUrlsAndModels(testType) {
    let scannedVehicles = 0;
    let result = [];
    let isProcessing = true;

    try {
        chrome.runtime.sendMessage({ type: 'startProcessing' }).catch(error => {
            console.warn('Could not send startProcessing message:', error);
        });
    } catch (error) {
        console.warn('Error sending startProcessing message:', error);
    }

    // Setup functions for checking images
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
            return await window.isComingSoonImageByOCR(imageUrl);
        } else if (selectedMethod === 'openai') {
            return await window.isComingSoonImageByChatGPT(imageUrl);
        }
        return false;
    };

    // Process images
    async function findUrlsAndModels(testType) {
        try {
            scannedVehicles = await window.scrollDownUntilLoadAllVehicles(result, "", testType);

            const allVehicleCards = document.querySelectorAll('.vehicle-car__section');
            await window.$dataHandler(allVehicleCards, null, result, testType, window.highlightCard);

            console.log(`Scanned ${scannedVehicles} vehicle(s).`);
            console.log('🚨 BEFORE EXPORT - Result array contains:', result.length, 'items');
            console.log('🚨 BEFORE EXPORT - Result data:', result);

            chrome.runtime.sendMessage({
                type: 'exportToCSV',
                data: result,
                testType: testType,
                siteName: window.location.hostname.replace('www.', '')
            });
        } finally {
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
