// Device module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { modal } from '../components/modal.js';

export class DeviceManager {
    constructor() {
        this.validationState = 'unvalidated'; // Track validation state: unvalidated, validated, invalid
        this.editingPatchListIndex = null; // Track which patch list is being edited
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
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h4>Patch Banks (${patchLists.length})</h4>
                    <button class="btn btn-sm btn-primary" onclick="deviceManager.addPatchBank()" title="Add new patch bank">+</button>
                </div>
                ${patchLists.map((patchList, index) => {
                    // Check if this patch list has MIDI commands
                    const hasMidiCommands = patchList.midi_commands && patchList.midi_commands.length > 0;
                    
                    return `
                    <div class="structure-element collapsible" data-index="${index}">
                        <div class="element-header collapsible-header" onclick="deviceManager.togglePatchBank(${index})">
                            <div class="element-name">
                                <span class="toggle-icon">▼</span>
                                ${this.editingPatchListIndex === index ? `
                                    <input type="text" 
                                           class="bank-name-input"
                                           value="${Utils.escapeHtml(patchList.name || `Patch Bank ${index + 1}`)}"
                                           onclick="event.stopPropagation()"
                                           onchange="deviceManager.updateBankName(${index}, this.value)"
                                           style="display: inline-block; width: auto; min-width: 200px; margin-right: 10px;">
                                ` : Utils.escapeHtml(patchList.name || `Patch Bank ${index + 1}`)}
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
                                <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); deviceManager.editPatchList(${index})">${this.editingPatchListIndex === index ? 'Done' : 'Edit'}</button>
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
                            ${this.editingPatchListIndex === index ? 
                                this.renderPatchListEditTable(patchList, index) : 
                                `
                                    <p>Patches: ${patchList.patch ? patchList.patch.length : 0}</p>
                                    ${patchList.patch && patchList.patch.length > 0 ? `
                                        <div class="patch-list-patches">
                                            <h5>Individual Patches:</h5>
                                            ${patchList.patch.map((patch, patchIndex) => {
                                                const defaultName = 'Patch ' + (patchIndex + 1);
                                                const patchName = patch.name || defaultName;
                                                const patchNumber = patch.Number !== undefined ? patch.Number : patchIndex;
                                                const programChange = patch.programChange !== undefined ? patch.programChange : patchIndex;
                                                return `
                                                    <div class="patch-item-inline">
                                                        <span class="patch-number">${patchNumber}</span>
                                                        <span class="patch-name clickable" onclick="deviceManager.editPatchInList(${index}, ${patchIndex})" title="Click to edit patch">${Utils.escapeHtml(patchName)}</span>
                                                        <span class="patch-program-change">PC: ${programChange}</span>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                `
                            }
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
        // Check if there are unsaved changes
        if (!appState.pendingChanges.hasUnsavedChanges) {
            Utils.showNotification('No changes to save', 'info');
            return;
        }
        
        // Check if we have a device loaded
        if (!appState.selectedDevice || !appState.currentMidnam) {
            Utils.showNotification('No device loaded', 'warning');
            return;
        }
        
        // Save the entire MIDNAM DOM structure
        this.logToDebugConsole('Saving device changes to file', 'info');
        await this.saveMidnamStructure();
    }
    
    async saveMidnamStructure() {
        // Try multiple ways to get the file path
        let filePath = null;
        
        if (appState.selectedDevice && appState.selectedDevice.file_path) {
            filePath = appState.selectedDevice.file_path;
        } else if (appState.currentMidnam && appState.currentMidnam.file_path) {
            filePath = appState.currentMidnam.file_path;
        }
        
        if (!filePath) {
            this.logToDebugConsole('✗ Could not determine file path to save', 'error');
            Utils.showNotification('Cannot save: file path unknown', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/midnam/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_path: filePath,
                    midnam: appState.currentMidnam
                })
            });
            
            if (!response.ok) {
                // Try to extract error message from response
                let errorMessage = response.statusText || `HTTP ${response.status}`;
                
                try {
                    const errorText = await response.text();
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorJson.message || errorMessage;
                    } catch {
                        if (errorText && errorText.length < 200 && !errorText.includes('<!DOCTYPE')) {
                            errorMessage = errorText;
                        }
                    }
                } catch {
                    // Couldn't read response body, use statusText
                }
                
                // Log detailed error to debug console
                this.logToDebugConsole(`✗ Failed to save to: ${filePath}`, 'error');
                this.logToDebugConsole(`  Error: ${errorMessage}`, 'error');
                
                // Special handling for 422 (invalid XML)
                if (response.status === 422) {
                    this.logToDebugConsole('  ⚠ The file contains invalid XML. Use the Validate button to see details.', 'error');
                }
                
                throw new Error(errorMessage);
            }
            
            // Mark as saved globally
            appState.markAsSaved();
            
            this.logToDebugConsole(`✓ Saved successfully to: ${filePath}`, 'success');
            Utils.showNotification('Changes saved successfully', 'success');
        } catch (error) {
            console.error('Error saving:', error);
            
            const errorMsg = error.message || 'Failed to save';
            
            if (errorMsg.toLowerCase().includes('invalid xml') || errorMsg.toLowerCase().includes('parse error')) {
                Utils.showNotification('Cannot save: File contains invalid XML. Check debug console for details.', 'error');
            } else {
                Utils.showNotification(`Save failed: ${errorMsg}`, 'error');
            }
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
    
    addPatchBank() {
        if (!appState.currentMidnam) {
            Utils.showNotification('No device loaded', 'warning');
            return;
        }
        
        // Ensure patchList array exists
        if (!appState.currentMidnam.patchList) {
            appState.currentMidnam.patchList = [];
        }
        
        // Create new bank with a default patch
        const newBankIndex = appState.currentMidnam.patchList.length;
        const newBank = {
            name: `New Bank ${newBankIndex + 1}`,
            midi_commands: [],
            patch: [{
                name: 'Default Patch',
                Number: '0',
                programChange: 0
            }]
        };
        
        // Add the new bank
        appState.currentMidnam.patchList.push(newBank);
        
        // Mark as changed
        appState.markAsChanged();
        
        // Re-render and enter edit mode for the new bank
        this.renderDeviceConfiguration();
        
        // Auto-expand and enter edit mode for the new bank
        setTimeout(() => {
            this.editPatchList(newBankIndex);
        }, 100);
        
        Utils.showNotification('New patch bank added', 'success');
    }
    
    editPatchList(index) {
        // Toggle edit mode for this patch list
        if (this.editingPatchListIndex === index) {
            // Exit edit mode
            this.editingPatchListIndex = null;
        } else {
            // Enter edit mode
            this.editingPatchListIndex = index;
        }
        
        // Re-render the device configuration to show/hide edit mode
        this.renderDeviceConfiguration();
        
        // Ensure the patch bank is expanded after render
        if (this.editingPatchListIndex !== null) {
            setTimeout(() => {
                const element = document.querySelector(`[data-index="${index}"] .collapsible-content`);
                if (element) {
                    element.style.display = 'block';
                    const parent = element.closest('.collapsible');
                    if (parent) {
                        parent.classList.add('expanded');
                    }
                }
            }, 0);
        }
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
    
    async deletePatchList(index) {
        if (!appState.currentMidnam || !appState.currentMidnam.patchList) {
            return;
        }
        
        const patchList = appState.currentMidnam.patchList[index];
        const bankName = patchList ? patchList.name : `Bank ${index + 1}`;
        
        const confirmed = await modal.confirm(
            `Are you sure you want to delete "${bankName}"? This will remove all patches in this bank.`,
            'Delete Patch Bank'
        );
        
        if (confirmed) {
            // Remove the patch list from the array
            appState.currentMidnam.patchList.splice(index, 1);
            
            // If we were editing this bank, clear edit mode
            if (this.editingPatchListIndex === index) {
                this.editingPatchListIndex = null;
            } else if (this.editingPatchListIndex > index) {
                // Adjust edit index if needed
                this.editingPatchListIndex--;
            }
            
            // Mark as changed
            appState.markAsChanged();
            
            // Re-render the device configuration
            this.renderDeviceConfiguration();
            
            Utils.showNotification(`Patch bank "${bankName}" deleted`, 'success');
        }
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
    
    // Patch list editing methods
    renderPatchListEditTable(patchList, listIndex) {
        const patches = patchList.patch || [];
        
        if (patches.length === 0) {
            return '<div class="empty-state">No patches in this bank. Add patches using the patch editor.</div>';
        }
        
        return `
            <div class="patch-edit-table-container">
                <table class="patch-edit-table">
                    <thead>
                        <tr>
                            <th>Patch ID</th>
                            <th>Name</th>
                            <th>Program Change</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="patch-edit-tbody-${listIndex}">
                        ${patches.map((patch, index) => {
                            const patchId = patch.Number || index;
                            const programChange = patch.programChange !== undefined ? patch.programChange : index;
                            const defaultName = 'Patch ' + (index + 1);
                            const patchName = patch.name || defaultName;
                            
                            return `
                                <tr data-patch-index="${index}">
                                    <td>
                                        <input type="text" 
                                               class="patch-id-input"
                                               data-list-index="${listIndex}"
                                               data-patch-index="${index}"
                                               tabindex="0"
                                               value="${patchId}"
                                               onkeydown="deviceManager.handlePatchEditKeydown(event, ${listIndex}, ${index}, 'id')"
                                               onchange="deviceManager.updatePatchInList(${listIndex}, ${index}, 'Number', this.value)">
                                    </td>
                                    <td>
                                        <input type="text" 
                                               class="patch-name-input-edit"
                                               data-list-index="${listIndex}"
                                               data-patch-index="${index}"
                                               tabindex="0"
                                               value="${Utils.escapeHtml(patchName)}"
                                               onkeydown="deviceManager.handlePatchEditKeydown(event, ${listIndex}, ${index}, 'name')"
                                               onchange="deviceManager.updatePatchInList(${listIndex}, ${index}, 'name', this.value)">
                                    </td>
                                    <td>
                                        <input type="number" 
                                               class="patch-program-change-input"
                                               data-list-index="${listIndex}"
                                               data-patch-index="${index}"
                                               tabindex="0"
                                               value="${programChange}"
                                               min="0"
                                               max="127"
                                               onkeydown="deviceManager.handlePatchEditKeydown(event, ${listIndex}, ${index}, 'pc')"
                                               onchange="deviceManager.updatePatchInList(${listIndex}, ${index}, 'programChange', this.value)">
                                    </td>
                                    <td class="patch-edit-actions">
                                        <button class="btn btn-sm btn-outline-primary" 
                                                tabindex="0"
                                                data-list-index="${listIndex}"
                                                data-patch-index="${index}"
                                                onkeydown="deviceManager.handlePatchEditKeydown(event, ${listIndex}, ${index}, 'insert')"
                                                onclick="deviceManager.insertPatchInList(${listIndex}, ${index})"
                                                title="Insert patch after this one">
                                            +I
                                        </button>
                                        <button class="btn btn-sm btn-secondary" 
                                                tabindex="-1"
                                                onclick="deviceManager.testPatchInEditMode(${listIndex}, ${index})"
                                                title="Test this patch">
                                            <img src="assets/kbd.svg" alt="Test" width="16" height="16" style="vertical-align: middle;">
                                        </button>
                                        <button class="btn btn-sm btn-danger" 
                                                tabindex="-1"
                                                onclick="deviceManager.deletePatchInEditMode(${listIndex}, ${index})"
                                                title="Delete this patch">
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    updateBankName(listIndex, value) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList) return;
        
        const newName = value.trim();
        if (!newName) {
            Utils.showNotification('Bank name cannot be empty', 'warning');
            return;
        }
        
        // Update the bank name
        patchList.name = newName;
        
        // Mark as changed
        appState.markAsChanged();
    }
    
    updatePatchInList(listIndex, patchIndex, field, value) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList || !patchList.patch || !patchList.patch[patchIndex]) return;
        
        const patch = patchList.patch[patchIndex];
        
        if (field === 'programChange') {
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 127) {
                Utils.showNotification('Program Change must be between 0 and 127', 'warning');
                return;
            }
            patch[field] = numValue;
        } else {
            patch[field] = value;
        }
        
        // Mark as changed
        appState.markAsChanged();
    }
    
    handlePatchEditKeydown(event, listIndex, patchIndex, field) {
        // Handle Enter key on name field - jump to Insert button
        if (event.key === 'Enter' && field === 'name') {
            event.preventDefault();
            this.focusPatchEditField(listIndex, patchIndex, 'insert');
            return;
        }
        
        if (event.key !== 'Tab') return;
        
        event.preventDefault();
        
        const tbody = document.getElementById(`patch-edit-tbody-${listIndex}`);
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        const currentRow = rows[patchIndex];
        if (!currentRow) return;
        
        // Define field order
        const fields = ['id', 'name', 'pc', 'insert'];
        const currentFieldIndex = fields.indexOf(field);
        
        if (event.shiftKey) {
            // Shift-Tab: go to previous field or previous row
            if (currentFieldIndex === 0) {
                // First field, go to last field of previous row
                if (patchIndex > 0) {
                    const prevRow = rows[patchIndex - 1];
                    const insertBtn = prevRow.querySelector('button[tabindex="0"]');
                    if (insertBtn) insertBtn.focus();
                }
            } else {
                // Go to previous field in same row
                const prevField = fields[currentFieldIndex - 1];
                this.focusPatchEditField(listIndex, patchIndex, prevField);
            }
        } else {
            // Tab: go to next field or next row
            if (currentFieldIndex === fields.length - 1) {
                // Last field, go to first field of next row
                if (patchIndex < rows.length - 1) {
                    this.focusPatchEditField(listIndex, patchIndex + 1, 'id');
                }
            } else {
                // Go to next field in same row
                const nextField = fields[currentFieldIndex + 1];
                this.focusPatchEditField(listIndex, patchIndex, nextField);
            }
        }
    }
    
    focusPatchEditField(listIndex, patchIndex, field) {
        const tbody = document.getElementById(`patch-edit-tbody-${listIndex}`);
        if (!tbody) return;
        
        const row = tbody.querySelector(`tr[data-patch-index="${patchIndex}"]`);
        if (!row) return;
        
        let element;
        if (field === 'id') {
            element = row.querySelector('.patch-id-input');
        } else if (field === 'name') {
            element = row.querySelector('.patch-name-input-edit');
        } else if (field === 'pc') {
            element = row.querySelector('.patch-program-change-input');
        } else if (field === 'insert') {
            element = row.querySelector('button[tabindex="0"]');
        }
        
        if (element) {
            element.focus();
            if (element.tagName === 'INPUT') {
                element.select();
            }
        }
    }
    
    smartIncrementPatchId(previousId) {
        const idStr = String(previousId);
        
        // Find all numeric sequences in the string
        const matches = [];
        const regex = /(\d+\.?\d*|\d*\.\d+)/g;
        let match;
        
        while ((match = regex.exec(idStr)) !== null) {
            matches.push({
                value: match[0],
                index: match.index,
                length: match[0].length
            });
        }
        
        if (matches.length === 0) {
            // No numbers found, just append "1"
            return idStr + '1';
        }
        
        // Use the last numeric sequence
        const lastMatch = matches[matches.length - 1];
        const numStr = lastMatch.value;
        
        // Check if it has a decimal point
        let newNumStr;
        if (numStr.includes('.')) {
            // Split into integer and fractional parts
            const parts = numStr.split('.');
            const integerPart = parts[0];
            const fractionalPart = parts[1] || '0';
            
            // Increment the fractional part
            const fractionalNum = parseInt(fractionalPart, 10);
            const incrementedFractional = fractionalNum + 1;
            
            // Preserve leading zeroes in fractional part, but allow it to grow if needed
            const minLength = fractionalPart.length;
            const newFractionalStr = String(incrementedFractional).padStart(minLength, '0');
            
            newNumStr = integerPart + '.' + newFractionalStr;
        } else {
            // No decimal, increment the whole number
            const num = parseInt(numStr, 10);
            const incrementedNum = num + 1;
            
            // Preserve leading zeroes
            newNumStr = String(incrementedNum);
            const leadingZeroes = numStr.length - String(num).length;
            if (leadingZeroes > 0 && newNumStr.length < numStr.length) {
                newNumStr = newNumStr.padStart(numStr.length, '0');
            }
        }
        
        // Reassemble the string
        const prefix = idStr.substring(0, lastMatch.index);
        const suffix = idStr.substring(lastMatch.index + lastMatch.length);
        
        return prefix + newNumStr + suffix;
    }
    
    insertPatchInList(listIndex, patchIndex) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList || !patchList.patch) return;
        
        const patches = patchList.patch;
        
        // Insert after the current row
        const insertPosition = patchIndex + 1;
        
        // Smart ID generation from previous patch
        const previousPatch = patches[patchIndex];
        const smartId = previousPatch ? this.smartIncrementPatchId(previousPatch.Number || patchIndex) : insertPosition;
        
        // Create new patch
        const newPatch = {
            name: 'New Patch ' + (insertPosition + 1),
            Number: smartId,
            programChange: insertPosition
        };
        
        // Insert at position (after current row)
        patches.splice(insertPosition, 0, newPatch);
        
        // Renumber program changes for patches after insertion point
        for (let i = insertPosition + 1; i < patches.length; i++) {
            patches[i].programChange = i;
        }
        
        appState.markAsChanged();
        this.renderDeviceConfiguration();
        
        // Focus and select the name field of the new patch
        setTimeout(() => {
            this.focusPatchEditField(listIndex, insertPosition, 'name');
        }, 0);
    }
    
    async deletePatchInEditMode(listIndex, patchIndex) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList || !patchList.patch) return;
        
        const patches = patchList.patch;
        
        if (patches.length === 1) {
            Utils.showNotification('Cannot delete the last patch', 'warning');
            return;
        }
        
        const confirmed = await modal.confirm('Are you sure you want to delete this patch?', 'Delete Patch');
        if (confirmed) {
            // Remove patch
            patches.splice(patchIndex, 1);
            
            // Renumber program changes
            for (let i = patchIndex; i < patches.length; i++) {
                patches[i].programChange = i;
            }
            
            appState.markAsChanged();
            this.renderDeviceConfiguration();
        }
    }
    
    async testPatchInEditMode(listIndex, patchIndex) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList || !patchList.patch) return;
        
        const patch = patchList.patch[patchIndex];
        if (!patch) return;
        
        const programChange = patch.programChange !== undefined ? patch.programChange : patchIndex;
        
        // Check if MIDI is enabled
        if (!window.midiManager || !window.midiManager.isOutputConnected()) {
            Utils.showNotification('MIDI output not connected', 'warning');
            return;
        }
        
        // Send bank select MIDI commands if they exist
        if (patchList.midi_commands && patchList.midi_commands.length > 0) {
            for (const cmd of patchList.midi_commands) {
                if (cmd.type === 'ControlChange') {
                    window.midiManager.sendControlChange(parseInt(cmd.control), parseInt(cmd.value), 0);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        }
        
        // Send program change
        window.midiManager.sendProgramChange(programChange);
        
        // Wait a bit for the program change to take effect
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Play 3 random notes (C, E, G shuffled)
        const notes = [60, 64, 67];
        const randomNotes = notes.sort(() => Math.random() - 0.5).slice(0, 3);
        
        for (const note of randomNotes) {
            window.midiManager.sendNoteOn(note, 100);
            await new Promise(resolve => setTimeout(resolve, 200)); // 8th note at 150 BPM
            window.midiManager.sendNoteOff(note);
            await new Promise(resolve => setTimeout(resolve, 50)); // Small gap
        }
    }
}

// Create global instance
export const deviceManager = new DeviceManager();

// Make it globally available
window.deviceManager = deviceManager;

