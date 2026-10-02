// admin-inventory-compare.js
//
// Compares the OLD LeadBox admin inventory list (DataTables, #inventory-table)
// against the NEW leadbox-os IMS vehicles admin list (Tailwind table with
// #items-per-page), matched by Stock #. Built for migration QA: catch
// vehicles that didn't make it across, new arrivals since the last export,
// and price/spec drift on vehicles present in both.
//
// Workflow (mirrors Vehicle Data Exporter -> CSV Data Matcher):
//   1. On the OLD admin inventory page, click the button and export its
//      table to CSV (Stock #, Year, Make, Model, Trim, Condition, Price,
//      After Rebate).
//   2. On the NEW IMS vehicles admin page, click the same button, paste that
//      CSV, and run the comparison. A discrepancy CSV downloads and a short
//      summary shows in the popup.
//
// Both table shapes are hardcoded here (not the generic manual-selector
// system used for arbitrary public SRP sites) because these are two
// specific, known LeadBox products with a fixed column layout.

const COMPARE_FIELDS = ['year', 'make', 'model', 'trim', 'condition', 'price', 'priceAfterRebate'];

document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('compare admin inventory');
    const section = document.getElementById('inventoryCompareSection');
    if (!toggleButton || !section) return;

    toggleButton.addEventListener('click', async (event) => {
        event.preventDefault();
        const allSections = document.querySelectorAll('.import-export-section, .module-section');
        allSections.forEach(sec => { if (sec.id !== 'inventoryCompareSection') sec.style.display = 'none'; });

        if (section.style.display === 'none' || !section.style.display) {
            section.style.display = 'block';
            await detectPageAndRender();
        } else {
            section.style.display = 'none';
        }
    });

    const exportOldButton = document.getElementById('startOldInventoryExport');
    if (exportOldButton) {
        exportOldButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await exportOldInventory();
        });
    }

    const runCompareButton = document.getElementById('startInventoryCompare');
    if (runCompareButton) {
        runCompareButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await runInventoryCompare();
        });
    }
});

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found!');
    return tab;
}

function setStatus(text, color) {
    const statusEl = document.getElementById('inventoryCompareStatus');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = color || '#ccc';
}

// ── Page detection (runs in the page) ──────────────────────────────────────
function detectAdminInventoryPage() {
    if (document.querySelector('#inventory-table')) return 'old';
    if (document.querySelector('#items-per-page') && document.querySelector('table.divide-y.divide-stroke')) return 'new';
    return null;
}

async function detectPageAndRender() {
    const oldUi = document.getElementById('inventoryCompareOldUi');
    const newUi = document.getElementById('inventoryCompareNewUi');
    [oldUi, newUi].forEach(el => el && (el.style.display = 'none'));
    setStatus('Checking this page…');

    try {
        const tab = await getActiveTab();
        const [{ result: pageType }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: detectAdminInventoryPage
        });

        if (pageType === 'old') {
            setStatus('Old admin inventory detected — export its data below, then paste it on the new IMS inventory page.');
            if (oldUi) oldUi.style.display = 'block';
        } else if (pageType === 'new') {
            setStatus('New IMS inventory detected — paste the CSV exported from the old admin, then compare.');
            if (newUi) newUi.style.display = 'block';
        } else {
            setStatus('This isn\'t the old admin inventory list or the new IMS vehicles list. Open one of those pages and reopen this panel.', '#ff6b35');
        }
    } catch (error) {
        console.error('Error detecting inventory admin page:', error);
        setStatus('Could not inspect this page: ' + error.message, '#ff4444');
    }
}

