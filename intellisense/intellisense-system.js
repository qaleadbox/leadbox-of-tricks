// intellisense-system.js
class IntellisenseSystem {
    constructor() {
        this.currentSite = '';
        this.suggestions = [];
        this.currentInput = null;
        this.suggestionIndex = -1;
        this.isActive = false;
        this.suggestionBox = null;
		this.bestHint = '';
        this.init();
    }

    async init() {
		await this.loadCurrentSite();
        this.createSuggestionBox();
        this.createOverlay();
        this.bindEvents();
		this.loadSiteProfile();
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async loadCurrentSite() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentSite = tab.url ? new URL(tab.url).hostname.replace('www.', '') : '';
    }

    createSuggestionBox() {
        this.suggestionBox = document.createElement('div');
        this.suggestionBox.id = 'intellisense-suggestions';
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

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'intellisense-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            background: rgba(76, 175, 80, 0.1);
            border: 2px solid rgba(76, 175, 80, 0.3);
            border-radius: 4px;
            pointer-events: none;
            z-index: 9999;
            display: none;
            transition: all 0.2s ease;
        `;
        document.body.appendChild(this.overlay);
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input[type="text"], textarea, input[type="number"], input[type="search"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"]')) {
                this.handleKeydown(e);
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="text"], textarea, input[type="number"], input[type="search"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"]')) {
                this.handleInput(e);
            }
        });

        document.addEventListener('focus', (e) => {
            if (e.target.matches('input[type="text"], textarea, input[type="number"], input[type="search"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"]')) {
                this.showOverlay(e.target);
            }
        }, true);

        document.addEventListener('blur', (e) => {
            if (e.target.matches('input[type="text"], textarea, input[type="number"], input[type="search"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"]')) {
                this.hideOverlay();
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

    showOverlay(inputElement) {
        const rect = inputElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        this.overlay.style.left = (rect.left + scrollLeft) + 'px';
        this.overlay.style.top = (rect.top + scrollTop) + 'px';
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
        this.overlay.style.display = 'block';
    }

    hideOverlay() {
        this.overlay.style.display = 'none';
    }

    handleInput(e) {
        this.currentInput = e.target;
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart;
        
        const beforeCursor = value.substring(0, cursorPosition);
        const words = beforeCursor.split(/\s+/);
        const currentWord = words[words.length - 1] || '';
        
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

        const matchingSuggestions = this.suggestions.filter(suggestion =>
            suggestion.toLowerCase().startsWith(currentWord.toLowerCase())
        );

		if (matchingSuggestions.length > 0) {
			const bestMatch = matchingSuggestions[0];
			this.bestHint = bestMatch;
			this.showGhostHighlight(inputElement, currentWord, bestMatch);
        } else {
			this.removeGhostHighlight(inputElement);
			this.bestHint = '';
        }
    }

	showGhostHighlight(inputElement, currentWord, fullSuggestion) {
        this.removeGhostHighlight(inputElement);
        
        const ghostText = document.createElement('span');
        ghostText.id = 'intellisense-ghost';
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
        
		const rect = inputElement.getBoundingClientRect();
		const computedStyle = window.getComputedStyle(inputElement);
		const paddingLeft = parseFloat(computedStyle.paddingLeft);
		const paddingTop = parseFloat(computedStyle.paddingTop);
		const beforeCursor = inputElement.value.substring(0, inputElement.selectionStart);
		const textWidth = this.measureTextWidth(beforeCursor, computedStyle);
		const left = rect.left + paddingLeft + textWidth;
		ghostText.style.left = left + 'px';
		ghostText.style.top = (rect.top + paddingTop) + 'px';
        
        const remainingText = fullSuggestion.substring(currentWord.length);
        ghostText.textContent = remainingText;
        
        document.body.appendChild(ghostText);
    }

	measureTextWidth(text, computedStyle) {
		const canvas = this._measureCanvas || (this._measureCanvas = document.createElement('canvas'));
		const ctx = canvas.getContext('2d');
		const font = `${computedStyle.fontStyle} ${computedStyle.fontVariant} ${computedStyle.fontWeight} ${computedStyle.fontSize} / ${computedStyle.lineHeight} ${computedStyle.fontFamily}`;
		ctx.font = font;
		return ctx.measureText(text).width;
	}

    removeGhostHighlight(inputElement) {
        const existingGhost = document.getElementById('intellisense-ghost');
        if (existingGhost) {
            existingGhost.remove();
        }
    }

	handleKeydown(e) {
		if (e.key === 'Tab') {
			if (this.bestHint && this.currentInput) {
				e.preventDefault();
				const value = this.currentInput.value;
				const cursorPosition = this.currentInput.selectionStart;
				const beforeCursor = value.substring(0, cursorPosition);
				const words = beforeCursor.split(/\s+/);
				const currentWord = words[words.length - 1] || '';
				const replaceStart = beforeCursor.length - currentWord.length;
				const replaceEnd = cursorPosition;
				this.typeTextIntoInput(this.currentInput, this.bestHint, replaceStart, replaceEnd);
				this.hideSuggestions();
				this.removeGhostHighlight(this.currentInput);
				this.bestHint = '';
				this.moveFocusToNextElement(this.currentInput);
				return;
			}
			return;
		}

		if (!this.isActive || !this.suggestionBox.style.display || this.suggestionBox.style.display === 'none') {
			return;
		}

		switch (e.key) {
            case 'Tab':
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.nextSuggestion();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.previousSuggestion();
                break;
            case 'Escape':
                this.hideSuggestions();
                break;
            case 'Enter':
                if (this.isActive) {
                    e.preventDefault();
                    this.acceptSuggestion();
                }
                break;
        }
    }

    showSuggestions(query, inputElement) {
        const filteredSuggestions = this.suggestions.filter(suggestion =>
            suggestion.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10);

        if (filteredSuggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.suggestionIndex = -1;
        this.renderSuggestions(filteredSuggestions, query);
        this.positionSuggestionBox(inputElement);
        this.isActive = true;
    }

    renderSuggestions(suggestions, query) {
        this.suggestionBox.innerHTML = '';
        
        const qLower = (query || '').toLowerCase();

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                background: ${index === this.suggestionIndex ? '#e8f5e8' : 'white'};
            `;
            
            const textSpan = document.createElement('span');
            const s = String(suggestion);
            if (qLower && s.toLowerCase().startsWith(qLower)) {
                const prefix = s.substring(0, qLower.length);
                const rest = s.substring(qLower.length);
                textSpan.innerHTML = `<strong>${this.escapeHtml(prefix)}</strong>${this.escapeHtml(rest)}`;
            } else {
                textSpan.textContent = s;
            }
            item.appendChild(textSpan);
            
            item.addEventListener('click', () => {
                this.suggestionIndex = index;
                this.acceptSuggestion();
            });
            
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
        
		const selectedSuggestion = items[this.suggestionIndex].textContent;
		const value = this.currentInput.value;
		const cursorPosition = this.currentInput.selectionStart;
		
		const beforeCursor = value.substring(0, cursorPosition);
		const afterCursor = value.substring(cursorPosition);
		const words = beforeCursor.split(/\s+/);
		const currentWord = words[words.length - 1] || '';
		
		const replaceStart = beforeCursor.length - currentWord.length;
		const replaceEnd = cursorPosition;
		this.typeTextIntoInput(this.currentInput, selectedSuggestion, replaceStart, replaceEnd);
        
        this.hideSuggestions();
        this.removeGhostHighlight(this.currentInput);
        
		this.saveOnTabPress(this.currentInput.value, selectedSuggestion);
        
		this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

	typeTextIntoInput(inputElement, textToType, selectionStart, selectionEnd) {
		if (!inputElement) return;
		inputElement.focus();
		const isTextArea = inputElement.tagName === 'TEXTAREA';
		const valueDescriptor = Object.getOwnPropertyDescriptor(isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
		const setNativeValue = valueDescriptor && valueDescriptor.set ? (val) => valueDescriptor.set.call(inputElement, val) : (val) => { inputElement.value = val; };
		if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
			inputElement.setSelectionRange(selectionStart, selectionEnd);
		}
		const start = inputElement.selectionStart;
		const end = inputElement.selectionEnd;
		let currentValue = inputElement.value.substring(0, start) + inputElement.value.substring(end);
		setNativeValue(currentValue);
		inputElement.setSelectionRange(start, start);
		inputElement.dispatchEvent(new Event('input', { bubbles: true }));
		for (const ch of textToType) {
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

    async saveOnTabPress(inputValue, acceptedSuggestion) {
        if (!inputValue || inputValue.trim().length === 0) return;
        
        const trimmedValue = inputValue.trim();
        if (!this.suggestions.includes(trimmedValue)) {
            await this.addSuggestion(trimmedValue);
            this.showSaveFeedback();
        }
        
        if (!this.suggestions.includes(acceptedSuggestion)) {
            await this.addSuggestion(acceptedSuggestion);
        }
        
        const words = trimmedValue.split(/\s+/);
        const phrases = this.extractPhrases(trimmedValue);
        
        for (const word of words) {
            if (word.length >= 2 && !this.suggestions.includes(word)) {
                await this.addSuggestion(word);
            }
        }
        
        for (const phrase of phrases) {
            if (phrase.length >= 3 && !this.suggestions.includes(phrase)) {
                await this.addSuggestion(phrase);
            }
        }
    }



    showSaveFeedback() {
        if (this.currentInput) {
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

    extractPhrases(text) {
        const phrases = [];
        
        const patterns = [
            /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
            /[a-z]+(?:_[a-z]+)+/g,
            /[a-z]+(?:\-[a-z]+)+/g,
            /[A-Z]+(?:_[A-Z]+)+/g,
            /[A-Z][a-z]+(?:\-[A-Z][a-z]+)*/g,
        ];
        
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                phrases.push(...matches);
            }
        });
        
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

    async addSuggestion(suggestion) {
        const v = this.sanitizeText(suggestion);
        if (!v || this.suggestions.includes(v)) return;
        this.suggestions.push(v);
        await this.saveSiteProfile();
        this.showSaveFeedback();
    }
    
    async saveSiteProfile() {
		await chrome.storage.local.set({ intellisenseGlobalSuggestions: this.suggestions });
    }

    async exportSiteProfile() {
		const profile = {
			scope: 'global',
			suggestions: this.suggestions,
			exportDate: new Date().toISOString(),
			version: '1.0'
		};
        
        const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
		a.href = url;
		a.download = `intellisense-profile-global-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async importSiteProfile(profileData) {
        const tryParse = async (txt) => {
            const p = JSON.parse(txt);
            if (Array.isArray(p.suggestions)) {
                this.suggestions = Array.from(new Set(p.suggestions.map(x => this.sanitizeText(x)).filter(Boolean)));
                await this.saveSiteProfile();
                return true;
            }
            return false;
        };
    
        try {
            if (await tryParse(profileData)) return true;
        } catch {}
    
        try {
            const safe = profileData.replace(/[\u0000-\u001F]/g, ch => {
                if (ch === '\n') return '\\n';
                if (ch === '\r') return '\\r';
                if (ch === '\t') return '\\t';
                return '\\u' + ch.charCodeAt(0).toString(16).padStart(4,'0');
            });
            if (await tryParse(safe)) return true;
        } catch {}
    
        const lines = profileData.split(/\r?\n/).map(s => this.sanitizeText(s).trim()).filter(Boolean);
        if (lines.length) {
            this.suggestions = Array.from(new Set([...(this.suggestions||[]), ...lines]));
            await this.saveSiteProfile();
            return true;
        }
        return false;
    }
    
    getProfileStats() {
        return {
            site: this.currentSite,
            totalSuggestions: this.suggestions.length
        };
    }

    escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    }

    sanitizeText(s) {
        return String(s)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    window.intellisenseSystem = new IntellisenseSystem();
});

export { IntellisenseSystem };
