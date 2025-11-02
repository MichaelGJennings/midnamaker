// Tools module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { midiManager } from './midi.js';

export class ToolsManager {
    constructor() {
        this.debugConsole = null;
        this.allNoteNames = new Set();
        this.selectedToolsSort = 'alphabetical';
        this.messageBuffer = []; // Buffer messages until debug console is available
        this.toolsTabLoaded = false; // Track if Tools tab has been loaded
        this.toolsTabActivated = false; // Track if we've logged the activation message
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Initialize debug console - will be updated when Tools tab loads
        this.ensureDebugConsole();
        
        // Upload file functionality
        const fileUploadBtn = document.getElementById('file-upload-btn');
        const fileUploadInput = document.getElementById('file-upload-input');
        const uploadFilesBtn = document.getElementById('upload-files-btn');
        
        if (fileUploadBtn && fileUploadInput) {
            fileUploadBtn.addEventListener('click', () => {
                fileUploadInput.click();
            });
            
            fileUploadInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }
        
        if (uploadFilesBtn) {
            uploadFilesBtn.addEventListener('click', () => {
                this.uploadFiles();
            });
        }
        
        // Clear console button
        const clearConsoleBtn = document.getElementById('clear-console-btn');
        if (clearConsoleBtn) {
            clearConsoleBtn.addEventListener('click', () => {
                this.clearDebugConsole();
            });
        }
    }
    
    ensureDebugConsole() {
        // Try to get the debug console output first (after Tools tab is rendered)
        let debugConsoleEl = document.getElementById('debug-console-output');
        if (!debugConsoleEl) {
            // Fall back to the original debug console
            debugConsoleEl = document.getElementById('debug-console');
        }
        this.debugConsole = debugConsoleEl;
        return debugConsoleEl;
    }
    
    loadToolsTab() {
        // Only render content if not already loaded, otherwise just refresh data
        const isFirstLoad = !this.toolsTabLoaded;
        
        if (isFirstLoad) {
            this.toolsTabLoaded = true; // Mark that Tools tab has been loaded
            this.renderToolsContent();
        }
        
        this.populateToolsBankSelector();
        
        // Log on first load, silent on subsequent loads
        this.collectNoteNamesFromPatches(!isFirstLoad);
        this.updateIndexDisplay();
        
        // Only log activation on first load
        if (!this.toolsTabActivated) {
            this.toolsTabActivated = true;
            this.logToDebugConsole('Tools tab activated', 'info');
        }
    }
    
    renderToolsContent() {
        // Don't render if content already exists (to preserve upload UI from HTML)
        const existingToolsSection = document.querySelector('#tools-content .tool-section');
        if (existingToolsSection) {
            // Content already exists, just ensure we have the dynamic sections
            this.ensureToolsSections();
            return;
        }
        
        // If no content exists, we're in a legacy state - just set up what we have
        this.ensureDebugConsole();
        this.setupDebugConsole();
        this.flushMessageBuffer();
    }
    
