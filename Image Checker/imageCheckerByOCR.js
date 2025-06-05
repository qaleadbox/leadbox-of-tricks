import { OCR_API_KEY } from '../config.js';

export async function checkImageWithOCR(imageUrl) {
    try {
        const params = new URLSearchParams({
            apikey: OCR_API_KEY,
            url: imageUrl,
            language: 'eng'
        });
        const response = await fetch(`https://api.ocr.space/parse/imageurl?${params}`, {
            method: 'GET'
        });
        if (!response.ok) {
            throw new Error(`OCR API error: ${response.status} - ${response.statusText}`);
        }
        const result = await response.json();
        const text = result?.ParsedResults?.[0]?.ParsedText?.toLowerCase() || '';
        const isComingSoon = text.includes('coming soon');
        return isComingSoon;
    } catch (error) {
        console.error('OCR Error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}
  
