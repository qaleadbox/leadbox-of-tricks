let comingSoonImageSizes = new Set();

function loadFromStorage() {
    if (chrome?.storage?.local) {
        chrome.storage.local.get(['comingSoonImageSizes', 'ocrKey'], (storageResult) => {
            if (storageResult?.comingSoonImageSizes) {
                storageResult.comingSoonImageSizes.forEach(size => comingSoonImageSizes.add(size));
                console.log('Loaded cached image sizes:', comingSoonImageSizes.size);
            }
        });
    }
}

async function saveToStorage() {
    if (chrome?.storage?.local) {
        try {
            await chrome.storage.local.set({ 
                comingSoonImageSizes: Array.from(comingSoonImageSizes) 
            });
        } catch (error) {
            console.warn('Failed to save to storage:', error);
        }
    }
}

loadFromStorage();

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

export async function checkImageWithOCR(imageUrl) {
    try {
        const storageResult = await chrome.storage.local.get(['ocrKey', 'enableComingSoonCache']);
        const ocrKey = storageResult.ocrKey;
        const cacheEnabled = storageResult.enableComingSoonCache !== undefined ? storageResult.enableComingSoonCache : true;

        console.log('🔧 Cache setting:', cacheEnabled ? 'ENABLED' : 'DISABLED');

        if (!ocrKey) {
            throw new Error('OCR API key not found. Please configure it in the extension popup.');
        }

        const imageSize = await getImageFileSize(imageUrl);
        console.log('🔢 Image file size:', imageSize, 'bytes for:', imageUrl);
        console.log('🗂️ Current cached sizes:', Array.from(comingSoonImageSizes));

        if (cacheEnabled && comingSoonImageSizes.has(imageSize)) {
            console.log('✅ CACHED: Image size', imageSize, 'bytes was previously detected as "coming soon" for:', imageUrl);
            console.warn('⚠️ WARNING: This image has same file size as a "coming soon" image, returning TRUE without checking!');
            return true;
        }
        console.log('🔍 Checking image via OCR API. Size:', imageSize, 'URL:', imageUrl);

        const params = new URLSearchParams({
            apikey: ocrKey,
            url: imageUrl,
            language: 'eng'
        });
        const response = await fetch(`https://api.ocr.space/parse/imageurl?${params}`, {
            method: 'GET'
        });
        if (!response.ok) {
            throw new Error(`OCR API error: ${response.status} - ${response.statusText}`);
        }
        const ocrResult = await response.json();
        const text = ocrResult?.ParsedResults?.[0]?.ParsedText || '';
        console.log('OCR raw response for', imageUrl, ':', text);
        const isComingSoon = text.toLowerCase().includes('soon');
        console.log('OCR decision: isComingSoon =', isComingSoon);

        if (isComingSoon && cacheEnabled) {
            console.log('New coming soon image size found, adding to cache. Size:', imageSize);
            comingSoonImageSizes.add(imageSize);
            await saveToStorage();
        } else if (isComingSoon && !cacheEnabled) {
            console.log('Coming soon detected but caching is DISABLED, not saving to cache');
        }

        return isComingSoon;
    } catch (error) {
        console.error('OCR Error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}
  
