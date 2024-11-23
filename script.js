document.getElementById('Check missing images').addEventListener('click', async () => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		function: callFindUrlsAndModels
	});
});

function callFindUrlsAndModels() {
	const instances = findUrlsAndModels();
	console.log(instances);

	function findUrlsAndModels() {
		const elements = document.querySelectorAll('.vehicle-car__section');
		const result = [];

		elements.forEach(element => {
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
			window.scrollTo(0, document.body.scrollHeight);
		});
		return result;
	}
}
