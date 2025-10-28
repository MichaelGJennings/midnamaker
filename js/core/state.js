// Core state management
export class AppState {
    constructor() {
        this.selectedManufacturer = null;
        this.selectedDevice = null;
        this.selectedPatch = null;
        this.selectedPatchBank = null;
        this.selectedBankIndex = null;
        this.midiManufacturers = {};
        this.deviceTypes = {};
        this.currentMidnam = null;
        this.catalog = {}; // Store catalog globally for disambiguation
        
        // Change tracking system
        this.pendingChanges = {
            noteData: new Map(), // Map of patchId -> noteData array
            structuralChanges: new Map(), // Map of changeId -> change object
            hasUnsavedChanges: false,
            lastModified: null
        };
        
        // Global save button IDs to update
        this.saveButtonIds = ['save-device-btn', 'save-patch-btn'];
        
        // Global MIDI state - persistent across tabs
        this.globalMIDIState = {
            access: null,
            selectedOutput: null,
            selectedOutputId: null,
            enabled: false,
            deviceName: null,
            initialized: false
        };
        
        // Legacy variables for compatibility
        this.midiAccess = null;
        this.selectedOutput = null;
        this.selectedOutputId = null;
        this.midiEnabled = false;
        this.patchProgramChanges = {};
    }
    
    // MIDI Utility Functions
    midiNoteToName(noteNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const note = noteNames[noteNumber % 12];
        return `${note}${octave}`;
    }
    
    isBlackKey(noteNumber) {
        const note = noteNumber % 12;
        return [1, 3, 6, 8, 10].includes(note); // C#, D#, F#, G#, A#
    }
    
    // Global MIDI Functions
    syncGlobalMIDIState() {
        // Sync legacy variables with global state
        this.midiAccess = this.globalMIDIState.access;
        this.selectedOutput = this.globalMIDIState.selectedOutput;
        this.selectedOutputId = this.globalMIDIState.selectedOutputId;
        this.midiEnabled = this.globalMIDIState.enabled;
    }
    
    updateGlobalMIDIUI() {
        const midiDot = document.getElementById('midi-dot');
        const midiLabel = document.getElementById('midi-label');
        const midiDeviceInfo = document.getElementById('midi-device-info');
        const midiDeviceSelect = document.getElementById('midi-device-select');
        
        if (!midiDot || !midiLabel || !midiDeviceInfo || !midiDeviceSelect) return;
        
        // Update dot state
        if (this.globalMIDIState.enabled) {
            midiDot.classList.add('enabled');
            midiLabel.textContent = 'MIDI';
            midiDeviceSelect.disabled = false;
        } else {
            midiDot.classList.remove('enabled');
            midiLabel.textContent = 'MIDI';
            midiDeviceSelect.disabled = true;
        }
        
        // Update device info
        if (this.globalMIDIState.enabled && this.globalMIDIState.deviceName) {
            midiDeviceInfo.textContent = `Connected: ${this.globalMIDIState.deviceName}`;
            midiDeviceInfo.classList.add('connected');
        } else {
            midiDeviceInfo.textContent = 'Not connected';
            midiDeviceInfo.classList.remove('connected');
        }
    }
    
    updateMIDIDeviceDropdown() {
        const select = document.getElementById('midi-device-select');
        if (!select || !this.globalMIDIState.enabled || !this.globalMIDIState.access) return;
        
        // Clear existing options and add placeholder
        select.innerHTML = '<option value="">Select a MIDI Device</option>';
        
        // Add available OUTPUT devices with stable IDs
        const outputs = Array.from(this.globalMIDIState.access.outputs.values());
        outputs.forEach((output) => {
            const option = document.createElement('option');
            option.value = output.id; // stable ID, not index
            option.textContent = output.name;
            select.appendChild(option);
        });
        
        // Reflect current selection by ID
        if (this.globalMIDIState.selectedOutputId) {
            select.value = this.globalMIDIState.selectedOutputId;
        }
    }
    
    async toggleMIDI() {
        const midiDeviceInfo = document.getElementById('midi-device-info');
        if (!navigator.requestMIDIAccess) {
            if (midiDeviceInfo) {
                midiDeviceInfo.textContent = 'WebMIDI not supported. Use Chrome/Edge or enable in Safari.';
                midiDeviceInfo.classList.remove('connected');
            }
            return;
        }
        if (this.globalMIDIState.enabled) {
            // Disable MIDI
            this.globalMIDIState.enabled = false;
            this.globalMIDIState.selectedOutput = null;
            this.globalMIDIState.selectedOutputId = null;
            this.globalMIDIState.deviceName = null;
            this.syncGlobalMIDIState();
            this.updateGlobalMIDIUI();
            // MIDI disabled
        } else {
            // Enable MIDI on user gesture
            await this.initializeGlobalMIDI();
            this.updateMIDIDeviceDropdown();
        }
    }
    
