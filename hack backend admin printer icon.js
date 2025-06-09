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

// Only run this code if we're on the specific internal leads pages
const targetUrls = [
    'https://my.leadboxhq.net/leads/internal',
    'https://car-dealer-production-qa.azurewebsites.net/leads/internal'
];

if (targetUrls.includes(window.location.href)) {
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


