// Main application module
import { appState } from './state.js';
import { Utils } from './utils.js';

export class App {
    constructor() {
        this.currentTab = 'manufacturer';
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadInitialData();
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
        
        // Global MIDI controls
        const midiToggle = document.getElementById('midi-toggle');
        if (midiToggle) {
            midiToggle.addEventListener('click', () => {
                appState.toggleMIDI();
            });
        }
        
        const midiDeviceSelect = document.getElementById('midi-device-select');
        if (midiDeviceSelect) {
            midiDeviceSelect.addEventListener('change', () => {
                appState.selectMIDIDevice();
            });
        }
        
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (appState.pendingChanges.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }
    
    switchTab(tabName) {
        // Update tab UI
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        this.currentTab = tabName;
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }
    
    loadTabData(tabName) {
        switch (tabName) {
            case 'manufacturer':
                this.loadManufacturerData();
                break;
            case 'device':
                this.loadDeviceData();
                break;
            case 'patch':
                this.loadPatchData();
                break;
            case 'catalog':
                this.loadCatalogData();
                break;
            case 'tools':
                this.loadToolsData();
                break;
        }
    }
    
    async loadInitialData() {
        try {
            // Load manufacturer data
            await this.loadManufacturerData();
            
            // Initialize MIDI if supported
            if (navigator.requestMIDIAccess) {
                await appState.initializeGlobalMIDI();
            }
            
            Utils.showNotification('Application loaded successfully', 'success');
        } catch (error) {
            console.error('Failed to load initial data:', error);
            Utils.showNotification('Failed to load application data', 'error');
        }
    }
    
    async loadManufacturerData() {
        // Use ManufacturerManager to load manufacturers
        if (window.manufacturerManager && window.manufacturerManager.loadManufacturers) {
            await window.manufacturerManager.loadManufacturers();
            return;
        }
        
        // Fallback to old implementation
        try {
            // Check if we're running in a development environment without a backend
            if (window.location.protocol === 'file:' || !window.fetch) {
                this.showNoBackendMessage();
                return;
            }
            
            // If server is available, make the actual request
            const response = await fetch('/api/manufacturers');
            if (!response.ok) {
                throw new Error('Failed to fetch manufacturers');
            }
            
            const data = await response.json();
            appState.midiManufacturers = data.manufacturers;
            appState.deviceTypes = data.deviceTypes;
            
            this.renderManufacturerTab();
        } catch (error) {
            // Suppress expected errors when no backend is running
            if (error.message.includes('Failed to fetch')) {
                this.showNoBackendMessage();
                return;
            }
            console.error('Error loading manufacturer data:', error);
            this.showNoBackendMessage();
        }
    }
    
    showNoBackendMessage() {
        const container = document.getElementById('manufacturer-devices');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Backend Server</h3>
                    <p>This application requires a backend server to load manufacturer data.</p>
                    <p>Please run the Python server: <code>python server.py</code></p>
                    <p>Then access the application at: <code>http://localhost:8000/midnamaker.html</code></p>
                </div>
            `;
        }
        
        // Hide loading indicator
        const loading = document.getElementById('manufacturer-loading');
        if (loading) {
            loading.style.display = 'none';
        }
        
        // Disable the search input
        const searchInput = document.getElementById('manufacturer-search');
        if (searchInput) {
            searchInput.disabled = true;
            searchInput.placeholder = 'Backend server required';
        }
    }
    
    loadDeviceData() {
        // If we have a selected device, restore its details
        if (appState.selectedDevice && appState.currentMidnam) {
            // Use DeviceManager to render the structure instead of details
            if (window.deviceManager && window.deviceManager.renderDeviceConfiguration) {
                window.deviceManager.renderDeviceConfiguration();
            } else {
                this.updateDeviceTabWithDetails(appState.currentMidnam);
            }
        } else if (appState.selectedManufacturer) {
            // If we have a manufacturer selected but no device, show device list
            this.updateDeviceTabForManufacturer(appState.selectedManufacturer);
        } else {
            // Show empty state
            const deviceContent = document.getElementById('device-content');
            const deviceTitle = document.getElementById('device-title');
            if (deviceContent) {
                deviceContent.innerHTML = '<div class="empty-state">Please select a device from the Manufacturer tab</div>';
            }
            if (deviceTitle) {
                deviceTitle.textContent = 'Select a Device';
            }
        }
    }
    
    loadPatchData() {
        // Use the global patch manager
        if (window.patchManager) {
            window.patchManager.loadPatchTab();
        }
    }
    
    loadCatalogData() {
        // Use the global catalog manager
        if (window.catalogManager) {
            window.catalogManager.loadCatalogTab();
        }
    }
    
    loadToolsData() {
        // Use the global tools manager
        if (window.toolsManager) {
            window.toolsManager.loadToolsTab();
        }
    }
    
    renderManufacturerTab() {
        const container = document.getElementById('manufacturer-dropdown-list');
        if (!container) return;
        
        // Hide loading indicator
        const loading = document.getElementById('manufacturer-loading');
        if (loading) {
            loading.style.display = 'none';
        }
        
        if (Object.keys(appState.midiManufacturers).length === 0) {
            container.innerHTML = '<div class="empty-state">No manufacturers found</div>';
            return;
        }
        
        const manufacturers = Object.keys(appState.midiManufacturers).sort();
        container.innerHTML = manufacturers.map(manufacturer => {
            const deviceCount = appState.midiManufacturers[manufacturer].length;
            return `
                <div class="manufacturer-option" data-manufacturer="${manufacturer}">
                    <div class="manufacturer-name">${Utils.escapeHtml(manufacturer)}</div>
                    <div class="manufacturer-stats">${deviceCount} device${deviceCount !== 1 ? 's' : ''}</div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        container.querySelectorAll('.manufacturer-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const manufacturer = e.currentTarget.getAttribute('data-manufacturer');
                this.selectManufacturer(manufacturer);
            });
        });
        
        // Show the dropdown
        container.classList.add('show');
    }
    
    selectManufacturer(manufacturerName) {
        appState.selectedManufacturer = manufacturerName;
        
        // Update UI
        document.querySelectorAll('.manufacturer-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-manufacturer="${manufacturerName}"]`).classList.add('selected');
        
        // Show manufacturer details
        this.showManufacturerDetails(manufacturerName);
        
        // Update device tab to show device selection
        this.updateDeviceTabForManufacturer(manufacturerName);
        
        // Switch to device tab
        this.switchTab('device');
    }
    
    updateDeviceTabForManufacturer(manufacturerName) {
        const deviceContent = document.getElementById('device-content');
        const deviceTitle = document.getElementById('device-title');
        
        if (!deviceContent || !deviceTitle) return;
        
        const devices = appState.midiManufacturers[manufacturerName] || [];
        
        // Update title
        deviceTitle.textContent = `Select a Device - ${manufacturerName}`;
        
        if (devices.length === 0) {
            deviceContent.innerHTML = `
                <div class="empty-state">
                    <h3>No Devices Found</h3>
                    <p>No devices found for ${Utils.escapeHtml(manufacturerName)}</p>
                </div>
            `;
            return;
        }
        
        // Show device selection interface
        deviceContent.innerHTML = `
            <div class="device-selection">
                <h3>Available Devices</h3>
                <div class="device-list">
                    ${devices.map(device => `
                        <div class="device-item" data-device-id="${device.id}">
                            <div class="device-name">${Utils.escapeHtml(device.name)}</div>
                            <div class="device-type">${Utils.escapeHtml(device.type || 'Unknown')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add click handlers for device selection
        deviceContent.querySelectorAll('.device-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const deviceId = e.currentTarget.getAttribute('data-device-id');
                this.selectDevice(deviceId);
            });
        });
    }
    
    showManufacturerDetails(manufacturerName) {
        const detailsContainer = document.querySelector('.manufacturer-details');
        if (!detailsContainer) return;
        
        const devices = appState.midiManufacturers[manufacturerName] || [];
        
        detailsContainer.innerHTML = `
            <div class="manufacturer-info">
                <div class="info-item">
                    <div class="info-label">Manufacturer</div>
                    <div class="info-value">${Utils.escapeHtml(manufacturerName)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Device Count</div>
                    <div class="info-value">${devices.length}</div>
                </div>
            </div>
            <table class="device-table">
                <thead>
                    <tr>
                        <th>Device Name</th>
                        <th>Type</th>
                        <th>Capabilities</th>
                    </tr>
                </thead>
                <tbody>
                    ${devices.map(device => `
                        <tr data-device-id="${device.id}">
                            <td class="device-name">${Utils.escapeHtml(device.name)}</td>
                            <td class="device-type">${Utils.escapeHtml(device.type || 'Unknown')}</td>
                            <td class="device-capabilities">
                                ${device.capabilities ? device.capabilities.map(cap => 
                                    `<span class="capability-tag">${Utils.escapeHtml(cap)}</span>`
                                ).join('') : 'None'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        detailsContainer.classList.add('show');
        
        // Add device selection handlers
        detailsContainer.querySelectorAll('tr[data-device-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                const deviceId = e.currentTarget.getAttribute('data-device-id');
                this.selectDevice(deviceId);
            });
        });
    }
    
    selectDevice(deviceId) {
        const device = appState.midiManufacturers[appState.selectedManufacturer]
            .find(d => d.id === deviceId);
        
        if (!device) return;
        
        appState.selectedDevice = device;
        
        // Update UI - remove old selection logic and add new
        document.querySelectorAll('.device-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-device-id="${deviceId}"]`).classList.add('selected');
        
        // Update device tab title
        const deviceTitle = document.getElementById('device-title');
        if (deviceTitle) {
            deviceTitle.textContent = `Device Editor - ${device.name}`;
        }
        
        // Enable buttons
        const saveBtn = document.getElementById('save-device-btn');
        const validateBtn = document.getElementById('validate-device-btn');
        if (saveBtn) saveBtn.disabled = false;
        if (validateBtn) validateBtn.disabled = false;
        
        // Load device details
        this.loadDeviceDetails(device);
    }
    
    async loadDeviceDetails(device) {
        try {
            const response = await fetch(`/api/device/${encodeURIComponent(device.id)}`);
            if (!response.ok) throw new Error('Failed to fetch device details');
            
            const deviceData = await response.json();
            
            // Transform API response to match frontend structure
            // Convert patch_banks to patchList format
            if (deviceData.patch_banks) {
                deviceData.patchList = deviceData.patch_banks.map(bank => ({
                    name: bank.name,
                    patch: bank.patches ? bank.patches.map(p => ({
                        name: p.name,
                        programChange: parseInt(p.number.replace(/\D/g, '')) || 0, // Extract number from "A11", "R01", etc.
                        usesNoteList: p.note_list_name,
                        note_list_name: p.note_list_name, // Also set the original field name
                        number: p.number
                    })) : []
                }));
            }
            
            // Extract note lists from the raw XML
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
                        
                        return {
                            name: name,
                            notes: notes
                        };
                    });
                } catch (xmlError) {
                    console.warn('Failed to parse XML for note lists:', xmlError);
                    deviceData.note_lists = [];
                }
            }
            
            // Set basic device info
            deviceData.deviceName = deviceData.name;
            deviceData.manufacturer = deviceData.manufacturer || 'Unknown';
            deviceData.model = deviceData.model || 'Unknown';
            
            appState.currentMidnam = deviceData;
            
            // Use DeviceManager to render the structure instead of details
            if (window.deviceManager && window.deviceManager.renderDeviceConfiguration) {
                window.deviceManager.renderDeviceConfiguration();
            } else {
                this.updateDeviceTabWithDetails(deviceData);
            }
            
        } catch (error) {
            console.error('Error loading device details:', error);
            Utils.showNotification('Failed to load device details', 'error');
        }
    }
    
    updateDeviceTabWithDetails(deviceData) {
        const deviceContent = document.getElementById('device-content');
        if (!deviceContent) return;
        
        // Create device details display
        deviceContent.innerHTML = `
            <div class="device-details">
                <div class="device-info">
                    <h3>${Utils.escapeHtml(deviceData.name)}</h3>
                    <div class="device-meta">
                        <span class="device-type-badge">${Utils.escapeHtml(deviceData.type)}</span>
                        <span class="device-file">${Utils.escapeHtml(deviceData.file_path)}</span>
                    </div>
                </div>
                
                <div class="device-stats">
                    <div class="stat-item">
                        <div class="stat-label">Total Patches</div>
                        <div class="stat-value">${deviceData.total_patches}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Patch Banks</div>
                        <div class="stat-value">${deviceData.patch_banks.length}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Note Lists</div>
                        <div class="stat-value">${deviceData.total_note_lists}</div>
                    </div>
                </div>
                
                <div class="patch-banks">
                    <div class="collapsible-section">
                        <h4 class="collapsible-header" onclick="app.togglePatchBanks()">
                            <span class="collapsible-icon">▼</span>
                            Patch Banks
                        </h4>
                        <div class="collapsible-content" id="patch-banks-content">
                            <div class="bank-list">
                                ${deviceData.patch_banks.map((bank, index) => `
                                    <div class="bank-item" data-bank-index="${index}">
                                        <div class="bank-header">
                                            <span class="bank-expand-icon">▶</span>
                                            <div class="bank-name">${Utils.escapeHtml(bank.name)}</div>
                                        </div>
                                        <div class="bank-count">${bank.patch_count} patches</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                ${deviceData.channel_name_set_assignments && deviceData.channel_name_set_assignments.length > 0 ? `
                <div class="note-lists">
                    <div class="collapsible-section">
                        <h4 class="collapsible-header" onclick="app.toggleChannelAssignments()">
                            <span class="collapsible-icon">▶</span>
                            Channel Name Set Assignments
                        </h4>
                        <div class="collapsible-content" id="channel-assignments-content" style="display: none;">
                            <div class="channel-assignments">
                                ${deviceData.channel_name_set_assignments.map(assignment => `
                                    <div class="channel-assignment">
                                        <span class="channel-number">Channel ${assignment.channel}</span>
                                        <span class="name-set">→ ${Utils.escapeHtml(assignment.name_set)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        // Add click handlers for patch banks
        deviceContent.querySelectorAll('.bank-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const bankIndex = parseInt(e.currentTarget.getAttribute('data-bank-index'));
                this.selectPatchBank(bankIndex);
            });
        });
    }
    
    selectPatchBank(bankIndex) {
        if (!appState.currentMidnam || !appState.currentMidnam.patch_banks) {
            Utils.showNotification('No device data available', 'error');
            return;
        }
        
        const bank = appState.currentMidnam.patch_banks[bankIndex];
        if (!bank) {
            Utils.showNotification('Invalid patch bank', 'error');
            return;
        }
        
        // Store selected bank in app state
        appState.selectedPatchBank = bank;
        appState.selectedBankIndex = bankIndex;
        
        // Update UI - highlight selected bank and expand to show patches
        document.querySelectorAll('.bank-item').forEach(item => {
            item.classList.remove('selected');
        });
        const selectedBankItem = document.querySelector(`[data-bank-index="${bankIndex}"]`);
        selectedBankItem.classList.add('selected');
        
        // Expand the bank to show patches inline
        this.expandPatchBank(bankIndex, bank);
        
        Utils.showNotification(`Selected patch bank: ${bank.name}`, 'success');
    }
    
    expandPatchBank(bankIndex, bank) {
        const bankItem = document.querySelector(`[data-bank-index="${bankIndex}"]`);
        if (!bankItem) return;
        
        // Check if already expanded by looking for sibling expansion
        const existingExpansion = bankItem.parentNode.querySelector(`.patch-expansion[data-bank-index="${bankIndex}"]`);
        const expandIcon = bankItem.querySelector('.bank-expand-icon');
        
        if (existingExpansion) {
            // Toggle expansion - collapse
            existingExpansion.remove();
            if (expandIcon) {
                expandIcon.textContent = '▶';
            }
            return;
        }
        
        // Expand - update icon
        if (expandIcon) {
            expandIcon.textContent = '▼';
        }
        
        // Create expansion container
        const expansion = document.createElement('div');
        expansion.className = 'patch-expansion';
        expansion.setAttribute('data-bank-index', bankIndex);
        expansion.innerHTML = `
            <div class="patch-list-header">
                <h5>Patches in ${Utils.escapeHtml(bank.name)}</h5>
                <div class="patch-controls">
                    <button class="btn btn-sm btn-primary edit-patch-btn" data-bank-index="${bankIndex}" data-patch-index="0">
                        Edit Patches
                    </button>
                </div>
            </div>
            <div class="patch-list">
                ${bank.patches.map((patch, patchIndex) => `
                    <div class="patch-item" data-patch-index="${patchIndex}">
                        <div class="patch-number">${patch.number}</div>
                        <div class="patch-name">${Utils.escapeHtml(patch.name)}</div>
                        <div class="patch-actions">
                            <button class="btn btn-sm btn-outline-primary edit-patch-btn" data-bank-index="${bankIndex}" data-patch-index="${patchIndex}">
                                Edit
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Insert after the bank item
        bankItem.parentNode.insertBefore(expansion, bankItem.nextSibling);
        
        // Add event listeners for edit buttons
        expansion.querySelectorAll('.edit-patch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bankIndex = parseInt(e.target.getAttribute('data-bank-index'));
                const patchIndex = parseInt(e.target.getAttribute('data-patch-index'));
                this.selectPatchFromBank(bankIndex, patchIndex);
            });
        });
    }
    
    selectPatchFromBank(bankIndex, patchIndex) {
        if (!appState.currentMidnam || !appState.currentMidnam.patch_banks) {
            Utils.showNotification('No device data available', 'error');
            return;
        }
        
        const bank = appState.currentMidnam.patch_banks[bankIndex];
        if (!bank || !bank.patches[patchIndex]) {
            Utils.showNotification('Invalid patch selection', 'error');
            return;
        }
        
        const patch = bank.patches[patchIndex];
        
        // Store selected patch in app state
        appState.selectedPatch = patch;
        appState.selectedPatchBank = bank;
        appState.selectedBankIndex = bankIndex;
        
        // Switch to patch tab to edit the specific patch
        this.switchTab('patch');
        
        Utils.showNotification(`Selected patch: ${patch.name}`, 'success');
    }
    
    toggleChannelAssignments() {
        const content = document.getElementById('channel-assignments-content');
        const section = content?.closest('.collapsible-section');
        const icon = section?.querySelector('.collapsible-icon');
        
        if (!content || !icon) return;
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    }
    
    togglePatchBanks() {
        const content = document.getElementById('patch-banks-content');
        const section = content?.closest('.collapsible-section');
        const icon = section?.querySelector('.collapsible-icon');
        
        if (!content || !icon) return;
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    }
    
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + S for save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.saveCurrentChanges();
        }
        
        // Ctrl/Cmd + Z for undo (if implemented)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            // TODO: Implement undo functionality
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            this.closeAllModals();
        }
    }
    
    saveCurrentChanges() {
        if (!appState.pendingChanges.hasUnsavedChanges) {
            Utils.showNotification('No changes to save', 'info');
            return;
        }
        
        // Implementation will be in respective modules
        Utils.showNotification('Save functionality will be implemented in respective modules', 'info');
    }
    
    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });
    }
}

// Initialize app when DOM is loaded
// Make App class globally available
window.App = App;
