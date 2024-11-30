document.getElementById('Check missing images').addEventListener('click', async () => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		function: callFindUrlsAndModels
	});
});

function callFindUrlsAndModels() {
    findUrlsAndModels();

    async function findUrlsAndModels() {
        const result = [];
		let scannedVehicles = 0;

		await scrollDownUntilLoadAllVehicles();
		scannedVehicles = readVehiclesAndWriteResults(result);

		const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;
		console.log(message);
		console.log(result);
    }

	async function scrollDownUntilLoadAllVehicles() {
		let actualElementsLoaded = document.querySelectorAll('.vehicle-car__section').length;
		let lastCount = 0;

		while (actualElementsLoaded !== lastCount) {
			lastCount = actualElementsLoaded;
			window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

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
}
