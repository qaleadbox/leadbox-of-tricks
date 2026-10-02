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
        // Tags cell can hold more than one tag (e.g. "Website" + a custom
        // tag like "Accessories") rendered as plain space-separated text,
        // not separate badge elements per tag (confirmed against a real
        // report — multiple tags showed up concatenated as one string, e.g.
        // "Website Accessories", never as distinct DOM nodes). Split the
        // cleaned cell text on whitespace into individual tags (NOT
        // hardcoded names; whatever words actually appear) and join with
        // '; ' (TAG_DELIM at the top of this file — keep them in sync, this
        // function runs in the page and can't reference that constant).
        const tagsText = cleanText(tds[15]?.textContent);
        const tags = (tagsText ? tagsText.split(' ') : []).join('; ');
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
        // Same whitespace-split extraction as the old scraper (confirmed
        // there that multiple tags render as plain space-separated text,
        // not separate elements) — still unverified on this side since no
        // new-system vehicle with actual tags was available to check against;
        // revisit if a real tagged row here doesn't match this assumption.
        const tagsText = directText(tds[14]);
        const tagList = tagsText && tagsText !== '—' ? tagsText.split(' ') : [];
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
            tags: tagList.join('; '),
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

// Must match the join used by both scrapers above exactly (they can't
// reference this constant — they run in the page, self-contained).
const TAG_DELIM = '; ';
function parseTagList(tagsField) {
    return String(tagsField || '').split(TAG_DELIM).map(t => t.trim()).filter(Boolean);
}

// ── Summary sheet: a fixed row per known field (always present, even at
// zero) plus one row per tag actually found in the old data — never a
// hardcoded tag name, since tags are dealer-specific and only exist in the
// scraped data. No AI/bespoke writing anywhere: every "check" is one of
// these pre-written, static strings with numbers substituted in. ─────────
const FIELD_AREA = {
    year: 'Vehicle Data', make: 'Vehicle Data', model: 'Vehicle Data', trim: 'Vehicle Data', condition: 'Vehicle Data',
    photos: 'Media', colour: 'Vehicle Data',
    price: 'Pricing', priceAfterRebate: 'Pricing',
    action: 'Website Link',
};
const FIELD_FINDING_TEXT = {
    year: 'Model year was recorded incorrectly',
    make: 'Make was recorded incorrectly',
    model: 'Model was recorded incorrectly',
    trim: 'Trim was recorded incorrectly',
    condition: 'Condition (New/Used) is inconsistent with the old system',
    photos: 'Photo count is different from the old system',
    colour: 'Colour was mapped differently than the old system',
    price: 'Price was not carried over correctly',
    priceAfterRebate: 'After-rebate price was not carried over correctly',
    action: 'Website link points somewhere different than the old system',
};
// 'age' is intentionally excluded here — it always drifts a little between
// when the old CSV was exported and when the new system was scraped, so
// flagging it would report expected time passing as a "finding".

function buildTagFindings(oldVehicles, newVehicles) {
    const newMap = new Map(newVehicles.map(v => [v.stockNumber, v]));
    const allTags = new Set();
    oldVehicles.forEach(v => parseTagList(v.tags).forEach(t => allTags.add(t)));

    if (allTags.size === 0) {
        return [{ area: 'Tags', check: 'No tags are used in the old system', affected: 0, total: oldVehicles.length }];
    }

    return [...allTags].map(tag => {
        let total = 0;
        let missing = 0;
        oldVehicles.forEach(v => {
            if (!parseTagList(v.tags).includes(tag)) return;
            total++;
            const newV = newMap.get(v.stockNumber);
            const newTags = newV ? parseTagList(newV.tags) : [];
            if (!newTags.includes(tag)) missing++;
        });
        return { area: 'Tags', check: `Missing "${tag}" tag in the new system`, affected: missing, total };
    });
}

function buildFindings(oldVehicles, newVehicles, diff) {
    // Field-level mismatches (price, condition, etc.) can only be checked on
    // vehicles present in BOTH systems — a vehicle missing from the new
    // system entirely wasn't actually compared on any of these fields, so it
    // must not count toward the denominator (that previously made the
    // percentages/totals understate the real rate: "out of 210" when only
    // 209 vehicles could even be checked).
    const matchedCount = oldVehicles.length - diff.missingFromNew.length;

    const mismatchCounts = {};
    diff.mismatches.forEach(m => m.diffs.forEach(field => {
        mismatchCounts[field] = (mismatchCounts[field] || 0) + 1;
    }));

    const findings = Object.keys(FIELD_FINDING_TEXT).map(field => ({
        area: FIELD_AREA[field],
        check: FIELD_FINDING_TEXT[field],
        affected: mismatchCounts[field] || 0,
        total: matchedCount,
    }));

    findings.push(...buildTagFindings(oldVehicles, newVehicles));

    findings.push({
        area: 'Inventory',
        check: 'Vehicle exists in the old system but not in the new one',
        affected: diff.missingFromNew.length,
        total: oldVehicles.length,
    });
    findings.push({
        area: 'Inventory',
        check: "Vehicle exists in the new system but wasn't in the old export",
        affected: diff.newArrivals.length,
        total: newVehicles.length,
        kind: 'info', // expected (vehicles added since the export), not a defect
    });

    return findings;
}

