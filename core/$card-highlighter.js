// $card-highlighter.js
window.highlightCard = async function (element, processingFunction, lastProcessingTime = 0, globalStyleElement = null, testType = '') {
    addProcessingStyles(globalStyleElement);
    element.classList.remove('waiting-card', 'processed-card', 'coming-soon-card', 'small-image-card');
    element.classList.add('processing-card');

    const startTime = performance.now();
    const timer = setInterval(() => {
        const currentTime = (performance.now() - startTime) / 1000;
        updateProcessingInfo(element, currentTime, lastProcessingTime);
    }, 100);

    try {
        const result = await processingFunction();
        console.log('🎯 highlightCard: processingFunction returned:', result, 'testType:', testType);
        clearInterval(timer);

        const endTime = performance.now();
        const processingTime = (endTime - startTime) / 1000;
        lastProcessingTime = processingTime;

        element.classList.remove('processing-card');
        element.classList.add('processed-card');

        if (result === true) {
            console.log('🔴 highlightCard: result is TRUE, adding special class for', testType);
            if (testType === 'COMING_SOON_DETECTOR') {
                element.classList.add('coming-soon-card');
                updateProcessingInfo(element, processingTime, lastProcessingTime, true, true, 'COMING_SOON_DETECTOR');
            } else if (testType === 'SMALL_IMAGE_DETECTOR') {
                element.classList.add('small-image-card');
                updateProcessingInfo(element, processingTime, lastProcessingTime, true, true, 'SMALL_IMAGE_DETECTOR');
            }
        } else {
            console.log('⚪ highlightCard: result is FALSE, marking as processed only');
            updateProcessingInfo(element, processingTime, lastProcessingTime, true, false, testType);
        }

        console.log('↩️ highlightCard: returning', result);
        return result;
    } catch (error) {
        clearInterval(timer);
        element.classList.remove('processing-card');
        element.classList.add('processed-card');
        element.setAttribute('data-processing-info', 'Error');
        console.error('💥 highlightCard error:', error);
        return false;
    }
};

function updateProcessingInfo(element, currentTime, lastTime, isProcessed = false, issueFound = false, testType = '') {
    let info;

    if (isProcessed) {
        if (testType === 'COMING_SOON_DETECTOR' && issueFound) {
            info = `Coming Soon (${currentTime.toFixed(2)}s)`;
        } else if (testType === 'SMALL_IMAGE_DETECTOR' && issueFound) {
            info = `Small Image (${currentTime.toFixed(2)}s)`;
        } else {
            info = `Processed (${currentTime.toFixed(2)}s)`;
        }
    } else {
        info = lastTime > 0 ? `Processing... (Last: ${lastTime.toFixed(2)}s)` : 'Processing...';
    }

    element.setAttribute('data-processing-info', info);
}

function addCleanupButton() {
    if (document.getElementById('cleanup-highlights-button')) return;

    const btn = document.createElement('button');
    btn.id = 'cleanup-highlights-button';
    btn.textContent = 'Clear Highlights';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-family: Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    btn.onclick = () => {
        cleanupStyles();
        btn.remove();
    };
    document.body.appendChild(btn);
}

function cleanupStyles() {
    const style = document.querySelector('style[data-processing-styles]');
    if (style) style.remove();

    document.querySelectorAll('.vehicle-car__section, .vehicle-card').forEach(card => {
        card.classList.remove('processed-card', 'coming-soon-card', 'small-image-card', 'processing-card', 'waiting-card');
        card.removeAttribute('data-processing-info');
    });
}

function addProcessingStyles(globalStyleElement = null) {
    if (document.querySelector('style[data-processing-styles]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-processing-styles', 'true');
    style.textContent = `
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(0,123,255,0.6); }
                           50% { box-shadow: 0 0 20px 10px rgba(0,123,255,0.3); transform: scale(1.02); }
                           100% { box-shadow: 0 0 0 0 rgba(0,123,255,0.6); transform: scale(1); } }
        @keyframes waiting { 0%,100% { border-color: rgba(120,120,120,0.5); }
                             50% { border-color: rgba(120,120,120,0.9); } }
        @keyframes blink { 50% { filter: brightness(150%) saturate(150%) hue-rotate(-30deg); } }

        .processing-card {
            animation: pulse 1.5s infinite;
            border: 2px solid rgba(0,123,255,0.5);
            border-radius: 10px;
            position: relative;
            z-index: 2;
        }
        .processed-card {
            border: 2px solid rgba(40,167,69,0.6);
            border-radius: 10px;
            position: relative;
            z-index: 2;
        }
        .coming-soon-card, .small-image-card {
            border: 2px solid rgba(255,0,0,0.9);
            border-radius: 10px;
            animation: blink 1s infinite;
        }
        .waiting-card {
            animation: waiting 2s infinite;
            border: 2px solid rgba(108,117,125,0.5);
            border-radius: 10px;
        }

        .processing-card::before,
        .processed-card::before,
        .coming-soon-card::before,
        .small-image-card::before,
        .waiting-card::before {
            content: attr(data-processing-info);
            position: absolute;
            top: -22px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            white-space: nowrap;
        }

        .processing-card::before { background: rgba(0,123,255,0.9); }
        .processed-card::before { background: rgba(40,167,69,0.9); }
        .coming-soon-card::before,
        .small-image-card::before { background: rgba(255,0,0,0.9); }
        .waiting-card::before { background: rgba(108,117,125,0.9); }
    `;
    document.head.appendChild(style);
}
