document.getElementById('Copy Unordered List Links').addEventListener('click', () => {
    const hrefInput = document.getElementById('hrefInput');
    if (hrefInput.style.display === 'none' || hrefInput.style.display === '') {
        hrefInput.style.display = 'block';
        document.getElementById('liElements').focus();
    } else {
        hrefInput.style.display = 'none';
    }
});

document.getElementById('processHrefs').addEventListener('click', async () => {
    const liElements = document.getElementById('liElements').value;
    if (!liElements.trim()) {
        alert('Please paste some HTML content first');
        return;
    }

    try {
        await chrome.runtime.sendMessage({ type: 'startProcessing' });

        const parser = new DOMParser();
        const doc = parser.parseFromString(liElements, 'text/html');
        const links = Array.from(doc.getElementsByTagName('a'));
        
        if (links.length === 0) {
            alert('No links found in the pasted content');
            return;
        }
        
        const hrefs = links.map(link => link.href);
        const textContent = hrefs.join('\n');
        
        await navigator.clipboard.writeText(textContent);
        
        const message = `Successfully copied ${hrefs.length} HREF${hrefs.length === 1 ? '' : 's'} to clipboard!`;
        alert(message);
        
        document.getElementById('liElements').value = '';
        document.getElementById('hrefInput').style.display = 'none';
    } catch (err) {
        alert('Failed to copy to clipboard. Please try again.');
        console.error('Failed to copy to clipboard:', err);
    } finally {
        try {
            await chrome.runtime.sendMessage({ type: 'stopProcessing' });
        } catch (error) {
            console.error('Error stopping processing:', error);
        }
    }
});
