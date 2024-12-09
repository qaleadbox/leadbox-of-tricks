document.getElementById('Check missing images').addEventListener('click', async (event) => {
    const testType = event.target.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: callFindUrlsAndModels,
        args: [testType]
    });
});

function callFindUrlsAndModels(testType) {
    findUrlsAndModels(testType);

    async function findUrlsAndModels(testType) {
        const result = [];
		let scannedVehicles = 0;

		await scrollDownUntilLoadAllVehicles();
		scannedVehicles = readVehiclesAndWriteResults(result);

		const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
		console.log(message);
		console.log(result);

		exportToCSVFile(result, testType);
    }

	async function scrollDownUntilLoadAllVehicles() {
		let actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
		let lastCount = 0;

		while (actualElementsLoaded !== lastCount) {
			lastCount = actualElementsLoaded;
			window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            
            const viewMoreButton = document.querySelector('button.lbx-load-more-btn');
            if (viewMoreButton) {
                console.log('Clicking "View More Vehicles" button...');
                viewMoreButton.click();
            }
			await new Promise(resolve => setTimeout(resolve, 1000));

			actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
			console.log(`Scrolled: ${actualElementsLoaded} elements loaded.`);
		}
		console.warn("Finished scrolling, all vehicles loaded.");
	}

    function readVehiclesAndWriteResults(result) {
        const elements = document.querySelectorAll('.vehicle-car__section');
        elements.forEach(element => {
            const modelElement = element.querySelector('.value__model');
            const trimElement = element.querySelector('.value__trim');
            const stockNumberElement = element.querySelector('.stock_number');
            const imageUrlElement = element.querySelector('.main-img');

            try {
                if (modelElement && trimElement && stockNumberElement && imageUrlElement) {
                    const model = modelElement.textContent.trim();
                    const trim = trimElement.textContent.trim();
                    const stockNumber = stockNumberElement.textContent.trim();
                    const imageUrl = imageUrlElement.dataset.src;

                    if (imageUrl && (imageUrl.includes('better-photo.jpg') || imageUrl.includes('spinner.gif'))) {
                        result.push({ model, trim, stockNumber, imageUrl });
                    }
                }
            } catch (error) {
                console.error("An error occurred while processing elements:", error);
            }
        });
        return elements.length;
    }

	function exportToCSVFile(data, testType) {
        if (data.length === 0) {
            alert('No data to export!');
            return;
        }

		const siteName = window.location.hostname.replace('www.', '');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
		const filename = `${siteName}_${testType.toUpperCase()}_${timestamp}.csv`;

        const headers = ['Model', 'Trim', 'Stock Number', 'Image URL'];
        const rows = data.map(item => [item.model, item.trim, item.stockNumber, item.imageUrl]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(value => `"${value}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = `${filename}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
