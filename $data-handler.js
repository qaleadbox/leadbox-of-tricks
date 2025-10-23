// $data-handler.js — merged version: prevents redundant reprocessing but keeps pagination intact

function detectVehicleCardStructure() {
  const vehicleCardV6 = document.querySelector('div.vehicle-card.vehicle-card-6');
  const vehicleCardV12345 = document.querySelector('div.vehicle-car__section.vehicle-car-1');
  if (vehicleCardV6) return 'vehicleCardV6';
  if (vehicleCardV12345) return 'vehicleCardV12345';
  return 'unknown';
}

function getVehicleCardSelector() {
  const structure = detectVehicleCardStructure();
  if (structure === 'vehicleCardV6') return 'div.vehicle-card.vehicle-card-6';
  if (structure === 'vehicleCardV12345') return 'div.vehicle-car__section.vehicle-car-1';
  return 'div.vehicle-card.vehicle-card-6, div.vehicle-car__section.vehicle-car-1';
}

function getFieldSelectors(structure) {
  if (structure === 'vehicleCardV6') {
    return { model: '.title-text', trim: '.title-text', stockNumber: '.stock-value', image: '.main-img' };
  }
  if (structure === 'vehicleCardV12345') {
    return { model: '.value__model', trim: '.value__trim', stockNumber: '.stock_label, .stock_number, .value__stock', image: '.main-img' };
  }
  return { model: '.title-text', trim: '.title-text', stockNumber: '.stock-value', image: '.main-img' };
}

