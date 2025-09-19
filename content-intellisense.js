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
            if (prefix.length >= 3) this._multiWordPrefix = prefix;
        }
        this.checkGhostHighlighting(e.target, currentWord);
        if (currentWord.length >= 2) {
            this.showSuggestions(currentWord, e.target);
        } else {
            this.hideSuggestions();
        }
    }

	checkGhostHighlighting(inputElement, currentWord) {
        if (currentWord.length < 2) {
            this.removeGhostHighlight(inputElement);
			this.bestHint = '';
            return;
        }

        // Find matching saved suggestions
        const matchingSuggestions = this.suggestions.filter(suggestion =>
            suggestion.toLowerCase().startsWith(currentWord.toLowerCase())
        );

		if (matchingSuggestions.length > 0) {
            // Get the best match (first one that starts with the current word)
			const bestMatch = matchingSuggestions[0];
			this.bestHint = bestMatch;
			this.showGhostHighlight(inputElement, currentWord, bestMatch);
        } else {
			this.removeGhostHighlight(inputElement);
			this.bestHint = '';
        }
    }

	showGhostHighlight(inputElement, currentWord, fullSuggestion) {
        // Remove existing ghost highlight
        this.removeGhostHighlight(inputElement);
        
        // Create ghost text element
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
        
        // Position the ghost text at the caret position for any editable element
        const caretRect = this.getCaretClientRect(inputElement);
        ghostText.style.left = caretRect.left + 'px';
        ghostText.style.top = caretRect.top + 'px';
        
        // Set the ghost text content (only the part that extends beyond current word)
        const remainingText = fullSuggestion.substring(currentWord.length);
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
			}

			if (this.bestHint && this.currentInput) {
				e.preventDefault();
				e.stopPropagation();
				this.replaceCurrentWordWith(this.currentInput, this.bestHint);
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
    replaceCurrentWordWith(element, replacementText) {
        if (!element) return;
        if (element.isContentEditable) {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            let range = sel.getRangeAt(0);
            // Ensure we operate on a text node
            let node = range.startContainer;
            let offset = range.startOffset;
            if (node.nodeType !== Node.TEXT_NODE) {
                // Try to find nearest text node
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
            // Find word boundaries
            let wordStart = offset;
            let wordEnd = offset;
            while (wordStart > 0 && !/\s/.test(text.charAt(wordStart - 1))) wordStart--;
            while (wordEnd < text.length && !/\s/.test(text.charAt(wordEnd))) wordEnd++;
            // Delete current word
            const pre = document.createTextNode(text.substring(0, wordStart));
            const post = document.createTextNode(text.substring(wordEnd));
            const parent = node.parentNode;
            if (!parent) return;
            parent.insertBefore(pre, node);
            parent.insertBefore(post, node.nextSibling);
            parent.removeChild(node);
            // Build fragment with line breaks
            const fragment = document.createDocumentFragment();
            const parts = String(replacementText).split(/\r?\n/);
            parts.forEach((part, idx) => {
                fragment.appendChild(document.createTextNode(part));
                if (idx < parts.length - 1) fragment.appendChild(document.createElement('br'));
            });
            parent.insertBefore(fragment, post);
            // Place caret after inserted content
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
        const qLower = query.toLowerCase();
        const mwLower = (this._multiWordPrefix || '').toLowerCase();
        // Base: starts with current word
        let set = new Map();
        for (const s of this.suggestions) {
            const sl = String(s).toLowerCase();
            if (sl.startsWith(qLower)) set.set(s, 'single');
        }
        // Also include multi-word prefix matches when available
        if (mwLower) {
            for (const s of this.suggestions) {
                const sl = String(s).toLowerCase();
                if (sl.startsWith(mwLower)) set.set(s, 'multi');
            }
        }
        let filteredSuggestions = Array.from(set.keys());
        if (filteredSuggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        // Prioritize: if at line start prefer multi-word; otherwise still put multi prefix matches on top
        if (mwLower) {
            filteredSuggestions.sort((a, b) => {
                const al = String(a).toLowerCase();
                const bl = String(b).toLowerCase();
                const aMulti = al.startsWith(mwLower);
                const bMulti = bl.startsWith(mwLower);
                if (aMulti !== bMulti) return aMulti ? -1 : 1;
                // then shorter first to show tighter matches
                return a.length - b.length;
            });
        } else if (this._atLineStart) {
            filteredSuggestions.sort((a, b) => {
                const aMulti = /\s/.test(a);
                const bMulti = /\s/.test(b);
                if (aMulti !== bMulti) return aMulti ? -1 : 1;
                return a.length - b.length;
            });
        }
        filteredSuggestions = filteredSuggestions.slice(0, 10);
        this.suggestionIndex = -1;
        this.renderSuggestions(filteredSuggestions, query, this._multiWordPrefix);
        this.positionSuggestionBox(inputElement);
        this.isActive = true;
    }

    renderSuggestions(suggestions, query) {
        this.suggestionBox.innerHTML = '';
    
        // keep strong contrast and top layer
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
    
            // Accept on pointerdown only when the target is NOT the remove button
            item.addEventListener('pointerdown', (ev) => {
                // if the original click was on the × button or inside it, do nothing here
                if (ev.target && ev.target.closest('.suggestion-remove')) {
                    return; // let the button's own handler run
                }
                ev.preventDefault();
                ev.stopPropagation();
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
    
            // Safe delete (×) button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'suggestion-remove';   // <- used by the guard above
            closeBtn.type = 'button';
            closeBtn.textContent = '×';
            closeBtn.title = 'Remove suggestion';
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
    
            // Don’t let the button trigger parent handlers or blur the input
            closeBtn.addEventListener('pointerdown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
            }, true);
            closeBtn.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
            }, true);
    
            closeBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
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
        if (!items.length) return;
    
        const selectedItem = items[this.suggestionIndex];
        // Pull the true value; fall back to span text if dataset missing
        const selectedSuggestion =
            (selectedItem && selectedItem.dataset && selectedItem.dataset.value) ||
            (selectedItem.querySelector('.suggestion-text')?.textContent || '');
    
        if (this.currentInput.isContentEditable) {
            this.replaceCurrentWordWith(this.currentInput, selectedSuggestion);
            this.hideSuggestions();
            this.removeGhostHighlight(this.currentInput);
            this.saveOnTabPress(this.getElementTextValue(this.currentInput), selectedSuggestion);
            return;
        }
    
        const value = this.currentInput.value || '';
        const cursorPosition = this.currentInput.selectionStart || 0;
        const beforeCursor = value.substring(0, cursorPosition);
        const words = beforeCursor.split(/\s+/);
        const currentWord = words[words.length - 1] || '';
        const replaceStart = Math.max(0, beforeCursor.length - currentWord.length);
        const replaceEnd = cursorPosition;
    
        this.typeTextIntoInput(this.currentInput, selectedSuggestion, replaceStart, replaceEnd);
    
        this.hideSuggestions();
        this.removeGhostHighlight(this.currentInput);
        this.saveOnTabPress(this.getElementTextValue(this.currentInput), selectedSuggestion);
    
        // ensure any listeners update
        this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
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
        if (this.currentInput) {
            // Create a green flash effect
            const originalBorder = this.currentInput.style.border;
            const originalBackground = this.currentInput.style.backgroundColor;
            
            this.currentInput.style.border = '2px solid #4CAF50';
            this.currentInput.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
            
            setTimeout(() => {
                this.currentInput.style.border = originalBorder;
                this.currentInput.style.backgroundColor = originalBackground;
            }, 300);
        }
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

	// Delete a suggestion from the global profile
    async deleteSuggestion(suggestion) {
        const idx = this.suggestions.indexOf(suggestion);
        if (idx !== -1) {
            this.suggestions.splice(idx, 1);
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
