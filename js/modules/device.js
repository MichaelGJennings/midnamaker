// Device module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { modal } from '../components/modal.js';

export class DeviceManager {
    constructor() {
        this.validationState = 'unvalidated'; // Track validation state: unvalidated, validated, invalid
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Device save button
        const saveBtn = document.getElementById('save-device-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveDevice();
            });
        }
        
        // Device validate button
        const validateBtn = document.getElementById('validate-device-btn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                if (this.validationState === 'invalid') {
                    // Switch to Tools tab and scroll to debug console
                    document.getElementById('nav-tools').click();
                    setTimeout(() => {
                        const debugConsole = document.getElementById('debug-console-output') || document.getElementById('debug-console');
                        if (debugConsole) {
                            debugConsole.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 100);
                } else {
                    this.validateDevice();
                }
            });
        }
    }
    
    loadDeviceTab() {
        if (!appState.selectedDevice) {
            this.showEmptyState();
            return;
        }
        
        this.renderDeviceConfiguration();
    }
    
    showEmptyState() {
        const content = document.getElementById('device-content');
        if (content) {
            content.innerHTML = '<div class="empty-state">Please select a device from the Manufacturer tab</div>';
        }
        
        // Disable action buttons
        const saveBtn = document.getElementById('save-device-btn');
        const validateBtn = document.getElementById('validate-device-btn');
        
        if (saveBtn) saveBtn.disabled = true;
        if (validateBtn) validateBtn.disabled = true;
    }
    
    renderDeviceConfiguration() {
        const content = document.getElementById('device-content');
        if (!content || !appState.currentMidnam) return;
        
        const device = appState.selectedDevice;
        const midnam = appState.currentMidnam;
        
        // Update device title
        const title = document.getElementById('device-title');
        if (title) {
            title.textContent = `${device.name} Configuration`;
        }
        
        // Enable action buttons
        const saveBtn = document.getElementById('save-device-btn');
        const validateBtn = document.getElementById('validate-device-btn');
        
        if (saveBtn) saveBtn.disabled = false;
        if (validateBtn) validateBtn.disabled = false;
        
        // Render device structure
        content.innerHTML = this.generateDeviceStructureHTML(midnam);
        
        // Setup event listeners for device configuration
        this.setupDeviceEventListeners();
        
        // Setup collapsible patch banks
        this.setupCollapsiblePatchBanks();
    }
    
    generateDeviceStructureHTML(midnam) {
        return `
            <div class="structure-editor">
                <div class="device-info-grid">
                    <div class="info-item">
                        <div class="info-label">Device Name</div>
                        <div class="info-value">${Utils.escapeHtml(midnam.deviceName || 'Unknown')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Manufacturer</div>
                        <div class="info-value">${Utils.escapeHtml(midnam.manufacturer || 'Unknown')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Model</div>
                        <div class="info-value">${Utils.escapeHtml(midnam.model || 'Unknown')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Version</div>
                        <div class="info-value">${Utils.escapeHtml(midnam.version || 'Unknown')}</div>
                    </div>
                </div>
                
                ${this.generatePatchListHTML(midnam.patchList || [])}
                ${this.generateControlChangeHTML(midnam.controlChange || [])}
            </div>
        `;
    }
    
    generatePatchListHTML(patchLists) {
        if (!patchLists || patchLists.length === 0) {
            return '<div class="structure-section"><h4>No Patch Lists Found</h4></div>';
        }
        
        return `
            <div class="structure-section">
                <h4>Patch Banks (${patchLists.length})</h4>
                ${patchLists.map((patchList, index) => {
                    // Check if this patch list has MIDI commands
                    const hasMidiCommands = patchList.midi_commands && patchList.midi_commands.length > 0;
                    
                    return `
                    <div class="structure-element collapsible" data-index="${index}">
                        <div class="element-header collapsible-header" onclick="deviceManager.togglePatchBank(${index})">
                            <div class="element-name">
                                <span class="toggle-icon">▼</span>
                                ${Utils.escapeHtml(patchList.name || `Patch Bank ${index + 1}`)}
                                ${hasMidiCommands ? `
                                    <span class="midi-commands-info" title="${this.formatMidiCommandsTooltip(patchList.midi_commands)}">
                                        (CC ${patchList.midi_commands.map(cmd => cmd.control).join(', ')})
                                    </span>
                                ` : ''}
                            </div>
                            <div class="element-actions">
                                ${hasMidiCommands ? `
                                    <button class="btn btn-small btn-secondary" 
                                            onclick="event.stopPropagation(); deviceManager.sendBankSelectMidi(${index})" 
                                            title="Send MIDI commands to select this bank">
                                        Select Bank
                                    </button>
                                ` : ''}
                                <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); deviceManager.editPatchList(${index})">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deviceManager.deletePatchList(${index})">Delete</button>
                            </div>
                        </div>
                        <div class="element-content collapsible-content">
                            ${hasMidiCommands ? `
                                <div class="bank-midi-commands">
                                    <strong>MIDI Commands to Select Bank:</strong>
                                    ${patchList.midi_commands.map(cmd => `
                                        <span class="midi-command-item">CC${cmd.control}=${cmd.value}</span>
                                    `).join(' ')}
                                </div>
                            ` : ''}
                            <p>Patches: ${patchList.patch ? patchList.patch.length : 0}</p>
                            ${patchList.patch && patchList.patch.length > 0 ? `
                                <div class="patch-list-patches">
                                    <h5>Individual Patches:</h5>
                                    ${patchList.patch.map((patch, patchIndex) => `
                                        <div class="patch-item-inline">
                                            <span class="patch-number">${patch.programChange || patchIndex}</span>
                                            <span class="patch-name clickable" onclick="deviceManager.editPatchInList(${index}, ${patchIndex})" title="Click to edit patch">${Utils.escapeHtml(patch.name || `Patch ${patchIndex + 1}`)}</span>
                                            <span class="patch-program-change">PC: ${patch.programChange || patchIndex}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    formatMidiCommandsTooltip(midiCommands) {
        if (!midiCommands || midiCommands.length === 0) return '';
        return midiCommands.map(cmd => `Control ${cmd.control} = ${cmd.value}`).join(', ');
    }
    
    sendBankSelectMidi(patchListIndex) {
        const patchList = appState.currentMidnam?.patchList?.[patchListIndex];
        if (!patchList || !patchList.midi_commands || patchList.midi_commands.length === 0) {
            Utils.showNotification('No MIDI commands found for this bank', 'warning');
            return;
        }
        
        // Check if MIDI is enabled and device selected
        if (!window.midiManager || !window.midiManager.isMIDIEnabled()) {
            Utils.showNotification('MIDI not enabled', 'warning');
            return;
        }
        
        if (!window.midiManager.isDeviceSelected()) {
            Utils.showNotification('No MIDI output device selected', 'warning');
            return;
        }
        
        // Send all MIDI commands for this bank
        let success = true;
        for (const cmd of patchList.midi_commands) {
            if (cmd.type === 'ControlChange') {
                const controller = parseInt(cmd.control);
                const value = parseInt(cmd.value);
                const sent = window.midiManager.sendControlChange(controller, value, 0);
                if (!sent) success = false;
            }
        }
        
        if (success) {
            Utils.showNotification(`Bank "${patchList.name}" selected via MIDI`, 'success');
        } else {
            Utils.showNotification('Failed to send some MIDI commands', 'error');
        }
    }
    
    generateNoteListHTML(noteLists) {
        if (!noteLists || noteLists.length === 0) {
            return '<div class="structure-section"><h4>No Note Lists Found</h4></div>';
        }
        
        return `
            <div class="structure-section">
                <h4>Note Lists (${noteLists.length})</h4>
                ${noteLists.map((noteList, index) => `
                    <div class="structure-element">
                        <div class="element-header">
                            <div class="element-name">${Utils.escapeHtml(noteList.name || `Note List ${index + 1}`)}</div>
                            <div class="element-actions">
                                <button class="btn btn-small btn-primary" onclick="deviceManager.editNoteList(${index})">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="deviceManager.deleteNoteList(${index})">Delete</button>
                            </div>
                        </div>
                        <div class="element-content">
                            <p>Notes: ${noteList.note ? noteList.note.length : 0}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    generateControlChangeHTML(controlChanges) {
        if (!controlChanges || controlChanges.length === 0) {
            return '<div class="structure-section"><h4>No Control Changes Found</h4></div>';
        }
        
        return `
            <div class="structure-section">
                <h4>Control Changes (${controlChanges.length})</h4>
                ${controlChanges.map((controlChange, index) => `
                    <div class="structure-element">
                        <div class="element-header">
                            <div class="element-name">${Utils.escapeHtml(controlChange.name || `Control Change ${index + 1}`)}</div>
                            <div class="element-actions">
                                <button class="btn btn-small btn-primary" onclick="deviceManager.editControlChange(${index})">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="deviceManager.deleteControlChange(${index})">Delete</button>
                            </div>
                        </div>
                        <div class="element-content">
                            <p>Controller: ${controlChange.controller || 'Unknown'}</p>
                            <p>Value: ${controlChange.value || 'Unknown'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    setupDeviceEventListeners() {
        // Add any specific event listeners for device configuration
        // This will be called after rendering the device structure
    }
    
    setupCollapsiblePatchBanks() {
        // Initialize all patch banks as expanded
        const patchBanks = document.querySelectorAll('.structure-element.collapsible');
        patchBanks.forEach(bank => {
            bank.classList.add('expanded');
        });
    }
    
    togglePatchBank(index) {
        const patchBank = document.querySelector(`.structure-element.collapsible[data-index="${index}"]`);
        if (!patchBank) return;
        
        const icon = patchBank.querySelector('.toggle-icon');
        const content = patchBank.querySelector('.collapsible-content');
        
        if (patchBank.classList.contains('expanded')) {
            // Collapse
            patchBank.classList.remove('expanded');
            patchBank.classList.add('collapsed');
            if (icon) icon.textContent = '▶';
            if (content) content.style.display = 'none';
        } else {
            // Expand
            patchBank.classList.remove('collapsed');
            patchBank.classList.add('expanded');
            if (icon) icon.textContent = '▼';
            if (content) content.style.display = 'block';
        }
    }
    
    async saveDevice() {
        // Currently, we only support saving patch changes
        // If a patch is being edited, delegate to the patch manager
        if (appState.selectedPatch && window.patchManager && window.patchManager.savePatch) {
            this.logToDebugConsole('Device save: delegating to patch save', 'info');
            await window.patchManager.savePatch();
            return;
        }
        
        // Future: Add device-level save functionality here
        // For now, just show a message if no patch is selected
        if (appState.pendingChanges.hasUnsavedChanges) {
            this.logToDebugConsole('Device save: no patch selected but changes detected', 'warning');
            Utils.showNotification('Please select a patch to save changes', 'warning');
        } else {
            Utils.showNotification('No changes to save', 'info');
        }
    }
    
    async validateDevice() {
        // Check if there are unsaved changes
        if (appState.pendingChanges.hasUnsavedChanges) {
            Utils.showNotification('Please save your changes before validating', 'warning');
            this.logToDebugConsole('Validation failed: unsaved changes detected', 'error');
            return;
        }
        
        // Check if we have a device loaded
        if (!appState.selectedDevice || !appState.currentMidnam) {
            Utils.showNotification('No device loaded', 'warning');
            return;
        }
        
        // Get the file path from the selected device
        const filePath = appState.selectedDevice.file_path || appState.currentMidnam.file_path;
        
        if (!filePath) {
            Utils.showNotification('Cannot determine file path for validation', 'error');
            this.logToDebugConsole('Validation failed: no file path available', 'error');
            return;
        }
        
        this.logToDebugConsole(`Starting validation for: ${filePath}`, 'info');
        
        try {
            const response = await fetch('/api/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_path: filePath
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Validation request failed: ${errorText}`);
            }
            
            const validationResult = await response.json();
            
            if (validationResult.valid) {
                this.setValidationState('validated');
                this.logToDebugConsole('✓ Validation PASSED', 'success');
                this.logToDebugConsole(validationResult.message, 'success');
                Utils.showNotification('File validated successfully', 'success');
            } else {
                this.setValidationState('invalid');
                this.logToDebugConsole('✗ Validation FAILED', 'error');
                this.logToDebugConsole(`Found ${validationResult.errors.length} error(s):`, 'error');
                
                // Log each error to debug console
                validationResult.errors.forEach((error, index) => {
                    this.logToDebugConsole(
                        `  Error ${index + 1}: Line ${error.line}, Column ${error.column} - ${error.message}`,
                        'error'
                    );
                });
                
                Utils.showNotification('Validation failed - see debug console', 'error');
            }
        } catch (error) {
            console.error('Error validating file:', error);
            this.logToDebugConsole(`Validation error: ${error.message}`, 'error');
            Utils.showNotification('Failed to validate file', 'error');
        }
    }
    
    setValidationState(state) {
        this.validationState = state;
        const validateBtn = document.getElementById('validate-device-btn');
        
        if (!validateBtn) return;
        
        // Remove all state classes
        validateBtn.classList.remove('btn-validated', 'btn-invalid');
        
        switch (state) {
            case 'validated':
                validateBtn.textContent = 'Validated';
                validateBtn.disabled = true;
                validateBtn.classList.add('btn-validated');
                validateBtn.title = 'File has been validated against the .midnam specification';
                break;
                
            case 'invalid':
                validateBtn.textContent = 'invalid';
                validateBtn.disabled = false;
                validateBtn.classList.add('btn-invalid');
                validateBtn.title = 'This .midnam file failed validation. Click to view the validation log in the debug console.';
                break;
                
            case 'unvalidated':
            default:
                validateBtn.textContent = 'Validate';
                validateBtn.disabled = appState.pendingChanges.hasUnsavedChanges;
                validateBtn.title = 'Validate the saved file against the .midnam file specification.';
                break;
        }
    }
    
    logToDebugConsole(message, type = 'info') {
        if (window.toolsManager && window.toolsManager.logToDebugConsole) {
            window.toolsManager.logToDebugConsole(message, type);
        }
    }
    
    editPatchList(index) {
        // Implementation for editing patch list
        Utils.showNotification('Patch list editing will be implemented', 'info');
    }
    
    editPatchInList(patchListIndex, patchIndex) {
        // Switch to patch tab and edit the specific patch
        if (window.tabManager) {
            window.tabManager.switchTab('patch');
        }
        
        // Set the selected patch list and patch
        if (window.patchManager) {
            window.patchManager.selectPatchList(patchListIndex);
            window.patchManager.editPatch(patchIndex);
        }
        
        Utils.showNotification(`Editing patch ${patchIndex + 1} in patch list ${patchListIndex + 1}`, 'info');
    }
    
    deletePatchList(index) {
        modal.confirm('Are you sure you want to delete this patch list?', 'Delete Patch List')
            .then(confirmed => {
                if (confirmed) {
                    // Delete patch list logic
                    Utils.showNotification('Patch list deleted', 'success');
                }
            });
    }
    
    editNoteList(index) {
        // Implementation for editing note list
        Utils.showNotification('Note list editing will be implemented', 'info');
    }
    
    deleteNoteList(index) {
        modal.confirm('Are you sure you want to delete this note list?', 'Delete Note List')
            .then(confirmed => {
                if (confirmed) {
                    // Delete note list logic
                    Utils.showNotification('Note list deleted', 'success');
                }
            });
    }
    
    editControlChange(index) {
        // Implementation for editing control change
        Utils.showNotification('Control change editing will be implemented', 'info');
    }
    
    deleteControlChange(index) {
        modal.confirm('Are you sure you want to delete this control change?', 'Delete Control Change')
            .then(confirmed => {
                if (confirmed) {
                    // Delete control change logic
                    Utils.showNotification('Control change deleted', 'success');
                }
            });
    }
    
    // Method to refresh device data
    async refreshDevice() {
        if (!appState.selectedDevice) return;
        
        await this.loadDeviceDetails(appState.selectedDevice);
    }
    
    // Method to get device statistics
    getDeviceStats() {
        if (!appState.currentMidnam) return null;
        
        const midnam = appState.currentMidnam;
        return {
            patchLists: midnam.patchList ? midnam.patchList.length : 0,
            noteLists: midnam.noteList ? midnam.noteList.length : 0,
            controlChanges: midnam.controlChange ? midnam.controlChange.length : 0,
            totalPatches: midnam.patchList ? 
                midnam.patchList.reduce((sum, pl) => sum + (pl.patch ? pl.patch.length : 0), 0) : 0
        };
    }
}

// Create global instance
export const deviceManager = new DeviceManager();

// Make it globally available
window.deviceManager = deviceManager;

