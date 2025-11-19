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
            // Load catalog to get manufacturer data
            // Try /api/midnam_catalog first (Vercel), fall back to /midnam_catalog (local)
            let response = await fetch(`/api/midnam_catalog?t=${Date.now()}`);
            if (!response.ok && response.status === 404) {
                // Fall back to local endpoint
                response = await fetch(`/midnam_catalog?t=${Date.now()}`);
            }
            if (!response.ok) throw new Error('Failed to load catalog');
            
            const catalog = await response.json();
            console.log('[ManufacturerManager] Loaded catalog with', Object.keys(catalog).length, 'devices');
            
            // Merge in user-created devices from IndexedDB if hosted
            const { isHostedVersion } = await import('../core/hosting.js');
            if (isHostedVersion()) {
                const mergedCatalog = await this.mergeBrowserStorageCatalog(catalog);
                appState.catalog = mergedCatalog;
            } else {
                appState.catalog = catalog;
            }
            
            // Build manufacturer list from catalog
            const manufacturers = this.buildManufacturerList(appState.catalog);
            console.log('[ManufacturerManager] Built manufacturer list with', manufacturers.length, 'manufacturers');
            
            if (manufacturers.length === 0) {
                container.innerHTML = '<div class="empty-state" data-testid="msg_no_manufacturers">No manufacturers found</div>';
                return;
            }
            
            // Render manufacturer list
            container.innerHTML = manufacturers.map(mfg => `
                <div class="manufacturer-list-item" data-manufacturer="${Utils.escapeAttribute(mfg.name)}" data-testid="itm_manufacturer_${Utils.escapeAttribute(mfg.name).replace(/\s+/g, '_').toLowerCase()}">
                    <div class="manufacturer-item-name" data-testid="div_manufacturer_name">${Utils.escapeHtml(mfg.name)}</div>
                    <div class="manufacturer-item-count" data-testid="div_manufacturer_count">${mfg.deviceCount} device${mfg.deviceCount !== 1 ? 's' : ''}</div>
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
            container.innerHTML = '<div class="empty-state" data-testid="msg_manufacturer_error">Error loading manufacturers</div>';
        }
    }
    
    /**
     * Merge browser storage devices into catalog
     */
    async mergeBrowserStorageCatalog(baseCatalog) {
        try {
            const { browserStorage } = await import('../core/storage.js');
            const allFiles = await browserStorage.getAllMidnams();
            
            // Create a copy of the base catalog
            const mergedCatalog = { ...baseCatalog };
            
            // Add each browser storage file to catalog
            allFiles.forEach(file => {
                if (file.manufacturer && file.model) {
                    const deviceId = `${file.manufacturer}|${file.model}`;
                    mergedCatalog[deviceId] = {
                        manufacturer: file.manufacturer,
                        model: file.model,
                        type: 'Synth', // Default type for user-created devices
                        files: [{ path: file.file_path }],
                        fromBrowserStorage: true // Mark as user-created
                    };
                }
            });
            
            console.log('[ManufacturerManager] Merged browser storage:', 
                allFiles.length, 'user files into catalog');
            
            return mergedCatalog;
        } catch (error) {
            console.error('[ManufacturerManager] Error merging browser storage:', error);
            return baseCatalog;
        }
    }
    
    /**
     * Refresh manufacturer list dynamically without fetching from server
     * Uses current appState.catalog
     */
    async refreshManufacturerListDynamic() {
        const container = document.getElementById('manufacturer-list');
        if (!container) return;
        
        try {
            // Use existing catalog from appState
            const catalog = appState.catalog || {};
            
            // Build manufacturer list from catalog
            const manufacturers = this.buildManufacturerList(catalog);
            console.log('[ManufacturerManager] Dynamically refreshed manufacturer list with', manufacturers.length, 'manufacturers');
            
            if (manufacturers.length === 0) {
                container.innerHTML = '<div class="empty-state" data-testid="msg_no_manufacturers">No manufacturers found</div>';
                return;
            }
            
            // Render manufacturer list
            container.innerHTML = manufacturers.map(mfg => `
                <div class="manufacturer-list-item" data-manufacturer="${Utils.escapeAttribute(mfg.name)}" data-testid="itm_manufacturer_${Utils.escapeAttribute(mfg.name).replace(/\s+/g, '_').toLowerCase()}">
                    <div class="manufacturer-item-name" data-testid="div_manufacturer_name">${Utils.escapeHtml(mfg.name)}</div>
                    <div class="manufacturer-item-count" data-testid="div_manufacturer_count">${mfg.deviceCount} device${mfg.deviceCount !== 1 ? 's' : ''}</div>
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
            console.error('Error refreshing manufacturers:', error);
            Utils.showNotification('Error refreshing manufacturer list', 'error');
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
            container.innerHTML = '<div class="empty-state" data-testid="msg_no_devices">No devices found for this manufacturer</div>';
            return;
        }
        
        // Sort devices alphabetically by name
        const sortedDevices = [...devices].sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        
        container.innerHTML = sortedDevices.map(device => `
            <div class="device-list-item" data-device-id="${Utils.escapeAttribute(device.id)}" data-testid="itm_device_${Utils.escapeAttribute(device.name).replace(/\s+/g, '_').toLowerCase()}">
                <div class="device-item-name" data-testid="div_device_name">${Utils.escapeHtml(device.name)}</div>
                <div class="device-item-type" data-testid="div_device_type">${Utils.escapeHtml(device.type)}</div>
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
            
            // Find all devices with matching ID, but exclude .middev files (we can only open .midnam files)
            const matchingDevices = devices.filter(d => {
                return d.id === deviceId && d.file_path && d.file_path.endsWith('.midnam');
            });
            
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
                // No match found - device exists in middev but has no midnam file
                // Offer to create one
                const shouldCreate = await this.offerToCreateMidnam(manufacturer, model);
                if (shouldCreate) {
                    await this.createAndLoadMidnam(manufacturer, model, deviceId);
                }
            }
            
        } catch (error) {
            console.error('Error loading device:', error);
            Utils.showNotification('Failed to load device', 'error');
        }
    }
    
    async loadDeviceFile(deviceInfo, deviceId, manufacturer, model) {
        try {
            let deviceData;
            
            // Check if this is a browser storage device
            const catalogEntry = appState.catalog[deviceId];
            if (catalogEntry && catalogEntry.fromBrowserStorage) {
                // Load from browser storage
                const { browserStorage } = await import('../core/storage.js');
                const storedFile = await browserStorage.getMidnam(deviceInfo.file_path);
                
                if (!storedFile) {
                    Utils.showNotification(`Device "${model}" not found in browser storage`, 'warning');
                    return;
                }
                
                // Parse the XML to create deviceData structure
                deviceData = await this.parseDeviceXML(storedFile.midnam, deviceId, manufacturer, model, deviceInfo.file_path);
            } else {
                // Fetch device details from API for built-in devices
                const response = await fetch(`/api/device/${encodeURIComponent(deviceId)}?file=${encodeURIComponent(deviceInfo.file_path)}`);
                
                if (!response.ok) {
                    Utils.showNotification(`Device "${model}" not found`, 'warning');
                    return;
                }
                
                deviceData = await response.json();
            }
            
            // Ensure deviceData has file_path
            if (!deviceData.file_path) {
                deviceData.file_path = deviceInfo.file_path;
            }
            
            // Store device data with file path
            appState.selectedDevice = { 
                id: deviceId, 
                name: model, 
                manufacturer,
                file_path: deviceInfo.file_path || deviceData.file_path
            };
            appState.currentMidnam = deviceData;
            
            // Clear collapsed banks state when switching to a new device
            if (window.deviceManager && window.deviceManager.clearCollapsedBanksState) {
                window.deviceManager.clearCollapsedBanksState();
            }
            
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
    
    /**
     * Parse device XML from browser storage into the same format as API returns
     */
    async parseDeviceXML(xmlString, deviceId, manufacturer, model, filePath) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        // Build device data structure matching API format
        const deviceData = {
            id: deviceId,
            Manufacturer: manufacturer,
            Model: model,
            Author: xmlDoc.querySelector('Author')?.textContent || 'Unknown',
            file_path: filePath,
            raw_xml: xmlString,
            note_lists: [],
            patch_banks: [],
            channel_name_sets: [],
            custom_device_modes: []
        };
        
        // Parse note lists
        xmlDoc.querySelectorAll('NoteNameList').forEach(noteList => {
            const name = noteList.getAttribute('Name');
            if (name) {
                const notes = [];
                noteList.querySelectorAll('Note').forEach(note => {
                    const number = note.getAttribute('Number');
                    const noteName = note.getAttribute('Name');
                    if (number && noteName) {
                        notes.push({ number: parseInt(number), name: noteName });
                    }
                });
                deviceData.note_lists.push({ name, notes });
            }
        });
        
        // Parse patch banks
        const patchBanksByName = {};
        xmlDoc.querySelectorAll('PatchBank').forEach(patchBank => {
            const bankName = patchBank.getAttribute('Name');
            if (bankName) {
                const patches = [];
                patchBank.querySelectorAll('Patch').forEach(patch => {
                    const patchNumber = patch.getAttribute('Number');
                    const patchName = patch.getAttribute('Name');
                    const programChange = patch.getAttribute('ProgramChange');
                    
                    const patchData = {
                        number: patchNumber,
                        name: patchName,
                        Number: patchNumber
                    };
                    
                    if (programChange) {
                        patchData.programChange = parseInt(programChange);
                    }
                    
                    const usesNoteList = patch.querySelector('UsesNoteNameList');
                    if (usesNoteList) {
                        patchData.note_list_name = usesNoteList.getAttribute('Name');
                    }
                    
                    patches.push(patchData);
                });
                
                const bankObj = { name: bankName, patches, midi_commands: [] };
                patchBanksByName[bankName] = bankObj;
                deviceData.patch_banks.push(bankObj);
            }
        });
        
        // Parse channel name sets
        xmlDoc.querySelectorAll('ChannelNameSet').forEach(channelNameSet => {
            const setName = channelNameSet.getAttribute('Name');
            if (setName) {
                const availableChannels = [];
                channelNameSet.querySelectorAll('AvailableChannel').forEach(avail => {
                    const channel = avail.getAttribute('Channel');
                    const available = avail.getAttribute('Available');
                    if (channel) {
                        availableChannels.push({
                            channel: parseInt(channel),
                            available: available === 'true'
                        });
                    }
                });
                
                // Get patch banks referenced by this channel name set
                const patch_banks = [];
                channelNameSet.querySelectorAll('PatchBank').forEach(pbRef => {
                    const pbName = pbRef.getAttribute('Name');
                    if (pbName && patchBanksByName[pbName]) {
                        patch_banks.push(patchBanksByName[pbName]);
                    }
                });
                
                deviceData.channel_name_sets.push({
                    name: setName,
                    available_channels: availableChannels,
                    patch_banks
                });
            }
        });
        
        // Parse custom device modes
        xmlDoc.querySelectorAll('CustomDeviceMode').forEach(mode => {
            const modeName = mode.getAttribute('Name');
            if (modeName) {
                const channelNameSets = [];
                mode.querySelectorAll('ChannelNameSetAssign').forEach(cns => {
                    const channel = cns.getAttribute('Channel');
                    const nameSet = cns.getAttribute('NameSet');
                    if (channel && nameSet) {
                        channelNameSets.push({
                            channel: parseInt(channel),
                            name_set: nameSet
                        });
                    }
                });
                
                deviceData.custom_device_modes.push({
                    name: modeName,
                    channel_name_set_assigns: channelNameSets
                });
            }
        });
        
        return deviceData;
    }
    
    async offerToCreateMidnam(manufacturer, model) {
        // Get modal component
        let modal = window.modal;
        if (!modal) {
            try {
                const modalModule = await import('../components/modal.js');
                modal = modalModule.modal;
            } catch (error) {
                console.error('Failed to load modal:', error);
                // Fall back to confirm dialog
                return confirm(`${model} does not have a MIDI Name Document. Create one?`);
            }
        }
        
        const confirmed = await modal.confirm(
            `<strong>${Utils.escapeHtml(model)}</strong> does not have a MIDI Name Document.<br><br>Would you like to create one?`,
            'Create MIDI Name Document',
            {
                confirmText: 'Create',
                cancelText: 'Cancel'
            }
        );
        
        return confirmed;
    }
    
    async createAndLoadMidnam(manufacturer, model, deviceId) {
        try {
            // Call the API to create the midnam file
            const response = await fetch('/api/middev/add-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    manufacturer: manufacturer,
                    model: model
                })
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to create MIDI Name Document';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // If we can't parse the error response, use the status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            if (result.success) {
                Utils.showNotification(`Created MIDI Name Document for ${model}`, 'success');
                
                // Refresh the catalog to include the new device
                if (window.middevManager) {
                    await window.middevManager.clearCatalogCache();
                }
                
                // Small delay to ensure file is written
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Fetch the newly created device
                const deviceResponse = await fetch(`/api/device/${encodeURIComponent(deviceId)}?file=${encodeURIComponent(result.midnam_path)}`);
                
                if (!deviceResponse.ok) {
                    throw new Error('Failed to load newly created device');
                }
                
                const deviceData = await deviceResponse.json();
                
                // Ensure deviceData has file_path
                if (!deviceData.file_path) {
                    deviceData.file_path = result.midnam_path;
                }
                
                // Store device data
                appState.selectedDevice = { 
                    id: deviceId, 
                    name: model, 
                    manufacturer,
                    file_path: result.midnam_path
                };
                appState.currentMidnam = deviceData;
                
                // Clear collapsed banks state when creating a new device
                if (window.deviceManager && window.deviceManager.clearCollapsedBanksState) {
                    window.deviceManager.clearCollapsedBanksState();
                }
                
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
                
                // Refresh the manufacturer list to show the new device
                await this.refreshManufacturerList();
                
            } else {
                throw new Error(result.message || 'Failed to create MIDI Name Document');
            }
            
        } catch (error) {
            console.error('Error creating MIDI Name Document:', error);
            Utils.showNotification(`Failed to create MIDI Name Document: ${error.message}`, 'error');
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
                <div class="file-disambiguation" data-testid="sec_file_disambiguation">
                    <p data-testid="div_disambiguation_prompt">Multiple files found for this device. Please select one:</p>
                    <div class="file-selection-list" data-testid="lst_file_selection">
                        ${devices.map((device, index) => `
                            <div class="file-selection-item" data-index="${index}" data-testid="itm_file_${index}">
                                <div class="file-selection-header" data-testid="hdr_file_${index}">
                                    <strong data-testid="div_file_name">${device.file_path.split('/').pop()}</strong>
                                    <span class="file-type-badge ${device.type}" data-testid="div_file_type_badge">${device.type}</span>
                                </div>
                                <div class="file-meta" data-testid="div_file_meta">
                                    <span class="file-path" data-testid="spn_file_path">${Utils.escapeHtml(device.file_path)}</span>
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
        // Store custom device modes and channel name sets
        deviceData.customDeviceModes = deviceData.custom_device_modes || [];
        deviceData.channelNameSets = deviceData.channel_name_sets || [];
        
        // Transform API response to match frontend structure
        // Convert hierarchical structure to patchList format with metadata
        deviceData.patchList = [];
        
        if (deviceData.channel_name_sets && deviceData.channel_name_sets.length > 0) {
            // Organize by ChannelNameSet
            for (const nameSet of deviceData.channel_name_sets) {
                if (nameSet.patch_banks) {
                    for (const bank of nameSet.patch_banks) {
                        // Add metadata about which NameSet this bank belongs to
                        const patchListEntry = {
                            name: bank.name,
                            channelNameSet: nameSet.name,
                            availableChannels: nameSet.available_channels,
                            midi_commands: bank.midi_commands || [],
                            patch: bank.patches ? bank.patches.map(p => ({
                                name: p.name,
                                Number: p.Number || '0',
                                number: p.Number || '0',
                                programChange: p.programChange !== undefined ? parseInt(p.programChange) : 0,
                                usesNoteList: p.note_list_name,
                                note_list_name: p.note_list_name
                            })) : []
                        };
                        deviceData.patchList.push(patchListEntry);
                    }
                }
            }
        } else if (deviceData.patch_banks) {
            // Fallback to flat structure for backward compatibility
            deviceData.patchList = deviceData.patch_banks.map(bank => ({
                name: bank.name,
                channelNameSet: null, // No NameSet association
                availableChannels: [],
                midi_commands: bank.midi_commands || [],
                patch: bank.patches ? bank.patches.map(p => ({
                    name: p.name,
                    Number: p.Number || '0',
                    number: p.Number || '0',
                    programChange: p.programChange !== undefined ? parseInt(p.programChange) : 0,
                    usesNoteList: p.note_list_name,
                    note_list_name: p.note_list_name
                })) : []
            }));
        }
        
        // Extract note lists and control name lists from XML
        if (deviceData.raw_xml) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(deviceData.raw_xml, 'text/xml');
                
                // Parse Note Lists
                const noteLists = xmlDoc.querySelectorAll('NoteNameList');
                deviceData.note_lists = Array.from(noteLists).map(noteList => {
                    const name = noteList.getAttribute('Name');
                    const notes = Array.from(noteList.querySelectorAll('Note')).map(note => ({
                        number: parseInt(note.getAttribute('Number')),
                        name: note.getAttribute('Name')
                    }));
                    
                    return { name, notes };
                });
                
                // Parse Control Name Lists
                const controlLists = xmlDoc.querySelectorAll('ControlNameList');
                deviceData.control_lists = Array.from(controlLists).map(controlList => {
                    const name = controlList.getAttribute('Name');
                    const controls = Array.from(controlList.querySelectorAll('Control')).map(control => ({
                        type: control.getAttribute('Type') || '7bit',
                        number: parseInt(control.getAttribute('Number')),
                        name: control.getAttribute('Name')
                    }));
                    
                    return { name, controls };
                });
                
                // Parse which ControlNameList is used by ChannelNameSet
                const channelNameSets = xmlDoc.querySelectorAll('ChannelNameSet');
                if (channelNameSets.length > 0) {
                    const firstChannelNameSet = channelNameSets[0];
                    const usesControlList = firstChannelNameSet.querySelector('UsesControlNameList');
                    deviceData.activeControlListName = usesControlList ? usesControlList.getAttribute('Name') : null;
                }
            } catch (xmlError) {
                console.warn('Failed to parse XML for note/control lists:', xmlError);
                deviceData.note_lists = [];
                deviceData.control_lists = [];
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
