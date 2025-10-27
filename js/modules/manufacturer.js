// Manufacturer module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { middevManager } from './middev.js';

export class ManufacturerManager {
    constructor() {
        this.currentFilter = '';
        this.selectedManufacturerData = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Filter input
        const filterInput = document.getElementById('manufacturer-filter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this.handleFilterChange(e.target.value);
            });
        }
        
        // Clear manufacturer selection button
        const clearBtn = document.getElementById('clear-manufacturer-selection');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearManufacturerSelection();
            });
        }
        
        // Toggle manufacturer list button
        const toggleBtn = document.getElementById('toggle-manufacturer-list');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleManufacturerList();
            });
        }
        
        // Header click to toggle
        const header = document.getElementById('manufacturer-section-header');
        if (header) {
            header.addEventListener('click', (e) => {
                // Don't toggle if clicking on buttons
                if (e.target.closest('button')) {
                    return;
                }
                this.toggleManufacturerList();
            });
        }
        
        // Add manufacturer button
        const addManufacturerBtn = document.getElementById('add-manufacturer-btn');
        if (addManufacturerBtn) {
            addManufacturerBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await middevManager.promptCreateManufacturer();
            });
        }
        
        // Add device button
        const addDeviceBtn = document.getElementById('add-device-btn');
        if (addDeviceBtn) {
            addDeviceBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (appState.selectedManufacturer) {
                    await middevManager.promptAddDevice(appState.selectedManufacturer);
                } else {
                    Utils.showNotification('No manufacturer selected', 'warning');
                }
            });
        }
    }
    
    async loadManufacturers() {
        await this.renderManufacturerList();
    }
    
    async renderManufacturerList() {
        const container = document.getElementById('manufacturer-list');
        if (!container) return;
        
        try {
            // Load catalog to get manufacturer data (add cache-busting parameter)
            const response = await fetch(`/midnam_catalog?t=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load catalog');
            
            const catalog = await response.json();
            console.log('[ManufacturerManager] Loaded catalog with', Object.keys(catalog).length, 'devices');
            appState.catalog = catalog;
            
            // Build manufacturer list from catalog
            const manufacturers = this.buildManufacturerList(catalog);
            console.log('[ManufacturerManager] Built manufacturer list with', manufacturers.length, 'manufacturers');
            
            if (manufacturers.length === 0) {
                container.innerHTML = '<div class="empty-state">No manufacturers found</div>';
                return;
            }
            
            // Render manufacturer list
            container.innerHTML = manufacturers.map(mfg => `
                <div class="manufacturer-list-item" data-manufacturer="${Utils.escapeAttribute(mfg.name)}">
                    <div class="manufacturer-item-name">${Utils.escapeHtml(mfg.name)}</div>
                    <div class="manufacturer-item-count">${mfg.deviceCount} device${mfg.deviceCount !== 1 ? 's' : ''}</div>
                </div>
            `).join('');
            
            // Add click handlers
            container.querySelectorAll('.manufacturer-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const manufacturerName = item.getAttribute('data-manufacturer');
                    this.selectManufacturer(manufacturerName, manufacturers);
                });
            });
            
        } catch (error) {
            console.error('Error loading manufacturers:', error);
            container.innerHTML = '<div class="empty-state">Error loading manufacturers</div>';
        }
    }
    
    buildManufacturerList(catalog) {
        const manufacturerMap = new Map();
        
        // Process catalog to group devices by manufacturer
        Object.values(catalog).forEach(device => {
            const manufacturer = device.manufacturer;
            if (!manufacturer) return;
            
            if (!manufacturerMap.has(manufacturer)) {
                manufacturerMap.set(manufacturer, {
                    name: manufacturer,
                    deviceCount: 0,
                    devices: []
                });
            }
            
            const mfg = manufacturerMap.get(manufacturer);
            mfg.deviceCount++;
            mfg.devices.push({
                id: `${device.manufacturer}|${device.model}`,
                name: device.model,
                type: device.type || 'Unknown',
                manufacturer: device.manufacturer
            });
        });
        
        // Convert to array and sort
        return Array.from(manufacturerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    handleFilterChange(filterValue) {
        this.currentFilter = filterValue.toLowerCase();
        this.filterManufacturerList();
    }
    
    filterManufacturerList() {
        const items = document.querySelectorAll('.manufacturer-list-item');
        items.forEach(item => {
            const manufacturerName = item.getAttribute('data-manufacturer').toLowerCase();
            if (manufacturerName.includes(this.currentFilter)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    async selectManufacturer(manufacturerName, manufacturersList) {
        // Find manufacturer data
        const manufacturerData = manufacturersList.find(m => m.name === manufacturerName);
        if (!manufacturerData) return;
        
        this.selectedManufacturerData = manufacturerData;
        appState.selectedManufacturer = manufacturerName;
        
        // Render device list
        await this.renderDeviceList(manufacturerData.devices);
        
        // Show device list container
        const deviceContainer = document.getElementById('device-list-container');
        if (deviceContainer) {
            deviceContainer.style.display = 'block';
        }
        
        // Update selected manufacturer name
        const nameElement = document.getElementById('selected-manufacturer-name');
        if (nameElement) {
            nameElement.textContent = `${manufacturerName} Devices`;
        }
        
        // Collapse manufacturer list
        this.collapseManufacturerList();
    }
    
    async renderDeviceList(devices) {
        const container = document.getElementById('device-list');
        if (!container) return;
        
        if (devices.length === 0) {
            container.innerHTML = '<div class="empty-state">No devices found for this manufacturer</div>';
            return;
        }
        
        // Sort devices alphabetically by name
        const sortedDevices = [...devices].sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        
        container.innerHTML = sortedDevices.map(device => `
            <div class="device-list-item" data-device-id="${Utils.escapeAttribute(device.id)}">
                <div class="device-item-name">${Utils.escapeHtml(device.name)}</div>
                <div class="device-item-type">${Utils.escapeHtml(device.type)}</div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.device-list-item').forEach(item => {
            item.addEventListener('click', async () => {
                const deviceId = item.getAttribute('data-device-id');
                await this.selectDevice(deviceId);
            });
        });
    }
    
    async selectDevice(deviceId) {
        try {
            // Parse device ID
            const [manufacturer, model] = deviceId.split('|');
            
            // Check if there are multiple files for this device
            // Get manufacturer data to find all devices with this ID
            const manufacturerResponse = await fetch('/api/manufacturers');
            if (!manufacturerResponse.ok) {
                throw new Error('Failed to fetch manufacturers');
            }
            
            const manufacturersData = await manufacturerResponse.json();
            const devices = manufacturersData.manufacturers[manufacturer] || [];
            
            // Find all devices with matching ID
            const matchingDevices = devices.filter(d => d.id === deviceId);
            
            if (matchingDevices.length > 1) {
                // Multiple files - show disambiguation dialog
                const selectedFile = await this.showFileDisambiguationDialog(deviceId, matchingDevices);
                if (!selectedFile) return; // User cancelled
                
                // Load the selected file
                await this.loadDeviceFile(selectedFile, deviceId, manufacturer, model);
            } else if (matchingDevices.length === 1) {
                // Single file - load directly
                await this.loadDeviceFile(matchingDevices[0], deviceId, manufacturer, model);
            } else {
                // No match found
                Utils.showNotification(`Device "${model}" not found`, 'warning');
                console.warn(`Device not found: ${deviceId}`);
            }
            
        } catch (error) {
            console.error('Error loading device:', error);
            Utils.showNotification('Failed to load device', 'error');
        }
    }
    
    async loadDeviceFile(deviceInfo, deviceId, manufacturer, model) {
        try {
            // Fetch device details for the specific file
            const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}?file=${encodeURIComponent(deviceInfo.file_path)}`);
            
            if (!response.ok) {
                Utils.showNotification(`Device "${model}" not found`, 'warning');
                return;
            }
            
            const deviceData = await response.json();
            
            // Store device data
            appState.selectedDevice = { id: deviceId, name: model, manufacturer };
            appState.currentMidnam = deviceData;
            
            // Transform device data for frontend
            await this.transformDeviceData(deviceData);
            
            // Switch to device tab
            if (window.tabManager) {
                window.tabManager.switchTab('device');
            }
            
            // Render device configuration
            if (window.deviceManager && window.deviceManager.renderDeviceConfiguration) {
                window.deviceManager.renderDeviceConfiguration();
            }
            
            Utils.showNotification(`Loaded device: ${model}`, 'success');
            
        } catch (error) {
            console.error('Error loading device file:', error);
            Utils.showNotification('Failed to load device', 'error');
        }
    }
    
    async showFileDisambiguationDialog(deviceId, devices) {
        return new Promise(async (resolve) => {
            const [manufacturer, model] = deviceId.split('|');
            
            // Get modal from global or import dynamically
            let modal = window.modal;
            if (!modal) {
                try {
                    const modalModule = await import('../components/modal.js');
                    modal = modalModule.modal;
                } catch (error) {
                    console.error('Failed to load modal:', error);
                    resolve(null);
                    return;
                }
            }
            
            const content = `
                <div class="file-disambiguation">
                    <p>Multiple files found for this device. Please select one:</p>
                    <div class="file-selection-list">
                        ${devices.map((device, index) => `
                            <div class="file-selection-item" data-index="${index}">
                                <div class="file-selection-header">
                                    <strong>${device.file_path.split('/').pop()}</strong>
                                    <span class="file-type-badge ${device.type}">${device.type}</span>
                                </div>
                                <div class="file-meta">
                                    <span class="file-path">${Utils.escapeHtml(device.file_path)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            modal.show({
                title: `Select File for ${model}`,
                content: content,
                showCancel: true,
                showConfirm: false,
                cancelText: 'Cancel',
                onCancel: () => resolve(null)
            });
            
            // Add click handlers after modal is shown
            setTimeout(() => {
                const items = document.querySelectorAll('.file-selection-item');
                items.forEach((item, index) => {
                    item.addEventListener('click', () => {
                        modal.close();
                        resolve(devices[index]);
                    });
                });
            }, 100);
        });
    }
    
    async transformDeviceData(deviceData) {
        // Transform API response to match frontend structure
        if (deviceData.patch_banks) {
            deviceData.patchList = deviceData.patch_banks.map(bank => ({
                name: bank.name,
                midi_commands: bank.midi_commands || [],
                patch: bank.patches ? bank.patches.map(p => ({
                    name: p.name,
                    Number: p.Number || '0',
                    programChange: p.programChange !== undefined ? parseInt(p.programChange) : 0,
                    usesNoteList: p.note_list_name,
                    note_list_name: p.note_list_name
                })) : []
            }));
        }
        
        // Extract note lists from XML
        if (deviceData.raw_xml) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(deviceData.raw_xml, 'text/xml');
                const noteLists = xmlDoc.querySelectorAll('NoteNameList');
                
                deviceData.note_lists = Array.from(noteLists).map(noteList => {
                    const name = noteList.getAttribute('Name');
                    const notes = Array.from(noteList.querySelectorAll('Note')).map(note => ({
                        number: parseInt(note.getAttribute('Number')),
                        name: note.getAttribute('Name')
                    }));
                    
                    return { name, notes };
                });
            } catch (xmlError) {
                console.warn('Failed to parse XML for note lists:', xmlError);
                deviceData.note_lists = [];
            }
        }
        
        // Set basic device info from the API response
        // The server sends 'name' which is the model name
        deviceData.deviceName = deviceData.name || 'Unknown';
        
        // Extract manufacturer and model from the device ID if not already present
        if (appState.selectedDevice) {
            const [manufacturer, model] = appState.selectedDevice.id.split('|');
            deviceData.manufacturer = manufacturer || 'Unknown';
            deviceData.model = model || deviceData.name || 'Unknown';
        } else {
            deviceData.manufacturer = deviceData.manufacturer || 'Unknown';
            deviceData.model = deviceData.model || deviceData.name || 'Unknown';
        }
        
        // Version might come from the XML, set default if not present
        deviceData.version = deviceData.version || 'N/A';
    }
    
    clearManufacturerSelection() {
        this.selectedManufacturerData = null;
        appState.selectedManufacturer = null;
        
        // Hide device list container
        const deviceContainer = document.getElementById('device-list-container');
        if (deviceContainer) {
            deviceContainer.style.display = 'none';
        }
        
        // Clear device list
        const deviceList = document.getElementById('device-list');
        if (deviceList) {
            deviceList.innerHTML = '';
        }
        
        // Expand manufacturer list
        this.expandManufacturerList();
    }
    
    collapseManufacturerList() {
        const collapsible = document.getElementById('manufacturer-section-collapsible');
        const toggleBtn = document.getElementById('toggle-manufacturer-list');
        
        if (collapsible) {
            collapsible.classList.add('collapsed');
        }
        
        if (toggleBtn) {
            toggleBtn.style.display = 'block';
            toggleBtn.classList.remove('expanded');
        }
    }
    
    expandManufacturerList() {
        const collapsible = document.getElementById('manufacturer-section-collapsible');
        const toggleBtn = document.getElementById('toggle-manufacturer-list');
        
        if (collapsible) {
            collapsible.classList.remove('collapsed');
        }
        
        if (toggleBtn) {
            toggleBtn.classList.add('expanded');
        }
    }
    
    toggleManufacturerList() {
        const collapsible = document.getElementById('manufacturer-section-collapsible');
        const toggleBtn = document.getElementById('toggle-manufacturer-list');
        
        if (collapsible && toggleBtn) {
            if (collapsible.classList.contains('collapsed')) {
                this.expandManufacturerList();
            } else {
                this.collapseManufacturerList();
            }
        }
    }
    
    // Public method for external access
    async refreshManufacturerList() {
        await this.renderManufacturerList();
    }
}

export const manufacturerManager = new ManufacturerManager();

// Make it globally available
window.manufacturerManager = manufacturerManager;
