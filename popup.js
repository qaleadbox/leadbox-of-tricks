const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        justify-content: center;
        align-items: center;
    }

    .loading-overlay.visible {
        display: flex;
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.className = 'loading-overlay';
const spinner = document.createElement('div');
spinner.className = 'loading-spinner';
overlay.appendChild(spinner);
document.body.appendChild(overlay);

function toggleLoading(show) {
    if (show) {
        overlay.classList.add('visible');
    } else {
        overlay.classList.remove('visible');
    }
}

async function sendMessageToBackground(message) {
    try {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
}

chrome.runtime.sendMessage({ type: 'checkProcessingState' }, (response) => {
    if (response && response.isProcessing) {
        toggleLoading(true);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'startProcessing') {
        console.log('Starting processing...');
        toggleLoading(true);
        sendResponse({ success: true });
    } else if (message.type === 'stopProcessing') {
        console.log('Stopping processing...');
        setTimeout(() => {
            toggleLoading(false);
        }, 500);
        sendResponse({ success: true });
    }
    return true;
});

window.addEventListener('unload', async () => {
    try {
        await sendMessageToBackground({ type: 'stopProcessing' });
    } catch (error) {
        console.error('Error stopping processing on unload:', error);
    }
});

window.addEventListener('blur', async () => {
    try {
        await sendMessageToBackground({ type: 'stopProcessing' });
    } catch (error) {
        console.error('Error stopping processing on blur:', error);
    }
});

const docsButton = document.querySelector('.docs-button');
const docsPopup = document.querySelector('.docs-popup');
let docsHideTimeout;

docsButton.addEventListener('mouseenter', function() {
    clearTimeout(docsHideTimeout);
    docsPopup.style.display = 'block';
    setTimeout(() => docsPopup.classList.add('visible'), 10);
});

docsButton.addEventListener('mouseleave', function() {
    docsHideTimeout = setTimeout(() => {
        docsPopup.classList.remove('visible');
        setTimeout(() => {
            if (!docsPopup.matches(':hover')) {
                docsPopup.style.display = 'none';
            }
        }, 200);
    }, 100);
});

docsPopup.addEventListener('mouseenter', function() {
    clearTimeout(docsHideTimeout);
    docsPopup.classList.add('visible');
});

docsPopup.addEventListener('mouseleave', function() {
    docsHideTimeout = setTimeout(() => {
        docsPopup.classList.remove('visible');
        setTimeout(() => {
            if (!docsButton.matches(':hover')) {
                docsPopup.style.display = 'none';
            }
        }, 200);
    }, 100);
});

const featuresButton = document.querySelector('.features-button');
const featuresList = document.querySelector('.features-list');
let featuresHideTimeout;

featuresButton.addEventListener('mouseenter', function() {
    clearTimeout(featuresHideTimeout);
    featuresList.style.display = 'block';
    setTimeout(() => featuresList.classList.add('visible'), 10);
});

featuresButton.addEventListener('mouseleave', function() {
    featuresHideTimeout = setTimeout(() => {
        featuresList.classList.remove('visible');
        setTimeout(() => {
            if (!featuresList.matches(':hover')) {
                featuresList.style.display = 'none';
            }
        }, 200);
    }, 100);
});

featuresList.addEventListener('mouseenter', function() {
    clearTimeout(featuresHideTimeout);
    featuresList.classList.add('visible');
});

featuresList.addEventListener('mouseleave', function() {
    featuresHideTimeout = setTimeout(() => {
        featuresList.classList.remove('visible');
        setTimeout(() => {
            if (!featuresButton.matches(':hover')) {
                featuresList.style.display = 'none';
            }
        }, 200);
    }, 100);
}); 