    ensureToolsSections() {
        const content = document.getElementById('tools-content');
        if (!content) return;
        
        // Check if Note Name Consistency Tool section exists
        let consistencySection = document.getElementById('note-consistency-section');
        if (!consistencySection) {
            // Find where to insert it (after upload sections but before debug console)
            const debugConsole = document.getElementById('debug-console');
            
            const section = document.createElement('div');
            section.id = 'note-consistency-section';
            section.className = 'tool-section';
            section.innerHTML = `
                <h3 data-testid="hdr_note_consistency_tool">Note Name Consistency Tool</h3>
                <p data-testid="div_note_consistency_description">Click on any note name to see where it's used and fix inconsistencies.</p>
                
                <div class="bank-selector" data-testid="sec_bank_selector">
                    <label for="tools-bank-select" data-testid="lbl_filter_bank">Filter by Bank:</label>
                    <select id="tools-bank-select" onchange="toolsManager.updateToolsBankFilter()" data-testid="sel_tools_bank">
                        <option value="all" data-testid="opt_all_banks">All Banks</option>
                    </select>
                    
                    <label for="tools-sort-select" data-testid="lbl_sort_by">Sort by:</label>
                    <select id="tools-sort-select" onchange="toolsManager.updateToolsSort()" data-testid="sel_tools_sort">
                        <option value="alphabetical" data-testid="opt_sort_alphabetical">Alphabetical</option>
                        <option value="usage-count" data-testid="opt_sort_usage">Usage Count</option>
                    </select>
                    
                    <button class="btn btn-small btn-secondary" onclick="toolsManager.refreshIndex()" data-testid="btn_refresh_note_list">Refresh List</button>
                </div>
                
                <div class="index-stats" data-testid="sec_index_stats">
                    <span id="index-count" data-testid="spn_index_count">Total entries: 0</span>
                    <span id="index-size" data-testid="spn_index_size">Memory usage: 0 KB</span>
                    <span id="pending-changes-count" data-testid="spn_pending_changes">Pending changes: 0</span>
                </div>
                <div class="index-search" data-testid="sec_index_search">
                    <input type="text" id="index-search" placeholder="Search note names..." oninput="toolsManager.filterIndexEntries()" data-testid="npt_index_search">
                    <button class="btn btn-small" onclick="toolsManager.clearIndexSearch()" data-testid="btn_clear_search">Clear</button>
                </div>
                <div class="index-entries" id="index-entries" data-testid="lst_index_entries">
                    <div class="empty-state" data-testid="msg_no_note_names">No note names in index</div>
                </div>
            `;
            
            // Find the debug console's parent tool-section
            if (debugConsole) {
                const debugSection = debugConsole.closest('.tool-section');
                if (debugSection && debugSection.parentNode === content) {
                    content.insertBefore(section, debugSection);
                } else {
                    content.appendChild(section);
                }
            } else {
                content.appendChild(section);
            }
        }
        
        // Initialize debug console
        this.ensureDebugConsole();
        this.setupDebugConsole();
        
        // Flush any buffered messages
        this.flushMessageBuffer();
    }
    
    setupDebugConsole() {
        // Don't intercept console.log/error/warn anymore to avoid duplicates
        // All debug messages should go through logToDebugConsole() explicitly
        
        // Keep this method in case we want to add interception later
        // but for now, do nothing to avoid duplicate messages
    }
    
    clearDebugConsole() {
        if (this.debugConsole) {
            this.debugConsole.innerHTML = '';
        }
    }
    
    logToDebugConsole(message, type = 'info') {
        // Always buffer messages until Tools tab has been loaded
        if (!this.toolsTabLoaded) {
            this.messageBuffer.push({ message, type, timestamp: new Date().toLocaleTimeString() });
            console.log(`[DEBUG - ${type}] ${message} (buffered)`);
            return;
        }
        
        // Ensure debug console is available
        const debugConsoleEl = this.ensureDebugConsole();
        
        if (!debugConsoleEl) {
            // Shouldn't happen if toolsTabLoaded is true, but handle it anyway
            this.messageBuffer.push({ message, type, timestamp: new Date().toLocaleTimeString() });
            console.log(`[DEBUG - ${type}] ${message} (buffered - no element)`);
            return;
        }
        
        const div = document.createElement('div');
        div.className = `debug-message debug-${type}`;
        div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        div.setAttribute('data-testid', 'div_debug_message');
        
        this.debugConsole.appendChild(div);
        this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
    }
    
    flushMessageBuffer() {
        // Output any buffered messages to the debug console
        if (this.messageBuffer.length > 0 && this.debugConsole) {
            console.log(`[ToolsManager] Flushing ${this.messageBuffer.length} buffered messages`);
            this.messageBuffer.forEach(({ message, type, timestamp }) => {
                const div = document.createElement('div');
                div.className = `debug-message debug-${type}`;
                div.textContent = `[${timestamp}] ${message}`;
                div.setAttribute('data-testid', 'div_debug_message');
                this.debugConsole.appendChild(div);
            });
            this.messageBuffer = [];
            this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
        }
    }
    