// Shared cell styles — plain data (fill/font/numFmt objects), not XLSX API
// calls. This script runs in the popup; XLSX itself only exists in the page
// context background.js injects it into, so every builder here returns pure
// aoa + style data and background.js is the only place that ever touches
// the XLSX object.
const STYLE_ISSUE = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFC7CE' } }, font: { bold: true, color: { rgb: 'FF9C0006' } } };
const STYLE_OK = { fill: { patternType: 'solid', fgColor: { rgb: 'FFC6EFCE' } }, font: { bold: true, color: { rgb: 'FF006100' } } };
const STYLE_INFO = { fill: { patternType: 'solid', fgColor: { rgb: 'FFDDEBF7' } }, font: { bold: true, color: { rgb: 'FF1F4E78' } } };
const STYLE_HEADER = { fill: { patternType: 'solid', fgColor: { rgb: 'FF1F2937' } }, font: { bold: true, color: { rgb: 'FFFFFFFF' } } };
const STYLE_BOLD = { font: { bold: true } };
const STYLE_TITLE = { font: { bold: true, sz: 16 } };
const STYLE_SUBTITLE = { font: { italic: true, color: { rgb: 'FF666666' } } };
const STYLE_SUMMARY_LINE = { font: { bold: true, sz: 12 } };
const STYLE_CENTER_BOLD = { font: { bold: true }, alignment: { horizontal: 'center' } };
// Two decimals so a real-but-small finding (e.g. 1 of 210 = 0.48%) never
// displays as a misleading "0%" the way a whole-number percent format would.
const STYLE_PERCENT = { numFmt: '0.00%' };

function summaryStatusFor(f) {
    if (f.kind === 'info') return { text: 'INFO', style: STYLE_INFO };
    if (f.affected > 0) return { text: 'ISSUE', style: STYLE_ISSUE };
    return { text: 'OK', style: STYLE_OK };
}

