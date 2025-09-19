// Content Script Intellisense System for LeadBox of Tricks Extension
// This runs on the actual webpage to provide intellisense functionality

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
        this._multiWordPrefix = '';
        this._bestHintMeta = null; // { text, matchStart, matchLen }
        this.init();
    }

    async init() {
        const enabled = await this.fetchAutofillEnabled();
        this.enabled = enabled;
        this.createSuggestionBox();
        this.bindEvents();
        this.createSaveIcons();
		await this.loadSiteProfile();
        // Listen for settings updates
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
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
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
        // Prevent stealing focus
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
        const top = rect.top + pageY - 24; // above field
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

    // Removed createOverlay()

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
                this.hideOverlay && this.hideOverlay();
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
		const result = await chrome.storage.local.get(['intellisenseGlobalSuggestions']);
		this.suggestions = Array.isArray(result.intellisenseGlobalSuggestions) ? result.intellisenseGlobalSuggestions : [];
	}

    // Removed showOverlay and hideOverlay methods

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
        }
        // build multi-word prefix if applicable
        this._multiWordPrefix = '';
        if (prevWord && currentWord) {
            const prefix = (prevWord + ' ' + currentWord).trim();
            if (prefix.length >= 2) this._multiWordPrefix = prefix; // allow quotes when two tokens exist
        }
        // Check for ghost highlighting using best prefix (multi-word or single)
        this.checkGhostHighlighting(e.target, currentWord);
        
        if (currentWord.length >= 1) {
            this.showSuggestions(currentWord, e.target);
        } else {
            this.hideSuggestions();
        }
    }

	checkGhostHighlighting(inputElement, currentWord) {
        if ((currentWord || '').length < 1 && (!this._multiWordPrefix || this._multiWordPrefix.length < 2)) {
            this.removeGhostHighlight(inputElement);
            this.bestHint = '';
            this._bestHintMeta = null;
            return;
        }
        const tryPrefixes = [];
        if (this._multiWordPrefix && this._multiWordPrefix.length >= 2) tryPrefixes.push(this._multiWordPrefix);
        if (currentWord && currentWord.length >= 1) tryPrefixes.push(currentWord);
        let best = null;
        for (const pref of tryPrefixes) {
            const lower = pref.toLowerCase();
            // First, try simple startsWith
            const starts = this.suggestions.find(s => String(s).toLowerCase().startsWith(lower));
            if (starts) {
                best = { text: String(starts), matchStart: 0, matchLen: lower.length };
                break;
            }
            // Then try two-word anywhere
            if (pref.includes(' ')) {
                for (const s of this.suggestions) {
                    const meta = this.findTwoWordMatchAnywhere(String(s), lower);
                    if (meta) { best = { text: String(s), matchStart: meta.matchStart, matchLen: meta.matchLen }; break; }
                }
                if (best) break;
            }
        }
        if (best) {
            this.bestHint = best.text;
            this._bestHintMeta = best;
            // For ghost, show remainder after the matched currentPrefix portion
            const usedPrefixLen = best.matchLen;
            const usedStart = best.matchStart;
            this.showGhostHighlight(inputElement, { text: best.text, fromIndex: usedStart + usedPrefixLen });
        } else {
            this.removeGhostHighlight(inputElement);
            this.bestHint = '';
            this._bestHintMeta = null;
        }
    }

	showGhostHighlight(inputElement, info) {
        // info: { text, fromIndex } where fromIndex is where remainder should start
        this.removeGhostHighlight(inputElement);
        const ghostText = document.createElement('span');
        ghostText.id = 'content-intellisense-ghost';
        ghostText.style.cssText = `
            position: absolute;
            color: rgba(76, 175, 80, 0.6);
            font-family: inherit;
            font-size: inherit;
            pointer-events: none;
            z-index: 10001;
            user-select: none;
            white-space: pre;
        `;
        const caretRect = this.getCaretClientRect(inputElement);
        ghostText.style.left = caretRect.left + 'px';
        ghostText.style.top = caretRect.top + 'px';
        const from = Math.max(0, info && typeof info.fromIndex === 'number' ? info.fromIndex : 0);
        const remainingText = String(info && info.text ? info.text : '').substring(from);
        ghostText.textContent = remainingText;
        document.body.appendChild(ghostText);
    }

	// Measure text width using canvas to align ghost with caret
	measureTextWidth(text, computedStyle) {
		const canvas = this._measureCanvas || (this._measureCanvas = document.createElement('canvas'));
		const ctx = canvas.getContext('2d');
		const font = `${computedStyle.fontStyle} ${computedStyle.fontVariant} ${computedStyle.fontWeight} ${computedStyle.fontSize} / ${computedStyle.lineHeight} ${computedStyle.fontFamily}`;
		ctx.font = font;
		return ctx.measureText(text).width;
	}

    removeGhostHighlight(inputElement) {
        const existingGhost = document.getElementById('content-intellisense-ghost');
        if (existingGhost) {
            existingGhost.remove();
        }
    }

    // Improve caret rect for inputs/textareas
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
            // Insert text up to caret
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

			if (this._justAutofilled) {
				this._justAutofilled = false;
				return; // native Tab now
			}

			// Find best hint
			if (!this.bestHint && e.target) {
				const currentWord = this.extractCurrentWord(e.target);
				if (currentWord && currentWord.length >= 2) {
					const match = (this.suggestions || []).find(s => s.toLowerCase().startsWith(currentWord.toLowerCase()));
					if (match) this.bestHint = match;
				}
				// also try two-word
				if (!this.bestHint && this._multiWordPrefix && this._multiWordPrefix.length >= 2) {
					const mwLower = this._multiWordPrefix.toLowerCase();
					const mwMatch = (this.suggestions || []).find(s => String(s).toLowerCase().startsWith(mwLower));
					if (mwMatch) this.bestHint = mwMatch;
				}
			}

			if (this.bestHint && this.currentInput) {
				e.preventDefault();
				e.stopPropagation();
				// Always replace prev+current tokens when we have a multi-word prefix typed
				const twoWordPref = (this._multiWordPrefix || '').trim();
				if (this.currentInput.isContentEditable) {
					this.replacePrefixInContentEditableBySuffix(this.currentInput, twoWordPref || null, this.bestHint);
				} else {
					this.replacePrefixInInputBySuffix(this.currentInput, twoWordPref || null, this.bestHint);
				}
				this.hideSuggestions();
				this.removeGhostHighlight(this.currentInput);
				this.saveOnTabPress(this.getElementTextValue(this.currentInput), this.bestHint);
				this.bestHint = '';
				this._justAutofilled = true;
				return;
			}
			return; // no hint -> native
		}
		// reset after other keys/mouse
		this._justAutofilled = false;
	}

    // Extract the current word at caret from any editable element
    extractCurrentWord(target) {
        if (target && target.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const containerText = range.startContainer.textContent || '';
                const before = containerText.substring(0, range.startOffset);
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

    // Replace the current word at caret with provided text for both input-like and contenteditable
    replaceCurrentWordWith(element, replacementText, coverTwoWords) {
        if (!element) return;
        if (element.isContentEditable) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            let range = sel.getRangeAt(0);
            // If there is a selection, replace it fully
            if (!range.collapsed) {
                this.insertTextFragmentAtRange(range, replacementText);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
            // Try using selection.modify to expand by word(s) across nodes
            try {
                sel.modify('extend', 'backward', 'word');
                if (coverTwoWords) sel.modify('extend', 'backward', 'word');
                range = sel.getRangeAt(0);
                this.insertTextFragmentAtRange(range, replacementText);
                // Collapse after inserted text
                sel.removeAllRanges();
                const after = document.createRange();
                if (range.endContainer) {
                    const endNode = range.endContainer;
                    const endOffset = range.endOffset;
                    after.setStart(endNode, endOffset);
                    after.collapse(true);
                    sel.addRange(after);
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            } catch (e) {
                // Fallback to manual within-node replacement
            }
            // Fallback manual logic (single-node only)
            let node = range.startContainer;
            let offset = range.startOffset;
            if (node.nodeType !== Node.TEXT_NODE) {
                if (node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE) {
                    node = node.firstChild;
                    offset = Math.min(offset, (node.textContent || '').length);
                } else {
                    const textNode = document.createTextNode('');
                    node.insertBefore(textNode, node.firstChild || null);
                    node = textNode;
                    offset = 0;
                }
            }
            const text = node.textContent || '';
            offset = Math.max(0, Math.min(offset, text.length));
            let wordStart = offset;
            let wordEnd = offset;
            while (wordStart > 0 && !/\s/.test(text.charAt(wordStart - 1))) wordStart--;
            while (wordEnd < text.length && !/\s/.test(text.charAt(wordEnd))) wordEnd++;
            if (coverTwoWords) {
                let ws = wordStart;
                while (ws > 0 && /\s/.test(text.charAt(ws - 1))) ws--;
                while (ws > 0 && !/\s/.test(text.charAt(ws - 1))) ws--;
                wordStart = ws;
            }
            const pre = document.createTextNode(text.substring(0, wordStart));
            const post = document.createTextNode(text.substring(wordEnd));
            const parent = node.parentNode;
            if (!parent) return;
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
            sel.removeAllRanges();
            sel.addRange(afterRange);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        // Input/Textarea path
        this.replaceTypedInInput(element, replacementText, coverTwoWords);
    }

    showSuggestions(query, inputElement) {
        const qLower = query.toLowerCase();
        const mwLower = (this._multiWordPrefix || '').toLowerCase();
        // Collect candidates with metadata
        const set = new Map(); // text -> meta
        const addCandidate = (text, matchStart, matchLen) => {
            if (!set.has(text)) set.set(text, { text, matchStart, matchLen });
        };
        for (const s of this.suggestions) {
            const sStr = String(s);
            const sl = sStr.toLowerCase();
            if (sl.startsWith(qLower)) {
                addCandidate(sStr, 0, qLower.length);
            }
        }
        if (mwLower) {
            for (const s of this.suggestions) {
                const sStr = String(s);
                const meta = this.findTwoWordMatchAnywhere(sStr, mwLower);
                if (meta) addCandidate(sStr, meta.matchStart, meta.matchLen);
            }
        }
        let candidates = Array.from(set.values());
        if (candidates.length === 0) {
            this.hideSuggestions();
            return;
        }
        // Prioritize: multi-word anywhere first when applicable, then shorter
        candidates.sort((a, b) => {
            const aMulti = a.matchStart > 0 || (mwLower && a.matchLen >= (mwLower.split(' ')[1] || '').length);
            const bMulti = b.matchStart > 0 || (mwLower && b.matchLen >= (mwLower.split(' ')[1] || '').length);
            if (aMulti !== bMulti) return aMulti ? -1 : 1;
            // prefer those whose match starts closer to caret context: start-of-string first
            if (a.matchStart !== b.matchStart) return a.matchStart - b.matchStart;
            return a.text.length - b.text.length;
        });
        candidates = candidates.slice(0, 10);
        this.suggestionIndex = -1;
        this.renderSuggestionsWithMeta(candidates, query, this._multiWordPrefix);
        this.positionSuggestionBox(inputElement);
        this.isActive = true;
    }

    // Find two-word match anywhere: prev + space + currentPrefix at any position
    findTwoWordMatchAnywhere(suggestion, twoWordPrefixLower) {
        const s = String(suggestion);
        const sl = s.toLowerCase();
        const parts = twoWordPrefixLower.split(/\s+/);
        if (parts.length < 2) return null;
        const prev = parts[0];
        const currPref = parts[1];
        // Walk tokens with indices
        const tokenRegex = /\b\w+\b/g;
        let m; const tokens = [];
        while ((m = tokenRegex.exec(sl)) !== null) {
            tokens.push({ word: sl.substring(m.index, m.index + m[0].length), start: m.index, end: m.index + m[0].length });
        }
        for (let i = 0; i < tokens.length - 1; i++) {
            const t1 = tokens[i];
            const t2 = tokens[i + 1];
            if (t1.word === prev && t2.word.startsWith(currPref)) {
                // matchStart at start of second token, matchLen = currentPrefix length
                return { matchStart: t2.start, matchLen: currPref.length };
            }
        }
        return null;
    }

    renderSuggestionsWithMeta(candidates, query, multiPrefix) {
        this.suggestionBox.innerHTML = '';
        this.suggestionBox.style.background = 'white';
        this.suggestionBox.style.color = '#111';
        this.suggestionBox.style.border = '1px solid #ccc';
        this.suggestionBox.style.zIndex = '2147483647';
        this.suggestionBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)';
        this.suggestionBox.style.pointerEvents = 'auto';

        const qLower = (query || '').toLowerCase();
        const mwLower = (multiPrefix || '').toLowerCase();

        candidates.forEach((cand, index) => {
            const { text, matchStart, matchLen } = cand;
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.value = text;
            item.dataset.matchStart = String(matchStart == null ? -1 : matchStart);
            item.dataset.matchLen = String(matchLen == null ? 0 : matchLen);
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
                ev.preventDefault();
                ev.stopPropagation();
                this.suggestionIndex = index;
                if (!this.currentInput) this.currentInput = document.activeElement;
                this.acceptSuggestion();
            }, { capture: true });

            const textSpan = document.createElement('span');
            textSpan.className = 'suggestion-text';
            textSpan.style.cssText = 'color:#111 !important;';
            const s = String(text);
            if (matchStart != null && matchStart >= 0 && matchLen > 0) {
                const before = s.substring(0, matchStart);
                const match = s.substring(matchStart, matchStart + matchLen);
                const after = s.substring(matchStart + matchLen);
                textSpan.innerHTML = `${this.escapeHtml(before)}<strong>${this.escapeHtml(match)}</strong>${this.escapeHtml(after)}`;
            } else if (qLower && s.toLowerCase().startsWith(qLower)) {
                const prefix = s.substring(0, qLower.length);
                const rest = s.substring(qLower.length);
                textSpan.innerHTML = `<strong>${this.escapeHtml(prefix)}</strong>${this.escapeHtml(rest)}`;
            } else {
                textSpan.textContent = s;
            }

            const closeBtn = document.createElement('button');
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
            `;
            // prevent parent pointerdown handler
            closeBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
            closeBtn.addEventListener('mousedown', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
            closeBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                await this.deleteSuggestion(text);
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
        if (items.length === 0) return;
        
        this.suggestionIndex = (this.suggestionIndex + 1) % items.length;
        this.updateHighlight();
    }

    previousSuggestion() {
        const items = this.suggestionBox.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;
        
        this.suggestionIndex = this.suggestionIndex <= 0 ? items.length - 1 : this.suggestionIndex - 1;
        this.updateHighlight();
    }

	acceptSuggestion() {
        if (this.suggestionIndex < 0 || !this.currentInput) return;
        const items = this.suggestionBox.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;
        const selectedItem = items[this.suggestionIndex];
        const selectedSuggestion = selectedItem && selectedItem.dataset ? selectedItem.dataset.value : items[this.suggestionIndex].textContent;

        if (this.currentInput.isContentEditable) {
            const { text, nodes, caretOffset } = this.getContentEditableInfo(this.currentInput);
            const { start, end } = this.computePrevAndCurrentTokenSpan(text, caretOffset);
            const range = this.buildRangeForOffsets(this.currentInput, nodes, start, end);
            this.insertTextFragmentAtRange(range, selectedSuggestion);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                const after = document.createRange();
                if (range.endContainer) {
                    after.setStart(range.endContainer, range.endOffset);
                    after.collapse(true);
                    sel.addRange(after);
                }
            }
            this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.currentInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            const caret = this.currentInput.selectionStart || 0;
            const value = this.currentInput.value || '';
            const { start, end } = this.computePrevAndCurrentTokenSpan(value, caret);
            this.typeTextIntoInput(this.currentInput, selectedSuggestion, start, end);
        }

        this.hideSuggestions();
        this.removeGhostHighlight(this.currentInput);
        this.saveOnTabPress(this.getElementTextValue(this.currentInput), selectedSuggestion);
        if (!this.currentInput.isContentEditable) {
            this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

	// Simulate real typing into an input by dispatching keyboard and input events
	typeTextIntoInput(inputElement, textToType, selectionStart, selectionEnd) {
		if (!inputElement) return;
		inputElement.focus();
		const isTextArea = inputElement.tagName === 'TEXTAREA';
		const valueDescriptor = Object.getOwnPropertyDescriptor(isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
		const setNativeValue = valueDescriptor && valueDescriptor.set ? (val) => valueDescriptor.set.call(inputElement, val) : (val) => { inputElement.value = val; };
		// Select the range to replace
		if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
			inputElement.setSelectionRange(selectionStart, selectionEnd);
		}
		// Remove current selection
		const start = inputElement.selectionStart;
		const end = inputElement.selectionEnd;
		let currentValue = inputElement.value.substring(0, start) + inputElement.value.substring(end);
		setNativeValue(currentValue);
		inputElement.setSelectionRange(start, start);
		inputElement.dispatchEvent(new Event('input', { bubbles: true }));
		// Type each character using native setter so frameworks pick it up
		for (const ch of textToType) {
			if (ch === '\n') {
				const keydownEnter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
				inputElement.dispatchEvent(keydownEnter);
				const insertPos = inputElement.selectionStart;
				currentValue = inputElement.value;
				const newValue = currentValue.substring(0, insertPos) + '\n' + currentValue.substring(insertPos);
				setNativeValue(newValue);
				const newPos = insertPos + 1;
				inputElement.setSelectionRange(newPos, newPos);
				try {
					const inputEvt = new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak', data: null });
					inputElement.dispatchEvent(inputEvt);
				} catch (e) {
					inputElement.dispatchEvent(new Event('input', { bubbles: true }));
				}
				const keyupEnter = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
				inputElement.dispatchEvent(keyupEnter);
				continue;
			}
			const keydown = new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true });
			inputElement.dispatchEvent(keydown);
			const insertPos = inputElement.selectionStart;
			currentValue = inputElement.value;
			const newValue = currentValue.substring(0, insertPos) + ch + currentValue.substring(insertPos);
			setNativeValue(newValue);
			const newPos = insertPos + ch.length;
			inputElement.setSelectionRange(newPos, newPos);
			try {
				const inputEvt = new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch });
				inputElement.dispatchEvent(inputEvt);
			} catch (e) {
				inputElement.dispatchEvent(new Event('input', { bubbles: true }));
			}
			const keyup = new KeyboardEvent('keyup', { key: ch, bubbles: true, cancelable: true });
			inputElement.dispatchEvent(keyup);
		}
		// Fire change at the end to help forms that read value on change/submit
		inputElement.dispatchEvent(new Event('change', { bubbles: true }));
	}

	// Move focus to the next focusable element to mimic native Tab behavior
	moveFocusToNextElement(current) {
		const candidates = Array.from(document.querySelectorAll('input, textarea, select, button, a[href], [tabindex]'))
			.filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
		const index = candidates.indexOf(current);
		if (index >= 0) {
			const next = candidates[index + 1] || candidates[0];
			next.focus();
		}
	}

    // Save current input when Tab is pressed
    async saveCurrentInput(inputElement) {
        const rawValue = this.getElementTextValue(inputElement);
        if (!rawValue || rawValue.trim().length === 0) return;
        const trimmedValue = rawValue.trim();
        if (!this.suggestions.includes(trimmedValue)) {
            await this.addSuggestion(trimmedValue);
            this.showSaveFeedback();
        }
        // Save individual words in lowercase
        const words = trimmedValue.split(/\s+/);
        for (const word of words) {
            const term = word.toLowerCase();
            if (term.length >= 2 && !this.suggestions.includes(term)) {
                await this.addSuggestion(term);
            }
        }
        // Save lines separately using raw value
        const lines = rawValue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (!this.suggestions.includes(line)) {
                await this.addSuggestion(line);
            }
        }
        // Save phrases (patterns) from trimmed
        const phrases = this.extractPhrases(trimmedValue);
        for (const phrase of phrases) {
            if (phrase.length >= 3 && !this.suggestions.includes(phrase)) {
                await this.addSuggestion(phrase);
            }
        }
    }

    // Save data only when Tab is pressed (for suggestions)
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
        // Save individual words in lowercase
        const words = trimmedValue.split(/\s+/);
        for (const word of words) {
            const term = word.toLowerCase();
            if (term.length >= 2 && !this.suggestions.includes(term)) {
                await this.addSuggestion(term);
            }
        }
        // Save lines from raw value
        const lines = rawValue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (!this.suggestions.includes(line)) {
                await this.addSuggestion(line);
            }
        }
        // Save phrases
        const phrases = this.extractPhrases(trimmedValue);
        for (const phrase of phrases) {
            if (phrase.length >= 3 && !this.suggestions.includes(phrase)) {
                await this.addSuggestion(phrase);
            }
        }
    }

    // Show visual feedback when something is saved
    showSaveFeedback() {
        // Purged green blinking; keep silent to avoid visual noise
        return;
    }

    // Extract meaningful phrases from text
    extractPhrases(text) {
        const phrases = [];
        
        // Extract common patterns
        const patterns = [
            /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, // CamelCase words
            /[a-z]+(?:_[a-z]+)+/g, // snake_case
            /[a-z]+(?:\-[a-z]+)+/g, // kebab-case
            /[A-Z]+(?:_[A-Z]+)+/g, // UPPER_SNAKE_CASE
            /[A-Z][a-z]+(?:\-[A-Z][a-z]+)*/g, // PascalCase
        ];
        
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                phrases.push(...matches);
            }
        });
        
        // Extract quoted strings
        const quotedMatches = text.match(/"([^"]+)"/g);
        if (quotedMatches) {
            phrases.push(...quotedMatches.map(q => q.slice(1, -1)));
        }
        
        return phrases;
    }

    hideSuggestions() {
        this.suggestionBox.style.display = 'none';
        this.isActive = false;
        this.suggestionIndex = -1;
        this.removeGhostHighlight(this.currentInput);
    }

	// Add new suggestions to the global profile
    async addSuggestion(suggestion) {
        if (!this.suggestions.includes(suggestion)) {
            this.suggestions.push(suggestion);
			await this.saveSiteProfile();
            // Show immediate feedback for new suggestions
            this.showSaveFeedback();
        }
    }

	// Delete a suggestion from the global profile (case/whitespace-insensitive)
    async deleteSuggestion(suggestion) {
        const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
        const target = normalize(suggestion);
        const beforeLen = this.suggestions.length;
        this.suggestions = this.suggestions.filter(item => normalize(item) !== target);
        if (this.suggestions.length !== beforeLen) {
            await this.saveSiteProfile();
        }
    }

	// Save the global profile
    async saveSiteProfile() {
		await chrome.storage.local.set({ intellisenseGlobalSuggestions: this.suggestions });
    }

    // Get statistics about the current profile
    getProfileStats() {
        return {
            site: this.currentSite,
            totalSuggestions: this.suggestions.length
        };
    }

    // Helper to read textual value from any editable element
    getElementTextValue(el) {
        if (!el) return '';
        if (el.isContentEditable) {
            // Use innerText to preserve visual line breaks across sites
            return (el.innerText || el.textContent || '');
        }
        return (el.value || '');
    }

    // Escape a string for safe use in RegExp
    escapeRegExp(str) {
        return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Minimal HTML escape for safe innerHTML usage
    escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    }

    // Replace typed text in input/textarea for one or two words
    replaceTypedInInput(element, replacementText, coverTwoWords) {
        const value = element.value || '';
        const caret = element.selectionStart || 0;
        const before = value.substring(0, caret);
        // find current word start
        let i = before.length;
        while (i > 0 && !/\s/.test(before.charAt(i - 1))) i--;
        let start = i;
        if (coverTwoWords) {
            // skip spaces before previous word
            while (start > 0 && /\s/.test(before.charAt(start - 1))) start--;
            // move over previous word
            while (start > 0 && !/\s/.test(before.charAt(start - 1))) start--;
        }
        this.typeTextIntoInput(element, replacementText, start, caret);
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
        range.deleteContents();
        const frag = this.buildMultilineFragment(text);
        range.insertNode(frag);
    }

    getCurrentWord() {
        if (!this.currentInput) return '';
        if (this.currentInput.isContentEditable) {
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
        const value = this.currentInput.value || '';
        const caret = this.currentInput.selectionStart || 0;
        const before = value.substring(0, caret);
        const parts = before.split(/\s+/);
        return parts[parts.length - 1] || '';
    }

    // Compute start index for typed span (prev+current or just current)
    computeTypedSpanStartInInput(input, useTwo) {
        const value = input.value || '';
        const caret = input.selectionStart || 0;
        let i = caret;
        // find start of current token
        while (i > 0 && !/\s/.test(value.charAt(i - 1))) i--;
        let currentStart = i;
        if (!useTwo) return currentStart;
        // skip spaces before previous token
        while (i > 0 && /\s/.test(value.charAt(i - 1))) i--;
        // find start of previous token
        while (i > 0 && !/\s/.test(value.charAt(i - 1))) i--;
        return i;
    }

    replacePrefixInInput(input, useTwo, replacementText) {
        const caret = input.selectionStart || 0;
        const start = this.computeTypedSpanStartInInput(input, useTwo);
        this.typeTextIntoInput(input, replacementText, start, caret);
    }

    // Replacement using suffix match to cover prev+current tokens reliably (inputs/textareas)
    replacePrefixInInputBySuffix(input, twoWordPrefixOrNull, replacementText) {
        const value = input.value || '';
        const caret = input.selectionStart || 0;
        const before = value.substring(0, caret);
        const beforeLower = before.toLowerCase();
        let start = caret;
        if (twoWordPrefixOrNull) {
            const prefLower = twoWordPrefixOrNull.toLowerCase();
            const idx = beforeLower.lastIndexOf(prefLower);
            if (idx !== -1 && idx + prefLower.length === beforeLower.length) {
                start = idx;
            } else {
                // Fallback to token-based two-word
                start = this.computeTypedSpanStartInInput(input, true);
            }
        } else {
            // single word suffix
            const current = this.getCurrentWord();
            const curLower = current.toLowerCase();
            const idx = beforeLower.lastIndexOf(curLower);
            if (idx !== -1 && idx + curLower.length === beforeLower.length) {
                start = idx;
            } else {
                start = this.computeTypedSpanStartInInput(input, false);
            }
        }
        this.typeTextIntoInput(input, replacementText, start, caret);
    }

    // Helpers for contenteditable standard replacement
    getContentEditableInfo(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let text = '';
        const nodes = [];
        while (walker.nextNode()) {
            const n = walker.currentNode;
            const t = n.textContent || '';
            nodes.push({ node: n, start: text.length, end: text.length + t.length });
            text += t;
        }
        const sel = window.getSelection();
        let caretOffset = 0;
        if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            const anchor = r.startContainer;
            const offset = r.startOffset;
            const entry = nodes.find(en => en.node === anchor);
            if (entry) caretOffset = entry.start + offset;
        }
        return { text, nodes, caretOffset };
    }

    findTypedSpanStartInText(text, caretOffset, useTwo) {
        // find start of current token
        let i = caretOffset;
        while (i > 0 && !/\s/.test(text.charAt(i - 1))) i--;
        let currentStart = i;
        if (!useTwo) return currentStart;
        // skip spaces
        while (i > 0 && /\s/.test(text.charAt(i - 1))) i--;
        // find start of previous token
        while (i > 0 && !/\s/.test(text.charAt(i - 1))) i--;
        return i;
    }

    buildRangeForOffsets(root, nodes, start, end) {
        const range = document.createRange();
        const findPos = (pos) => {
            for (const en of nodes) {
                if (pos <= en.end) {
                    const local = Math.max(0, pos - en.start);
                    return { container: en.node, offset: local };
                }
            }
            const last = nodes[nodes.length - 1];
            return { container: last.node, offset: (last.node.textContent || '').length };
        };
        const s = findPos(start);
        const e = findPos(end);
        range.setStart(s.container, s.offset);
        range.setEnd(e.container, e.offset);
        return range;
    }

    replacePrefixInContentEditable(root, useTwo, replacementText) {
        const { text, nodes, caretOffset } = this.getContentEditableInfo(root);
        const start = this.findTypedSpanStartInText(text, caretOffset, useTwo);
        const end = caretOffset;
        const range = this.buildRangeForOffsets(root, nodes, start, end);
        this.insertTextFragmentAtRange(range, replacementText);
        const sel = window.getSelection();
        if (sel) {
            sel.removeAllRanges();
            const after = document.createRange();
            if (range.endContainer) {
                after.setStart(range.endContainer, range.endOffset);
                after.collapse(true);
                sel.addRange(after);
            }
        }
        root.dispatchEvent(new Event('input', { bubbles: true }));
        root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Replacement using suffix match for contenteditable
    replacePrefixInContentEditableBySuffix(root, twoWordPrefixOrNull, replacementText) {
        const { text, nodes, caretOffset } = this.getContentEditableInfo(root);
        const lower = text.toLowerCase();
        let start = caretOffset;
        if (twoWordPrefixOrNull) {
            const prefLower = twoWordPrefixOrNull.toLowerCase();
            const idx = lower.lastIndexOf(prefLower, caretOffset);
            if (idx !== -1 && idx + prefLower.length === caretOffset) {
                start = idx;
            } else {
                start = this.findTypedSpanStartInText(text, caretOffset, true);
            }
        } else {
            // single
            // find current token
            let i = caretOffset;
            while (i > 0 && !/\s/.test(text.charAt(i - 1))) i--;
            start = i;
        }
        const end = caretOffset;
        const range = this.buildRangeForOffsets(root, nodes, start, end);
        this.insertTextFragmentAtRange(range, replacementText);
        const sel = window.getSelection();
        if (sel) {
            sel.removeAllRanges();
            const after = document.createRange();
            if (range.endContainer) {
                after.setStart(range.endContainer, range.endOffset);
                after.collapse(true);
                sel.addRange(after);
            }
        }
        root.dispatchEvent(new Event('input', { bubbles: true }));
        root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Compute span covering previous token + single space(s) + current token, ending at caret.
    // If there is no previous token, returns current token span only.
    computePrevAndCurrentTokenSpan(fullText, caretOffset) {
        const text = String(fullText);
        let end = caretOffset;
        // current token start
        let curStart = end;
        while (curStart > 0 && !/\s/.test(text.charAt(curStart - 1))) curStart--;
        // skip spaces before previous token
        let i = curStart;
        while (i > 0 && /\s/.test(text.charAt(i - 1))) i--;
        // previous token start
        let prevStart = i;
        while (prevStart > 0 && !/\s/.test(text.charAt(prevStart - 1))) prevStart--;
        // Determine if we truly have two tokens: previous token exists and directly precedes current separated only by spaces
        const hasPrev = prevStart < i;
        const start = hasPrev ? prevStart : curStart;
        return { start, end };
    }
}

// Add CSS animations for the content script
const style = document.createElement('style');
style.textContent = `
    @keyframes content-intellisense-pulse {
        0% {
            border-color: rgba(76, 175, 80, 0.3);
            background: rgba(76, 175, 80, 0.1);
        }
        50% {
            border-color: rgba(76, 175, 80, 0.6);
            background: rgba(76, 175, 80, 0.2);
        }
        100% {
            border-color: rgba(76, 175, 80, 0.3);
            background: rgba(76, 175, 80, 0.1);
        }
    }

    #content-intellisense-suggestions .suggestion-item strong { color: #4CAF50; font-weight: bold; }
`;
if (!document.getElementById('content-intellisense-style')) {
    style.id = 'content-intellisense-style';
    document.head.appendChild(style);
}

// Initialize the content intellisense system
window.contentIntellisenseSystem = new ContentIntellisenseSystem();