// ── OLD page: set page size to All, then scrape #inventory-table ──────────
// Self-contained (runs via chrome.scripting.executeScript) — can't import
// helpers, so everything it needs lives inside this one function.
async function scrapeOldAdminTable() {
    function readShownTotal() {
        const info = document.querySelector('#inventory-table_info');
        if (!info) return null;
        const spans = info.textContent.match(/(\d+)\s+to\s+(\d+)\s+of\s+(\d+)/);
        if (!spans) return null;
        return { shown: Number(spans[2]), total: Number(spans[3]) };
    }

    const lengthSelect = document.querySelector('select[name="inventory-table_length"]');
    if (lengthSelect && lengthSelect.value !== '-1') {
        lengthSelect.value = '-1';
        lengthSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Poll briefly for DataTables to redraw with all rows.
    let counts = readShownTotal();
    const deadline = Date.now() + 4000;
    while (counts && counts.shown < counts.total && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
        counts = readShownTotal();
    }

    const rows = Array.from(document.querySelectorAll('#inventory-table tbody tr[data-vehicle]'));
    const vehicles = rows.map(tr => {
        const tds = tr.querySelectorAll('td');
        const stockNumber = (tds[8]?.textContent || '').trim();
        const priceText = (tds[13]?.textContent || '').trim();
        const rebateText = (tds[14]?.textContent || '').trim();
        return {
            stockNumber,
            year: tr.dataset.year || '',
            make: tr.dataset.make || '',
            model: tr.dataset.model || '',
            trim: tr.dataset.trim || '',
            condition: tr.dataset.condition || '',
            price: priceText,
            priceAfterRebate: rebateText,
        };
    }).filter(v => v.stockNumber);

    return {
        vehicles,
        partial: !!(counts && counts.shown < counts.total),
        shown: counts ? counts.shown : vehicles.length,
        total: counts ? counts.total : vehicles.length,
    };
}

async function exportOldInventory() {
    try {
        setStatus('Scraping old inventory table…');
        const tab = await getActiveTab();
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeOldAdminTable,
        });

        if (!result || result.vehicles.length === 0) {
            setStatus('No vehicle rows found on this page.', '#ff4444');
            return;
        }

        if (result.partial) {
            setStatus(`Warning: only scraped ${result.shown} of ${result.total} — set "records per page" to All and try again.`, '#ff6b35');
            return;
        }

        chrome.runtime.sendMessage({
            type: 'exportToCSV',
            data: result.vehicles,
            testType: 'ADMIN_INVENTORY_OLD',
            siteName: new URL(tab.url).hostname.replace(/^www\./, ''),
            primaryKeyField: 'stockNumber',
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                setStatus('Error exporting CSV: ' + (chrome.runtime.lastError?.message || response?.error || 'unknown error'), '#ff4444');
                return;
            }
            setStatus(`Exported ${result.vehicles.length} vehicles. Paste this CSV on the new IMS inventory page to compare.`, '#4CAF50');
        });
    } catch (error) {
        console.error('Error exporting old inventory:', error);
        setStatus('Error: ' + error.message, '#ff4444');
    }
}

// ── NEW page: set page size to All, then scrape the IMS table ─────────────
async function scrapeNewIMSTable() {
    function directText(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        clone.querySelectorAll('dl').forEach(dl => dl.remove());
        return clone.textContent.trim();
    }

    function readShownTotal() {
        const paragraph = Array.from(document.querySelectorAll('p')).find(p => /Showing/i.test(p.textContent));
        if (!paragraph) return null;
        const spans = paragraph.querySelectorAll('span');
        if (spans.length < 3) return null;
        return { shown: Number(spans[1].textContent), total: Number(spans[2].textContent) };
    }

    const sizeSelect = document.querySelector('#items-per-page');
    if (sizeSelect && sizeSelect.value !== 'all') {
        sizeSelect.value = 'all';
        sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        sizeSelect.dispatchEvent(new Event('input', { bubbles: true }));
    }

    let counts = readShownTotal();
    const deadline = Date.now() + 4000;
    while (counts && counts.shown < counts.total && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
        counts = readShownTotal();
    }

    const rows = Array.from(document.querySelectorAll('table.divide-y.divide-stroke tbody tr'));
    const vehicles = rows.map(tr => {
        const tds = tr.querySelectorAll('td');
        const stockCell = tds[3];
        const stockLink = stockCell?.querySelector('a[href^="/app/ims/vehicles/"]');
        const stockNumber = (stockLink?.textContent || '').trim();
        const conditionBadge = tds[1]?.querySelector('span');
        const trimText = directText(tds[7]);
        const priceText = directText(tds[10]);
        const rebateText = directText(tds[11]);
        return {
            stockNumber,
            year: directText(tds[4]),
            make: directText(tds[5]),
            model: directText(tds[6]),
            trim: trimText === '—' ? '' : trimText,
            condition: (conditionBadge?.textContent || '').trim(),
            price: priceText === '—' ? '' : priceText,
            priceAfterRebate: rebateText === '—' ? '' : rebateText,
        };
    }).filter(v => v.stockNumber);

    return {
        vehicles,
        partial: !!(counts && counts.shown < counts.total),
        shown: counts ? counts.shown : vehicles.length,
        total: counts ? counts.total : vehicles.length,
    };
}

// ── CSV parsing (pasted from the old export) ───────────────────────────────
function parseCSVLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
            if (c === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else {
                cur += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            out.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    out.push(cur);
    return out;
}

function parseCSV(text) {
    const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
        const cells = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
        return row;
    });
}

// ── Diff ────────────────────────────────────────────────────────────────────
function normalizePrice(v) {
    if (!v) return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
}

function normalizeText(v) {
    return String(v || '').trim().toLowerCase();
}

