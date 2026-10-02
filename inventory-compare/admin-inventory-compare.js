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

const COMPARE_FIELDS = ['condition', 'age', 'year', 'make', 'model', 'trim', 'photos', 'colour', 'price', 'priceAfterRebate', 'tags', 'action'];

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
    // The Tags cell can hold more than one label (e.g. "Website" + a custom
    // tag like "Accessories") with a lot of raw HTML indentation/newlines
    // between them — collapse that down to single spaces so the value is
    // both readable and, critically, safe to round-trip through CSV (a raw
    // embedded newline there previously broke the naive line-based CSV
    // parser downstream, desyncing every row after it).
    function cleanText(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }

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
        const ageText = (tds[2]?.textContent || '').trim();
        const photosText = (tds[7]?.textContent || '').trim();
        // Colour cell's visible text gets truncated ("Carbonized Grey ...") —
        // the anchor's title attribute always carries the full name.
        const colourLink = tds[12]?.querySelector('a[title]');
        const colour = cleanText(colourLink?.getAttribute('title') || tds[12]?.textContent);
        const tags = cleanText(tds[15]?.textContent);
        // "Action" = the link to the vehicle's live page on the dealer site
        // (the globe icon in the Action column), compared against the new
        // system's "View on dealer site" action link.
        const actionHref = tds[1]?.querySelector('a.show-on-website-element')?.getAttribute('href') || '';
        return {
            stockNumber,
            year: tr.dataset.year || '',
            make: tr.dataset.make || '',
            model: tr.dataset.model || '',
            trim: tr.dataset.trim || '',
            condition: tr.dataset.condition || '',
            price: priceText,
            priceAfterRebate: rebateText,
            age: ageText,
            photos: photosText,
            colour,
            tags,
            action: actionHref,
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
        // Strip the mobile-only duplicate <dl> blocks and any nested buttons
        // (copy-stock-number / view-photos) so only the cell's own text is left.
        clone.querySelectorAll('dl, button').forEach(node => node.remove());
        // Collapse runs of whitespace (including real newlines between e.g.
        // multiple tag labels) to single spaces — raw embedded newlines broke
        // the CSV round-trip downstream by desyncing the naive line parser.
        return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    function findLinkByLabel(cell, label) {
        if (!cell) return null;
        return Array.from(cell.querySelectorAll('a')).find(a => a.querySelector('.sr-only')?.textContent.trim() === label) || null;
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
        // Colour cell's visible text gets truncated — the div's title
        // attribute always carries the full name (same convention as old).
        const colourDiv = tds[9]?.querySelector('[title]');
        const colour = (colourDiv?.getAttribute('title') || directText(tds[9])).replace(/\s+/g, ' ').trim();
        const dealerSiteLink = findLinkByLabel(tds[15], 'View on dealer site');
        return {
            stockNumber,
            year: directText(tds[4]),
            make: directText(tds[5]),
            model: directText(tds[6]),
            trim: trimText === '—' ? '' : trimText,
            condition: (conditionBadge?.textContent || '').trim(),
            price: priceText === '—' ? '' : priceText,
            priceAfterRebate: rebateText === '—' ? '' : rebateText,
            age: directText(tds[2]),
            photos: directText(tds[8]),
            colour,
            tags: directText(tds[14]),
            action: dealerSiteLink?.getAttribute('href') || '',
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
// Full-text, quote-aware parser — NOT line-based. A quoted field is allowed
// to contain literal commas, newlines and escaped ("") quotes per the CSV
// spec; the exporter quotes every field, and some values genuinely contain
// embedded newlines (e.g. a Tags cell with more than one label). Splitting
// the input into "lines" first (naively, on \n) before parsing quotes broke
// exactly on those rows — it cut a single record into pieces, and every
// record after it in the file came out shifted/duplicated as a result.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else {
                cur += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(cur); cur = '';
        } else if (c === '\r') {
            // skip — the matching '\n' (if any) ends the row below
        } else if (c === '\n') {
            row.push(cur); cur = '';
            rows.push(row); row = [];
        } else {
            cur += c;
        }
    }
    if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }

    const dataRows = rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
    if (dataRows.length < 2) return [];

    const headers = dataRows[0].map(h => h.trim());
    return dataRows.slice(1).map(cells => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim(); });
        return obj;
    });
}

// ── Diff ────────────────────────────────────────────────────────────────────
// Every field in COMPARE_FIELDS is checked — including when one side is
// blank and the other isn't, since that's real, reportable information for
// a migration (e.g. old has a Price, new shows nothing). The only case that
// is NOT a mismatch is both sides genuinely blank/unknown — there's nothing
// to compare there, so it would just be noise.
const NUMERIC_FIELDS = new Set(['price', 'priceAfterRebate', 'age', 'photos']);

function normalizeNumber(v) {
    if (!v) return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
}

function normalizeText(v) {
    return String(v || '').trim().toLowerCase();
}

