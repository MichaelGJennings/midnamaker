// Device module
import { modal } from '../components/modal.js';
import { getMIDIControllerName } from '../constants/midiControllers.js';
import { isHostedVersion } from '../core/hosting.js';
import { appState } from '../core/state.js';
import { browserStorage } from '../core/storage.js';
import { Utils } from '../core/utils.js';
import { sendBankSelectMidi, sendProgramChange, testPatch } from '../utils/midiHelpers.js';

export class DeviceManager {
    constructor() {
        this.validationState = 'unvalidated'; // Track validation state: unvalidated, validated, invalid
        this.editingPatchListIndex = null; // Track which patch list is being edited
        this.editingControlListIndex = null; // Track which control list is being edited
        this.collapsedBanks = new Set(); // Track which banks are collapsed (by bank name)

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRenameListener();
    }

    setupRenameListener() {
        // Use event delegation for dynamically added rename button
        document.addEventListener('click', async (e) => {
            if (e.target && (e.target.id === 'btn-edit-model' || e.target.closest('#btn-edit-model'))) {
                await this.promptRenameDevice();
            }
        });
    }

    async promptRenameDevice() {
        if (!appState.selectedDevice || !appState.currentMidnam) {
            Utils.showNotification('No device selected', 'warning');
            return;
        }

        const currentModel = appState.currentMidnam.model;
        const manufacturer = appState.currentMidnam.manufacturer;
        const oldDeviceId = `${manufacturer}|${currentModel}`;

        const newModel = prompt(`Rename device "${currentModel}" to:`, currentModel);

        if (!newModel || newModel === currentModel) {
            return; // User cancelled or no change
        }

        if (!newModel.trim()) {
            Utils.showNotification('Device name cannot be empty', 'warning');
            return;
        }

        try {
            await this.renameDevice(manufacturer, currentModel, newModel.trim());
            Utils.showNotification(`Device renamed to "${newModel.trim()}"`, 'success');
        } catch (error) {
            console.error('Error renaming device:', error);
            Utils.showNotification(`Failed to rename device: ${error.message}`, 'error');
        }
    }

    async renameDevice(manufacturer, oldModel, newModel) {
        const oldDeviceId = `${manufacturer}|${oldModel}`;
        const newDeviceId = `${manufacturer}|${newModel}`;

        // Check if hosted version
        const { isHostedVersion } = await import('../core/hosting.js');

        if (isHostedVersion()) {
            // Update browser storage
            const { browserStorage } = await import('../core/storage.js');

            // Get the existing file
            const oldFilePath = appState.selectedDevice.file_path;
            const storedFile = await browserStorage.getMidnam(oldFilePath);

            if (!storedFile) {
                throw new Error('Device file not found in browser storage');
            }

            // Parse and update the XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(storedFile.midnam, 'text/xml');

            const modelElem = xmlDoc.querySelector('Model');
            if (modelElem) {
                modelElem.textContent = newModel;
            }

            // Serialize back to XML
            const updatedXml = new XMLSerializer().serializeToString(xmlDoc);

            // Create new file path
            const newFilePath = oldFilePath.replace(oldModel, newModel);

            // Delete old entry
            await browserStorage.deleteMidnam(oldFilePath);

            // Save with new name
            await browserStorage.saveMidnam({
                file_path: newFilePath,
                midnam: updatedXml,
                manufacturer: manufacturer,
                model: newModel
            });

            // Update catalog
            if (appState.catalog[oldDeviceId]) {
                delete appState.catalog[oldDeviceId];
            }

            appState.catalog[newDeviceId] = {
                manufacturer: manufacturer,
                model: newModel,
                type: 'Synth',
                files: [{ path: newFilePath }],
                fromBrowserStorage: true
            };

            // Update appState
            appState.selectedDevice.id = newDeviceId;
            appState.selectedDevice.name = newModel;
            appState.selectedDevice.file_path = newFilePath;
            appState.currentMidnam.model = newModel;

            // Refresh manufacturer list to show new name
            if (window.manufacturerManager) {
                await window.manufacturerManager.refreshManufacturerListDynamic();
            }

        } else {
            // Local version - call API to rename
            const response = await fetch('/api/middev/rename-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    manufacturer: manufacturer,
                    old_model: oldModel,
                    new_model: newModel,
                    file_path: appState.selectedDevice.file_path
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to rename device');
            }

            const result = await response.json();

            // Update appState with new values
            appState.selectedDevice.id = newDeviceId;
            appState.selectedDevice.name = newModel;
            appState.selectedDevice.file_path = result.new_file_path || appState.selectedDevice.file_path;
            appState.currentMidnam.model = newModel;

            // Refresh manufacturer list
            if (window.manufacturerManager) {
                await window.manufacturerManager.renderManufacturerList();
            }
        }

        // Re-render the device to show new name
        this.renderDeviceConfiguration();
    }