    updateIndexDisplay() {
        const countElement = document.getElementById('index-count');
        const sizeElement = document.getElementById('index-size');
        const pendingElement = document.getElementById('pending-changes-count');
        const entriesElement = document.getElementById('index-entries');
        
        if (!countElement || !sizeElement || !entriesElement) return;
        
        // Get filtered note names based on selected bank
        const filteredNoteNames = this.getFilteredNoteNames();
        const count = filteredNoteNames.length;
        const sizeKB = Math.round((JSON.stringify(Array.from(this.allNoteNames)).length) / 1024);
        const pendingCount = appState.pendingChanges.noteData ? appState.pendingChanges.noteData.size : 0;
        
        countElement.textContent = `Total entries: ${count}`;
        sizeElement.textContent = `Memory usage: ${sizeKB} KB`;
        if (pendingElement) {
            pendingElement.textContent = `Pending changes: ${pendingCount}`;
        }
        
        if (count === 0) {
            entriesElement.innerHTML = '<div class="empty-state" data-testid="msg_no_note_names_display">No note names in index</div>';
            return;
        }
        
        // Sort note names based on selected sort option
        let sortedNames;
        if (this.selectedToolsSort === 'usage-count') {
            // Sort by usage count (ascending - least used first)
            sortedNames = filteredNoteNames.sort((a, b) => {
                const usageA = this.findNoteNameUsage(a).length;
                const usageB = this.findNoteNameUsage(b).length;
                return usageA - usageB;
            });
        } else {
            // Default: alphabetical sorting
            sortedNames = filteredNoteNames.sort();
        }
        entriesElement.innerHTML = '';
        
        sortedNames.forEach((name, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'index-entry';
            entryDiv.setAttribute('data-testid', `itm_note_name_${index}`);
            
            // Find usage locations for this note name (filtered by bank if applicable)
            const usageLocations = this.findNoteNameUsage(name);
            
            const escapedName = this.escapeHtmlAttribute(name);
            const dropdownId = this.createUniqueId(name);
            
            entryDiv.innerHTML = `
                <div class="index-entry-content" onclick="toolsManager.showUsageDropdown('${escapedName}', '${escapedName}', this)" data-testid="div_note_entry_content_${index}">
                    <span class="index-entry-name" data-testid="spn_note_name">${name}</span>
                    <span class="usage-indicator" data-testid="spn_usage_count">${usageLocations.length} usage${usageLocations.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="usage-dropdown" id="${dropdownId}" style="display: none;" data-testid="drp_note_usage_${index}">
                    ${this.generateUsageDropdownContent(name, usageLocations)}
                </div>
                <div class="index-entry-actions" data-testid="grp_note_actions_${index}">
                    <button class="btn btn-small btn-danger" onclick="toolsManager.removeIndexEntry('${escapedName}')" data-testid="btn_remove_note">×</button>
                </div>
            `;
            entriesElement.appendChild(entryDiv);
        });
    }
    
