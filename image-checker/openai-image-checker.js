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
        const storageResult = await chrome.storage.local.get(['openaiKey']);
        const openaiKey = storageResult.openaiKey;

        if (!openaiKey) {
            throw new Error('OpenAI API key not found. Please configure it in the extension popup.');
        }

        const imageSize = await getImageFileSize(imageUrl);
        if (comingSoonImageSizes.has(imageSize)) {
            console.log('Found cached coming soon image size, skipping API call');
            return true;
        }

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
        const text = result?.choices?.[0]?.message?.content?.toLowerCase() || '';
        const isComingSoon = text.includes('true');

        if (isComingSoon) {
            console.log('New coming soon image size found, adding to cache');
            comingSoonImageSizes.add(imageSize);
            await saveToStorage();
        }

        return isComingSoon;
    } catch (error) {
        console.error('OpenAI Error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}