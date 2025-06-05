function duplicateMagnifyingGlass(original) {
    if (original.nextElementSibling?.classList?.contains('hacked-icon')) return;

    const href = original.getAttribute('href');
    if (!href) return;

    const match = href.match(/previewinternallead\/([^?]+)/);
    if (!match || !match[1]) return;

    const leadId = match[1];
    const printUrl = `https://my.leadboxhq.net/home/printlead/${leadId}`;

    const printLink = document.createElement('a');
    printLink.href = printUrl;
    printLink.classList.add('hacked-icon');
    printLink.style.marginLeft = '8px';
    printLink.title = 'Print Lead';
    printLink.setAttribute('data-action', 'preview-lead');
    
    const icon = document.createElement('i');
    icon.className = 'leadbox-icon-printer';
    printLink.appendChild(icon);

    original.parentNode.insertBefore(printLink, original.nextSibling);
}

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "duplicateMagnifyingGlasses") {
        document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
        sendResponse({status: "success"});
    }
});

function injectContentScript() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "duplicateMagnifyingGlasses") {
        document.querySelectorAll('a[data-action="preview-lead"]').forEach(duplicateMagnifyingGlass);
        sendResponse({status: "success"});
    }
});

document.getElementById('hack backend printer icon').addEventListener('click', async (event) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: injectContentScript
    });

    chrome.tabs.sendMessage(tab.id, { action: "duplicateMagnifyingGlasses" });
});

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


