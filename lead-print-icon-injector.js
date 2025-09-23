async function isLeadsPrinterEnabled() {
    const { featureSettings } = await chrome.storage.local.get(['featureSettings']);
    const s = featureSettings || { leadsPrinterIcon: true };
    return s.leadsPrinterIcon !== false;
  }
  function renderPrintFromPreview(a) {
    const cell = a.closest('td'); if (!cell || !/\baction-column\b/.test(cell.className)) return;
    if (cell.querySelector('a.lbot-print-icon')) return;
    const m = (a.getAttribute('href')||'').match(/\/previewinternallead\/([^/?#]+)/i); if (!m) return;
  
    const link = document.createElement('a');
    link.href = `${location.origin}/home/printlead/${m[1]}`;
    link.className = 'lbot-print-icon lbot-additional-icons';
    link.title = 'Print Lead';
    link.style.marginLeft = '8px';
    link.setAttribute('data-action','preview-lead'); // popup
  
    const i = document.createElement('i'); i.className = 'leadbox-icon-printer'; link.appendChild(i);
  
    const edit = cell.querySelector('a.lbot-edit-icon');
    edit ? cell.insertBefore(link, edit.nextSibling) : a.parentNode.insertBefore(link, a.nextSibling);
  }
  const _PRINT_SEL = 'td.action-column a[data-action="preview-lead"][href*="previewinternallead"]';
  let PRINT_OBS;
  async function initLeadsPrinterIcon() {
    if (!/\.net\/(en\/)?leads\/internal/i.test(location.href)) return;
    if (!(await isLeadsPrinterEnabled())) return;
    const scan = () => document.querySelectorAll(_PRINT_SEL).forEach(renderPrintFromPreview);
    scan();
    if (PRINT_OBS) try { PRINT_OBS.disconnect(); } catch {}
    PRINT_OBS = new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes)
        if (n.nodeType===1 && (n.matches?.(_PRINT_SEL) || n.querySelector?.(_PRINT_SEL))) { scan(); return; }
    });
    PRINT_OBS.observe(document.body, { childList:true, subtree:true });
  }
  initLeadsPrinterIcon();
  chrome.runtime.onMessage.addListener(async (msg)=> {
    if (msg?.type!=='featureSettingsUpdated') return;
    if (await isLeadsPrinterEnabled()) initLeadsPrinterIcon();
    else document.querySelectorAll('a.lbot-print-icon').forEach(el=>el.remove());
  });
  