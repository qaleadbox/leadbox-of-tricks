import { checkImageWithOpenAI } from './Image Checker/imageCheckerByOpenAI.js';
import { checkImageWithOCR } from './Image Checker/imageCheckerByOCR.js';

const icons = [
  "./icons/16x16/icon1.png",
  "./icons/16x16/icon2.png",
  "./icons/16x16/icon3.png",
  "./icons/16x16/icon4.png"
];
let currentIndex = 0;

function changeIcon() {
  chrome.action.setIcon({ path: icons[currentIndex] });
  currentIndex = (currentIndex + 1) % icons.length;
}

let isProcessing = false;
let processingTimer = null;
let processingTabs = new Set();

chrome.action.setIcon({ path: icons[0] });

function startRotation() {
    isProcessing = true;
    processingTimer = setInterval(changeIcon, 300);
    chrome.runtime.sendMessage({ type: 'startProcessing' });
}

function stopRotation() {
    isProcessing = false;
    if (processingTimer) {
        clearInterval(processingTimer);
        processingTimer = null;
    }
    chrome.action.setIcon({ path: icons[0] });
    chrome.runtime.sendMessage({ type: 'stopProcessing' });
}

async function handleOCRCheck(imageUrl) {
    try {
        const result = await checkImageWithOCR(imageUrl);
        return result;
    } catch (error) {
        console.error('Error in handleOCRCheck:', error);
        throw error;
    }
}

async function handleOpenAICheck(imageUrl) {
    try {
        const result = await checkImageWithOpenAI(imageUrl);
        return result;
    } catch (error) {
        console.error('Error in handleOpenAICheck:', error);
        throw error;
    }
}

Promise.resolve().then(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Background received message:', message.type, 'from tab:', sender.tab?.id);
        
        try {
            switch (message.type) {
                case 'startProcessing':
                    if (sender.tab?.id) {
                        processingTabs.add(sender.tab.id);
                        startRotation();
                    }
                    sendResponse({ success: true });
                    break;

                case 'stopProcessing':
                    if (sender.tab?.id) {
                        processingTabs.delete(sender.tab.id);
                        if (processingTabs.size === 0) {
                            stopRotation();
                        }
                    }
                    sendResponse({ success: true });
                    break;

                case 'checkImageByOCR':
                    handleOCRCheck(message.imageUrl)
                        .then(result => sendResponse({ success: true, result }))
                        .catch(error => {
                            console.error('OCR check error:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    return true;

                case 'checkImageByOpenAI':
                    handleOpenAICheck(message.imageUrl)
                        .then(result => sendResponse({ success: true, result }))
                        .catch(error => {
                            console.error('OpenAI check error:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    return true;

                default:
                    console.warn('Unknown message type:', message.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (processingTabs.has(tabId)) {
        processingTabs.delete(tabId);
        if (processingTabs.size === 0) {
            stopRotation();
        }
    }
});