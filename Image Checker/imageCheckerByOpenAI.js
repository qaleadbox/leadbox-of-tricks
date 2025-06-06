// import { OPENAI_API_KEY, OPENAI_API_URL } from '../config.js';

export async function checkImageWithOpenAI(imageUrl) {
    try {        
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

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        return result;
    } catch (error) {
        console.error('Error stack:', error.stack);
        throw error;
    }
}