function fieldsDiffer(field, oldVal, newVal) {
    if (NUMERIC_FIELDS.has(field)) {
        const a = normalizeNumber(oldVal);
        const b = normalizeNumber(newVal);
        if (a === null && b === null) return false; // both unknown/blank — nothing to compare
        return a !== b;
    }
    const a = normalizeText(oldVal);
    const b = normalizeText(newVal);
    if (!a && !b) return false; // both blank — nothing to compare
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

// ── Spreadsheet report: one OLD row + one NEW row + one Detail row per
// vehicle, blank spacer row between vehicles. Mismatched cells in the NEW
// row (or the whole NEW/OLD row when a vehicle only exists on one side) get
// a red fill; the Detail row carries the "old -> new" text per mismatched
// column. ────────────────────────────────────────────────────────────────
// Label + Stock # + one column per COMPARE_FIELDS entry, in that order.
const SHEET_COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, 2 + COMPARE_FIELDS.length).split('');
const SHEET_HEADER = ['', 'Stock #', 'Condition', 'Age', 'Year', 'Make', 'Model', 'Trim', 'Photos', 'Colour', 'Price', 'After Rebate', 'Tags', 'Action'];
const LAST_COL_INDEX = 1 + COMPARE_FIELDS.length; // last field column's 0-based index
// COMPARE_FIELDS[i] lives in column index 2 + i (columns C..N)

function vehicleRow(label, v) {
    return [label, v?.stockNumber || '', ...COMPARE_FIELDS.map(f => v?.[f] || '')];
}

function buildReportSheet({ missingFromNew, newArrivals, mismatches }) {
    const aoa = [SHEET_HEADER];
    const redCells = [];
    const boldCells = SHEET_COLS.map(c => `${c}1`);

    function blankRow() { return SHEET_HEADER.map(() => ''); }

    function pushBlock(oldV, newV) {
        const oldRow = aoa.length + 1;
        aoa.push(vehicleRow('OLD', oldV));
        const newRow = aoa.length + 1;
        aoa.push(vehicleRow('NEW', newV));
        const detailRow = aoa.length + 1;
        aoa.push(blankRow().map((c, i) => i === 0 ? 'Detail' : c));
        aoa.push(blankRow());
        boldCells.push(`A${oldRow}`, `A${newRow}`, `A${detailRow}`);
        return { oldRow, newRow, detailRow };
    }

    mismatches.forEach(({ oldV, newV, diffs }) => {
        const { newRow, detailRow } = pushBlock(oldV, newV);
        diffs.forEach(field => {
            const colIndex = 2 + COMPARE_FIELDS.indexOf(field);
            redCells.push(`${SHEET_COLS[colIndex]}${newRow}`);
            aoa[detailRow - 1][colIndex] = `${oldV[field] || '(blank)'} → ${newV[field] || '(blank)'}`;
        });
    });

    missingFromNew.forEach(v => {
        const { newRow, detailRow } = pushBlock(v, null);
        for (let c = 2; c <= LAST_COL_INDEX; c++) redCells.push(`${SHEET_COLS[c]}${newRow}`);
        aoa[detailRow - 1][0] = 'Missing from new system';
    });

    newArrivals.forEach(v => {
        const { oldRow, detailRow } = pushBlock(null, v);
        for (let c = 2; c <= LAST_COL_INDEX; c++) redCells.push(`${SHEET_COLS[c]}${oldRow}`);
        aoa[detailRow - 1][0] = 'New arrival (not in old export)';
    });

    // Drop the trailing blank spacer after the last block.
    if (aoa.length && aoa[aoa.length - 1].every(c => c === '')) aoa.pop();

    return { aoa, redCells, boldCells };
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
        const discrepancyCount = diff.missingFromNew.length + diff.newArrivals.length + diff.mismatches.length;

        const summaryEl = document.getElementById('inventoryCompareSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div>Old export: <b>${oldVehicles.length}</b> vehicles · New system: <b>${result.vehicles.length}</b> vehicles</div>
                <div style="color:#ff6b35">Missing from new system: <b>${diff.missingFromNew.length}</b></div>
                <div style="color:#8ab4f8">New arrivals (not in old export): <b>${diff.newArrivals.length}</b></div>
                <div style="color:#ffd54f">Field mismatches on matched stock #s: <b>${diff.mismatches.length}</b></div>
            `;
        }

        if (discrepancyCount === 0) {
            setStatus('No discrepancies found — the two systems match on every stock number.', '#4CAF50');
            return;
        }

        const { aoa, redCells, boldCells } = buildReportSheet(diff);

        chrome.runtime.sendMessage({
            type: 'exportToXLSX',
            aoa, redCells, boldCells,
            testType: 'INVENTORY_COMPARE_REPORT',
            siteName: new URL(tab.url).hostname.replace(/^www\./, ''),
            sheetName: 'Discrepancies',
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                setStatus('Comparison done, but the report spreadsheet failed to download: ' + (chrome.runtime.lastError?.message || response?.error || 'unknown error'), '#ff6b35');
                return;
            }
            setStatus(`Comparison complete — ${discrepancyCount} discrepancies downloaded as a spreadsheet (mismatches highlighted in red).`, '#4CAF50');
        });
    } catch (error) {
        console.error('Error running inventory compare:', error);
        setStatus('Error: ' + error.message, '#ff4444');
    }
}
