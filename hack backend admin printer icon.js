// Function to duplicate magnifying glass icons
function duplicateMagnifyingGlass(original) {
    // Prevent duplicate injection
    if (original.nextElementSibling?.classList?.contains('hacked-icon')) return;

    // Get lead ID from original link
    const href = original.getAttribute('href');
    if (!href) return; // Skip if no href

    const match = href.match(/previewinternallead\/([^?]+)/);
    if (!match || !match[1]) return; // Skip silently if no match

    const leadId = match[1];
    const printUrl = `https://my.leadboxhq.net/home/printlead/${leadId}`;

    // Create a new link with the printer icon
    const printLink = document.createElement('a');
    printLink.href = printUrl;
    printLink.classList.add('hacked-icon');
    printLink.style.marginLeft = '8px';
    printLink.title = 'Print Lead';
    printLink.setAttribute('data-action', 'preview-lead');
    
    // Add the printer icon
    const icon = document.createElement('i');
    icon.className = 'leadbox-icon-printer';
    printLink.appendChild(icon);

    // Insert after the original
    original.parentNode.insertBefore(printLink, original.nextSibling);
}

// Create a MutationObserver to watch for changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
        }
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Handle any existing magnifying glasses
document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "duplicateMagnifyingGlasses") {
        document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
        sendResponse({status: "success"});
    }
});

// Function to be injected into the page
function injectContentScript() {
    // Create a MutationObserver to watch for changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
            }
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also handle any existing magnifying glasses
    document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "duplicateMagnifyingGlasses") {
        document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
        sendResponse({status: "success"});
    }
});

// Inject the content script when the extension button is clicked
document.getElementById('hack backend printer icon').addEventListener('click', async (event) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // First inject the content script
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: injectContentScript
    });

    // Then send a message to start the process
    chrome.tabs.sendMessage(tab.id, { action: "duplicateMagnifyingGlasses" });
});

// Also inject when the page loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.includes('leadboxhq.net')) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: injectContentScript
        }).then(() => {
            chrome.tabs.sendMessage(tabId, { action: "duplicateMagnifyingGlasses" });
        });
    }
});


