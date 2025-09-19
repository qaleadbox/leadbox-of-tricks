// Content Script Intellisense System for LeadBox of Tricks Extension
// Smart Autofiller (rebuild) — keeps same structure & method names

class ContentIntellisenseSystem {
    constructor() {
        this.currentSite = window.location.hostname.replace('www.', '');
        this.suggestions = [];
        this.currentInput = null;
        this.suggestionIndex = -1;
        this.isActive = false;
        this.suggestionBox = null;
        this.overlay = null;
        this.bestHint = '';
        this.enabled = true;
        this._justAutofilled = false;
        this._atLineStart = false;
        this._beforeCursorText = '';
        this._prevWord = '';
        this._currWord = '';
        this.saveIconWord = null;
        this.saveIconField = null;
        this._measureCanvas = null;
        this.init();
    }

    async init() {
        const enabled = await this.fetchAutofillEnabled();
        this.enabled = enabled;
        this.createSuggestionBox();
        this.bindEvents();
        this.createSaveIcons();
        await this.loadSiteProfile();
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg && msg.type === 'featureSettingsUpdated') {
                this.enabled = !!(msg.settings && msg.settings.autofill);
                if (!this.enabled) {
                    this.hideSuggestions();
                    this.removeGhostHighlight(this.currentInput);
                    this.hideSaveIcons();
                }
            }
        });
    }

    async fetchAutofillEnabled() {
        const { featureSettings } = await chrome.storage.local.get(['featureSettings']);
        const settings = featureSettings || { autofill: true };
        return settings.autofill !== false;
    }

    createSuggestionBox() {
        this.suggestionBox = document.createElement('div');
        this.suggestionBox.id = 'content-intellisense-suggestions';
        this.suggestionBox.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            max-height: 220px;
            overflow-y: auto;
            z-index: 2147483647;
            display: none;
            font-family: 'Consolas', 'Monaco', ui-monospace, monospace;
            font-size: 12px;
            pointer-events: auto;
        `;
        document.body.appendChild(this.suggestionBox);
    }

    createSaveIcons() {
        this.saveIconWord = document.createElement('button');
        this.saveIconWord.title = 'Save current word';
        this.saveIconWord.textContent = '💾';
        this.saveIconWord.setAttribute('tabindex', '-1');
        this.saveIconWord.type = 'button';
        this.saveIconWord.style.cssText = `
            position: absolute; width: 20px; height: 20px; font-size: 12px; line-height: 20px; text-align:center;
            background: rgba(255,255,255,0.95); color: #333; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;
            z-index: 2147483647; display: none; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;
        this.saveIconField = document.createElement('button');
        this.saveIconField.title = 'Save whole field';
        this.saveIconField.textContent = 'A';
        this.saveIconField.setAttribute('tabindex', '-1');
        this.saveIconField.type = 'button';
        this.saveIconField.style.cssText = `
            position: absolute; width: 20px; height: 20px; font-size: 12px; line-height: 20px; text-align:center;
            background: rgba(255,255,255,0.95); color: #333; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;
            z-index: 2147483647; display: none; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(this.saveIconWord);
        document.body.appendChild(this.saveIconField);

        const saveCurrentWord = async () => {
            if (!this.currentInput) return;
            this.currentInput.focus();
            const word = this.extractCurrentWord(this.currentInput);
            const term = (word || '').trim();
            if (!term) return;
            if (!this.suggestions.includes(term)) {
                await this.addSuggestion(term);
                this.showSaveFeedback();
            }
        };
        const saveWholeField = async () => {
            if (!this.currentInput) return;
            this.currentInput.focus();
            await this.saveCurrentInput(this.currentInput);
        };
        ['mousedown','pointerdown'].forEach(evt => {
            this.saveIconWord.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
            this.saveIconField.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
        });
        this.saveIconWord.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await saveCurrentWord(); });
        this.saveIconField.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await saveWholeField(); });
    }

    positionSaveIcons(inputElement) {
        if (!this.saveIconWord || !this.saveIconField || !inputElement) return;
        const rect = inputElement.getBoundingClientRect();
        const pageY = window.pageYOffset || document.documentElement.scrollTop;
        const pageX = window.pageXOffset || document.documentElement.scrollLeft;
        const top = rect.top + pageY - 24;
        const leftWord = rect.left + pageX + rect.width - 46;
        const leftField = rect.left + pageX + rect.width - 22;
        this.saveIconWord.style.top = top + 'px';
        this.saveIconWord.style.left = leftWord + 'px';
        this.saveIconField.style.top = top + 'px';
        this.saveIconField.style.left = leftField + 'px';
        this.saveIconWord.style.display = 'block';
        this.saveIconField.style.display = 'block';
    }

    hideSaveIcons() {
        if (this.saveIconWord) this.saveIconWord.style.display = 'none';
        if (this.saveIconField) this.saveIconField.style.display = 'none';
    }

    bindEvents() {
        const editableSelector = 'input:not([type="hidden"]), textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable]';
        document.addEventListener('keydown', (e) => {
            if (e.target.matches(editableSelector)) {
                this.handleKeydown(e);
            } else {
                this._justAutofilled = false;
            }
        });
        document.addEventListener('input', (e) => {
            if (e.target.matches(editableSelector)) {
                this.handleInput(e);
                this.positionSaveIcons(e.target);
            }
        });
        document.addEventListener('focus', (e) => {
            if (e.target.matches(editableSelector)) {
                this._justAutofilled = false;
                this.positionSaveIcons(e.target);
                this.currentInput = e.target;
            }
        }, true);
        document.addEventListener('blur', (e) => {
            if (e.target.matches(editableSelector)) {
                this._justAutofilled = false;
                this.hideSaveIcons();
            }
        }, true);
        document.addEventListener('click', (e) => {
            if (!this.suggestionBox.contains(e.target) && e.target !== this.currentInput) {
                this.hideSuggestions();
            }
        });
    }

    async loadSiteProfile() {
        const { intellisenseGlobalSuggestions } = await chrome.storage.local.get(['intellisenseGlobalSuggestions']);
        this.suggestions = Array.isArray(intellisenseGlobalSuggestions) ? Array.from(new Set(intellisenseGlobalSuggestions)).slice(0, 2000) : [];
    }

    // -------- smart helpers --------
    getQuoteInfo(word) {
        const w = String(word || '');
        const q = w[0];
        return (q === '"' || q === "'" || q === '`')
            ? { quote: q, inner: w.slice(1) }
            : { quote: '', inner: w };
    }
    getActiveUnclosedQuote_(s) {
        const text = String(s || '');
        const lastD = text.lastIndexOf('"');
        const lastS = text.lastIndexOf("'");
        const lastB = text.lastIndexOf('`');
        const last = Math.max(lastD, lastS, lastB);
        if (last === -1) return '';
        const q = text[last];
        const rest = text.slice(last + 1);
        return rest.includes(q) ? '' : q;
    }
    isQuotedTwoWordContext_(beforeCursor) {
        const q = this.getActiveUnclosedQuote_(beforeCursor);
        if (!q) return { active: false };
        const since = beforeCursor.slice(beforeCursor.lastIndexOf(q) + 1);
        const parts = since.split(/\s+/);
        return { active: parts.length >= 2 && parts[0] && (parts[1] || '').length > 0, quote: q, inner: since };
    }
    getCompletionSuffix_(fullHint, twoWordPrefixOrNull, currentWord) {
        const hint = String(fullHint || '');
        const two = (twoWordPrefixOrNull || '').trim();
        if (two) {
            const i = hint.toLowerCase().indexOf(two.toLowerCase());
            if (i === 0) return hint.slice(two.length);
        }
        const one = String(currentWord || '');
        if (one) {
            const i = hint.toLowerCase().indexOf(one.toLowerCase());
            if (i === 0) return hint.slice(one.length);
        }
        return hint;
    }

    handleInput(e) {
        if (!this.enabled) return;
        this.currentInput = e.target;
        this._justAutofilled = false;

        let currentWord = '';
        let prevWord = '';
        if (this.currentInput && this.currentInput.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const containerText = range.startContainer.textContent || '';
                const before = containerText.substring(0, range.startOffset);
                const parts = before.split(/\s+/);
                currentWord = parts[parts.length - 1] || '';
                prevWord = parts.length >= 2 ? parts[parts.length - 2] : '';
                const prevChar = before.charAt(before.length - currentWord.length - 1) || '';
                this._atLineStart = (before.length === currentWord.length) || prevChar === '\n';
                this._beforeCursorText = before;
            }
        } else {
            const value = e.target.value || '';
            const cursorPosition = e.target.selectionStart || 0;
            const beforeCursor = value.substring(0, cursorPosition);
            const words = beforeCursor.split(/\s+/);
            currentWord = words[words.length - 1] || '';
            prevWord = words.length >= 2 ? words[words.length - 2] : '';
            const prevChar = beforeCursor.charAt(beforeCursor.length - currentWord.length - 1) || '';
            this._atLineStart = (beforeCursor.length === currentWord.length) || prevChar === '\n';
            this._beforeCursorText = beforeCursor;
        }

        this._prevWord = prevWord;
        this._currWord = currentWord;

        this.checkGhostHighlighting(e.target, currentWord);

        if ((currentWord || '').length >= 1) {
            this.showSuggestions(currentWord, e.target);
        } else {
            this.hideSuggestions();
        }
    }

    checkGhostHighlighting(inputElement, currentWord) {
        const before = String(this._beforeCursorText || '');
        const quotedCtx = this.isQuotedTwoWordContext_(before);

        // Rule: if first word + start of second word matches inside an open quote,
        // ghost should suggest the rest of the quoted phrase + closing quote.
        if (quotedCtx.active) {
            const { quote, inner } = quotedCtx;
            const parts = inner.split(/\s+/);
            const first = parts[0];
            const second = parts[1] || '';
            const twoPref = (first + ' ' + second).toLowerCase();
            const hit = (this.suggestions || []).find(s => String(s).toLowerCase().startsWith(twoPref));
            if (hit) {
                this.bestHint = String(hit);
                const remainder = this.bestHint.substring(twoPref.length) + quote; // include closing quote
                this.showGhostHighlight(inputElement, '', remainder);
                return;
            }
        }

        // Non-quoted: try two-word anywhere (prev + current) for better phrase completion
        let candidate = '';
        if (this._prevWord && currentWord) {
            const two = (this._prevWord + ' ' + currentWord).toLowerCase();
            candidate = (this.suggestions || []).find(s => String(s).toLowerCase().startsWith(two)) || '';
            if (candidate) {
                this.bestHint = candidate;
                const remainder = candidate.substring(two.length);
                this.showGhostHighlight(inputElement, '', remainder);
                return;
            }
        }

        // Single prefix
        if (!currentWord || currentWord.length < 1) {
            this.removeGhostHighlight(inputElement);
            this.bestHint = '';
            return;
        }
        const single = (this.suggestions || []).find(s => String(s).toLowerCase().startsWith(currentWord.toLowerCase()));
        if (single) {
            this.bestHint = single;
            const remainder = single.substring(currentWord.length);
            this.showGhostHighlight(inputElement, '', remainder);
        } else {
            this.removeGhostHighlight(inputElement);
            this.bestHint = '';
        }
    }

    showGhostHighlight(inputElement, _unusedPrefix, remainderText) {
        this.removeGhostHighlight(inputElement);
        const ghostText = document.createElement('span');
        ghostText.id = 'content-intellisense-ghost';
        ghostText.style.cssText = `
            position: absolute;
            color: rgba(76, 175, 80, 0.6);
            font-family: inherit;
            font-size: inherit;
            pointer-events: none;
            z-index: 2147483647;
            user-select: none;
            white-space: pre;
        `;
        const caretRect = this.getCaretClientRect(inputElement);
        ghostText.style.left = caretRect.left + 'px';
        ghostText.style.top = caretRect.top + 'px';
        ghostText.textContent = String(remainderText || '');
        document.body.appendChild(ghostText);
    }

    measureTextWidth(text, computedStyle) {
        const canvas = this._measureCanvas || (this._measureCanvas = document.createElement('canvas'));
        const ctx = canvas.getContext('2d');
        const font = `${computedStyle.fontStyle} ${computedStyle.fontVariant} ${computedStyle.fontWeight} ${computedStyle.fontSize} / ${computedStyle.lineHeight} ${computedStyle.fontFamily}`;
        ctx.font = font;
        return ctx.measureText(text).width;
    }

    removeGhostHighlight() {
        const existingGhost = document.getElementById('content-intellisense-ghost');
        if (existingGhost) existingGhost.remove();
    }

    getCaretClientRect(element) {
        const pageY = window.pageYOffset || document.documentElement.scrollTop;
        const pageX = window.pageXOffset || document.documentElement.scrollLeft;
        if (element.isContentEditable) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
                const r = element.getBoundingClientRect();
                return { left: r.left + pageX, top: r.top + pageY, height: r.height };
            }
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            const rect = range.getClientRects()[0] || element.getBoundingClientRect();
            return { left: rect.left + pageX, top: rect.top + pageY, height: rect.height };
        }
        const tag = element.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const mirror = document.createElement('div');
            mirror.style.cssText = 'position:absolute; visibility:hidden; white-space:pre; overflow:hidden;';
            const props = ['font-size','font-family','font-weight','font-style','letter-spacing','text-transform','text-indent','line-height'];
            props.forEach(p => mirror.style[p] = style[p]);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingTop = parseFloat(style.paddingTop) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            const borderLeft = parseFloat(style.borderLeftWidth) || 0;
            const borderTop = parseFloat(style.borderTopWidth) || 0;
            const contentWidth = rect.width - paddingLeft - paddingRight - borderLeft - (parseFloat(style.borderRightWidth) || 0);
            mirror.style.width = contentWidth + 'px';
            const before = (element.value || '').substring(0, element.selectionStart || 0).replace(/\n/g, '\n');
            mirror.textContent = before;
            const marker = document.createElement('span');
            marker.textContent = '\u200b';
            mirror.appendChild(marker);
            document.body.appendChild(mirror);
            const mrect = marker.getBoundingClientRect();
            document.body.removeChild(mirror);
            const left = rect.left + pageX + borderLeft + paddingLeft + (mrect.left - mirror.getBoundingClientRect().left) - (element.scrollLeft || 0);
            const top = rect.top + pageY + borderTop + paddingTop - (element.scrollTop || 0);
            return { left, top, height: rect.height };
        }
        const r = element.getBoundingClientRect();
        return { left: r.left + pageX, top: r.top + pageY, height: r.height };
    }

    handleKeydown(e) {
        if (!this.enabled) return;
        if (e.key === 'Tab') {
            if (!this.currentInput) this.currentInput = e.target;
            if (this._justAutofilled) { this._justAutofilled = false; return; }

            // Ensure bestHint present
            if (!this.bestHint && e.target) {
                const currentWord = this.extractCurrentWord(e.target);
                if (currentWord && currentWord.length >= 1) {
                    const match = (this.suggestions || []).find(s => s.toLowerCase().startsWith(currentWord.toLowerCase()));
                    if (match) this.bestHint = match;
                }
            }

            // If quoted two-word context, append remainder + closing quote
            const before = String(this._beforeCursorText || '');
            const qctx = this.isQuotedTwoWordContext_(before);
            if (qctx.active && this.bestHint) {
                e.preventDefault(); e.stopPropagation();
                const { quote, inner } = qctx;
                const parts = inner.split(/\s+/);
                const two = (parts[0] + ' ' + (parts[1] || ''));
                const remainder = this.bestHint.substring(two.length) + quote;
                if (this.currentInput.isContentEditable) {
                    const sel = window.getSelection();
                    if (!sel || sel.rangeCount === 0) return;
                    const r = sel.getRangeAt(0);
                    const caret = r.cloneRange(); caret.collapse(true);
                    this.insertTextFragmentAtRange(caret, remainder);
                    sel.removeAllRanges(); sel.addRange(caret);
                } else {
                    const caret = this.currentInput.selectionStart || 0;
                    this.typeTextIntoInput(this.currentInput, remainder, caret, caret);
                }
                this.hideSuggestions();
                this.removeGhostHighlight(this.currentInput);
                this.saveOnTabPress(this.getElementTextValue(this.currentInput), this.bestHint);
                this.bestHint = '';
                this._justAutofilled = true;
                return;
            }

            // Non-quoted: insert only the missing suffix
            if (this.bestHint && this.currentInput) {
                e.preventDefault(); e.stopPropagation();
                const suffix = this.getCompletionSuffix_(this.bestHint, (this._prevWord && this._currWord) ? (this._prevWord + ' ' + this._currWord) : null, this._currWord);
                if (this.currentInput.isContentEditable) {
                    const sel = window.getSelection();
                    if (!sel || sel.rangeCount === 0) return;
                    const r = sel.getRangeAt(0);
                    const caret = r.cloneRange(); caret.collapse(true);
                    this.insertTextFragmentAtRange(caret, suffix);
                    sel.removeAllRanges(); sel.addRange(caret);
                } else {
                    const caret = this.currentInput.selectionStart || 0;
                    this.typeTextIntoInput(this.currentInput, suffix, caret, caret);
                }
                this.hideSuggestions();
                this.removeGhostHighlight(this.currentInput);
                this.saveOnTabPress(this.getElementTextValue(this.currentInput), this.bestHint);
                this.bestHint = '';
                this._justAutofilled = true;
                return;
            }
            return; // native Tab when no hint
        }

        // list navigation when open
        if (this.isActive && this.suggestionBox && this.suggestionBox.style.display !== 'none') {
            if (e.key === 'ArrowDown') { e.preventDefault(); this.nextSuggestion(); this._justAutofilled = false; return; }
            if (e.key === 'ArrowUp')   { e.preventDefault(); this.previousSuggestion(); this._justAutofilled = false; return; }
            if (e.key === 'Enter')     { e.preventDefault(); this.acceptSuggestion(); this._justAutofilled = true; return; }
            if (e.key === 'Escape')    { e.preventDefault(); this.hideSuggestions(); this.removeGhostHighlight(this.currentInput); return; }
        }

        this._justAutofilled = false;
    }

    extractCurrentWord(target) {
        if (target && target.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const text = (range.startContainer.textContent || '');
                const before = text.substring(0, range.startOffset);
                const parts = before.split(/\s+/);
                return parts[parts.length - 1] || '';
            }
            return '';
        }
        const value = target.value || '';
        const cursorPosition = target.selectionStart || 0;
        const beforeCursor = value.substring(0, cursorPosition);
        const words = beforeCursor.split(/\s+/);
        return words[words.length - 1] || '';
    }

    replaceCurrentWordWith(element, replacementText) {
        if (!element) return;
        if (element.isContentEditable) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            let range = sel.getRangeAt(0);
            let node = range.startContainer;
            let offset = range.startOffset;
            if (node.nodeType !== Node.TEXT_NODE) {
                if (node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE) {
                    node = node.firstChild;
                    offset = Math.min(offset, (node.textContent || '').length);
                } else {
                    const textNode = document.createTextNode('');
                    node.insertBefore(textNode, node.firstChild || null);
                    node = textNode; offset = 0;
                }
            }
            const text = node.textContent || '';
            offset = Math.max(0, Math.min(offset, text.length));
            let wordStart = offset, wordEnd = offset;
            while (wordStart > 0 && !/\s/.test(text.charAt(wordStart - 1))) wordStart--;
            while (wordEnd < text.length && !/\s/.test(text.charAt(wordEnd))) wordEnd++;
            const pre = document.createTextNode(text.substring(0, wordStart));
            const post = document.createTextNode(text.substring(wordEnd));
            const parent = node.parentNode; if (!parent) return;
            parent.insertBefore(pre, node);
            parent.insertBefore(post, node.nextSibling);
            parent.removeChild(node);
            const fragment = this.buildMultilineFragment(replacementText);
            parent.insertBefore(fragment, post);
            const newCaretNode = post.previousSibling && post.previousSibling.nodeType === Node.TEXT_NODE ? post.previousSibling : post;
            const newOffset = newCaretNode.nodeType === Node.TEXT_NODE ? (newCaretNode.textContent || '').length : 0;
            const afterRange = document.createRange();
            afterRange.setStart(newCaretNode, newOffset);
            afterRange.collapse(true);
            sel.removeAllRanges(); sel.addRange(afterRange);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        const value = element.value || '';
        const cursorPosition = element.selectionStart || 0;
        const beforeCursor = value.substring(0, cursorPosition);
        const words = beforeCursor.split(/\s+/);
        const currentWord = words[words.length - 1] || '';
        const replaceStart = beforeCursor.length - currentWord.length;
        const replaceEnd = cursorPosition;
        this.typeTextIntoInput(element, replacementText, replaceStart, replaceEnd);
    }

    showSuggestions(query, inputElement) {
        // respect quotes: match on inner if the token starts with a quote
        const { inner } = this.getQuoteInfo(query);
        const q = inner || query;

        let filtered = (this.suggestions || []).filter(s =>
            String(s).toLowerCase().startsWith(String(q).toLowerCase())
        );

        // If quoted context and we have two tokens inside the quote, tighten by two-word prefix
        const qc = this.isQuotedTwoWordContext_(String(this._beforeCursorText || ''));
        if (qc.active) {
            const parts = qc.inner.split(/\s+/);
            const two = (parts[0] + ' ' + (parts[1] || '')).toLowerCase();
            filtered = filtered.filter(s => String(s).toLowerCase().startsWith(two));
        }

        if (!filtered.length) { this.hideSuggestions(); return; }

        if (this._atLineStart) {
            filtered.sort((a, b) => {
                const aMulti = /\s/.test(a), bMulti = /\s/.test(b);
                if (aMulti === bMulti) return a.length - b.length;
                return aMulti ? -1 : 1;
            });
        }

        filtered = filtered.slice(0, 10);
        this.suggestionIndex = -1;
        this.renderSuggestions(filtered, q);
        this.positionSuggestionBox(inputElement);
        this.isActive = true;
    }

    renderSuggestions(suggestions, query) {
        this.suggestionBox.innerHTML = '';
        this.suggestionBox.style.background = 'white';
        this.suggestionBox.style.color = '#111';
        this.suggestionBox.style.border = '1px solid #ccc';
        this.suggestionBox.style.zIndex = '2147483647';
        this.suggestionBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)';
        this.suggestionBox.style.pointerEvents = 'auto';

        const qLower = (query || '').toLowerCase();

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.value = suggestion;
            item.style.cssText = `
                padding: 8px 12px !important;
                cursor: pointer !important;
                border-bottom: 1px solid #eee !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 8px !important;
                background: ${index === this.suggestionIndex ? '#e8f5e8' : 'white'} !important;
                color: #111 !important;
                user-select: none !important;
            `;
            item.addEventListener('pointerdown', (ev) => {
                if (ev.target && ev.target.closest('.suggestion-remove')) return; // let button handle
                ev.preventDefault(); ev.stopPropagation();
                this.suggestionIndex = index;
                if (!this.currentInput) this.currentInput = document.activeElement;
                this.acceptSuggestion();
            }, { capture: true });

            const textSpan = document.createElement('span');
            textSpan.className = 'suggestion-text';
            textSpan.style.cssText = 'color:#111 !important;';
            const s = String(suggestion);
            if (qLower && s.toLowerCase().startsWith(qLower)) {
                const prefix = s.substring(0, qLower.length);
                const rest = s.substring(qLower.length);
                textSpan.innerHTML = `<strong>${this.escapeHtml(prefix)}</strong>${this.escapeHtml(rest)}`;
            } else {
                textSpan.textContent = s;
            }

            const closeBtn = document.createElement('button');
            closeBtn.className = 'suggestion-remove';
            closeBtn.textContent = '×';
            closeBtn.title = 'Remove suggestion';
            closeBtn.type = 'button';
            closeBtn.style.cssText = `
                border: none !important;
                background: transparent !important;
                color: #777 !important;
                font-size: 14px !important;
                line-height: 1 !important;
                cursor: pointer !important;
                padding: 0 4px !important;
                z-index: 2147483647 !important;
            `;
            closeBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, true);
            closeBtn.addEventListener('mousedown', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, true);
            closeBtn.addEventListener('click', async (ev) => {
                ev.preventDefault(); ev.stopPropagation();
                await this.deleteSuggestion(suggestion);
                this.showSuggestions(query, this.currentInput || document.activeElement);
            });

            item.appendChild(textSpan);
            item.appendChild(closeBtn);

            item.addEventListener('mouseenter', () => {
                this.suggestionIndex = index;
                this.updateHighlight();
            });

            this.suggestionBox.appendChild(item);
        });

        this.suggestionBox.style.display = 'block';
    }

    positionSuggestionBox(inputElement) {
        const rect = inputElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        this.suggestionBox.style.left = (rect.left + scrollLeft) + 'px';
        this.suggestionBox.style.top = (rect.bottom + scrollTop + 2) + 'px';
        this.suggestionBox.style.width = rect.width + 'px';
    }

    updateHighlight() {
        const items = this.suggestionBox.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            item.style.background = index === this.suggestionIndex ? '#e8f5e8' : 'white';
        });
    }

    nextSuggestion() {
        const items = this.suggestionBox.querySelectorAll('.suggestion-item');
        if (!items.length) return;
        this.suggestionIndex = (this.suggestionIndex + 1) % items.length;
        this.updateHighlight();
    }

    previousSuggestion() {
        const items = this.suggestionBox.querySelectorAll('.suggestion-item');
        if (!items.length) return;
        this.suggestionIndex = this.suggestionIndex <= 0 ? items.length - 1 : this.suggestionIndex - 1;
        this.updateHighlight();
    }

    acceptSuggestion() {
        if (this.suggestionIndex < 0 || !this.currentInput) return;
        const items = this.suggestionBox.querySelectorAll('.suggestion-item');
        if (!items.length) return;

        const selectedItem = items[this.suggestionIndex];
        const baseSuggestion =
            (selectedItem && selectedItem.dataset && selectedItem.dataset.value) ||
            (selectedItem.querySelector('.suggestion-text')?.textContent || '');

        // Quoted two-word context: append remainder + auto close
        const before = String(this._beforeCursorText || '');
        const quotedCtx = this.isQuotedTwoWordContext_(before);
        if (quotedCtx.active) {
            const { quote, inner } = quotedCtx;
            const parts = inner.split(/\s+/);
            const two = (parts[0] + ' ' + (parts[1] || ''));
            const remainder = baseSuggestion.substring(two.length) + quote;

            if (this.currentInput.isContentEditable) {
                const sel = window.getSelection();
                if (!sel || sel.rangeCount === 0) return;
                const r = sel.getRangeAt(0);
                const caret = r.cloneRange(); caret.collapse(true);
                this.insertTextFragmentAtRange(caret, remainder);
                sel.removeAllRanges(); sel.addRange(caret);
                this.hideSuggestions(); this.removeGhostHighlight(this.currentInput);
                this.saveOnTabPress(this.getElementTextValue(this.currentInput), baseSuggestion);
                this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            } else {
                const caret = this.currentInput.selectionStart || 0;
                this.typeTextIntoInput(this.currentInput, remainder, caret, caret);
                this.hideSuggestions(); this.removeGhostHighlight(this.currentInput);
                this.saveOnTabPress(this.getElementTextValue(this.currentInput), baseSuggestion);
                this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }

        // Default: replace current token with suggestion
        if (this.currentInput.isContentEditable) {
            this.replaceCurrentWordWith(this.currentInput, baseSuggestion);
            this.hideSuggestions(); this.removeGhostHighlight(this.currentInput);
            this.saveOnTabPress(this.getElementTextValue(this.currentInput), baseSuggestion);
            return;
        }

        const value = this.currentInput.value || '';
        const cursorPosition = this.currentInput.selectionStart || 0;
        const beforeCursor = value.substring(0, cursorPosition);
        const words = beforeCursor.split(/\s+/);
        const currentWord = words[words.length - 1] || '';
        const replaceStart = Math.max(0, beforeCursor.length - currentWord.length);
        const replaceEnd = cursorPosition;
        this.typeTextIntoInput(this.currentInput, baseSuggestion, replaceStart, replaceEnd);
        this.hideSuggestions(); this.removeGhostHighlight(this.currentInput);
        this.saveOnTabPress(this.getElementTextValue(this.currentInput), baseSuggestion);
        this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    typeTextIntoInput(inputElement, textToType, selectionStart, selectionEnd) {
        if (!inputElement) return;
        inputElement.focus();
        const isTextArea = inputElement.tagName === 'TEXTAREA';
        const valueDescriptor = Object.getOwnPropertyDescriptor(isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
        const setNativeValue = valueDescriptor && valueDescriptor.set ? (val) => valueDescriptor.set.call(inputElement, val) : (val) => { inputElement.value = val; };
        if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') inputElement.setSelectionRange(selectionStart, selectionEnd);
        const start = inputElement.selectionStart;
        const end = inputElement.selectionEnd;
        let currentValue = inputElement.value.substring(0, start) + inputElement.value.substring(end);
        setNativeValue(currentValue);
        inputElement.setSelectionRange(start, start);
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        for (const ch of textToType) {
            if (ch === '\n') {
                const kd = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
                inputElement.dispatchEvent(kd);
                const insertPos = inputElement.selectionStart;
                currentValue = inputElement.value;
                const newValue = currentValue.substring(0, insertPos) + '\n' + currentValue.substring(insertPos);
                setNativeValue(newValue);
                const newPos = insertPos + 1;
                inputElement.setSelectionRange(newPos, newPos);
                try { inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak', data: null })); }
                catch { inputElement.dispatchEvent(new Event('input', { bubbles: true })); }
                const ku = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
                inputElement.dispatchEvent(ku);
                continue;
            }
            const kd = new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true });
            inputElement.dispatchEvent(kd);
            const insertPos = inputElement.selectionStart;
            currentValue = inputElement.value;
            const newValue = currentValue.substring(0, insertPos) + ch + currentValue.substring(insertPos);
            setNativeValue(newValue);
            const newPos = insertPos + ch.length;
            inputElement.setSelectionRange(newPos, newPos);
            try { inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch })); }
            catch { inputElement.dispatchEvent(new Event('input', { bubbles: true })); }
            const ku = new KeyboardEvent('keyup', { key: ch, bubbles: true, cancelable: true });
            inputElement.dispatchEvent(ku);
        }
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    moveFocusToNextElement(current) {
        const candidates = Array.from(document.querySelectorAll('input, textarea, select, button, a[href], [tabindex]'))
            .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
        const index = candidates.indexOf(current);
        if (index >= 0) {
            const next = candidates[index + 1] || candidates[0];
            next.focus();
        }
    }

    async saveCurrentInput(inputElement) {
        const rawValue = this.getElementTextValue(inputElement);
        if (!rawValue || rawValue.trim().length === 0) return;
        const trimmedValue = rawValue.trim();
        if (!this.suggestions.includes(trimmedValue)) {
            await this.addSuggestion(trimmedValue);
            this.showSaveFeedback();
        }
        const words = trimmedValue.split(/\s+/);
        for (const word of words) {
            const term = word.toLowerCase();
            if (term.length >= 2 && !this.suggestions.includes(term)) {
                await this.addSuggestion(term);
            }
        }
        const lines = rawValue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (!this.suggestions.includes(line)) {
                await this.addSuggestion(line);
            }
        }
        const phrases = this.extractPhrases(trimmedValue);
        for (const phrase of phrases) {
            if (phrase.length >= 3 && !this.suggestions.includes(phrase)) {
                await this.addSuggestion(phrase);
            }
        }
    }

    async saveOnTabPress(inputValue, acceptedSuggestion) {
        if (!inputValue || inputValue.trim().length === 0) return;
        const rawValue = inputValue;
        const trimmedValue = inputValue.trim();
        if (!this.suggestions.includes(trimmedValue)) {
            await this.addSuggestion(trimmedValue);
            this.showSaveFeedback();
        }
        if (acceptedSuggestion && !this.suggestions.includes(acceptedSuggestion)) {
            await this.addSuggestion(acceptedSuggestion);
        }
        const words = trimmedValue.split(/\s+/);
        for (const word of words) {
            const term = word.toLowerCase();
            if (term.length >= 2 && !this.suggestions.includes(term)) {
                await this.addSuggestion(term);
            }
        }
        const lines = rawValue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (!this.suggestions.includes(line)) {
                await this.addSuggestion(line);
            }
        }
        const phrases = this.extractPhrases(trimmedValue);
        for (const phrase of phrases) {
            if (phrase.length >= 3 && !this.suggestions.includes(phrase)) {
                await this.addSuggestion(phrase);
            }
        }
    }

    showSaveFeedback() {
        // keep subtle to avoid visual noise
        return;
    }

    extractPhrases(text) {
        const phrases = [];
        const patterns = [
            /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
            /[a-z]+(?:_[a-z]+)+/g,
            /[a-z]+(?:\-[a-z]+)+/g,
            /[A-Z]+(?:_[A-Z]+)+/g,
            /[A-Z][a-z]+(?:\-[A-Z][a-z]+)*/g,
        ];
        patterns.forEach(p => {
            const m = text.match(p);
            if (m) phrases.push(...m);
        });
        const quoted = text.match(/"([^"]+)"|'([^']+)'|`([^`]+)`/g);
        if (quoted) {
            for (const q of quoted) phrases.push(q.slice(1, -1));
        }
        return phrases;
    }

    hideSuggestions() {
        if (!this.suggestionBox) return;
        this.suggestionBox.style.display = 'none';
        this.isActive = false;
        this.suggestionIndex = -1;
        this.removeGhostHighlight(this.currentInput);
    }

    async addSuggestion(suggestion) {
        const v = String(suggestion);
        if (!this.suggestions.includes(v)) {
            this.suggestions.push(v);
            await this.saveSiteProfile();
            this.showSaveFeedback();
        }
    }

    async deleteSuggestion(suggestion) {
        const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
        const target = normalize(suggestion);
        const beforeLen = this.suggestions.length;
        this.suggestions = this.suggestions.filter(item => normalize(item) !== target);
        if (this.suggestions.length !== beforeLen) {
            await this.saveSiteProfile();
        }
    }

    async saveSiteProfile() {
        await chrome.storage.local.set({ intellisenseGlobalSuggestions: this.suggestions });
    }

    getProfileStats() {
        return { site: this.currentSite, totalSuggestions: this.suggestions.length };
    }

    getElementTextValue(el) {
        if (!el) return '';
        if (el.isContentEditable) return (el.innerText || el.textContent || '');
        return (el.value || '');
    }

    escapeRegExp(str) { return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    }

    buildMultilineFragment(text) {
        const fragment = document.createDocumentFragment();
        const parts = String(text).split(/\r?\n/);
        parts.forEach((part, idx) => {
            fragment.appendChild(document.createTextNode(part));
            if (idx < parts.length - 1) fragment.appendChild(document.createElement('br'));
        });
        return fragment;
    }
    insertTextFragmentAtRange(range, text) {
        const frag = this.buildMultilineFragment(text);
        range.insertNode(frag);
        range.setStart(range.endContainer, range.endOffset);
        range.collapse(true);
    }
}

// Add CSS (strong highlight color)
const style = document.createElement('style');
style.textContent = `
    @keyframes content-intellisense-pulse {
        0% { border-color: rgba(76, 175, 80, 0.3); background: rgba(76, 175, 80, 0.1); }
        50% { border-color: rgba(76, 175, 80, 0.6); background: rgba(76, 175, 80, 0.2); }
        100% { border-color: rgba(76, 175, 80, 0.3); background: rgba(76, 175, 80, 0.1); }
    }
    #content-intellisense-suggestions .suggestion-item strong { color: #2E7D32; font-weight: 700; }
`;
if (!document.getElementById('content-intellisense-style')) {
    style.id = 'content-intellisense-style';
    document.head.appendChild(style);
}

// Initialize
window.contentIntellisenseSystem = new ContentIntellisenseSystem();
