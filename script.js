document.getElementById('Check missing images').addEventListener('click', async () => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		function: callFindUrlsAndModels
	});
});

function callFindUrlsAndModels() {
	const { instances, message } = findUrlsAndModels();
	console.log(message);
	console.log(instances);

	function findUrlsAndModels() {
		const elements = document.querySelectorAll('.vehicle-car__section');
		const result = [];
	
		let scannedVehicles = 0;
	
		elements.forEach(element => {
			scannedVehicles++;
	
			const modelElement = element.querySelector('.value__model');
			const trimElement = element.querySelector('.value__trim');
			const stockNumberElement = element.querySelector('.stock_number');
			const imageUrlElement = element.querySelector('.main-img');
	
			if (modelElement && trimElement && stockNumberElement && imageUrlElement) {
				const model = modelElement.textContent.trim();
				const trim = trimElement.textContent.trim();
				const stockNumber = stockNumberElement.textContent.trim();
				const imageUrl = imageUrlElement.dataset.src;
	
				if (imageUrl && (imageUrl.includes('better-photo.jpg') || imageUrl.includes('spinner.gif'))) {
					result.push({ model, trim, stockNumber, imageUrl });
				}
			}
		});	
		const message = `Scanned ${scannedVehicles} vehicle${scannedVehicles !== 1 ? 's' : ''}.`;	
		return { instances: result, message };
	}
}