// Builds the Summary sheet's DATA ONLY (aoa + cell styles + merges) — a
// one-screen, color-coded findings list, no per-vehicle data (that's the
// Details sheet). Handles both outcomes with the same code path: an
// all-clean run and a many-issues run both just fall out of the same
// per-field/per-tag enumeration, nothing is skipped either way.
function buildSummarySheet(findings, oldTotal, newTotal) {
    const checkCount = findings.filter(f => f.kind !== 'info').length;
    const issueCount = findings.filter(f => f.kind !== 'info' && f.affected > 0).length;
    const summaryLine = issueCount === 0
        ? `All ${checkCount} checks passed — no migration issues found.`
        : `${checkCount - issueCount} of ${checkCount} checks look clean. ${issueCount} need attention.`;

    const areas = [...new Set(findings.map(f => f.area))];
    const areaIssueCounts = areas.map(area =>
        findings.filter(f => f.area === area && f.kind !== 'info' && f.affected > 0).length
    );

    const AREA_LABEL_ROW = 6;
    const AREA_HEADER_ROW = 7;
    const AREA_COUNT_ROW = 8;
    const TABLE_HEADER_ROW = 10;

    const aoa = [
        ['Inventory Migration QA — Summary'],
        [`Old system: ${oldTotal} vehicles · New system: ${newTotal} vehicles · Generated ${new Date().toISOString().slice(0, 10)}`],
        [],
        [summaryLine],
        [],
        ['Issues by area'],
        [...areas],
        [...areaIssueCounts],
        [],
        ['Status', 'Check', 'Affected', 'Out Of', '%'],
        ...findings.map(f => [summaryStatusFor(f).text, f.check, f.affected, f.total, f.total ? f.affected / f.total : 0]),
    ];

    const styles = [
        { ref: 'A1', style: STYLE_TITLE },
        { ref: 'A2', style: STYLE_SUBTITLE },
        { ref: 'A4', style: STYLE_SUMMARY_LINE },
        { ref: `A${AREA_LABEL_ROW}`, style: STYLE_BOLD },
    ];

    areas.forEach((area, i) => {
        const col = SHEET_COLS[i];
        styles.push({ ref: `${col}${AREA_HEADER_ROW}`, style: STYLE_CENTER_BOLD });
        const count = areaIssueCounts[i];
        styles.push({ ref: `${col}${AREA_COUNT_ROW}`, style: { ...(count > 0 ? STYLE_ISSUE : STYLE_OK), alignment: { horizontal: 'center' } } });
    });

    ['A', 'B', 'C', 'D', 'E'].forEach(c => styles.push({ ref: `${c}${TABLE_HEADER_ROW}`, style: STYLE_HEADER }));
    findings.forEach((f, i) => {
        const row = TABLE_HEADER_ROW + 1 + i;
        styles.push({ ref: `A${row}`, style: summaryStatusFor(f).style });
        styles.push({ ref: `B${row}`, style: STYLE_BOLD });
        styles.push({ ref: `E${row}`, style: STYLE_PERCENT });
    });

    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
        { s: { r: AREA_LABEL_ROW - 1, c: 0 }, e: { r: AREA_LABEL_ROW - 1, c: 4 } },
    ];

    return { aoa, styles, merges, cols: [{ wch: 14 }, { wch: 50 }, { wch: 11 }, { wch: 9 }, { wch: 8 }] };
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
    const styles = SHEET_COLS.map(c => ({ ref: `${c}1`, style: STYLE_HEADER }));

    function blankRow() { return SHEET_HEADER.map(() => ''); }

    function pushBlock(oldV, newV) {
        const oldRow = aoa.length + 1;
        aoa.push(vehicleRow('OLD', oldV));
        const newRow = aoa.length + 1;
        aoa.push(vehicleRow('NEW', newV));
        const detailRow = aoa.length + 1;
        aoa.push(blankRow().map((c, i) => i === 0 ? 'Detail' : c));
        aoa.push(blankRow());
        styles.push({ ref: `A${oldRow}`, style: STYLE_BOLD }, { ref: `A${newRow}`, style: STYLE_BOLD }, { ref: `A${detailRow}`, style: STYLE_BOLD });
        return { oldRow, newRow, detailRow };
    }

    mismatches.forEach(({ oldV, newV, diffs }) => {
        const { newRow, detailRow } = pushBlock(oldV, newV);
        diffs.forEach(field => {
            const colIndex = 2 + COMPARE_FIELDS.indexOf(field);
            styles.push({ ref: `${SHEET_COLS[colIndex]}${newRow}`, style: STYLE_ISSUE });
            aoa[detailRow - 1][colIndex] = `${oldV[field] || '(blank)'} → ${newV[field] || '(blank)'}`;
        });
    });

    missingFromNew.forEach(v => {
        const { newRow, detailRow } = pushBlock(v, null);
        for (let c = 2; c <= LAST_COL_INDEX; c++) styles.push({ ref: `${SHEET_COLS[c]}${newRow}`, style: STYLE_ISSUE });
        aoa[detailRow - 1][0] = 'Missing from new system';
    });

    newArrivals.forEach(v => {
        const { oldRow, detailRow } = pushBlock(null, v);
        for (let c = 2; c <= LAST_COL_INDEX; c++) styles.push({ ref: `${SHEET_COLS[c]}${oldRow}`, style: STYLE_ISSUE });
        aoa[detailRow - 1][0] = 'New arrival (not in old export)';
    });

    // Drop the trailing blank spacer after the last block.
    if (aoa.length && aoa[aoa.length - 1].every(c => c === '')) aoa.pop();

    const cols = aoa[0].map((_, i) => ({ wch: i === 0 ? 10 : i === 1 ? 10 : 18 }));
    return { aoa, styles, cols };
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
        const findings = buildFindings(oldVehicles, result.vehicles, diff);
        const issueCount = findings.filter(f => f.kind !== 'info' && f.affected > 0).length;

        const summaryEl = document.getElementById('inventoryCompareSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div>Old export: <b>${oldVehicles.length}</b> vehicles · New system: <b>${result.vehicles.length}</b> vehicles</div>
                <div style="color:#ff6b35">Missing from new system: <b>${diff.missingFromNew.length}</b></div>
                <div style="color:#8ab4f8">New arrivals (not in old export): <b>${diff.newArrivals.length}</b></div>
                <div style="color:#ffd54f">Field mismatches on matched stock #s: <b>${diff.mismatches.length}</b></div>
                <div>Summary checks needing attention: <b>${issueCount}</b> of ${findings.filter(f => f.kind !== 'info').length}</div>
            `;
        }

        const summarySheet = buildSummarySheet(findings, oldVehicles.length, result.vehicles.length);
        const detailsSheet = buildReportSheet(diff);

        chrome.runtime.sendMessage({
            type: 'exportToXLSX',
            sheets: [
                { name: 'Summary', ...summarySheet },
                { name: 'Details', ...detailsSheet },
            ],
            testType: 'INVENTORY_COMPARE_REPORT',
            siteName: new URL(tab.url).hostname.replace(/^www\./, ''),
        }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                setStatus('Comparison done, but the report spreadsheet failed to download: ' + (chrome.runtime.lastError?.message || response?.error || 'unknown error'), '#ff6b35');
                return;
            }
            setStatus(discrepancyCount === 0
                ? 'No discrepancies found — spreadsheet downloaded (Summary shows all checks passed).'
                : `Comparison complete — ${discrepancyCount} vehicle discrepancies, ${issueCount} summary checks need attention. Spreadsheet downloaded.`,
                '#4CAF50');
        });
    } catch (error) {
        console.error('Error running inventory compare:', error);
        setStatus('Error: ' + error.message, '#ff4444');
    }
}
