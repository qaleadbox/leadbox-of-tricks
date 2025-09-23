async function isLeadsEditEnabled() {
    const { featureSettings } = await chrome.storage.local.get(['featureSettings']);
    const s = featureSettings || { leadsEditIcon: true };
    return s.leadsEditIcon !== false;
  }
  
  function renderEditFromPreview(a) {
    const href = a.getAttribute('href') || '';
    if (!/\/previewinternallead\//i.test(href)) return;
  
    const cell = a.closest('td');
    if (!cell || !/\baction-column\b/.test(cell.className)) return;
    if (cell.querySelector('a.lbot-edit-icon')) return;
  
    const m = href.match(/\/previewinternallead\/([^/?#]+)/i);
    if (!m) return;
    const id = m[1];
  
    const link = document.createElement('a');
    link.href = `${location.origin}/en/leads/edit/${id}?returnUrl=${encodeURIComponent('/leads/internal')}`;
    link.className = 'lbot-edit-icon lbot-additional-icons';
    link.title = 'Edit Lead';
    link.style.marginLeft = '8px';
    link.setAttribute('data-action','edit-lead'); // normal same-tab nav
  
    const span = document.createElement('span');
    const i = document.createElement('i');
    i.className = 'leadbox-icon-edit';
    i.title = 'Edit';
    span.appendChild(i);
    link.appendChild(span);
  
    const printer = cell.querySelector('a.lbot-print-icon, a.hacked-icon[href*="/home/printlead/"]');
    if (printer) cell.insertBefore(link, printer);           // preview → EDIT → printer
    else a.parentNode.insertBefore(link, a.nextSibling);     // preview → EDIT (no printer yet)
  }
  
  const EDIT_SEL = 'td.action-column a[data-action="preview-lead"][href*="previewinternallead"]';
  let EDIT_OBS;
  
  async function initLeadsEditIcon() {
    if (!/\/(en\/)?leads\/internal/i.test(location.pathname)) return;
    if (!(await isLeadsEditEnabled())) return;
  
    const scan = () => document.querySelectorAll(EDIT_SEL).forEach(renderEditFromPreview);
    scan();
  
    if (EDIT_OBS) try { EDIT_OBS.disconnect(); } catch {}
    EDIT_OBS = new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes)
        if (n.nodeType === 1 && (n.matches?.(EDIT_SEL) || n.querySelector?.(EDIT_SEL))) { scan(); return; }
    });
    EDIT_OBS.observe(document.body, { childList: true, subtree: true });
  }
  
  initLeadsEditIcon();
  
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg?.type !== 'featureSettingsUpdated') return;
    if (await isLeadsEditEnabled()) initLeadsEditIcon();
    else document.querySelectorAll('a.lbot-edit-icon').forEach(el => el.remove());
  });
  