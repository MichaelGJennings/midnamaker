// Device module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { modal } from '../components/modal.js';

export class DeviceManager {
    constructor() {
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
                this.validateDevice();
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
                ${this.generateNoteListHTML(midnam.noteList || [])}
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
                <h4>Patch Lists (${patchLists.length})</h4>
                ${patchLists.map((patchList, index) => `
                    <div class="structure-element">
                        <div class="element-header">
                            <div class="element-name">${Utils.escapeHtml(patchList.name || `Patch List ${index + 1}`)}</div>
                            <div class="element-actions">
                                <button class="btn btn-small btn-primary" onclick="deviceManager.editPatchList(${index})">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="deviceManager.deletePatchList(${index})">Delete</button>
                            </div>
                        </div>
                        <div class="element-content">
                            <p>Patches: ${patchList.patch ? patchList.patch.length : 0}</p>
                            <p>Bank Select: ${patchList.bankSelect ? 'Yes' : 'No'}</p>
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
                `).join('')}
            </div>
        `;
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
    
    async saveDevice() {
        if (!appState.currentMidnam) {
            Utils.showNotification('No device loaded to save', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/device/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: appState.selectedDevice.id,
                    midnam: appState.currentMidnam
                })
            });
            
            if (!response.ok) throw new Error('Failed to save device');
            
            // Mark changes as saved
            appState.pendingChanges.hasUnsavedChanges = false;
            appState.pendingChanges.lastModified = new Date().toISOString();
            
            Utils.showNotification('Device saved successfully', 'success');
        } catch (error) {
            console.error('Error saving device:', error);
            Utils.showNotification('Failed to save device', 'error');
        }
    }
    
    async validateDevice() {
        if (!appState.currentMidnam) {
            Utils.showNotification('No device loaded to validate', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/device/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    midnam: appState.currentMidnam
                })
            });
            
            if (!response.ok) throw new Error('Failed to validate device');
            
            const validationResult = await response.json();
            
            if (validationResult.valid) {
                Utils.showNotification('Device validation passed', 'success');
            } else {
                const errors = validationResult.errors || [];
                const errorMessage = errors.length > 0 ? 
                    `Validation failed: ${errors.join(', ')}` : 
                    'Device validation failed';
                Utils.showNotification(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error validating device:', error);
            Utils.showNotification('Failed to validate device', 'error');
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