    setupEventListeners() {
        // Device save button (main click action)
        const saveBtn = document.getElementById('save-device-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveDevice();
            });
        }

        // Split button dropdown toggle
        const dropdownBtn = document.getElementById('save-device-dropdown-btn');
        const dropdownMenu = document.getElementById('save-device-menu');
        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = dropdownMenu.style.display === 'block';
                dropdownMenu.style.display = isVisible ? 'none' : 'block';
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.style.display = 'none';
                }
            });
        }

        // Save only action
        const saveOnlyBtn = document.getElementById('save-device-only');
        if (saveOnlyBtn) {
            saveOnlyBtn.addEventListener('click', () => {
                if (dropdownMenu) dropdownMenu.style.display = 'none';
                this.saveDevice();
            });
        }

        // Download action (no save required)
        const saveDownloadBtn = document.getElementById('save-device-download');
        if (saveDownloadBtn) {
            saveDownloadBtn.addEventListener('click', async () => {
                if (dropdownMenu) dropdownMenu.style.display = 'none';
                await this.showDownloadModal();
            });
        }

        // Setup download modal
        this.setupDownloadModal();

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

    clearCollapsedBanksState() {
        // Clear the collapsed banks state (useful when switching to a different device)
        this.collapsedBanks.clear();
    }

    showEmptyState() {
        const content = document.getElementById('device-content');
        if (content) {
            content.innerHTML = '<div class="empty-state" data-testid="msg_device_empty_state">Please select a device from the Manufacturer tab</div>';
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

    formatChannelAvailability(availableChannels) {
        // Format channel availability as ranges
        if (!availableChannels || availableChannels.length === 0) {
            return '(All Channels)';
        }

        // Get list of available channels (where available === true)
        const available = availableChannels
            .filter(ch => ch.available)
            .map(ch => parseInt(ch.channel))
            .sort((a, b) => a - b);

        if (available.length === 0) {
            return '(No Channels)';
        }

        if (available.length === 16) {
            return '(All Channels)';
        }

        // Create ranges
        const ranges = [];
        let start = available[0];
        let end = available[0];

        for (let i = 1; i < available.length; i++) {
            if (available[i] === end + 1) {
                end = available[i];
            } else {
                if (start === end) {
                    ranges.push(`${start}`);
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = available[i];
                end = available[i];
            }
        }

        // Add final range
        if (start === end) {
            ranges.push(`${start}`);
        } else {
            ranges.push(`${start}-${end}`);
        }

        const prefix = ranges.length === 1 ? 'Channel' : 'Channels';
        return `(${prefix} ${ranges.join(', ')})`;
    }

    generateDeviceStructureHTML(midnam) {
        return `
            <div class="structure-editor" data-testid="sec_structure_editor">
                <div class="device-info-grid" data-testid="sec_device_info_grid">
                    <div class="info-item" data-testid="sec_device_name_info">
                        <div class="info-label" data-testid="lbl_device_name">Device Name</div>
                        <div class="info-value" data-testid="div_device_name_value">${Utils.escapeHtml(midnam.deviceName || 'Unknown')}</div>
                    </div>
                    <div class="info-item" data-testid="sec_manufacturer_info">
                        <div class="info-label" data-testid="lbl_manufacturer">Manufacturer</div>
                        <div class="info-value" data-testid="div_manufacturer_value">${Utils.escapeHtml(midnam.manufacturer || 'Unknown')}</div>
                    </div>
                    <div class="info-item" data-testid="sec_model_info">
                        <div class="info-label" data-testid="lbl_model">Model</div>
                        <div class="info-value-with-action">
                            <div class="info-value" data-testid="div_model_value">${Utils.escapeHtml(midnam.model || 'Unknown')}</div>
                            <button type="button" class="btn-icon btn-edit-model" id="btn-edit-model" 
                                title="Rename device" data-testid="btn_edit_model">✏️</button>
                        </div>
                    </div>
                    <div class="info-item" data-testid="sec_version_info">
                        <div class="info-label" data-testid="lbl_version">Version</div>
                        <div class="info-value" data-testid="div_version_value">${Utils.escapeHtml(midnam.version || 'Unknown')}</div>
                    </div>
                </div>
                
                ${this.generatePatchListHTML(midnam.patchList || [])}
                ${this.generateNameSetsHTML(midnam.channelNameSets || [], midnam.patchList || [])}
                ${this.generateControlParameterAssignmentsHTML(midnam.control_lists || [], midnam.activeControlListName)}
                ${this.generateStandardDeviceModeHTML(midnam)}
            </div>
        `;
    }

    generatePatchListHTML(patchLists) {
        if (!patchLists || patchLists.length === 0) {
            return '<div class="structure-section" data-testid="sec_no_patch_lists"><h4 data-testid="hdr_no_patch_lists">No Patch Lists Found</h4></div>';
        }

        return `
            <div class="structure-section" data-testid="sec_patch_banks">
                <div style="display: flex; align-items: center; justify-content: space-between;" data-testid="hdr_patch_banks_section">
                    <h4 data-testid="hdr_patch_banks">Patch Banks (${patchLists.length})</h4>
                    <button class="btn btn-small btn-primary" onclick="deviceManager.addPatchBank()" title="Add new patch bank" data-testid="btn_add_patch_bank">+</button>
                </div>
                ${patchLists.map((patchList, index) => {
            // Check if this patch list has MIDI commands
            const hasMidiCommands = patchList.midi_commands && patchList.midi_commands.length > 0;

            // Format channel availability for display
            const channelAvailability = patchList.availableChannels ?
                this.formatChannelAvailability(patchList.availableChannels) : '';

            // Get all available NameSets for dropdown
            const nameSetOptions = (appState.currentMidnam?.channelNameSets || [])
                .map(ns => `<option value="${Utils.escapeHtml(ns.name)}" ${ns.name === patchList.channelNameSet ? 'selected' : ''}>${Utils.escapeHtml(ns.name)}</option>`)
                .join('');

            return `
                    <div class="structure-element collapsible" data-index="${index}" data-testid="itm_patch_bank_${index}">
                        <div class="element-header collapsible-header" onclick="deviceManager.togglePatchBank(${index})" data-testid="hdr_patch_bank_${index}">
                            <div class="element-name" data-testid="div_patch_bank_name_${index}">
                                <span class="toggle-icon" data-testid="icn_toggle_bank_${index}">▼</span>
                                ${this.editingPatchListIndex === index ? `
                                    <input type="text" 
                                           class="bank-name-input"
                                           value="${Utils.escapeHtml(patchList.name || `Patch Bank ${index + 1}`)}"
                                           onclick="event.stopPropagation()"
                                           onchange="deviceManager.updateBankName(${index}, this.value)"
                                           data-testid="npt_bank_name_${index}"
                                           style="display: inline-block; width: auto; min-width: 200px; margin-right: 10px;">
                                ` : Utils.escapeHtml(patchList.name || `Patch Bank ${index + 1}`)}
                                ${patchList.channelNameSet ? (this.editingPatchListIndex === index ? `
                                    <span class="nameset-selector" style="margin-left: 10px; font-size: 0.9em;">
                                        <label>NameSet:</label>
                                        <select onchange="deviceManager.movePatchBankToNameSet(${index}, this.value)" onclick="event.stopPropagation()">
                                            ${nameSetOptions}
                                        </select>
                                        <span style="color: #666; margin-left: 5px;">${channelAvailability}</span>
                                    </span>
                                ` : `
                                    <span class="nameset-label" style="margin-left: 10px; font-size: 0.9em; color: #666;">
                                        Part of NameSet: <strong>${Utils.escapeHtml(patchList.channelNameSet)}</strong> ${channelAvailability}
                                    </span>
                                `) : ''}
                            </div>
                            <div class="element-actions" data-testid="grp_patch_bank_actions_${index}">
                                <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); deviceManager.editPatchList(${index})" data-testid="btn_edit_patch_bank_${index}">${this.editingPatchListIndex === index ? 'Done' : 'Edit'}</button>
                                <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deviceManager.deletePatchList(${index})" data-testid="btn_delete_patch_bank_${index}">Delete</button>
                            </div>
                        </div>
                        <div class="element-content collapsible-content" data-testid="sec_patch_bank_content_${index}">
                            ${hasMidiCommands ? `
                                <div class="bank-midi-commands" data-testid="sec_bank_midi_commands_${index}">
                                    <strong data-testid="lbl_bank_midi_command">Bank Select MIDI Command:</strong>
                                    ${patchList.midi_commands.map(cmd => `
                                        <span class="midi-command-item" data-testid="spn_midi_command">CC${cmd.control}=${cmd.value}</span>
                                    `).join(' ')}
                                    <button class="btn btn-small btn-secondary" 
                                            onclick="event.stopPropagation(); deviceManager.sendBankSelectMidi(${index})" 
                                            title="Issue MIDI Bank Select"
                                            data-testid="btn_test_bank_select_${index}">
                                        Test Bank Select
                                    </button>
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
                                                        <span class="patch-number clickable-pc" 
                                                              data-bank-index="${index}"
                                                              data-patch-index="${patchIndex}"
                                                              data-program-change="${programChange}">${patchNumber}</span>
                                                        <span class="patch-name clickable" onclick="deviceManager.editPatchInList(${index}, ${patchIndex})" title="Click to edit patch">${Utils.escapeHtml(patchName)}</span>
                                                        <span class="patch-program-change clickable-pc" 
                                                              data-bank-index="${index}"
                                                              data-patch-index="${patchIndex}"
                                                              data-program-change="${programChange}">PC: ${programChange}</span>
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

    generateNameSetsHTML(channelNameSets, patchList) {
        if (!channelNameSets || channelNameSets.length === 0) {
            return '';  // No NameSets section if there are no NameSets
        }

        return `
            <div class="structure-section" data-testid="sec_namesets">
                <div style="display: flex; align-items: center; justify-content: space-between;" data-testid="hdr_namesets_section">
                    <h4 data-testid="hdr_namesets">NameSets (${channelNameSets.length})</h4>
                    <button class="btn btn-small btn-primary" onclick="deviceManager.addNameSet()" title="Add new NameSet" data-testid="btn_add_nameset">+</button>
                </div>
                <p class="section-description">
                    If the patch banks this device presents are dependent on MIDI channel, define a new NameSet here.
                    You can associate MIDI channels and Patch Banks with NameSets, thereby associating Patch Banks with MIDI channels.
                </p>
                ${channelNameSets.map((nameSet, index) => {
            // Get list of patch banks in this NameSet
            const banksInNameSet = patchList.filter(bank => bank.channelNameSet === nameSet.name);
            const channelAvailability = this.formatChannelAvailability(nameSet.available_channels);

            return `
                    <div class="nameset-card" data-nameset-index="${index}" data-testid="itm_nameset_${index}">
                        <div class="nameset-header" data-testid="hdr_nameset_${index}">
                            <div class="nameset-name" data-testid="div_nameset_name_${index}">
                                <strong data-testid="spn_nameset_name">${Utils.escapeHtml(nameSet.name)}</strong>
                                <span class="channel-availability" data-testid="spn_channel_availability">${channelAvailability}</span>
                            </div>
                            <div class="nameset-actions" data-testid="grp_nameset_actions_${index}">
                                <button class="btn btn-small btn-primary" onclick="deviceManager.editNameSet(${index})" title="Edit NameSet" data-testid="btn_edit_nameset_${index}">Edit</button>
                                <button class="btn btn-small btn-secondary" onclick="deviceManager.duplicateNameSet(${index})" title="Duplicate NameSet" data-testid="btn_duplicate_nameset_${index}">Duplicate</button>
                                <button class="btn btn-small btn-danger" onclick="deviceManager.deleteNameSet(${index})" title="Delete NameSet" data-testid="btn_delete_nameset_${index}">Delete</button>
                            </div>
                        </div>
                        <div class="nameset-banks">
                            <label>Patch Banks in this NameSet:</label>
                            ${banksInNameSet.length > 0 ? `
                                <ul class="bank-list">
                                    ${banksInNameSet.map(bank => `<li>${Utils.escapeHtml(bank.name)}</li>`).join('')}
                                </ul>
                            ` : '<em>No patch banks</em>'}
                        </div>
                        <div class="channel-editor" id="channel-editor-${index}" style="display: none;">
                            <label><strong>Channel Availability:</strong></label>
                            <div class="channel-grid">
                                ${Array.from({ length: 16 }, (_, i) => {
                const channelNum = i + 1;
                const channelData = nameSet.available_channels.find(ch => parseInt(ch.channel) === channelNum);
                const isAvailable = channelData ? channelData.available : false;
                return `
                                        <div class="channel-checkbox">
                                            <input type="checkbox" 
                                                   id="channel-${index}-${channelNum}" 
                                                   ${isAvailable ? 'checked' : ''}
                                                   onchange="deviceManager.updateChannelAvailability(${index}, ${channelNum}, this.checked)">
                                            <label for="channel-${index}-${channelNum}">${channelNum}</label>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        </div>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    sendBankSelectMidi(patchListIndex) {
        const patchList = appState.currentMidnam?.patchList?.[patchListIndex];
        if (patchList) {
            sendBankSelectMidi(patchList, patchList.name);
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

    generateControlParameterAssignmentsHTML(controlLists, activeControlListName) {
        if (!controlLists) controlLists = [];

        const hasLists = controlLists.length > 0;

        // Find the selected list index, with fallback logic
        let selectedListIndex = -1;
        if (activeControlListName && hasLists) {
            selectedListIndex = controlLists.findIndex(list => list.name === activeControlListName);

            // If the referenced list doesn't exist, fall back to the first list and fix the reference
            if (selectedListIndex === -1) {
                selectedListIndex = 0;
                // Update the active control list name to the first available list
                if (appState.currentMidnam) {
                    appState.currentMidnam.activeControlListName = controlLists[0].name;
                    appState.markAsChanged();
                    console.warn(`[Device] Referenced control list "${activeControlListName}" not found. Falling back to "${controlLists[0].name}"`);
                }
            }
        } else if (hasLists) {
            // No active name specified, use first list
            selectedListIndex = 0;
            if (appState.currentMidnam) {
                appState.currentMidnam.activeControlListName = controlLists[0].name;
            }
        }

        const selectedList = selectedListIndex >= 0 ? controlLists[selectedListIndex] : null;

        return `
            <div class="structure-section control-parameter-assignments">
                <div class="section-header-with-controls">
                    <h4>Control Parameter Assignments</h4>
                    <div class="control-list-controls">
                        ${hasLists ? `
                            <select class="control-list-selector" onchange="deviceManager.selectControlList(this.value)">
                                ${controlLists.map((list, index) => `
                                    <option value="${index}" ${index === selectedListIndex ? 'selected' : ''}>
                                        ${Utils.escapeHtml(list.name || `Control List ${index + 1}`)}
                                    </option>
                                `).join('')}
                            </select>
                        ` : ''}
                        <div class="control-list-add-dropdown">
                            <button class="btn btn-small btn-primary" onclick="deviceManager.toggleControlListMenu()">+</button>
                            <div class="control-list-menu" id="control-list-menu" style="display: none;">
                                <button class="menu-item" onclick="deviceManager.createNewControlList()">New List</button>
                                <button class="menu-item ${!hasLists ? 'disabled' : ''}" 
                                        onclick="deviceManager.duplicateControlList()"
                                        ${!hasLists ? 'disabled' : ''}>Duplicate</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="section-description" id="control-assignments-description">
                    <p>If this device is set to use certain MIDI continuous controllers to control or automate specific patch parameters (i.e. filter cutoff), assign them helpful names that can be presented in a DAW, if supported.</p>
                    <p>If there are multiple controller sets specified here, the currently displayed controller set will be used for the current set of patch banks.</p>
                </div>
                ${selectedList ? `
                    <div class="control-list-content">
                        <div class="control-list-info">
                            ${this.editingControlListIndex === selectedListIndex ? `
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <input type="text" 
                                           class="control-list-name-input"
                                           value="${Utils.escapeHtml(selectedList.name)}"
                                           onchange="deviceManager.updateControlListName(${selectedListIndex}, this.value)"
                                           style="font-weight: 600; padding: 0.375rem 0.5rem; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.9rem;">
                                    <span> - ${selectedList.controls.length} controller(s)</span>
                                </div>
                            ` : `
                                <p><strong>${Utils.escapeHtml(selectedList.name)}</strong> - ${selectedList.controls.length} controller(s)</p>
                            `}
                            <button class="btn btn-small btn-primary" onclick="deviceManager.editControlList(${selectedListIndex})">${this.editingControlListIndex === selectedListIndex ? 'Done' : 'Edit'}</button>
                        </div>
                        ${this.editingControlListIndex === selectedListIndex ?
                    this.renderControlListEditTable(selectedList, selectedListIndex) :
                    `<div class="control-list-items">
                                ${selectedList.controls.map(control => {
                        const defaultName = getMIDIControllerName(control.number);
                        const tooltipText = `CC${control.number}: ${defaultName}`;
                        return `
                                        <div class="control-item" title="${Utils.escapeHtml(tooltipText)}">
                                            <span class="control-number">CC${control.number}</span>
                                            <span class="control-type">${control.type}</span>
                                            <span class="control-name">${Utils.escapeHtml(control.name)}</span>
                                        </div>
                                    `;
                    }).join('')}
                            </div>`
                }
                    </div>
                ` : '<div class="empty-state">No control lists defined. Click + to create one.</div>'}
            </div>
        `;
    }

    generateStandardDeviceModeHTML(midnam) {
        const supportsStandardMode = midnam.supportsStandardDeviceMode || false;
        const standardModeName = midnam.standardDeviceModeName || 'General MIDI';

        return `
            <div class="structure-section standard-device-mode" data-testid="sec_standard_device_mode">
                <h4>General MIDI Support</h4>
                <div class="standard-mode-controls">
                    <label class="checkbox-container" data-testid="lbl_supports_standard_mode">
                        <input type="checkbox" 
                               id="supports-standard-mode-checkbox"
                               ${supportsStandardMode ? 'checked' : ''}
                               onchange="deviceManager.toggleStandardDeviceMode(this.checked)"
                               data-testid="chk_supports_standard_mode">
                        <span>Supports Standard Device Mode</span>
                    </label>
                    <div class="standard-mode-name-input" style="margin-left: 2rem; display: flex; align-items: center; gap: 0.5rem;">
                        <label for="standard-mode-name" data-testid="lbl_standard_mode_name">Name:</label>
                        <input type="text" 
                               id="standard-mode-name"
                               value="${Utils.escapeHtml(standardModeName)}"
                               onchange="deviceManager.updateStandardDeviceModeName(this.value)"
                               data-testid="npt_standard_mode_name"
                               style="padding: 0.375rem 0.5rem; border: 1px solid #ced4da; border-radius: 4px; font-size: 0.9rem; min-width: 200px;">
                    </div>
                </div>
            </div>
        `;
    }

    setupDeviceEventListeners() {
        // Add event listeners for clickable program change buttons and bank number buttons
        const pcButtons = document.querySelectorAll('.patch-program-change.clickable-pc, .patch-number.clickable-pc');

        pcButtons.forEach(button => {
            // Set up click handler
            button.addEventListener('click', () => {
                const bankIndex = parseInt(button.getAttribute('data-bank-index'));
                const patchIndex = parseInt(button.getAttribute('data-patch-index'));
                this.sendProgramChangeFromDeviceTab(bankIndex, patchIndex);
            });

            // Set up dynamic tooltip
            button.addEventListener('mouseenter', () => {
                if (window.midiManager && window.midiManager.isOutputConnected()) {
                    button.setAttribute('title', 'Send Program Change message');
                    button.style.cursor = 'url(assets/kbd.png) 8 8, pointer';
                } else {
                    button.setAttribute('title', 'Select a MIDI device to enable program changes.');
                    button.style.cursor = 'not-allowed';
                }
            });
        });
    }

    setupCollapsiblePatchBanks() {
        // Initialize patch banks and restore their previous expand/collapse state
        const patchBanks = document.querySelectorAll('.structure-element.collapsible');
        patchBanks.forEach(bank => {
            const index = bank.getAttribute('data-index');
            const bankName = this.getBankNameByIndex(parseInt(index));

            // Check if this bank was previously collapsed
            if (bankName && this.collapsedBanks.has(bankName)) {
                // Restore collapsed state
                bank.classList.remove('expanded');
                bank.classList.add('collapsed');
                const icon = bank.querySelector('.toggle-icon');
                const content = bank.querySelector('.collapsible-content');
                if (icon) icon.textContent = '▶';
                if (content) content.style.display = 'none';
            } else {
                // Default to expanded
                bank.classList.add('expanded');
                bank.classList.remove('collapsed');
                const icon = bank.querySelector('.toggle-icon');
                const content = bank.querySelector('.collapsible-content');
                if (icon) icon.textContent = '▼';
                if (content) content.style.display = 'block';
            }
        });
    }

    getBankNameByIndex(index) {
        // Get the bank name from the current patchList by index
        if (!appState.currentMidnam || !appState.currentMidnam.patchList) {
            return null;
        }
        const bank = appState.currentMidnam.patchList[index];
        return bank ? bank.name : null;
    }

    togglePatchBank(index) {
        const patchBank = document.querySelector(`.structure-element.collapsible[data-index="${index}"]`);
        if (!patchBank) return;

        const icon = patchBank.querySelector('.toggle-icon');
        const content = patchBank.querySelector('.collapsible-content');
        const bankName = this.getBankNameByIndex(index);

        if (patchBank.classList.contains('expanded')) {
            // Collapse
            patchBank.classList.remove('expanded');
            patchBank.classList.add('collapsed');
            if (icon) icon.textContent = '▶';
            if (content) content.style.display = 'none';

            // Track collapsed state
            if (bankName) {
                this.collapsedBanks.add(bankName);
            }
        } else {
            // Expand
            patchBank.classList.remove('collapsed');
            patchBank.classList.add('expanded');
            if (icon) icon.textContent = '▼';
            if (content) content.style.display = 'block';

            // Remove from collapsed tracking
            if (bankName) {
                this.collapsedBanks.delete(bankName);
            }
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

    setupDownloadModal() {
        const modal = document.getElementById('download-modal');
        const closeBtn = document.getElementById('download-modal-close');
        const cancelBtn = document.getElementById('download-modal-cancel');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close on overlay click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    }

    async showDownloadModal() {
        if (!appState.selectedDevice) {
            Utils.showNotification('No device selected', 'warning');
            return;
        }

        const modal = document.getElementById('download-modal');
        const linksContainer = document.getElementById('download-links');

        if (!modal || !linksContainer) return;

        // Clear previous links
        linksContainer.innerHTML = '';

        const deviceId = appState.selectedDevice.id;
        const filePath = appState.selectedDevice.file_path;
        const manufacturer = deviceId.split('|')[0];
        const deviceName = deviceId.split('|')[1] || 'Unknown Device';

        // Debug logging
        console.log('Download Modal - Device ID:', deviceId);
        console.log('Download Modal - File Path:', filePath);
        console.log('Download Modal - Manufacturer:', manufacturer);
        console.log('Download Modal - Device Name:', deviceName);

        // Validate file path
        if (!filePath) {
            Utils.showNotification('Error: No file path available for this device', 'error');
            console.error('Missing file_path in selectedDevice:', appState.selectedDevice);
            return;
        }

        // Create download links
        const midnamFilename = filePath.split('/').pop();
        const middevFilename = `${manufacturer.replace(' ', '_')}.middev`;

        console.log('Download Modal - MIDNAM filename:', midnamFilename);
        console.log('Download Modal - MIDDEV filename:', middevFilename);

        // Check if hosted version
        const { isHostedVersion } = await import('../core/hosting.js');
        const isHosted = isHostedVersion();

        console.log('Download Modal - Is Hosted:', isHosted);
        console.log('Download Modal - Hostname:', window.location.hostname);

        if (isHosted) {
            console.log('Download Modal - Using client-side downloads');
            // For hosted version, create client-side downloads
            // MIDNAM file link
            linksContainer.appendChild(this.createClientDownloadLinkItem(
                midnamFilename,
                'Device patch names and note mappings',
                async () => this.downloadMidnamClientSide(midnamFilename)
            ));

            // MIDDEV file link
            linksContainer.appendChild(this.createClientDownloadLinkItem(
                middevFilename,
                'Device metadata and MIDI capabilities',
                async () => this.downloadMiddevClientSide(manufacturer, middevFilename)
            ));

            // Separator
            const separator = document.createElement('div');
            separator.className = 'download-separator';
            separator.textContent = '— or download both in one file —';
            separator.setAttribute('data-testid', 'div_download_separator');
            linksContainer.appendChild(separator);

            // ZIP file link
            const zipFilename = `${manufacturer.replace(' ', '_')}_${deviceName.replace(' ', '_')}.zip`;
            const zipItem = this.createClientDownloadLinkItem(
                zipFilename,
                'Both files in a single archive',
                async () => this.downloadZipClientSide(manufacturer, deviceName, midnamFilename, middevFilename)
            );
            zipItem.classList.add('download-zip-item');
            linksContainer.appendChild(zipItem);
        } else {
            // For local version, use API endpoints
            // MIDNAM file link
            const midnamUrl = `/api/download/midnam/${encodeURIComponent(deviceId)}?file=${encodeURIComponent(filePath)}`;
            linksContainer.appendChild(this.createDownloadLinkItem(
                midnamFilename,
                'Device patch names and note mappings',
                midnamUrl
            ));

            // MIDDEV file link
            const middevUrl = `/api/download/middev/${encodeURIComponent(manufacturer)}`;
            linksContainer.appendChild(this.createDownloadLinkItem(
                middevFilename,
                'Device metadata and MIDI capabilities',
                middevUrl
            ));

            // Separator
            const separator = document.createElement('div');
            separator.className = 'download-separator';
            separator.textContent = '— or download both in one file —';
            separator.setAttribute('data-testid', 'div_download_separator');
            linksContainer.appendChild(separator);

            // ZIP file link
            const zipUrl = `/api/download/zip/${encodeURIComponent(deviceId)}?file=${encodeURIComponent(filePath)}`;
            const zipFilename = `${manufacturer.replace(' ', '_')}_${deviceName.replace(' ', '_')}.zip`;
            const zipItem = this.createDownloadLinkItem(
                zipFilename,
                'Both files in a single archive',
                zipUrl
            );
            zipItem.classList.add('download-zip-item');
            linksContainer.appendChild(zipItem);
        }

        // Show modal
        modal.style.display = 'block';
    }

    createDownloadLinkItem(filename, description, url) {
        const item = document.createElement('div');
        item.className = 'download-link-item';
        item.setAttribute('data-testid', 'itm_download_link');

        const info = document.createElement('div');
        info.className = 'download-link-info';
        info.setAttribute('data-testid', 'div_download_link_info');

        const name = document.createElement('div');
        name.className = 'download-link-name';
        name.textContent = filename;
        name.setAttribute('data-testid', 'div_download_filename');

        const desc = document.createElement('div');
        desc.className = 'download-link-description';
        desc.textContent = description;
        desc.setAttribute('data-testid', 'div_download_description');

        info.appendChild(name);
        info.appendChild(desc);

        const link = document.createElement('a');
        link.className = 'download-link-button';
        link.href = url;
        link.download = filename;
        link.textContent = 'Download';
        link.setAttribute('data-testid', 'btn_download_file');

        item.appendChild(info);
        item.appendChild(link);

        return item;
    }

    createClientDownloadLinkItem(filename, description, downloadCallback) {
        const item = document.createElement('div');
        item.className = 'download-link-item';
        item.setAttribute('data-testid', 'itm_download_link');

        const info = document.createElement('div');
        info.className = 'download-link-info';
        info.setAttribute('data-testid', 'div_download_link_info');

        const name = document.createElement('div');
        name.className = 'download-link-name';
        name.textContent = filename;
        name.setAttribute('data-testid', 'div_download_filename');

        const desc = document.createElement('div');
        desc.className = 'download-link-description';
        desc.textContent = description;
        desc.setAttribute('data-testid', 'div_download_description');

        info.appendChild(name);
        info.appendChild(desc);

        const button = document.createElement('button');
        button.className = 'download-link-button';
        button.textContent = 'Download';
        button.setAttribute('data-testid', 'btn_download_file');
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = 'Downloading...';
            try {
                await downloadCallback();
            } catch (error) {
                console.error('Download error:', error);
                Utils.showNotification(`Download failed: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Download';
            }
        });

        item.appendChild(info);
        item.appendChild(button);

        return item;
    }

    async downloadMidnamClientSide(filename) {
        try {
            // Get the current MIDNAM XML - either from raw_xml or generate it
            let midnamXml = appState.currentMidnam?.raw_xml;

            console.log('Download MIDNAM - raw_xml exists:', !!midnamXml);
            console.log('Download MIDNAM - raw_xml type:', typeof midnamXml);

            // If raw_xml is an object, serialize it
            if (midnamXml && typeof midnamXml === 'object') {
                console.log('Download MIDNAM - raw_xml is object, serializing...');
                midnamXml = this.serializeMidnamToXML(midnamXml);
            }

            if (!midnamXml || typeof midnamXml !== 'string') {
                // Check if device is in browser storage
                const { isHostedVersion } = await import('../core/hosting.js');
                if (isHostedVersion() && appState.selectedDevice?.file_path) {
                    const { browserStorage } = await import('../core/storage.js');
                    const storedFile = await browserStorage.getMidnam(appState.selectedDevice.file_path);
                    if (storedFile && storedFile.midnam) {
                        midnamXml = storedFile.midnam;
                        console.log('Download MIDNAM - Retrieved from browser storage');

                        // If stored as object, serialize it
                        if (typeof midnamXml === 'object') {
                            console.log('Download MIDNAM - Stored as object, serializing...');
                            midnamXml = this.serializeMidnamToXML(midnamXml);
                        }
                    }
                }
            }

            if (!midnamXml || typeof midnamXml !== 'string') {
                // Generate XML from current state
                console.log('Download MIDNAM - Generating from currentMidnam');
                midnamXml = this.serializeMidnamToXML(appState.currentMidnam);
            }

            // Final check
            if (typeof midnamXml !== 'string') {
                console.error('Download MIDNAM - Final type check failed:', typeof midnamXml);
                throw new Error(`MIDNAM XML is not a string, it's ${typeof midnamXml}`);
            }

            console.log('Download MIDNAM - XML length:', midnamXml.length);

            // Create and download blob
            const blob = new Blob([midnamXml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showNotification('MIDNAM file downloaded', 'success');
        } catch (error) {
            console.error('Error downloading MIDNAM:', error);
            throw error;
        }
    }

    async downloadMiddevClientSide(manufacturer, filename) {
        try {
            // Generate a basic MIDDEV XML structure
            const middevXml = `<?xml version='1.0' encoding='utf-8'?>
<MIDIDevice>
  <Manufacturer>${Utils.escapeXml(manufacturer)}</Manufacturer>
  <Devices>
    <Device Name="${Utils.escapeXml(appState.currentMidnam?.model || 'Unknown Device')}" />
  </Devices>
</MIDIDevice>`;

            // Create and download blob
            const blob = new Blob([middevXml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showNotification('MIDDEV file downloaded', 'success');
        } catch (error) {
            console.error('Error downloading MIDDEV:', error);
            throw error;
        }
    }

    async downloadZipClientSide(manufacturer, deviceName, midnamFilename, middevFilename) {
        try {
            // Dynamically import JSZip
            const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;

            const zip = new JSZip();

            // Get MIDNAM XML
            let midnamXml = appState.currentMidnam?.raw_xml;

            console.log('Download ZIP - raw_xml exists:', !!midnamXml);
            console.log('Download ZIP - raw_xml type:', typeof midnamXml);

            // If raw_xml is an object, serialize it
            if (midnamXml && typeof midnamXml === 'object') {
                console.log('Download ZIP - raw_xml is object, serializing...');
                midnamXml = this.serializeMidnamToXML(midnamXml);
            }

            if (!midnamXml || typeof midnamXml !== 'string') {
                // Check if device is in browser storage
                const { isHostedVersion } = await import('../core/hosting.js');
                if (isHostedVersion() && appState.selectedDevice?.file_path) {
                    const { browserStorage } = await import('../core/storage.js');
                    const storedFile = await browserStorage.getMidnam(appState.selectedDevice.file_path);
                    if (storedFile && storedFile.midnam) {
                        midnamXml = storedFile.midnam;
                        console.log('Download ZIP - Retrieved MIDNAM from browser storage');

                        // If stored as object, serialize it
                        if (typeof midnamXml === 'object') {
                            console.log('Download ZIP - Stored as object, serializing...');
                            midnamXml = this.serializeMidnamToXML(midnamXml);
                        }
                    }
                }
            }

            if (!midnamXml || typeof midnamXml !== 'string') {
                // Generate XML from current state
                console.log('Download ZIP - Generating from currentMidnam');
                midnamXml = this.serializeMidnamToXML(appState.currentMidnam);
            }

            // Final check
            if (typeof midnamXml !== 'string') {
                console.error('Download ZIP - MIDNAM XML type:', typeof midnamXml, midnamXml);
                throw new Error(`MIDNAM XML is not a string, it's ${typeof midnamXml}`);
            }

            console.log('Download ZIP - MIDNAM XML length:', midnamXml.length);

            // Generate MIDDEV XML
            const middevXml = `<?xml version='1.0' encoding='utf-8'?>
<MIDIDevice>
  <Manufacturer>${Utils.escapeXml(manufacturer)}</Manufacturer>
  <Devices>
    <Device Name="${Utils.escapeXml(appState.currentMidnam?.model || deviceName)}" />
  </Devices>
</MIDIDevice>`;

            console.log('Download ZIP - MIDDEV XML length:', middevXml.length);

            // Add files to ZIP
            zip.file(midnamFilename, midnamXml);
            zip.file(middevFilename, middevXml);

            // Generate ZIP blob
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            // Download
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${manufacturer.replace(' ', '_')}_${deviceName.replace(' ', '_')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showNotification('ZIP file downloaded', 'success');
        } catch (error) {
            console.error('Error downloading ZIP:', error);
            throw error;
        }
    }

    generateMidnamXmlFromState() {
        // Get current device data from appState
        const midnam = appState.currentMidnam;
        if (!midnam) {
            throw new Error('No device data available');
        }

        // If raw_xml exists and is a string, use it
        if (midnam.raw_xml && typeof midnam.raw_xml === 'string') {
            return midnam.raw_xml;
        }

        // Otherwise, serialize the full structure
        return this.serializeMidnamToXML(midnam);
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

        // Route to appropriate save method based on environment
        if (isHostedVersion()) {
            await this.saveMidnamToBrowser(filePath);
        } else {
            await this.saveMidnamToServer(filePath);
        }
    }

    async saveMidnamToBrowser(filePath) {
        try {
            const manufacturer = appState.selectedDevice?.manufacturer ||
                appState.currentMidnam?.Manufacturer ||
                'Unknown';
            const model = appState.selectedDevice?.name ||
                appState.selectedDevice?.model ||
                appState.currentMidnam?.Model ||
                'Unknown Device';

            // Convert currentMidnam object to XML string
            // ALWAYS serialize from the current object structure to capture all edits
            let midnamXml;
            if (typeof appState.currentMidnam === 'string') {
                midnamXml = appState.currentMidnam;
            } else {
                // Generate XML from the currentMidnam object structure
                // This ensures all edits (patches, banks, etc.) are included
                console.log('[Save] Serializing currentMidnam object to XML');
                console.log('[Save] Current state:', {
                    manufacturer: appState.currentMidnam.Manufacturer,
                    model: appState.currentMidnam.Model,
                    patchBankCount: appState.currentMidnam.patch_banks?.length,
                    channelNameSetCount: appState.currentMidnam.channel_name_sets?.length
                });
                midnamXml = this.serializeMidnamToXML(appState.currentMidnam);
            }

            this.logToDebugConsole(`Saving XML (${midnamXml.length} chars) to browser storage`, 'info');
            console.log('[Save] Saving to browser storage:', filePath);
            console.log('[Save] XML preview:', midnamXml.substring(0, 200));

            const result = await browserStorage.saveMidnam({
                file_path: filePath,
                midnam: midnamXml,  // Save as XML string
                manufacturer: manufacturer,
                model: model
            });

            console.log('[Save] Result:', result);

            if (result.success) {
                // Update raw_xml in appState to reflect what we just saved
                if (appState.currentMidnam && typeof appState.currentMidnam === 'object') {
                    appState.currentMidnam.raw_xml = midnamXml;
                }

                // Update the catalog entry to ensure it has the latest data
                const deviceId = `${manufacturer}|${model}`;
                if (appState.catalog[deviceId]) {
                    appState.catalog[deviceId].fromBrowserStorage = true;
                    console.log('[Save] Updated catalog entry for:', deviceId);
                }

                // Mark as saved globally
                appState.markAsSaved();

                const action = result.isUpdate ? 'Updated' : 'Saved';
                this.logToDebugConsole(`✓ ${action} in browser storage: ${filePath}`, 'success');
                Utils.showNotification(`${action} to browser storage successfully`, 'success');

                // Verify the save by reading it back
                const verification = await browserStorage.getMidnam(filePath);
                console.log('[Save] Verification - file exists:', !!verification);
                if (verification) {
                    console.log('[Save] Verification - XML length:', verification.midnam?.length);
                    console.log('[Save] Verification - XML preview:', verification.midnam?.substring(0, 200));
                }
            }
        } catch (error) {
            console.error('Error saving to browser:', error);
            this.logToDebugConsole(`✗ Failed to save to browser storage: ${error.message}`, 'error');
            Utils.showNotification(`Browser save failed: ${error.message}`, 'error');
        }
    }

    serializeMidnamToXML(midnam) {
        console.log('[Serialize] Starting serialization');
        console.log('[Serialize] Input structure:', {
            hasManufacturer: !!midnam.Manufacturer,
            hasModel: !!midnam.Model,
            patchBankCount: midnam.patch_banks?.length || 0,
            channelNameSetCount: midnam.channel_name_sets?.length || 0,
            customDeviceModeCount: midnam.custom_device_modes?.length || 0,
            noteListCount: midnam.note_lists?.length || 0
        });

        // Build complete MIDNAM XML from the object structure
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<!DOCTYPE MIDINameDocument PUBLIC "-//MIDI Manufacturers Association//DTD MIDINameDocument 1.0//EN" "http://www.midi.org/dtds/MIDINameDocument10.dtd">\n';
        xml += '<MIDINameDocument>\n';
        xml += `  <Author>${Utils.escapeXml(midnam.Author || midnam.author || 'Unknown')}</Author>\n`;
        xml += '  <MasterDeviceNames>\n';
        xml += `    <Manufacturer>${Utils.escapeXml(midnam.Manufacturer || midnam.manufacturer)}</Manufacturer>\n`;
        xml += `    <Model>${Utils.escapeXml(midnam.Model || midnam.model)}</Model>\n`;

        console.log('[Serialize] Processing patch banks:', midnam.patch_banks?.length);
        if (midnam.patch_banks) {
            midnam.patch_banks.forEach((bank, idx) => {
                console.log(`[Serialize] Bank ${idx}:`, {
                    name: bank.name,
                    patchCount: bank.patches?.length
                });
            });
        }

        // Add CustomDeviceModes
        if (midnam.custom_device_modes && midnam.custom_device_modes.length > 0) {
            midnam.custom_device_modes.forEach(mode => {
                xml += `    <CustomDeviceMode Name="${Utils.escapeXml(mode.name)}">\n`;
                xml += '      <ChannelNameSetAssignments>\n';
                if (mode.channel_name_set_assigns) {
                    mode.channel_name_set_assigns.forEach(assign => {
                        xml += `        <ChannelNameSetAssign Channel="${assign.channel}" NameSet="${Utils.escapeXml(assign.name_set)}" />\n`;
                    });
                }
                xml += '      </ChannelNameSetAssignments>\n';
                xml += '    </CustomDeviceMode>\n';
            });
        }

        // Add ChannelNameSets
        if (midnam.channel_name_sets && midnam.channel_name_sets.length > 0) {
            midnam.channel_name_sets.forEach(cns => {
                xml += `    <ChannelNameSet Name="${Utils.escapeXml(cns.name)}">\n`;
                xml += '      <AvailableForChannels>\n';
                if (cns.available_channels) {
                    cns.available_channels.forEach(ac => {
                        xml += `        <AvailableChannel Channel="${ac.channel}" Available="${ac.available ? 'true' : 'false'}" />\n`;
                    });
                }
                xml += '      </AvailableForChannels>\n';

                // Reference PatchBanks
                if (cns.patch_banks) {
                    cns.patch_banks.forEach(pb => {
                        if (typeof pb === 'string') {
                            xml += `      <PatchBank Name="${Utils.escapeXml(pb)}" />\n`;
                        } else if (pb.name) {
                            xml += `      <PatchBank Name="${Utils.escapeXml(pb.name)}" />\n`;
                        }
                    });
                }

                xml += '    </ChannelNameSet>\n';
            });
        }

        // Add PatchBanks
        if (midnam.patch_banks && midnam.patch_banks.length > 0) {
            midnam.patch_banks.forEach(bank => {
                xml += `    <PatchBank Name="${Utils.escapeXml(bank.name)}">\n`;

                // Add MIDI Commands if present
                if (bank.midi_commands && bank.midi_commands.length > 0) {
                    xml += '      <MIDICommands>\n';
                    bank.midi_commands.forEach(cmd => {
                        const attrs = Object.entries(cmd)
                            .filter(([key]) => key !== 'type')
                            .map(([key, value]) => `${key}="${Utils.escapeXml(String(value))}"`)
                            .join(' ');
                        xml += `        <${cmd.type} ${attrs} />\n`;
                    });
                    xml += '      </MIDICommands>\n';
                }

                xml += '      <PatchNameList>\n';
                if (bank.patches && bank.patches.length > 0) {
                    bank.patches.forEach(patch => {
                        const patchNumber = patch.Number || patch.number;
                        const patchName = patch.name || 'Unnamed';
                        const programChange = patch.programChange !== undefined ? patch.programChange : patchNumber;

                        xml += `        <Patch Number="${patchNumber}" Name="${Utils.escapeXml(patchName)}" ProgramChange="${programChange}"`;

                        if (patch.note_list_name) {
                            xml += '>\n';
                            xml += `          <UsesNoteNameList Name="${Utils.escapeXml(patch.note_list_name)}" />\n`;
                            xml += '        </Patch>\n';
                        } else {
                            xml += ' />\n';
                        }
                    });
                }
                xml += '      </PatchNameList>\n';
                xml += '    </PatchBank>\n';
            });
        }

        // Add NoteNameLists
        if (midnam.note_lists && midnam.note_lists.length > 0) {
            midnam.note_lists.forEach(noteList => {
                xml += `    <NoteNameList Name="${Utils.escapeXml(noteList.name)}">\n`;
                if (noteList.notes && noteList.notes.length > 0) {
                    noteList.notes.forEach(note => {
                        xml += `      <Note Number="${note.number}" Name="${Utils.escapeXml(note.name)}" />\n`;
                    });
                }
                xml += '    </NoteNameList>\n';
            });
        }

        xml += '  </MasterDeviceNames>\n';
        xml += '</MIDINameDocument>\n';

        return xml;
    }

    async saveMidnamToServer(filePath) {
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
            Utils.showNotification('Changes saved to file successfully', 'success');
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

        // Check if hosted version
        const { isHostedVersion } = await import('../core/hosting.js');

        if (isHostedVersion()) {
            // Client-side validation for hosted version
            try {
                await this.validateDeviceClientSide(filePath);
            } catch (error) {
                console.error('Error validating file:', error);
                this.logToDebugConsole(`Validation error: ${error.message}`, 'error');
                Utils.showNotification('Failed to validate file', 'error');
            }
            return;
        }

        // Server-side validation for local version
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

    async validateDeviceClientSide(filePath) {
        // Get the XML content
        let xmlContent = appState.currentMidnam?.raw_xml;

        if (!xmlContent) {
            // Try to get from browser storage
            const { browserStorage } = await import('../core/storage.js');
            const storedFile = await browserStorage.getMidnam(filePath);
            if (storedFile && storedFile.midnam) {
                xmlContent = storedFile.midnam;
            }
        }

        if (!xmlContent) {
            throw new Error('No XML content available for validation');
        }

        this.logToDebugConsole('Performing client-side XML validation...', 'info');

        // Parse XML using DOMParser
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        // Check for parse errors
        const parseError = xmlDoc.querySelector('parsererror');

        if (parseError) {
            // Extract error details
            const errorText = parseError.textContent || parseError.innerText || 'Unknown XML error';
            const errors = [];

            // Try to extract line and column info if available
            const lineMatch = errorText.match(/line (\d+)/i);
            const colMatch = errorText.match(/column (\d+)/i);

            errors.push({
                line: lineMatch ? parseInt(lineMatch[1]) : 'unknown',
                column: colMatch ? parseInt(colMatch[1]) : 'unknown',
                message: errorText
            });

            this.setValidationState('invalid');
            this.logToDebugConsole('✗ Validation FAILED', 'error');
            this.logToDebugConsole(`Found ${errors.length} error(s):`, 'error');

            errors.forEach((error, index) => {
                this.logToDebugConsole(
                    `  Error ${index + 1}: Line ${error.line}, Column ${error.column} - ${error.message}`,
                    'error'
                );
            });

            Utils.showNotification('Validation failed - see debug console', 'error');
        } else {
            // Basic structure validation
            const warnings = [];

            // Check for required elements
            const manufacturer = xmlDoc.querySelector('Manufacturer');
            const model = xmlDoc.querySelector('Model');
            const masterDeviceNames = xmlDoc.querySelector('MasterDeviceNames');

            if (!manufacturer) {
                warnings.push('Missing <Manufacturer> element');
            }
            if (!model) {
                warnings.push('Missing <Model> element');
            }
            if (!masterDeviceNames) {
                warnings.push('Missing <MasterDeviceNames> element');
            }

            if (warnings.length > 0) {
                this.setValidationState('invalid');
                this.logToDebugConsole('✗ Validation completed with warnings', 'error');
                warnings.forEach(warning => {
                    this.logToDebugConsole(`  Warning: ${warning}`, 'error');
                });
                Utils.showNotification('Validation completed with warnings', 'warning');
            } else {
                this.setValidationState('validated');
                this.logToDebugConsole('✓ Validation PASSED', 'success');
                this.logToDebugConsole('XML is well-formed with required elements', 'success');
                Utils.showNotification('File validated successfully', 'success');
            }
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

    async reloadDevice() {
        /**
         * Reload the current device from disk, clearing cache and re-indexing.
         * Useful for testing to verify that saved changes persist.
         * Returns the reloaded device data.
         */

        // Check if we have a device loaded
        if (!appState.selectedDevice || !appState.currentMidnam) {
            Utils.showNotification('No device loaded to reload', 'warning');
            return null;
        }

        // Get the file path from the selected device
        const filePath = appState.selectedDevice.file_path || appState.currentMidnam.file_path;
        const deviceId = appState.selectedDevice.id;

        if (!filePath) {
            Utils.showNotification('Cannot determine file path for reload', 'error');
            this.logToDebugConsole('Reload failed: no file path available', 'error');
            return null;
        }

        this.logToDebugConsole(`Reloading device from: ${filePath}`, 'info');

        try {
            const response = await fetch('/api/midnam/reload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_path: filePath,
                    device_id: deviceId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logToDebugConsole(`✗ Reload failed: ${errorText}`, 'error');
                Utils.showNotification('Failed to reload device', 'error');
                return null;
            }

            const deviceData = await response.json();

            // Update appState with reloaded data
            appState.currentMidnam = deviceData;
            appState.selectedDevice.file_path = filePath;

            // Transform device data using the manufacturer manager's transform function
            if (window.manufacturerManager && window.manufacturerManager.transformDeviceData) {
                await window.manufacturerManager.transformDeviceData(deviceData);
            }

            // Re-render device configuration with fresh data
            this.renderDeviceConfiguration();

            // Mark as saved (no unsaved changes after reload)
            appState.markAsSaved();

            this.logToDebugConsole(`✓ Device reloaded successfully from: ${filePath}`, 'success');
            this.logToDebugConsole(`  Found ${deviceData.channel_name_sets?.length || 0} channel name sets`, 'info');
            this.logToDebugConsole(`  Found ${deviceData.patch_banks?.length || 0} patch banks`, 'info');

            Utils.showNotification('Device reloaded successfully', 'success');

            return deviceData;

        } catch (error) {
            console.error('Error reloading device:', error);
            this.logToDebugConsole(`✗ Error reloading device: ${error.message}`, 'error');
            Utils.showNotification('Failed to reload device', 'error');
            return null;
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

        // Determine which ChannelNameSet to use for the new bank
        let targetChannelNameSet = null;

        // First, try to use the same ChannelNameSet as existing banks
        if (appState.currentMidnam.patchList.length > 0) {
            const firstBank = appState.currentMidnam.patchList[0];
            if (firstBank.channelNameSet) {
                targetChannelNameSet = firstBank.channelNameSet;
            }
        }

        // If no existing banks or they don't have a ChannelNameSet, use the first available ChannelNameSet
        if (!targetChannelNameSet && appState.currentMidnam.channelNameSets && appState.currentMidnam.channelNameSets.length > 0) {
            targetChannelNameSet = appState.currentMidnam.channelNameSets[0].name;
        }

        // If still no ChannelNameSet found, create a default one
        if (!targetChannelNameSet) {
            if (!appState.currentMidnam.channelNameSets) {
                appState.currentMidnam.channelNameSets = [];
            }
            const defaultNameSet = {
                name: 'Name Set 1',
                available_channels: Array.from({ length: 16 }, (_, i) => ({
                    channel: String(i + 1),
                    available: true
                })),
                patch_banks: []
            };
            appState.currentMidnam.channelNameSets.push(defaultNameSet);
            targetChannelNameSet = defaultNameSet.name;
            this.logToDebugConsole(`Created default ChannelNameSet "${targetChannelNameSet}"`, 'info');
        }

        // Find the highest Control 32 value across all banks
        let highestCC32 = -1;
        for (const bank of appState.currentMidnam.patchList) {
            if (bank.midi_commands) {
                for (const cmd of bank.midi_commands) {
                    if (cmd.control === '32' || cmd.control === 32) {
                        const value = parseInt(cmd.value);
                        if (!isNaN(value) && value > highestCC32) {
                            highestCC32 = value;
                        }
                    }
                }
            }
        }

        // Calculate new CC32 value (increment from highest, default to 0 if none found)
        const newCC32Value = highestCC32 >= 0 ? highestCC32 + 1 : 0;

        // Get the available channels from the target ChannelNameSet
        const targetNameSet = appState.currentMidnam.channelNameSets?.find(ns => ns.name === targetChannelNameSet);
        const availableChannels = targetNameSet?.available_channels || [];

        // Create new bank with a default patch and default MIDI commands
        const newBankIndex = appState.currentMidnam.patchList.length;
        const newBank = {
            name: `New Bank ${newBankIndex + 1}`,
            channelNameSet: targetChannelNameSet,  // CRITICAL: Set the ChannelNameSet so the bank can be saved
            availableChannels: availableChannels,  // Set the available channels for display in header
            midi_commands: [
                { type: 'ControlChange', control: '0', value: '0' },
                { type: 'ControlChange', control: '32', value: newCC32Value.toString() }
            ],
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

        this.logToDebugConsole(`Added new bank "${newBank.name}" to ChannelNameSet "${targetChannelNameSet}"`, 'info');
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

    // Control List management methods
    toggleControlListMenu() {
        const menu = document.getElementById('control-list-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    }

    selectControlList(index) {
        if (!appState.currentMidnam || !appState.currentMidnam.control_lists) return;

        const selectedList = appState.currentMidnam.control_lists[index];
        if (selectedList) {
            appState.currentMidnam.activeControlListName = selectedList.name;
            // Mark as changed since we're changing which control list is active
            appState.markAsChanged();
            // Re-render to show the selected list
            this.renderDeviceConfiguration();
        }
    }

    createNewControlList() {
        if (!appState.currentMidnam) return;

        // Hide the menu
        const menu = document.getElementById('control-list-menu');
        if (menu) menu.style.display = 'none';

        // Initialize control_lists if it doesn't exist
        if (!appState.currentMidnam.control_lists) {
            appState.currentMidnam.control_lists = [];
        }

        // Create new list with default controllers
        const newList = {
            name: 'Controls',
            controls: [
                { type: '7bit', number: 1, name: 'Modulation Wheel or Lever' },
                { type: '7bit', number: 7, name: 'Channel Volume' },
                { type: '7bit', number: 10, name: 'Pan' },
                { type: '7bit', number: 11, name: 'Expression Controller' },
                { type: '7bit', number: 64, name: 'Damper Pedal on/off (Sustain) ≤63 off, ≥64 on' }
            ]
        };

        // Add the new list
        appState.currentMidnam.control_lists.push(newList);
        appState.currentMidnam.activeControlListName = newList.name;

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        Utils.showNotification('New control list created', 'success');
    }

    duplicateControlList() {
        if (!appState.currentMidnam || !appState.currentMidnam.control_lists || appState.currentMidnam.control_lists.length === 0) {
            return;
        }

        // Hide the menu
        const menu = document.getElementById('control-list-menu');
        if (menu) menu.style.display = 'none';

        // Find the currently active list
        const activeListName = appState.currentMidnam.activeControlListName;
        const activeList = appState.currentMidnam.control_lists.find(list => list.name === activeListName) ||
            appState.currentMidnam.control_lists[0];

        // Create a duplicate with a unique name
        let baseName = activeList.name;
        let counter = 1;
        let newName = `${baseName} ${counter}`;

        // Find a unique name
        while (appState.currentMidnam.control_lists.some(list => list.name === newName)) {
            counter++;
            newName = `${baseName} ${counter}`;
        }

        // Create the duplicate
        const duplicateList = {
            name: newName,
            controls: activeList.controls.map(control => ({ ...control })) // Deep copy
        };

        // Add the duplicate
        appState.currentMidnam.control_lists.push(duplicateList);
        appState.currentMidnam.activeControlListName = duplicateList.name;

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        Utils.showNotification(`Duplicated to "${newName}"`, 'success');
    }

    // Control list editing methods
    editControlList(index) {
        // Toggle edit mode for this control list
        if (this.editingControlListIndex === index) {
            // Exit edit mode
            this.editingControlListIndex = null;
        } else {
            // Enter edit mode
            this.editingControlListIndex = index;
        }

        // Re-render the device configuration to show/hide edit mode
        this.renderDeviceConfiguration();
    }

    updateControlListName(listIndex, newName) {
        const controlList = appState.currentMidnam?.control_lists?.[listIndex];
        if (!controlList) return;

        const trimmedName = newName.trim();
        if (!trimmedName) {
            Utils.showNotification('Control list name cannot be empty', 'warning');
            this.renderDeviceConfiguration();
            return;
        }

        // Store the old name to check if this is the active list
        const oldName = controlList.name;

        // Update the control list name
        controlList.name = trimmedName;

        // If this was the active control list, update the activeControlListName reference
        if (appState.currentMidnam.activeControlListName === oldName) {
            appState.currentMidnam.activeControlListName = trimmedName;
        }

        // Mark as changed
        appState.markAsChanged();

        // Re-render to show updated name
        this.renderDeviceConfiguration();
    }

    renderControlListEditTable(controlList, listIndex) {
        const controls = controlList.controls || [];

        if (controls.length === 0) {
            return '<div class="empty-state">No controls in this list. Add controls using the + button.</div>';
        }

        return `
            <div class="control-edit-table-container">
                <table class="control-edit-table">
                    <thead>
                        <tr>
                            <th class="type-column">Type</th>
                            <th>CC#</th>
                            <th>Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="control-edit-tbody-${listIndex}">
                        ${controls.map((control, index) => {
            const defaultName = getMIDIControllerName(control.number);
            const tooltipText = `CC${control.number}: ${defaultName}`;

            return `
                                <tr data-control-index="${index}" title="${Utils.escapeHtml(tooltipText)}">
                                    <td class="type-column">
                                        <select class="control-type-select"
                                                data-list-index="${listIndex}"
                                                data-control-index="${index}"
                                                tabindex="-1"
                                                onchange="deviceManager.updateControlInList(${listIndex}, ${index}, 'type', this.value)">
                                            <option value="7bit" ${control.type === '7bit' ? 'selected' : ''}>7bit</option>
                                            <option value="14bit" ${control.type === '14bit' ? 'selected' : ''}>14bit</option>
                                            <option value="RPN" ${control.type === 'RPN' ? 'selected' : ''}>RPN</option>
                                            <option value="NRPN" ${control.type === 'NRPN' ? 'selected' : ''}>NRPN</option>
                                        </select>
                                    </td>
                                    <td>
                                        <input type="number" 
                                               class="control-number-input"
                                               data-list-index="${listIndex}"
                                               data-control-index="${index}"
                                               tabindex="0"
                                               value="${control.number}"
                                               min="0"
                                               max="127"
                                               onkeydown="deviceManager.handleControlEditKeydown(event, ${listIndex}, ${index}, 'number')"
                                               onchange="deviceManager.updateControlInList(${listIndex}, ${index}, 'number', this.value)">
                                    </td>
                                    <td>
                                        <input type="text" 
                                               class="control-name-input-edit"
                                               data-list-index="${listIndex}"
                                               data-control-index="${index}"
                                               tabindex="0"
                                               value="${Utils.escapeHtml(control.name)}"
                                               onkeydown="deviceManager.handleControlEditKeydown(event, ${listIndex}, ${index}, 'name')"
                                               onchange="deviceManager.updateControlInList(${listIndex}, ${index}, 'name', this.value)">
                                    </td>
                                    <td class="control-edit-actions">
                                        <button class="btn btn-sm btn-outline-primary" 
                                                tabindex="0"
                                                data-list-index="${listIndex}"
                                                data-control-index="${index}"
                                                onkeydown="deviceManager.handleControlEditKeydown(event, ${listIndex}, ${index}, 'insert')"
                                                onclick="deviceManager.insertControlInList(${listIndex}, ${index})"
                                                title="Insert control after this one">
                                            +I
                                        </button>
                                        <button class="btn btn-sm btn-danger" 
                                                tabindex="-1"
                                                onclick="deviceManager.deleteControlInList(${listIndex}, ${index})"
                                                title="Delete this control">
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

    updateControlInList(listIndex, controlIndex, field, value) {
        const controlList = appState.currentMidnam?.control_lists?.[listIndex];
        if (!controlList || !controlList.controls || !controlList.controls[controlIndex]) return;

        const control = controlList.controls[controlIndex];

        if (field === 'number') {
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 127) {
                Utils.showNotification('Controller number must be between 0 and 127', 'warning');
                return;
            }
            control[field] = numValue;

            // Update the tooltip by re-rendering
            this.renderDeviceConfiguration();
        } else {
            control[field] = value;
        }

        // Mark as changed
        appState.markAsChanged();
    }

    handleControlEditKeydown(event, listIndex, controlIndex, field) {
        // Handle Enter key on name field - jump to Insert button
        if (event.key === 'Enter') {
            event.preventDefault();
            if (field === 'name') {
                this.focusControlEditField(listIndex, controlIndex, 'insert');
            } else if (field === 'insert') {
                // Insert and focus new row
                this.insertControlInList(listIndex, controlIndex);
            }
            return;
        }

        if (event.key !== 'Tab') return;

        event.preventDefault();

        const tbody = document.getElementById(`control-edit-tbody-${listIndex}`);
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        const currentRow = rows[controlIndex];
        if (!currentRow) return;

        // Define field order (type is excluded from tab sequence)
        const fields = ['number', 'name', 'insert'];
        const currentFieldIndex = fields.indexOf(field);

        if (event.shiftKey) {
            // Shift-Tab: go to previous field or previous row
            if (currentFieldIndex === 0) {
                // First field, go to last field of previous row
                if (controlIndex > 0) {
                    const prevRow = rows[controlIndex - 1];
                    const insertBtn = prevRow.querySelector('button[tabindex="0"]');
                    if (insertBtn) insertBtn.focus();
                }
            } else {
                // Go to previous field in same row
                const prevField = fields[currentFieldIndex - 1];
                this.focusControlEditField(listIndex, controlIndex, prevField);
            }
        } else {
            // Tab: go to next field or next row
            if (currentFieldIndex === fields.length - 1) {
                // Last field, go to first field of next row
                if (controlIndex < rows.length - 1) {
                    this.focusControlEditField(listIndex, controlIndex + 1, 'number');
                }
            } else {
                // Go to next field in same row
                const nextField = fields[currentFieldIndex + 1];
                this.focusControlEditField(listIndex, controlIndex, nextField);
            }
        }
    }

    focusControlEditField(listIndex, controlIndex, field) {
        const tbody = document.getElementById(`control-edit-tbody-${listIndex}`);
        if (!tbody) return;

        const row = tbody.querySelector(`tr[data-control-index="${controlIndex}"]`);
        if (!row) return;

        let element;
        if (field === 'number') {
            element = row.querySelector('.control-number-input');
        } else if (field === 'type') {
            element = row.querySelector('.control-type-select');
        } else if (field === 'name') {
            element = row.querySelector('.control-name-input-edit');
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

    insertControlInList(listIndex, controlIndex) {
        const controlList = appState.currentMidnam?.control_lists?.[listIndex];
        if (!controlList || !controlList.controls) return;

        const controls = controlList.controls;

        // Insert after the current row
        const insertPosition = controlIndex + 1;

        // Find an unused controller number (start from 1)
        let newControlNumber = 1;
        const usedNumbers = new Set(controls.map(c => c.number));
        while (usedNumbers.has(newControlNumber) && newControlNumber <= 127) {
            newControlNumber++;
        }

        // Get default name for this controller number
        const defaultName = getMIDIControllerName(newControlNumber);

        // Create new control
        const newControl = {
            type: '7bit',
            number: newControlNumber,
            name: defaultName
        };

        // Insert at position (after current row)
        controls.splice(insertPosition, 0, newControl);

        appState.markAsChanged();
        this.renderDeviceConfiguration();

        // Focus and select the name field of the new control
        setTimeout(() => {
            this.focusControlEditField(listIndex, insertPosition, 'name');
        }, 0);
    }

    deleteControlInList(listIndex, controlIndex) {
        const controlList = appState.currentMidnam?.control_lists?.[listIndex];
        if (!controlList || !controlList.controls) return;

        const controls = controlList.controls;

        if (controls.length === 1) {
            Utils.showNotification('Cannot delete the last control', 'warning');
            return;
        }

        // Remove control
        controls.splice(controlIndex, 1);

        appState.markAsChanged();
        this.renderDeviceConfiguration();
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
        const midiCommands = patchList.midi_commands || [];

        // MIDI Commands section
        const midiCommandsHTML = `
            <div class="midi-commands-editor">
                <div class="midi-commands-header">
                    <h5>Bank Select Controls</h5>
                    <button class="btn btn-sm btn-primary" onclick="deviceManager.addMidiCommand(${listIndex})" title="Add MIDI Command">+</button>
                </div>
                ${midiCommands.length === 0 ? '<p class="empty-state">No MIDI commands defined for this bank</p>' : `
                    <div class="midi-commands-list">
                        ${midiCommands.map((cmd, cmdIndex) => `
                            <div class="midi-command-item-edit">
                                <label>Control:</label>
                                <input type="number" 
                                       class="midi-control-input"
                                       value="${cmd.control || 0}"
                                       min="0"
                                       max="127"
                                       onchange="deviceManager.updateMidiCommand(${listIndex}, ${cmdIndex}, 'control', this.value)">
                                <label>Value:</label>
                                <input type="number" 
                                       class="midi-value-input"
                                       value="${cmd.value || 0}"
                                       min="0"
                                       max="127"
                                       onchange="deviceManager.updateMidiCommand(${listIndex}, ${cmdIndex}, 'value', this.value)">
                                <button class="btn btn-sm btn-danger" 
                                        onclick="deviceManager.deleteMidiCommand(${listIndex}, ${cmdIndex})"
                                        title="Delete MIDI Command">×</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        if (patches.length === 0) {
            return midiCommandsHTML + '<div class="empty-state">No patches in this bank. Add patches using the patch editor.</div>';
        }

        return `
            ${midiCommandsHTML}
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
                                               autocomplete="off"
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
                                               autocomplete="off"
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
                                               autocomplete="off"
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

    toggleStandardDeviceMode(checked) {
        if (!appState.currentMidnam) return;

        // Update the flag
        appState.currentMidnam.supportsStandardDeviceMode = checked;

        // If enabling and no name set, use default
        if (checked && !appState.currentMidnam.standardDeviceModeName) {
            appState.currentMidnam.standardDeviceModeName = 'General MIDI';
        }

        // Mark as changed
        appState.markAsChanged();

        console.log(`[Device] Standard Device Mode ${checked ? 'enabled' : 'disabled'}`);
    }

    updateStandardDeviceModeName(value) {
        if (!appState.currentMidnam) return;

        const newName = value.trim();
        if (!newName) {
            Utils.showNotification('Standard Device Mode name cannot be empty', 'warning');
            // Reset to previous value
            document.getElementById('standard-mode-name').value = appState.currentMidnam.standardDeviceModeName || 'General MIDI';
            return;
        }

        // Update the name
        appState.currentMidnam.standardDeviceModeName = newName;

        // Mark as changed
        appState.markAsChanged();

        console.log(`[Device] Standard Device Mode name updated to: ${newName}`);
    }

    movePatchBankToNameSet(listIndex, newNameSet) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList) return;

        const oldNameSet = patchList.channelNameSet;
        if (oldNameSet === newNameSet) return;

        // Find the new NameSet in the channelNameSets array
        const nameSetData = appState.currentMidnam.channelNameSets.find(ns => ns.name === newNameSet);
        if (!nameSetData) {
            Utils.showNotification('Target NameSet not found', 'error');
            return;
        }

        // Update the patch bank's NameSet association and channel availability
        patchList.channelNameSet = newNameSet;
        patchList.availableChannels = nameSetData.available_channels;

        // Mark as changed
        appState.markAsChanged();

        // Re-render to update the display
        this.renderDeviceConfiguration();

        // Log the move
        this.logToDebugConsole(`Moved patch bank "${patchList.name}" from NameSet "${oldNameSet}" to "${newNameSet}"`, 'info');
        Utils.showNotification(`Patch bank moved to NameSet "${newNameSet}"`, 'success');
    }

    // NameSet management methods
    editNameSet(index) {
        // Toggle the channel editor visibility
        const editor = document.getElementById(`channel-editor-${index}`);
        if (editor) {
            if (editor.style.display === 'none') {
                editor.style.display = 'block';
            } else {
                editor.style.display = 'none';
            }
        }
    }

    updateChannelAvailability(nameSetIndex, channelNum, isAvailable) {
        const nameSet = appState.currentMidnam?.channelNameSets?.[nameSetIndex];
        if (!nameSet) return;

        // Find or create the channel entry
        let channelData = nameSet.available_channels.find(ch => parseInt(ch.channel) === channelNum);
        if (channelData) {
            channelData.available = isAvailable;
        } else {
            // Add new channel entry
            nameSet.available_channels.push({
                channel: String(channelNum),
                available: isAvailable
            });
        }

        // Update all patch banks that use this NameSet
        const patchBanks = appState.currentMidnam.patchList.filter(bank => bank.channelNameSet === nameSet.name);
        patchBanks.forEach(bank => {
            bank.availableChannels = nameSet.available_channels;
        });

        // Mark as changed
        appState.markAsChanged();

        // Re-render to update the display
        this.renderDeviceConfiguration();

        this.logToDebugConsole(`Updated channel ${channelNum} availability for NameSet "${nameSet.name}" to ${isAvailable}`, 'info');
    }

    addNameSet() {
        if (!appState.currentMidnam) return;

        // Ensure channelNameSets array exists
        if (!appState.currentMidnam.channelNameSets) {
            appState.currentMidnam.channelNameSets = [];
        }

        // Generate unique name
        let nameCounter = appState.currentMidnam.channelNameSets.length + 1;
        let newName = `Name Set ${nameCounter}`;
        while (appState.currentMidnam.channelNameSets.find(ns => ns.name === newName)) {
            nameCounter++;
            newName = `Name Set ${nameCounter}`;
        }

        // Create new NameSet with all channels available by default
        const newNameSet = {
            name: newName,
            available_channels: Array.from({ length: 16 }, (_, i) => ({
                channel: String(i + 1),
                available: true
            })),
            patch_banks: []
        };

        appState.currentMidnam.channelNameSets.push(newNameSet);

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        this.logToDebugConsole(`Added new NameSet "${newName}"`, 'info');
        Utils.showNotification(`NameSet "${newName}" added`, 'success');
    }

    duplicateNameSet(index) {
        const nameSet = appState.currentMidnam?.channelNameSets?.[index];
        if (!nameSet) return;

        // Generate unique name
        let nameCounter = 1;
        let newName = `${nameSet.name} Copy ${nameCounter}`;
        while (appState.currentMidnam.channelNameSets.find(ns => ns.name === newName)) {
            nameCounter++;
            newName = `${nameSet.name} Copy ${nameCounter}`;
        }

        // Create duplicate with deep copy of available channels
        const duplicate = {
            name: newName,
            available_channels: nameSet.available_channels.map(ch => ({ ...ch })),
            patch_banks: []  // Don't copy patch banks
        };

        appState.currentMidnam.channelNameSets.push(duplicate);

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        this.logToDebugConsole(`Duplicated NameSet "${nameSet.name}" as "${newName}"`, 'info');
        Utils.showNotification(`NameSet duplicated as "${newName}"`, 'success');
    }

    async deleteNameSet(index) {
        const nameSet = appState.currentMidnam?.channelNameSets?.[index];
        if (!nameSet) return;

        // Check if any patch banks use this NameSet
        const banksInNameSet = appState.currentMidnam.patchList.filter(bank => bank.channelNameSet === nameSet.name);

        if (banksInNameSet.length > 0) {
            const bankNames = banksInNameSet.map(b => b.name).join('", "');
            Utils.showNotification(
                `Cannot delete NameSet: Choose a different NameSet for the following Patch Banks before deleting: "${bankNames}"`,
                'error'
            );
            this.logToDebugConsole(
                `Cannot delete NameSet "${nameSet.name}" - used by ${banksInNameSet.length} patch bank(s)`,
                'error'
            );
            return;
        }

        // Confirm deletion
        const confirmed = await modal.confirm(
            `Are you sure you want to delete NameSet "${nameSet.name}"?`,
            'Delete NameSet'
        );

        if (!confirmed) return;

        // Remove from array
        appState.currentMidnam.channelNameSets.splice(index, 1);

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        this.logToDebugConsole(`Deleted NameSet "${nameSet.name}"`, 'info');
        Utils.showNotification(`NameSet "${nameSet.name}" deleted`, 'success');
    }

    // MIDI Command editing methods
    addMidiCommand(listIndex) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList) return;

        if (!patchList.midi_commands) {
            patchList.midi_commands = [];
        }

        // Add a new MIDI command with default values
        patchList.midi_commands.push({
            type: 'ControlChange',
            control: 0,
            value: 0
        });

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        // Ensure the patch bank stays expanded after render
        setTimeout(() => {
            const element = document.querySelector(`[data-index="${listIndex}"] .collapsible-content`);
            if (element) {
                element.style.display = 'block';
                const parent = element.closest('.collapsible');
                if (parent) {
                    parent.classList.add('expanded');
                }
            }
        }, 0);
    }

    updateMidiCommand(listIndex, cmdIndex, field, value) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList || !patchList.midi_commands || !patchList.midi_commands[cmdIndex]) return;

        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 127) {
            Utils.showNotification('Value must be between 0 and 127', 'warning');
            return;
        }

        patchList.midi_commands[cmdIndex][field] = numValue.toString();

        // Mark as changed
        appState.markAsChanged();
    }

    deleteMidiCommand(listIndex, cmdIndex) {
        const patchList = appState.currentMidnam?.patchList?.[listIndex];
        if (!patchList || !patchList.midi_commands) return;

        // Remove the MIDI command
        patchList.midi_commands.splice(cmdIndex, 1);

        // Mark as changed
        appState.markAsChanged();

        // Re-render
        this.renderDeviceConfiguration();

        // Ensure the patch bank stays expanded after render
        setTimeout(() => {
            const element = document.querySelector(`[data-index="${listIndex}"] .collapsible-content`);
            if (element) {
                element.style.display = 'block';
                const parent = element.closest('.collapsible');
                if (parent) {
                    parent.classList.add('expanded');
                }
            }
        }, 0);
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
        await testPatch(patchList, patch, patchIndex);
    }

    async sendProgramChangeFromDeviceTab(bankIndex, patchIndex) {
        const patchList = appState.currentMidnam?.patchList?.[bankIndex];
        if (!patchList || !patchList.patch) return;

        const patch = patchList.patch[patchIndex];
        if (!patch) return;

        const patchName = patch.name || `Patch ${patchIndex + 1}`;
        await sendProgramChange(patchList, patch, patchIndex, patchName);
    }
}

// Create global instance
export const deviceManager = new DeviceManager();

// Make it globally available
window.deviceManager = deviceManager;

