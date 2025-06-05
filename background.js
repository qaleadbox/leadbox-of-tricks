import { checkImageWithOpenAI } from './Image Checker/imageCheckerByOpenAI.js';

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

setInterval(changeIcon, 300);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'checkImage') {
        (async () => {
            try {
                const result = await checkImageWithOpenAI(request.imageUrl);
                sendResponse({ success: true, result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});
