/**
 * My Edits Module
 * Manages browser-saved MIDNAM files for hosted deployments
 */

import { browserStorage } from '../core/storage.js';
import { isHostedVersion } from '../core/hosting.js';
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';

export class MyEditsManager {
    constructor() {
        this.init();
    }

    async init() {
        // Only show My Edits section if hosted
        if (isHostedVersion()) {
            const section = document.getElementById('my-edits-section');
            if (section) {
                section.style.display = 'block';
            }
        }

        this.setupEventListeners();
        await this.loadSavedEdits();
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refresh-my-edits-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSavedEdits());
        }

        const clearBtn = document.getElementById('clear-my-edits-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.confirmClearAll());
        }
    }

    async loadSavedEdits() {
        const listContainer = document.getElementById('my-edits-list');
        if (!listContainer) return;

        try {
            listContainer.innerHTML = '<div class="loading">Loading saved edits...</div>';

            const savedFiles = await browserStorage.getAllMidnams();
            const stats = await browserStorage.getStats();

            // Update stats display
            this.updateStats(stats);

            // Display list of saved files
            if (savedFiles.length === 0) {
                listContainer.innerHTML = `
                    <div class="my-edits-empty">
                        <p>No saved edits yet.</p>
                        <p class="hint">Edit a device and click "Save" to store it in your browser.</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = '';
                savedFiles.forEach(file => {
                    listContainer.appendChild(this.createFileItem(file));
                });
            }
        } catch (error) {
            console.error('Error loading saved edits:', error);
            listContainer.innerHTML = `
                <div class="error">
                    <p>Failed to load saved edits: ${error.message}</p>
                </div>
            `;
        }
    }

    updateStats(stats) {
        const countEl = document.getElementById('my-edits-count');
        const sizeEl = document.getElementById('my-edits-size');

        if (countEl) {
            const fileText = stats.fileCount === 1 ? 'file' : 'files';
            countEl.textContent = `${stats.fileCount} ${fileText} saved`;
        }

        if (sizeEl) {
            sizeEl.textContent = stats.totalSizeFormatted;
        }
    }

    createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'my-edits-item';
        
        const date = new Date(file.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        item.innerHTML = `
            <div class="my-edits-item-info">
                <div class="my-edits-item-title">${Utils.escapeHtml(file.model || 'Unknown Device')}</div>
                <div class="my-edits-item-meta">
                    <span class="manufacturer">${Utils.escapeHtml(file.manufacturer || 'Unknown')}</span>
                    <span class="separator">•</span>
                    <span class="timestamp">${dateStr}</span>
                </div>
            </div>
            <div class="my-edits-item-actions">
                <button type="button" class="btn btn-tiny btn-primary" data-action="load" title="Load this file">
                    Load
                </button>
                <button type="button" class="btn btn-tiny btn-secondary" data-action="download" title="Download this file">
                    Download
                </button>
                <button type="button" class="btn btn-tiny btn-danger" data-action="delete" title="Delete from browser">
                    Delete
                </button>
            </div>
        `;

        // Attach event listeners
        const loadBtn = item.querySelector('[data-action="load"]');
        const downloadBtn = item.querySelector('[data-action="download"]');
        const deleteBtn = item.querySelector('[data-action="delete"]');

        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadFile(file));
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadFile(file));
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteFile(file));
        }

        return item;
    }

    async loadFile(file) {
        try {
            // Set up the app state as if we loaded this device normally
            appState.currentMidnam = file.midnam;
            appState.selectedDevice = {
                id: file.file_path,
                name: file.model,
                manufacturer: file.manufacturer,
                file_path: file.file_path
            };

            // Transform and display the device
            if (window.deviceManager) {
                await window.deviceManager.transformDeviceData(file.midnam);
                await window.deviceManager.renderDeviceConfiguration(file.midnam);
            }

            // Switch to device tab
            if (window.tabManager) {
                window.tabManager.switchTab('device');
            }

            Utils.showNotification(`Loaded ${file.model} from browser storage`, 'success');
        } catch (error) {
            console.error('Error loading file:', error);
            Utils.showNotification(`Failed to load file: ${error.message}`, 'error');
        }
    }

    async downloadFile(file) {
        try {
            // Generate XML from the MIDNAM structure
            const xmlString = this.generateMidnamXml(file.midnam);
            
            // Create download
            const blob = new Blob([xmlString], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.file_path.split('/').pop() || 'device.midnam';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showNotification('File downloaded successfully', 'success');
        } catch (error) {
            console.error('Error downloading file:', error);
            Utils.showNotification(`Failed to download: ${error.message}`, 'error');
        }
    }

    generateMidnamXml(midnam) {
        // Use the device manager's XML generation if available
        if (window.deviceManager && window.deviceManager.generateXMLFromMidnam) {
            return window.deviceManager.generateXMLFromMidnam(midnam);
        }
        
        // Fallback: basic XML generation
        // This is a simplified version - the full version is in device.js
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<!DOCTYPE MIDINameDocument PUBLIC "-//MIDI Manufacturers Association//DTD MIDINameDocument 1.0//EN" "http://www.midi.org/dtds/MIDINameDocument10.dtd">\n';
        xml += '<MIDINameDocument>\n';
        xml += `  <Author>${Utils.escapeXml(midnam.Author || 'Midnamaker')}</Author>\n`;
        
        // Add basic structure - for full implementation, refer to device.js
        // This is just enough to make the file valid
        xml += '  <MasterDeviceNames>\n';
        xml += `    <Manufacturer>${Utils.escapeXml(midnam.Manufacturer || 'Unknown')}</Manufacturer>\n`;
        xml += `    <Model>${Utils.escapeXml(midnam.Model || 'Unknown Device')}</Model>\n`;
        xml += '  </MasterDeviceNames>\n';
        xml += '</MIDINameDocument>\n';
        
        return xml;
    }

    async deleteFile(file) {
        const confirmMsg = `Delete "${file.model}" from browser storage?\n\nThis cannot be undone.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            await browserStorage.deleteMidnam(file.file_path);
            Utils.showNotification('File deleted from browser storage', 'success');
            await this.loadSavedEdits(); // Refresh the list
        } catch (error) {
            console.error('Error deleting file:', error);
            Utils.showNotification(`Failed to delete: ${error.message}`, 'error');
        }
    }

    async confirmClearAll() {
        const stats = await browserStorage.getStats();
        
        if (stats.fileCount === 0) {
            Utils.showNotification('No files to clear', 'info');
            return;
        }

        const confirmMsg = `Clear all ${stats.fileCount} saved file(s) from browser storage?\n\nThis cannot be undone.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            await browserStorage.clearAll();
            Utils.showNotification('All files cleared from browser storage', 'success');
            await this.loadSavedEdits(); // Refresh the list
        } catch (error) {
            console.error('Error clearing files:', error);
            Utils.showNotification(`Failed to clear files: ${error.message}`, 'error');
        }
    }
}

// Initialize when module loads (but only if DOM is ready)
let myEditsManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        myEditsManager = new MyEditsManager();
        window.myEditsManager = myEditsManager;
    });
} else {
    myEditsManager = new MyEditsManager();
    window.myEditsManager = myEditsManager;
}

export { myEditsManager };

