window.highlightCard = async function(element, processingFunction, lastProcessingTime, globalStyleElement) {
    addProcessingStyles(globalStyleElement);
    element.classList.add('processing-card');
    
    const startTime = performance.now();
    let timerInterval;
    
    timerInterval = setInterval(() => {
        const currentTime = (performance.now() - startTime) / 1000;
        updateProcessingInfo(element, currentTime, lastProcessingTime);
    }, 100);
    
    updateProcessingInfo(element, 0, lastProcessingTime);
    
    try {
        const result = await processingFunction();
        const endTime = performance.now();
        const processingTime = (endTime - startTime) / 1000;
        lastProcessingTime = processingTime;
        
        clearInterval(timerInterval);
        
        element.classList.remove('processing-card');
        
        if (result) {
            element.classList.add('coming-soon-card');
            updateProcessingInfo(element, processingTime, lastProcessingTime, true, true, 'COMING_SOON_DETECTOR');
        } else {
            element.classList.add('processed-card');
            updateProcessingInfo(element, processingTime, lastProcessingTime, true, false, 'COMING_SOON_DETECTOR');
        }
        
        return result;
    } catch (error) {
        clearInterval(timerInterval);
        element.classList.remove('processing-card');
        element.classList.add('processed-card');
        updateProcessingInfo(element, (performance.now() - startTime) / 1000, lastProcessingTime, true);
        throw error;
    }
};

function updateProcessingInfo(element, currentTime, lastTime, isProcessed = false, issueFound, testType) {
    let timeInfo;
    console.log(currentTime);

    if (isProcessed) {
        if ((testType === 'COMING_SOON_DETECTOR') && (issueFound)) {
            timeInfo = `Coming Soon ${currentTime.toFixed(2)}s`;
        } else if ((testType === 'SMALL_IMAGE_DETECTOR') && (issueFound)) {
            const processingTime = currentTime - lastTime;
            timeInfo = `Small Image ${processingTime.toFixed(2)}s`;
        } else {
            timeInfo = `Processed in ${currentTime.toFixed(2)}s`;
        }
    } else {
        timeInfo = lastTime > 0 
            ? `Processing... (Last: ${lastTime.toFixed(2)}s)`
            : 'Processing...';
    }

    element.setAttribute('data-processing-info', timeInfo);
}

function addCleanupButton() {
    const button = document.createElement('button');
    button.id = 'cleanup-highlights-button';
    button.textContent = 'Clear Highlights';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    button.addEventListener('click', () => {
        cleanupStyles();
        button.remove();
    });
    document.body.appendChild(button);
}

function cleanupStyles() {
    const styleElement = document.querySelector('style[data-processing-styles]');
    if (styleElement) {
        styleElement.remove();
    }
    document.querySelectorAll('div.vehicle-car__section.vehicle-car-1').forEach(card => {
        card.classList.remove('processed-card', 'coming-soon-card', 'small-image-card', 'processing-card', 'waiting-card');
        card.removeAttribute('data-processing-info');
    });
    const cleanupButton = document.querySelector('#cleanup-highlights-button');
    if (cleanupButton) {
        cleanupButton.remove();
    }
}

function addProcessingStyles(globalStyleElement) {
    if (globalStyleElement) {
        globalStyleElement.remove();
    }
    
    globalStyleElement = document.createElement('style');
    globalStyleElement.setAttribute('data-processing-styles', 'true');
    globalStyleElement.textContent = `
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 20px 10px rgba(0, 123, 255, 0.4);
                transform: scale(1.02);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
                transform: scale(1);
            }
        }
        @keyframes blink {
            0% {
                filter: none;
            }
            50% {
                filter: sepia(50%) saturate(200%) hue-rotate(-30deg);
            }
            100% {
                filter: none;
            }
        }
        @keyframes waiting {
            0% {
                border-color: rgba(108, 117, 125, 0.5);
            }
            50% {
                border-color: rgba(108, 117, 125, 0.8);
            }
            100% {
                border-color: rgba(108, 117, 125, 0.5);
            }
        }
        .processing-card {
            animation: pulse 1.5s infinite;
            transition: all 0.3s ease;
            border: 2px solid rgba(0, 123, 255, 0.5);
            border-radius: 12px;
            position: relative;
            z-index: 1;
        }
        .processed-card {
            border: 2px solid rgba(40, 167, 69, 0.5);
            border-radius: 12px;
            position: relative;
            z-index: 1;
        }
        .coming-soon-card, .small-image-card {
            border: 2px solid rgb(255, 0, 0);
            border-radius: 12px;
            position: relative;
            z-index: 1;
        }
        .waiting-card {
            animation: waiting 2s infinite;
            border: 2px solid rgba(108, 117, 125, 0.5);
            border-radius: 12px;
            position: relative;
            z-index: 1;
        }
        .coming-soon-card .main-img, .small-image-card .main-img {
            animation: blink 1s infinite;
            border: 2px solid rgb(255, 0, 0);
            border-radius: 8px;
        }
        .processing-card::before,
        .processed-card::before,
        .coming-soon-card::before,
        .small-image-card::before,
        .waiting-card::before {
            content: attr(data-processing-info);
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            white-space: nowrap;
            z-index: 2;
        }
        .processing-card::before {
            background: rgba(0, 123, 255, 0.9);
            color: white;
        }
        .processed-card::before {
            background: rgba(40, 167, 69, 0.9);
            color: white;
        }
        .coming-soon-card::before,
        .small-image-card::before {
            background: rgb(255, 0, 0);
            color: white;
        }
        .waiting-card::before {
            background: rgba(108, 117, 125, 0.9);
            color: white;
        }
    `;
    document.head.appendChild(globalStyleElement);
    return globalStyleElement;
}
