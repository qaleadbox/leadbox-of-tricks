let comingSoonImageSizes = new Set();

function loadFromStorage() {
    if (chrome?.storage?.local) {
        chrome.storage.local.get(['comingSoonImageSizes', 'openaiKey'], (storageResult) => {
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

export async function checkImageWithOpenAI(imageUrl) {
    try {
        const storageResult = await chrome.storage.local.get(['openaiKey', 'enableComingSoonCache']);
        const openaiKey = storageResult.openaiKey;
        const cacheEnabled = storageResult.enableComingSoonCache !== undefined ? storageResult.enableComingSoonCache : true;

        console.log('🔧 Cache setting:', cacheEnabled ? 'ENABLED' : 'DISABLED');

        if (!openaiKey) {
            throw new Error('OpenAI API key not found. Please configure it in the extension popup.');
        }

        const imageSize = await getImageFileSize(imageUrl);
        console.log('🔢 Image file size:', imageSize, 'bytes for:', imageUrl);
        console.log('🗂️ Current cached sizes:', Array.from(comingSoonImageSizes));

        if (cacheEnabled && comingSoonImageSizes.has(imageSize)) {
            console.log('✅ CACHED: Image size', imageSize, 'bytes was previously detected as "coming soon" for:', imageUrl);
            console.warn('⚠️ WARNING: This image has same file size as a "coming soon" image, returning TRUE without checking!');
            return true;
        }
        console.log('🔍 Checking image via OpenAI API. Size:', imageSize, 'URL:', imageUrl);

        const requestBody = {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this image carefully. If the image contains any of these elements, return true: 'Coming Soon' text, 'Coming Soon' sign, placeholder image, or any indication that the image is not yet available. If the image shows an actual vehicle or product, return false. Be thorough in your analysis." },
                        { type: "image_url", image_url: { url: imageUrl }}
                    ]
                }
            ],
            max_tokens: 300
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const text = result?.choices?.[0]?.message?.content?.trim() || '';
        console.log('OpenAI raw response for', imageUrl, ':', text);

        // More robust parsing: check for "true" or "false" in the response
        const textLower = text.toLowerCase();
        let isComingSoon = false;

        if (/\btrue\b/.test(textLower) && !/\bfalse\b/.test(textLower)) {
            // Contains "true" but not "false"
            isComingSoon = true;
        } else if (/\bfalse\b/.test(textLower) && !/\btrue\b/.test(textLower)) {
            // Contains "false" but not "true"
            isComingSoon = false;
        } else if (/^true/i.test(text)) {
            // Starts with "true" (fallback)
            isComingSoon = true;
        } else if (/^false/i.test(text)) {
            // Starts with "false" (fallback)
            isComingSoon = false;
        }

        console.log('OpenAI decision: isComingSoon =', isComingSoon);

        if (isComingSoon && cacheEnabled) {
            console.log('New coming soon image size found, adding to cache. Size:', imageSize);
            comingSoonImageSizes.add(imageSize);
            await saveToStorage();
        } else if (isComingSoon && !cacheEnabled) {
            console.log('Coming soon detected but caching is DISABLED, not saving to cache');
        }

        return isComingSoon;
    } catch (error) {
        console.error('OpenAI Error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}