    findNoteNameUsage(noteName) {
        const usageLocations = [];
        
        // Scan through all patches in the current bank
        if (appState.currentMidnam && appState.currentMidnam.patch_banks) {
            appState.currentMidnam.patch_banks.forEach(bank => {
                if (bank.patches) {
                    bank.patches.forEach(patch => {
                        // Find the note list used by this patch
                        const noteListName = patch.note_list_name;
                        
                        if (noteListName && appState.currentMidnam.note_lists) {
                            // Find the note list in the device
                            const noteList = appState.currentMidnam.note_lists.find(nl => nl.name === noteListName);
                            
                            if (noteList && noteList.notes) {
                                // Check each note in the list
                                noteList.notes.forEach(note => {
                                    if (note.name === noteName) {
                                        usageLocations.push({
                                            bankName: bank.name,
                                            patchName: patch.name,
                                            noteListName: noteListName,
                                            noteNumber: note.number,
                                            noteName: noteName
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
        
        return usageLocations;
    }
    
    createUniqueId(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'dropdown-' + Math.abs(hash).toString(36);
    }
    
    escapeHtmlAttribute(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    unescapeHtmlAttribute(str) {
        return str.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#96;/g, '`').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
    
    generateUsageDropdownContent(noteName, usageLocations) {
        const escapedNoteName = this.escapeHtmlAttribute(noteName);
        
        if (usageLocations.length === 0) {
            return `
                <div class="usage-item unused" data-note-name="${escapedNoteName}">
                    <span class="usage-text">Unused – delete?</span>
                </div>
            `;
        }
        
        return usageLocations.map(location => {
            const escapedBankName = this.escapeHtmlAttribute(location.bankName);
            const escapedPatchName = this.escapeHtmlAttribute(location.patchName);
            const escapedNoteListName = this.escapeHtmlAttribute(location.noteListName);
            
            return `
                <div class="usage-item" 
                     data-bank-name="${escapedBankName}" 
                     data-patch-name="${escapedPatchName}" 
                     data-note-list-name="${escapedNoteListName}" 
                     data-note-number="${location.noteNumber}">
                    <span class="usage-bank">${location.bankName}</span>
                    <span class="usage-patch">${location.patchName}</span>
                    <span class="usage-note">Note ${location.noteNumber}</span>
                </div>
            `;
        }).join('');
    }
    
    showUsageDropdown(name, escapedName, element) {
        const dropdown = element.nextElementSibling;
        if (!dropdown) return;
        
        // Close all other dropdowns
        document.querySelectorAll('.usage-dropdown').forEach(dd => {
            if (dd !== dropdown) {
                dd.style.display = 'none';
            }
        });
        
        // Toggle this dropdown
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
        
        // Add click handlers to usage items if just opened
        if (!isVisible) {
            dropdown.querySelectorAll('.usage-item').forEach(item => {
                // Remove old listeners by cloning
                const newItem = item.cloneNode(true);
                item.parentNode.replaceChild(newItem, item);
                
                // Add new listener
                newItem.addEventListener('click', () => {
                    if (newItem.classList.contains('unused')) {
                        // Handle delete unused note name
                        const noteName = newItem.getAttribute('data-note-name');
                        if (noteName) {
                            this.deleteUnusedNoteName(noteName);
                        }
                    } else {
                        // Navigate to note editor
                        const bankName = newItem.getAttribute('data-bank-name');
                        const patchName = newItem.getAttribute('data-patch-name');
                        const noteListName = newItem.getAttribute('data-note-list-name');
                        const noteNumber = parseInt(newItem.getAttribute('data-note-number'));
                        
                        if (bankName && patchName && noteListName && !isNaN(noteNumber)) {
                            this.navigateToNoteEditor(bankName, patchName, noteListName, noteNumber);
                        }
                    }
                });
            });
        }
    }
    
    navigateToNoteEditor(bankName, patchName, noteListName, noteNumber) {
        // Unescape HTML entities from the parameters
        bankName = this.unescapeHtmlAttribute(bankName);
        patchName = this.unescapeHtmlAttribute(patchName);
        noteListName = this.unescapeHtmlAttribute(noteListName);
        
        this.logToDebugConsole(`Navigate to ${bankName} / ${patchName} / Note ${noteNumber}`, 'info');
        
        // Find the patch in the current device data
        if (!appState.currentMidnam || !appState.currentMidnam.patch_banks) {
            this.logToDebugConsole('No device data available for navigation', 'error');
            return;
        }
        
        // Find the bank
        const bank = appState.currentMidnam.patch_banks.find(b => b.name === bankName);
        if (!bank) {
            this.logToDebugConsole(`Bank "${bankName}" not found`, 'error');
            return;
        }
        
        // Find the patch
        const patch = bank.patches.find(p => p.name === patchName);
        if (!patch) {
            this.logToDebugConsole(`Patch "${patchName}" not found in bank "${bankName}"`, 'error');
            return;
        }
        
        // Check if we're navigating to a different patch and have unsaved changes
        const isDifferentPatch = !appState.selectedPatch || 
                                 appState.selectedPatch.name !== patchName || 
                                 (appState.selectedPatchBank && appState.selectedPatchBank.name !== bankName);
        
        if (isDifferentPatch && appState.pendingChanges && appState.pendingChanges.hasUnsavedChanges) {
            const currentPatchName = appState.selectedPatch ? appState.selectedPatch.name : 'current patch';
            if (!confirm(`You have unsaved changes in "${currentPatchName}".\n\nDiscard changes and navigate to "${patchName}"?`)) {
                this.logToDebugConsole('Navigation cancelled - user chose to keep unsaved changes', 'info');
                return;
            }
            // User confirmed, clear the unsaved changes flag
            appState.pendingChanges.hasUnsavedChanges = false;
        }
        
        // Set the selected patch and bank in app state
        appState.selectedPatch = patch;
        appState.selectedPatchBank = bank;
        
        // Send MIDI patch change if navigating to a different patch and MIDI is enabled
        if (isDifferentPatch && window.midiManager && window.midiManager.isDeviceSelected()) {
            // Send program change for the patch
            if (patch.programChange !== undefined) {
                const programNumber = parseInt(patch.programChange);
                if (!isNaN(programNumber)) {
                    window.midiManager.sendProgramChange(programNumber, 0);
                    this.logToDebugConsole(`Sent patch change: Program ${programNumber} for "${patchName}"`, 'success');
                }
            }
        }
        
        // Switch to the patch tab
        if (window.tabManager) {
            window.tabManager.switchTab('patch');
        }
        
        // Ensure the patch manager renders the selected patch
        if (window.patchManager) {
            window.patchManager.renderPatchEditor();
        }
        
        // Wait for the patch editor to load, then highlight the specific note
        setTimeout(() => {
            this.highlightNoteInEditor(noteNumber);
        }, 500);
    }
    
    highlightNoteInEditor(noteNumber) {
        // Find the note input with the matching note number
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            // Get the actual MIDI note number from the note-number-display element
            const noteDisplay = row.querySelector('.note-number-display');
            if (!noteDisplay) continue;
            
            const rowNoteNumber = parseInt(noteDisplay.getAttribute('data-note'));
            
            if (rowNoteNumber === noteNumber) {
                // Found the matching note, focus and highlight it
                const noteInput = row.querySelector('.note-name-input');
                if (noteInput) {
                    noteInput.focus();
                    noteInput.select();
                    
                    // Scroll the note into view
                    noteInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Add a temporary highlight effect
                    noteInput.style.backgroundColor = '#fff3cd';
                    setTimeout(() => {
                        noteInput.style.backgroundColor = '';
                    }, 2000);
                    
                    this.logToDebugConsole(`Highlighted note ${noteNumber} in editor`, 'success');
                    return;
                }
            }
        }
        
        this.logToDebugConsole(`Note ${noteNumber} not found in current patch editor`, 'warn');
    }
    
    deleteUnusedNoteName(name) {
        const unescapedName = this.unescapeHtmlAttribute(name);
        
        if (confirm(`Remove "${unescapedName}" from index?`)) {
            this.allNoteNames.delete(unescapedName);
            this.updateIndexDisplay();
            this.logToDebugConsole(`Removed "${unescapedName}" from index`, 'info');
        }
    }
    
    removeIndexEntry(name) {
        const unescapedName = this.unescapeHtmlAttribute(name);
        
        if (confirm(`Remove "${unescapedName}" from index?`)) {
            this.allNoteNames.delete(unescapedName);
            this.updateIndexDisplay();
            this.logToDebugConsole(`Removed "${unescapedName}" from index`, 'info');
        }
    }
    
    filterIndexEntries() {
        const searchTerm = document.getElementById('index-search').value.toLowerCase();
        const entries = document.querySelectorAll('.index-entry');
        
        entries.forEach(entry => {
            const name = entry.querySelector('.index-entry-name').textContent.toLowerCase();
            if (name.includes(searchTerm)) {
                entry.style.display = 'flex';
            } else {
                entry.style.display = 'none';
            }
        });
    }
    
    clearIndexSearch() {
        document.getElementById('index-search').value = '';
        this.filterIndexEntries();
    }
    
    
    updateToolsSort() {
        const sortSelect = document.getElementById('tools-sort-select');
        if (sortSelect) {
            this.selectedToolsSort = sortSelect.value;
            this.updateIndexDisplay();
        }
    }
    
    updateToolsBankFilter() {
        this.updateIndexDisplay();
    }
    
    refreshIndex() {
        // Rebuild the index from scratch
        this.collectNoteNamesFromPatches(false); // Not silent - log when user explicitly refreshes
        this.updateIndexDisplay();
        this.logToDebugConsole('Index refreshed from patches', 'success');
        Utils.showNotification('Note name index refreshed', 'success');
    }
    
    populateToolsBankSelector() {
        const bankSelect = document.getElementById('tools-bank-select');
        if (!bankSelect) return;
        
        // Clear existing options except "All Banks"
        bankSelect.innerHTML = '<option value="all" data-testid="opt_all_banks_selector">All Banks</option>';
        
        if (!appState.currentMidnam) return;
        
        // Get all patch banks from the current device
        if (appState.currentMidnam.patchList) {
            const bankNames = appState.currentMidnam.patchList.map(bank => bank.name).filter(name => name);
            
            // Sort bank names and add to dropdown
            bankNames.sort().forEach((bankName, index) => {
                const option = document.createElement('option');
                option.value = bankName;
                option.textContent = bankName;
                option.setAttribute('data-testid', `opt_bank_${index}`);
                bankSelect.appendChild(option);
            });
        }
    }
    
    getFilteredNoteNames() {
        // TODO: Implement bank filtering
        return Array.from(this.allNoteNames);
    }
    
    collectNoteNamesFromPatches(silent = false) {
        this.allNoteNames.clear();
        
        // If we have a selected patch bank, collect note names from all patches in that bank
        if (appState.selectedPatchBank && appState.currentMidnam && appState.currentMidnam.note_lists) {
            const bank = appState.selectedPatchBank;
            
            // Get all unique note list names used by patches in this bank
            const noteListNames = new Set();
            const patchArray = bank.patches || bank.patch; // Try both 'patches' and 'patch'
            if (patchArray) {
                patchArray.forEach(patch => {
                    const noteListName = patch.note_list_name || patch.usesNoteList;
                    if (noteListName) {
                        noteListNames.add(noteListName);
                    }
                });
            }
            
            // Collect note names from all note lists used by this bank
            appState.currentMidnam.note_lists.forEach(noteList => {
                if (noteListNames.has(noteList.name)) {
                    if (noteList.notes) {
                        noteList.notes.forEach(note => {
                            if (note.name && note.name.trim()) {
                                this.allNoteNames.add(note.name.trim());
                            }
                        });
                    }
                }
            });
            
            if (!silent) {
                this.logToDebugConsole(`Collected ${this.allNoteNames.size} note names from bank "${bank.name}"`, 'info');
            }
        } else {
            // Fallback: collect from all note lists if no bank is selected
            if (appState.currentMidnam && appState.currentMidnam.note_lists) {
                appState.currentMidnam.note_lists.forEach(noteList => {
                    if (noteList.notes) {
                        noteList.notes.forEach(note => {
                            if (note.name && note.name.trim()) {
                                this.allNoteNames.add(note.name.trim());
                            }
                        });
                    }
                });
            }
            
            if (!silent) {
                this.logToDebugConsole(`Collected ${this.allNoteNames.size} note names from all patches`, 'info');
            }
        }
    }
    
    testDropdownFiltering() {
        const testCases = [
            { input: 'L', expected: ['Lft&Rght'] },
            { input: 'Lf', expected: ['Lft&Rght'] },
            { input: 'Lft', expected: ['Lft&Rght'] },
            { input: 'Lft&', expected: ['Lft&Rght'] },
            { input: 'xyz', expected: [] }
        ];
        
        this.logToDebugConsole('Testing dropdown filtering...', 'info');
        
        testCases.forEach(testCase => {
            const matches = Array.from(this.allNoteNames).filter(name => {
                const lowerName = name.toLowerCase();
                const lowerValue = testCase.input.toLowerCase();
                return lowerName.includes(lowerValue) && lowerName !== lowerValue;
            });
            
            const passed = JSON.stringify(matches) === JSON.stringify(testCase.expected);
            this.logToDebugConsole(
                `Test "${testCase.input}": ${passed ? 'PASS' : 'FAIL'} (got ${matches.length} matches)`,
                passed ? 'success' : 'error'
            );
        });
    }
    
    handleFileSelection(files) {
        const fileList = document.getElementById('file-upload-list');
        const uploadBtn = document.getElementById('upload-files-btn');
        
        if (!fileList || !uploadBtn) return;
        
        // Clear previous list
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            uploadBtn.style.display = 'none';
            return;
        }
        
        // Store files in instance variable
        this.selectedFiles = Array.from(files);
        
        // Display selected files
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-upload-item';
            fileItem.setAttribute('data-testid', `itm_upload_file_${index}`);
            
            const fileName = document.createElement('span');
            fileName.className = 'file-upload-item-name';
            fileName.textContent = file.name;
            fileName.setAttribute('data-testid', 'spn_upload_file_name');
            
            const fileSize = document.createElement('span');
            fileSize.className = 'file-upload-item-size';
            fileSize.textContent = this.formatFileSize(file.size);
            fileSize.setAttribute('data-testid', 'spn_upload_file_size');
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-upload-item-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => this.removeFile(index);
            removeBtn.setAttribute('data-testid', 'btn_remove_upload_file');
            
            fileItem.appendChild(fileName);
            fileItem.appendChild(fileSize);
            fileItem.appendChild(removeBtn);
            fileList.appendChild(fileItem);
        });
        
        uploadBtn.style.display = 'inline-block';
    }
    
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        const fileInput = document.getElementById('file-upload-input');
        if (fileInput) {
            // Create a new FileList without the removed file
            const dt = new DataTransfer();
            this.selectedFiles.forEach(file => dt.items.add(file));
            fileInput.files = dt.files;
        }
        this.handleFileSelection(this.selectedFiles);
    }
    
    async uploadFiles() {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            Utils.showNotification('No files selected', 'warning');
            return;
        }
        
        const uploadBtn = document.getElementById('upload-files-btn');
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
        }
        
        try {
            const formData = new FormData();
            this.selectedFiles.forEach((file, index) => {
                formData.append(`file${index}`, file);
            });
            
            const response = await fetch('/api/upload_files', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                Utils.showNotification(result.message, 'success');
                this.logToDebugConsole(`Uploaded ${result.uploaded_files.length} file(s)`, 'success');
                
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(error => {
                        this.logToDebugConsole(`Error: ${error}`, 'error');
                    });
                }
                
                // Clear file selection
                this.selectedFiles = [];
                const fileInput = document.getElementById('file-upload-input');
                if (fileInput) fileInput.value = '';
                this.handleFileSelection([]);
                
                // Refresh catalog if catalog manager is available
                if (window.catalogManager) {
                    window.catalogManager.loadCatalogData();
                }
                
                // Reload manufacturers list
                if (window.manufacturerManager) {
                    window.manufacturerManager.loadManufacturers();
                }
            } else {
                Utils.showNotification('Upload failed', 'error');
                this.logToDebugConsole(`Upload failed: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            Utils.showNotification('Upload failed: ' + error.message, 'error');
            this.logToDebugConsole(`Upload error: ${error.message}`, 'error');
        } finally {
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Selected Files';
            }
        }
    }
}

export const toolsManager = new ToolsManager();

// Make it globally available
window.toolsManager = toolsManager;