function fieldsDiffer(field, oldVal, newVal) {
    if (field === 'price' || field === 'priceAfterRebate') {
        const a = normalizePrice(oldVal);
        const b = normalizePrice(newVal);
        if (a === null || b === null) return false; // don't flag unknown/blank on either side
        return a !== b;
    }
    const a = normalizeText(oldVal);
    const b = normalizeText(newVal);
    if (!a || !b) return false;
    return a !== b;
}

function diffInventories(oldVehicles, newVehicles) {
    const oldMap = new Map(oldVehicles.map(v => [v.stockNumber, v]));
    const newMap = new Map(newVehicles.map(v => [v.stockNumber, v]));

    const missingFromNew = oldVehicles.filter(v => !newMap.has(v.stockNumber));
    const newArrivals = newVehicles.filter(v => !oldMap.has(v.stockNumber));

    const mismatches = [];
    for (const [stockNumber, oldV] of oldMap) {
        const newV = newMap.get(stockNumber);
        if (!newV) continue;
        const diffs = COMPARE_FIELDS.filter(f => fieldsDiffer(f, oldV[f], newV[f]));
        if (diffs.length > 0) {
            mismatches.push({ stockNumber, oldV, newV, diffs });
        }
    }

    return { missingFromNew, newArrivals, mismatches };
}

function buildReportRows({ missingFromNew, newArrivals, mismatches }) {
    const rows = [];
    missingFromNew.forEach(v => rows.push({
        stockNumber: v.stockNumber, issueType: 'MISSING_FROM_NEW',
        year: v.year, make: v.make, model: v.model, trim: v.trim,
        oldPrice: v.price, newPrice: '', detail: 'Present in old system, not found in new system',
    }));
    newArrivals.forEach(v => rows.push({
        stockNumber: v.stockNumber, issueType: 'NEW_ARRIVAL',
        year: v.year, make: v.make, model: v.model, trim: v.trim,
        oldPrice: '', newPrice: v.price, detail: 'Present in new system, not in old export',
    }));
    mismatches.forEach(({ stockNumber, oldV, newV, diffs }) => rows.push({
        stockNumber, issueType: 'FIELD_MISMATCH',
        year: newV.year, make: newV.make, model: newV.model, trim: newV.trim,
        oldPrice: oldV.price, newPrice: newV.price,
        detail: diffs.map(f => `${f}: "${oldV[f]}" -> "${newV[f]}"`).join('; '),
    }));
    return rows;
}

async function runInventoryCompare() {
    const textarea = document.getElementById('inventoryCompareCsv');
    const csvText = textarea?.value?.trim();
    if (!csvText) {
        setStatus('Paste the CSV exported from the old admin inventory page first.', '#ff6b35');
        return;
    }

    const oldVehicles = parseCSV(csvText);
    if (oldVehicles.length === 0 || !oldVehicles[0].stockNumber) {
        setStatus('Could not read that CSV — make sure it\'s the file from "Export Old Inventory to CSV".', '#ff4444');
        return;
    }

    try {
        setStatus('Scraping new IMS inventory table…');
        const tab = await getActiveTab();
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeNewIMSTable,
        });

        if (!result || result.vehicles.length === 0) {
            setStatus('No vehicle rows found on this page.', '#ff4444');
            return;
        }

        if (result.partial) {
            setStatus(`Warning: only scraped ${result.shown} of ${result.total} — set "Rows per page" to All and try again.`, '#ff6b35');
            return;
        }

        const diff = diffInventories(oldVehicles, result.vehicles);
        const reportRows = buildReportRows(diff);

        const summaryEl = document.getElementById('inventoryCompareSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div>Old export: <b>${oldVehicles.length}</b> vehicles · New system: <b>${result.vehicles.length}</b> vehicles</div>
                <div style="color:#ff6b35">Missing from new system: <b>${diff.missingFromNew.length}</b></div>
                <div style="color:#8ab4f8">New arrivals (not in old export): <b>${diff.newArrivals.length}</b></div>
                <div style="color:#ffd54f">Field mismatches on matched stock #s: <b>${diff.mismatches.length}</b></div>
            `;
        }

        if (reportRows.length === 0) {
            setStatus('No discrepancies found — the two systems match on every stock number.', '#4CAF50');
            return;
        }

        chrome.runtime.sendMessage({
            type: 'exportToCSV',
            data: reportRows,
            testType: 'INVENTORY_COMPARE_REPORT',
            siteName: new URL(tab.url).hostname.replace(/^www\./, ''),
            primaryKeyField: 'stockNumber',
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                setStatus('Comparison done, but the report CSV failed to download: ' + (chrome.runtime.lastError?.message || response?.error || 'unknown error'), '#ff6b35');
                return;
            }
            setStatus(`Comparison complete — ${reportRows.length} discrepancies downloaded as CSV.`, '#4CAF50');
        });
    } catch (error) {
        console.error('Error running inventory compare:', error);
        setStatus('Error: ' + error.message, '#ff4444');
    }
}
