// Keyboard component for MIDI note playing
export class KeyboardManager {
    constructor() {
        this.keyboardMap = new Map();
        this.tooltip = null;
        this.init();
    }
    
    init() {
        this.createTooltip();
        this.setupKeyboardMapping();
        this.setupEventListeners();
    }
    
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'keyboard-tooltip';
        this.tooltip.className = 'keyboard-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }
    
    setupKeyboardMapping() {
        // Standard QWERTY keyboard mapping to MIDI notes
        this.keyboardMap.set('KeyZ', 60); // C4
        this.keyboardMap.set('KeyS', 61); // C#4
        this.keyboardMap.set('KeyX', 62); // D4
        this.keyboardMap.set('KeyD', 63); // D#4
        this.keyboardMap.set('KeyC', 64); // E4
        this.keyboardMap.set('KeyV', 65); // F4
        this.keyboardMap.set('KeyG', 66); // F#4
        this.keyboardMap.set('KeyB', 67); // G4
        this.keyboardMap.set('KeyH', 68); // G#4
        this.keyboardMap.set('KeyN', 69); // A4
        this.keyboardMap.set('KeyJ', 70); // A#4
        this.keyboardMap.set('KeyM', 71); // B4
        
        // Second octave
        this.keyboardMap.set('Comma', 72); // C5
        this.keyboardMap.set('KeyL', 73); // C#5
        this.keyboardMap.set('Period', 74); // D5
        this.keyboardMap.set('Semicolon', 75); // D#5
        this.keyboardMap.set('Slash', 76); // E5
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });
        
        // Hide tooltip when clicking outside
        document.addEventListener('click', () => {
            this.hideTooltip();
        });
    }
    
    handleKeyDown(e) {
        // Ignore keyboard shortcuts when typing in input fields
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
            return;
        }
        
        const noteNumber = this.keyboardMap.get(e.code);
        if (noteNumber && !e.repeat) {
            this.playNote(noteNumber);
            this.showKeyTooltip(e, noteNumber);
        }
    }
    
    handleKeyUp(e) {
        // Ignore keyboard shortcuts when typing in input fields
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
            return;
        }
        
        const noteNumber = this.keyboardMap.get(e.code);
        if (noteNumber) {
            this.stopNote(noteNumber);
            this.hideTooltip();
        }
    }
    
    playNote(noteNumber) {
        // Import appState to access MIDI functionality
        import('../core/state.js').then(({ appState }) => {
            if (appState.globalMIDIState.enabled && appState.globalMIDIState.selectedOutput) {
                const noteOn = [0x90, noteNumber, 127]; // Channel 1, note, velocity
                appState.globalMIDIState.selectedOutput.send(noteOn);
            }
        });
    }
    
    stopNote(noteNumber) {
        // Import appState to access MIDI functionality
        import('../core/state.js').then(({ appState }) => {
            if (appState.globalMIDIState.enabled && appState.globalMIDIState.selectedOutput) {
                const noteOff = [0x80, noteNumber, 0]; // Channel 1, note, velocity
                appState.globalMIDIState.selectedOutput.send(noteOff);
            }
        });
    }
    
    showKeyTooltip(event, noteNumber) {
        if (!this.tooltip) return;
        
        const noteName = this.getNoteName(noteNumber);
        const keyName = this.getKeyName(event.code);
        
        this.tooltip.innerHTML = `
            <img src="assets/kbd.svg" alt="keyboard" width="16" height="16">
            <span>${keyName} → ${noteName}</span>
        `;
        
        this.tooltip.style.display = 'flex';
        
        // Position tooltip near the cursor
        const rect = event.target.getBoundingClientRect();
        this.tooltip.style.left = `${event.clientX + 10}px`;
        this.tooltip.style.top = `${event.clientY - 30}px`;
    }
    
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }
    
    getNoteName(noteNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const note = noteNames[noteNumber % 12];
        return `${note}${octave}`;
    }
    
    getKeyName(keyCode) {
        const keyMap = {
            'KeyZ': 'Z',
            'KeyS': 'S',
            'KeyX': 'X',
            'KeyD': 'D',
            'KeyC': 'C',
            'KeyV': 'V',
            'KeyG': 'G',
            'KeyB': 'B',
            'KeyH': 'H',
            'KeyN': 'N',
            'KeyJ': 'J',
            'KeyM': 'M',
            'Comma': ',',
            'KeyL': 'L',
            'Period': '.',
            'Semicolon': ';',
            'Slash': '/'
        };
        return keyMap[keyCode] || keyCode;
    }
    
    // Method to highlight a note on the virtual keyboard
    highlightNote(noteNumber, highlight = true) {
        const noteElement = document.querySelector(`[data-note="${noteNumber}"]`);
        if (noteElement) {
            if (highlight) {
                noteElement.classList.add('keyboard-highlight');
            } else {
                noteElement.classList.remove('keyboard-highlight');
            }
        }
    }
    
    // Method to create a virtual keyboard display
    createVirtualKeyboard(container) {
        const keyboardHTML = `
            <div class="virtual-keyboard">
                <div class="keyboard-octave">
                    ${this.generateKeyboardKeys(60, 71)} <!-- C4 to B4 -->
                </div>
                <div class="keyboard-octave">
                    ${this.generateKeyboardKeys(72, 83)} <!-- C5 to B5 -->
                </div>
            </div>
        `;
        
        container.innerHTML = keyboardHTML;
        
        // Add click handlers for virtual keys
        container.querySelectorAll('.keyboard-key').forEach(key => {
            key.addEventListener('mousedown', (e) => {
                const noteNumber = parseInt(e.target.getAttribute('data-note'));
                this.playNote(noteNumber);
                this.highlightNote(noteNumber, true);
            });
            
            key.addEventListener('mouseup', (e) => {
                const noteNumber = parseInt(e.target.getAttribute('data-note'));
                this.stopNote(noteNumber);
                this.highlightNote(noteNumber, false);
            });
            
            key.addEventListener('mouseleave', (e) => {
                const noteNumber = parseInt(e.target.getAttribute('data-note'));
                this.stopNote(noteNumber);
                this.highlightNote(noteNumber, false);
            });
        });
    }
    
    generateKeyboardKeys(startNote, endNote) {
        let keysHTML = '';
        for (let note = startNote; note <= endNote; note++) {
            const noteName = this.getNoteName(note);
            const isBlackKey = this.isBlackKey(note);
            const keyClass = `keyboard-key ${isBlackKey ? 'black-key' : 'white-key'}`;
            
            keysHTML += `
                <div class="${keyClass}" data-note="${note}" title="${noteName}">
                    <span class="key-label">${noteName}</span>
                </div>
            `;
        }
        return keysHTML;
    }
    
    isBlackKey(noteNumber) {
        const note = noteNumber % 12;
        return [1, 3, 6, 8, 10].includes(note); // C#, D#, F#, G#, A#
    }
}

// Create global instance
export const keyboardManager = new KeyboardManager();

// Make it globally available
window.keyboardManager = keyboardManager;