    async initializeGlobalMIDI() {
        try {
            // Skip MIDI initialization during testing
            if (window.DISABLE_MIDI_FOR_TESTING) {
                // MIDI initialization skipped for testing
                this.globalMIDIState.enabled = false;
                this.globalMIDIState.initialized = true;
                this.updateGlobalMIDIUI();
                return;
            }
            
            if (!navigator.requestMIDIAccess) {
                console.error('WebMIDI not supported in this browser');
                return;
            }

            this.globalMIDIState.access = await navigator.requestMIDIAccess();
            this.globalMIDIState.enabled = true;
            this.globalMIDIState.initialized = true;
            
            // Don't auto-select devices - let user choose
            this.globalMIDIState.selectedOutput = null;
            this.globalMIDIState.selectedOutputId = null;
            this.globalMIDIState.deviceName = null;
            
            // Listen for device changes
            this.globalMIDIState.access.onstatechange = (event) => {
                this.handleMIDIDeviceChange(event);
            };
            
            this.syncGlobalMIDIState();
            this.updateGlobalMIDIUI();
            this.updateMIDIDeviceDropdown();
            // Global MIDI initialized - no device selected
            
        } catch (error) {
            console.error('Global MIDI initialization failed:', error);
            this.globalMIDIState.enabled = false;
            this.updateGlobalMIDIUI();
        }
    }
    
    selectMIDIDevice() {
        const select = document.getElementById('midi-device-select');
        if (!select || !this.globalMIDIState.enabled || !this.globalMIDIState.access) return;
        
        const selectedId = select.value;
        if (!selectedId) {
            // No device selected
            this.globalMIDIState.selectedOutput = null;
            this.globalMIDIState.selectedOutputId = null;
            this.globalMIDIState.deviceName = null;
            
            // Refresh note display tooltips when MIDI device changes
            // MIDI device deselected, refreshing tooltips
            if (window.patchManager && window.patchManager.refreshAllNoteDisplayTooltips) {
                // Add small delay to ensure state is fully updated
                setTimeout(() => {
                    window.patchManager.refreshAllNoteDisplayTooltips();
                }, 10);
            }
        } else {
            // Device selected by stable ID
            const outputs = Array.from(this.globalMIDIState.access.outputs.values());
            const output = outputs.find(out => out.id === selectedId);
            if (output) {
                this.globalMIDIState.selectedOutput = output;
                this.globalMIDIState.selectedOutputId = output.id;
                this.globalMIDIState.deviceName = output.name;
                
                // Refresh note display tooltips when MIDI device changes
                // MIDI device selected, refreshing tooltips
                if (window.patchManager && window.patchManager.refreshAllNoteDisplayTooltips) {
                    // Add small delay to ensure state is fully updated
                    setTimeout(() => {
                        window.patchManager.refreshAllNoteDisplayTooltips();
                    }, 10);
                }
            } else {
                // Selected device is not currently available
                this.globalMIDIState.selectedOutput = null;
                this.globalMIDIState.selectedOutputId = null;
                this.globalMIDIState.deviceName = null;
                
                // Refresh note display tooltips when MIDI device changes
                // MIDI device not available, refreshing tooltips
                if (window.patchManager && window.patchManager.refreshAllNoteDisplayTooltips) {
                    // Add small delay to ensure state is fully updated
                    setTimeout(() => {
                        window.patchManager.refreshAllNoteDisplayTooltips();
                    }, 10);
                }
            }
        }
        
        this.syncGlobalMIDIState();
        this.updateGlobalMIDIUI();
        console.log('MIDI device selected:', this.globalMIDIState.deviceName);
    }
    
    handleMIDIDeviceChange(event) {
        console.log('MIDI device state changed:', event.port.name, event.port.state);
        
        // If the currently selected device was disconnected, clear selection
        if (event.port.state === 'disconnected' && 
            event.port.id === this.globalMIDIState.selectedOutputId) {
            this.globalMIDIState.selectedOutput = null;
            this.globalMIDIState.selectedOutputId = null;
            this.globalMIDIState.deviceName = null;
            this.syncGlobalMIDIState();
            this.updateGlobalMIDIUI();
            this.updateMIDIDeviceDropdown();
            console.log('Selected MIDI device disconnected');
        } else if (event.port.state === 'connected') {
            // Refresh dropdown to show newly connected device
            this.updateMIDIDeviceDropdown();
        }
    }
    
    // Global save state management
    markAsChanged() {
        this.pendingChanges.hasUnsavedChanges = true;
        this.pendingChanges.lastModified = new Date().toISOString();
        
        // Update all save buttons across all tabs
        this.saveButtonIds.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Save Changes';
                btn.classList.add('btn-warning');
            }
            
            // Also enable the dropdown button
            const dropdownBtnId = btnId.replace('-btn', '-dropdown-btn');
            const dropdownBtn = document.getElementById(dropdownBtnId);
            if (dropdownBtn) {
                dropdownBtn.disabled = false;
                dropdownBtn.classList.add('btn-warning');
            }
        });
        
        // Reset validation state on Device tab
        if (window.deviceManager && window.deviceManager.setValidationState) {
            window.deviceManager.setValidationState('unvalidated');
        }
    }
    
    markAsSaved() {
        this.pendingChanges.hasUnsavedChanges = false;
        this.pendingChanges.lastModified = new Date().toISOString();
        
        // Update all save buttons across all tabs
        this.saveButtonIds.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.textContent = 'Saved';
                btn.classList.remove('btn-warning');
                btn.disabled = true;
            }
            
            // Keep the dropdown button enabled but remove warning state
            const dropdownBtnId = btnId.replace('-btn', '-dropdown-btn');
            const dropdownBtn = document.getElementById(dropdownBtnId);
            if (dropdownBtn) {
                dropdownBtn.disabled = false; // Keep enabled for download access
                dropdownBtn.classList.remove('btn-warning');
            }
        });
        
        // Reset validation state to unvalidated (file has changed, needs revalidation)
        if (window.deviceManager && window.deviceManager.setValidationState) {
            window.deviceManager.setValidationState('unvalidated');
        }
    }
}

// Create global instance
export const appState = new AppState();