function extractFields(element) {
  const fields = { stockNumber: '', model: '', trim: '' };

  const stockSelectors = ['[data-stock-number]', '.stock-value', '.value__stock', '.stock_number', '.stock_label', '.stock', '.value__vin'];
  const modelSelectors = ['[data-model]', '.title-text', '.value__model', '.model', '.vehicle-title', '.vehicle-name'];
  const trimSelectors  = ['[data-trim]', '.value__trim', '.trim', '.subtitle', '.sub-title'];

  for (const q of stockSelectors) {
    const el = element.querySelector(q);
    if (el && el.textContent.trim()) { fields.stockNumber = el.textContent.trim(); break; }
  }
  for (const q of modelSelectors) {
    const el = element.querySelector(q);
    if (el && el.textContent.trim()) { fields.model = el.textContent.trim(); break; }
  }
  for (const q of trimSelectors) {
    const el = element.querySelector(q);
    if (el && el.textContent.trim()) { fields.trim = el.textContent.trim(); break; }
  }

  if (fields.stockNumber && /stock\s*#?:/i.test(fields.stockNumber)) {
    fields.stockNumber = fields.stockNumber.replace(/stock\s*#?:/i, '').trim();
  }
  return fields;
}

function detectScrollMode() {
  if (document.querySelector('div.lbx-paginator')) return 'pagination';
  if (document.querySelector('button.lbx-load-more-btn')) return 'viewmore';
  return 'infinite';
}

window.$dataHandler = async function(allVehicleCards, csvData, result, testType, highlightCard) {
  if (!Array.isArray(result)) result = [];
  const scrollMode = detectScrollMode();

  if (typeof addProcessingStyles === 'function') addProcessingStyles();

  let lastProcessingTime = 0;
  const structure = detectVehicleCardStructure();
  const fieldSelectors = getFieldSelectors(structure);
  const cards = document.querySelectorAll(getVehicleCardSelector());

  // Set all unprocessed to waiting state
  cards.forEach(card => {
    if (!card.classList.contains('processed-card') &&
        !card.classList.contains('coming-soon-card') &&
        !card.classList.contains('small-image-card')) {
      card.classList.remove('processing-card');
      card.classList.add('waiting-card');
      card.setAttribute('data-processing-info', 'Waiting...');
    }
  });

  switch (testType) {
    case 'SMALL_IMAGE_DETECTOR': {
      for (const element of cards) {
        // NEW FIX: skip redundant reprocessing of already detected small images
        if (element.classList.contains('small-image-card')) continue;

        if (scrollMode !== 'infinite' && element.classList.contains('processed-card')) continue;

        const start = performance.now();
        element.classList.remove('waiting-card');
        element.classList.add('processing-card');
        if (typeof updateProcessingInfo === 'function') updateProcessingInfo(element, 0, lastProcessingTime);

        const img = element.querySelector(fieldSelectors.image) || element.querySelector('img');
        const imageUrl = (img?.dataset?.src || img?.src || '').trim();
        const { stockNumber, model, trim } = extractFields(element);

        try {
          if (model && stockNumber && imageUrl) {
            const exists = result.some(v => v.stockNumber === stockNumber);
            const res = await window.isSmallImageByUrl(imageUrl);
            const elapsed = (performance.now() - start) / 1000;

            element.classList.remove('processing-card');

            if (res && res.isSmall && !exists) {
              element.classList.add('small-image-card');
              if (typeof updateProcessingInfo === 'function')
                updateProcessingInfo(element, elapsed, lastProcessingTime, true, true, 'SMALL_IMAGE_DETECTOR');
              result.push({ model, trim, stockNumber, imageSize: res.fileSizeKB, imageUrl, timestamp: new Date().toISOString() });
              console.log(`✅ Small Image ${stockNumber} (${model}) - Total: ${result.length}`);
            } else if (!element.classList.contains('small-image-card')) {
              // only mark processed if it's not already a small image
              element.classList.add('processed-card');
              if (typeof updateProcessingInfo === 'function')
                updateProcessingInfo(element, elapsed, lastProcessingTime, true, false, 'SMALL_IMAGE_DETECTOR');
            }

            lastProcessingTime = elapsed;
          } else {
            element.classList.remove('processing-card');
            element.classList.add('processed-card');
            if (typeof updateProcessingInfo === 'function')
              updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'SMALL_IMAGE_DETECTOR');
            console.log('⚠️ Missing data', { hasModel: !!model, hasStockNumber: !!stockNumber, hasImage: !!imageUrl });
          }
        } catch (e) {
          element.classList.remove('processing-card');
          if (!element.classList.contains('small-image-card')) element.classList.add('processed-card');
          if (typeof updateProcessingInfo === 'function')
            updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'SMALL_IMAGE_DETECTOR');
          console.error('💥 Error processing small image:', e);
        }
      }
      break;
    }

    case 'COMING_SOON_DETECTOR': {
      if (typeof highlightCard !== 'function') {
        console.error('highlightCard function is required for COMING_SOON_DETECTOR');
        return result;
      }

      for (const element of cards) {
        if (scrollMode !== 'infinite' && element.classList.contains('processed-card')) continue;

        const start = performance.now();
        element.classList.remove('waiting-card');
        element.classList.add('processing-card');
        if (typeof updateProcessingInfo === 'function') updateProcessingInfo(element, 0, lastProcessingTime);

        const img = element.querySelector(fieldSelectors.image) || element.querySelector('img');
        const imageUrl = (img?.dataset?.src || img?.src || '').trim();
        const { stockNumber, model, trim } = extractFields(element);

        try {
          if (model && stockNumber && imageUrl) {
            const exists = result.some(v => v.stockNumber === stockNumber);
            const isComingSoon = await highlightCard(element, async () => {
              return await window.isComingSoonImage(imageUrl);
            });

            const elapsed = (performance.now() - start) / 1000;
            if (typeof updateProcessingInfo === 'function')
              updateProcessingInfo(element, elapsed, lastProcessingTime, true, !!isComingSoon, 'COMING_SOON_DETECTOR');

            if (isComingSoon && !exists) {
              result.push({ model, trim, stockNumber, imageUrl });
              console.log(`✅ Coming Soon ${stockNumber} (${model}) - Total: ${result.length}`);
            }

            lastProcessingTime = elapsed;
          } else {
            element.classList.remove('processing-card');
            element.classList.add('processed-card');
            if (typeof updateProcessingInfo === 'function')
              updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'COMING_SOON_DETECTOR');
            console.log('⚠️ Missing data', { hasModel: !!model, hasStockNumber: !!stockNumber, hasImage: !!imageUrl });
          }
        } catch (e) {
          element.classList.remove('processing-card');
          element.classList.add('processed-card');
          if (typeof updateProcessingInfo === 'function')
            updateProcessingInfo(element, (performance.now() - start) / 1000, lastProcessingTime, true, false, 'COMING_SOON_DETECTOR');
          console.error('💥 Error processing coming soon:', e);
        }
      }
      break;
    }
  }

  return result;
};