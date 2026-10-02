import { checkImageWithOpenAI } from '/coming-soon/openai-image-checker.js';
import { checkImageWithOCR } from '/coming-soon/ocr-image-checker.js';

const icons = [
  "./icons/16x16/icon1.png",
  "./icons/16x16/icon2.png",
  "./icons/16x16/icon3.png",
  "./icons/16x16/icon4.png"
];
let currentIndex = 0;

function changeIcon() {
  chrome.action.setIcon({ path: icons[currentIndex] });
  currentIndex = (currentIndex + 1) % icons.length;
}

let isProcessing = false;
let processingTimer = null;
let processingTabs = new Set();

chrome.action.setIcon({ path: icons[0] });

function startRotation() {
    isProcessing = true;
    processingTimer = setInterval(changeIcon, 300);
    chrome.runtime.sendMessage({ type: 'startProcessing' });
}

function stopRotation() {
    isProcessing = false;
    if (processingTimer) {
        clearInterval(processingTimer);
        processingTimer = null;
    }
    chrome.action.setIcon({ path: icons[0] });
    chrome.runtime.sendMessage({ type: 'stopProcessing' });
}

async function handleOCRCheck(imageUrl) {
    try {
        const result = await checkImageWithOCR(imageUrl);
        return result;
    } catch (error) {
        console.error('Error in handleOCRCheck:', error);
        throw error;
    }
}

async function handleOpenAICheck(imageUrl) {
    try {
        const result = await checkImageWithOpenAI(imageUrl);
        return result;
    } catch (error) {
        console.error('Error in handleOpenAICheck:', error);
        throw error;
    }
}

Promise.resolve().then(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Background received message:', message.type, 'from tab:', sender.tab?.id);
        
        try {
            switch (message.type) {
                case 'startProcessing':
                    if (sender.tab?.id) {
                        processingTabs.add(sender.tab.id);
                        startRotation();
                    }
                    sendResponse({ success: true });
                    break;

                case 'stopProcessing':
                    if (sender.tab?.id) {
                        processingTabs.delete(sender.tab.id);
                        if (processingTabs.size === 0) {
                            stopRotation();
                        }
                    }
                    sendResponse({ success: true });
                    break;

                case 'checkImageByOCR':
                    handleOCRCheck(message.imageUrl)
                        .then(result => sendResponse({ success: true, result }))
                        .catch(error => {
                            console.error('OCR check error:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    return true;

                case 'checkImageByOpenAI':
                    handleOpenAICheck(message.imageUrl)
                        .then(result => sendResponse({ success: true, result }))
                        .catch(error => {
                            console.error('OpenAI check error:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    return true;

                case 'exportToCSV':
                    console.log('📤 Background received exportToCSV request:', {
                        testType: message.testType,
                        dataLength: message.data?.length,
                        siteName: message.siteName
                    });

                    // Execute CSV export in the active tab (can't use import in service worker)
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) {
                            chrome.scripting.executeScript({
                                target: { tabId: tabs[0].id },
                                func: (data, testType, siteName, primaryKeyField = 'stockNumber') => {
                                    // Inline CSV export function
                                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
                                    const filename = `${siteName}_VEHICLE_DATA_${timestamp}`;

                                    // Collect all unique field names
                                    const allFields = new Set();
                                    data.forEach(vehicle => {
                                        Object.keys(vehicle).forEach(field => allFields.add(field));
                                    });

                                    // Sort headers (primary key first, then alphabetically)
                                    const headers = Array.from(allFields).sort((a, b) => {
                                        if (a === primaryKeyField) return -1;
                                        if (b === primaryKeyField) return 1;
                                        if (a === 'model') return -1;
                                        if (b === 'model') return 1;
                                        if (a === 'trim') return -1;
                                        if (b === 'trim') return 1;
                                        return a.localeCompare(b);
                                    });

                                    // Create rows
                                    const rows = data.map(vehicle => {
                                        return headers.map(header => {
                                            const value = vehicle[header] || '';
                                            return `"${String(value).replace(/"/g, '""')}"`;
                                        });
                                    });

                                    const csvContent = [
                                        headers.map(h => `"${h}"`).join(','),
                                        ...rows.map(row => row.join(','))
                                    ].join('\n');

                                    // Create and download
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

                                    console.log(`✅ CSV downloaded: ${filename}.csv with ${data.length} vehicles`);
                                },
                                args: [message.data, message.testType, message.siteName, message.primaryKeyField || 'stockNumber']
                            }).then(() => {
                                sendResponse({ success: true });
                            }).catch(error => {
                                console.error('Error exporting CSV:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        }
                    });
                    return true;

                case 'exportToXLSX':
                    console.log('📊 Background received exportToXLSX request:', {
                        testType: message.testType,
                        rows: message.aoa?.length,
                        siteName: message.siteName
                    });

                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (!tabs[0]) {
                            sendResponse({ success: false, error: 'No active tab found' });
                            return;
                        }
                        const tabId = tabs[0].id;

                        // xlsx-js-style can't be imported into the service worker (no DOM/zip
                        // deps bundled for that context) — load it into the page instead, same
                        // injection pattern as the CSV export above.
                        chrome.scripting.executeScript({
                            target: { tabId },
                            files: ['/lib/xlsx.bundle.js']
                        }).then(() => chrome.scripting.executeScript({
                            target: { tabId },
                            func: (aoa, redCells, boldCells, filename, sheetName) => {
                                const ws = XLSX.utils.aoa_to_sheet(aoa);

                                const RED_FILL = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFC7CE' } }, font: { color: { rgb: 'FF9C0006' } } };
                                const BOLD = { font: { bold: true } };

                                redCells.forEach(ref => { if (ws[ref]) ws[ref].s = RED_FILL; });
                                boldCells.forEach(ref => { if (ws[ref]) ws[ref].s = { ...(ws[ref].s || {}), ...BOLD }; });

                                // Readable default column widths: label, stock #, then the
                                // vehicle-detail columns.
                                ws['!cols'] = aoa[0].map((_, i) => ({ wch: i === 0 ? 10 : i === 1 ? 10 : 16 }));

                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');
                                const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

                                const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.href = url;
                                link.download = `${filename}.xlsx`;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);

                                console.log(`✅ XLSX downloaded: ${filename}.xlsx`);
                            },
                            args: [
                                message.aoa,
                                message.redCells || [],
                                message.boldCells || [],
                                `${message.siteName}_${message.testType}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}`,
                                message.sheetName || 'Discrepancies'
                            ]
                        })).then(() => {
                            sendResponse({ success: true });
                        }).catch(error => {
                            console.error('Error exporting XLSX:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                    });
                    return true;

                default:
                    console.warn('Unknown message type:', message.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (processingTabs.has(tabId)) {
        processingTabs.delete(tabId);
        if (processingTabs.size === 0) {
            stopRotation();
        }
    }
});