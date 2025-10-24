// Tools module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { midiManager } from './midi.js';

export class ToolsManager {
    constructor() {
        this.debugConsole = null;
        this.allNoteNames = new Set();
        this.selectedToolsSort = 'alphabetical';
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Clear console button
        const clearConsoleBtn = document.getElementById('clear-console-btn');
        if (clearConsoleBtn) {
            clearConsoleBtn.addEventListener('click', () => {
                this.clearDebugConsole();
            });
        }
        
        // Test MIDI button
        const testMIDIBtn = document.getElementById('test-midi-btn');
        if (testMIDIBtn) {
            testMIDIBtn.addEventListener('click', () => {
                this.testMIDIConnection();
            });
        }
        
        // Initialize debug console
        this.debugConsole = document.getElementById('debug-console');
    }
    
    loadToolsTab() {
        this.renderToolsContent();
        this.populateToolsBankSelector();
        this.collectNoteNamesFromPatches();
        this.updateIndexDisplay();
        this.logToDebugConsole('Tools tab activated', 'info');
    }
    
    renderToolsContent() {
        const content = document.getElementById('tools-content');
        if (!content) return;
        
        // Always render the content - the condition was preventing re-rendering
        content.innerHTML = `
            <div class="tools-section">
                <h3>Note Name Consistency Tool</h3>
                <p>Click on any note name to see where it's used and fix inconsistencies.</p>
                
                <div class="bank-selector">
                    <label for="tools-bank-select">Filter by Bank:</label>
                    <select id="tools-bank-select" onchange="toolsManager.updateToolsBankFilter()">
                        <option value="all">All Banks</option>
                    </select>
                    
                    <label for="tools-sort-select">Sort by:</label>
                    <select id="tools-sort-select" onchange="toolsManager.updateToolsSort()">
                        <option value="alphabetical">Alphabetical</option>
                        <option value="usage-count">Usage Count</option>
                    </select>
                </div>
                
                <div class="index-stats">
                    <span id="index-count">Total entries: 0</span>
                    <span id="index-size">Memory usage: 0 KB</span>
                    <span id="pending-changes-count">Pending changes: 0</span>
                </div>
                <div class="index-search">
                    <input type="text" id="index-search" placeholder="Search note names..." oninput="toolsManager.filterIndexEntries()">
                    <button class="btn btn-small" onclick="toolsManager.clearIndexSearch()">Clear</button>
                </div>
                <div class="index-entries" id="index-entries">
                    <div class="empty-state">No note names in index</div>
                </div>
            </div>
            
            <div class="tools-section">
                <h3>Add New Entry</h3>
                <div class="add-entry-form">
                    <input type="text" id="new-entry-input" placeholder="Enter note name..." maxlength="50">
                    <button class="btn btn-success" onclick="toolsManager.addIndexEntry()">Add</button>
                </div>
            </div>
            
            <div class="tools-section">
                <h3>Debug Console</h3>
                <div class="debug-console-display" id="debug-console-display">
                    <div class="debug-console-output" id="debug-console-output"></div>
                </div>
                <div class="console-controls">
                    <button class="btn btn-small" onclick="toolsManager.clearDebugConsole()">Clear Console</button>
                    <button class="btn btn-small" onclick="toolsManager.testDropdownFiltering()">Test Filtering</button>
                </div>
            </div>
        `;
        
        // Initialize debug console
        this.debugConsole = document.getElementById('debug-console-output');
        this.setupDebugConsole();
    }
    
    setupDebugConsole() {
        // Intercept console.log, console.error, etc. to display in debug console
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addToDebugConsole('log', args.join(' '));
        };
        
        console.error = (...args) => {
            originalError.apply(console, args);
            this.addToDebugConsole('error', args.join(' '));
        };
        
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.addToDebugConsole('warn', args.join(' '));
        };
    }
    
    addToDebugConsole(type, message) {
        if (!this.debugConsole) return;
        
        const div = document.createElement('div');
        div.className = `debug-message debug-${type}`;
        div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.debugConsole.appendChild(div);
        this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
    }
    
    clearDebugConsole() {
        if (this.debugConsole) {
            this.debugConsole.innerHTML = '';
        }
    }
    
    async testMIDIConnection() {
        if (!midiManager.isMIDIEnabled()) {
            Utils.showNotification('MIDI is not enabled. Please enable MIDI first.', 'warning');
            return;
        }
        
        await midiManager.testMIDIConnection();
    }
    
    logToDebugConsole(message, type = 'info') {
        if (!this.debugConsole) return;
        
        const div = document.createElement('div');
        div.className = `debug-message debug-${type}`;
        div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.debugConsole.appendChild(div);
        this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
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
            entriesElement.innerHTML = '<div class="empty-state">No note names in index</div>';
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
        
        sortedNames.forEach(name => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'index-entry';
            
            // Find usage locations for this note name (filtered by bank if applicable)
            const usageLocations = this.findNoteNameUsage(name);
            
            const escapedName = this.escapeHtmlAttribute(name);
            const dropdownId = this.createUniqueId(name);
            
            entryDiv.innerHTML = `
                <div class="index-entry-content" onclick="toolsManager.showUsageDropdown('${escapedName}', '${escapedName}', this)">
                    <span class="index-entry-name">${name}</span>
                    <span class="usage-indicator">${usageLocations.length} usage${usageLocations.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="usage-dropdown" id="${dropdownId}" style="display: none;">
                    ${this.generateUsageDropdownContent(name, usageLocations)}
                </div>
                <div class="index-entry-actions">
                    <button class="btn btn-small btn-danger" onclick="toolsManager.removeIndexEntry('${escapedName}')">×</button>
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
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    generateUsageDropdownContent(noteName, usageLocations) {
        const escapedNoteName = this.escapeHtmlAttribute(noteName);
        
        if (usageLocations.length === 0) {
            return `
                <div class="usage-item unused" onclick="toolsManager.deleteUnusedNoteName('${escapedNoteName}')">
                    <span class="usage-text">Unused – delete?</span>
                </div>
            `;
        }
        
        return usageLocations.map(location => {
            const escapedBankName = this.escapeHtmlAttribute(location.bankName);
            const escapedPatchName = this.escapeHtmlAttribute(location.patchName);
            const escapedNoteListName = this.escapeHtmlAttribute(location.noteListName);
            
            return `
                <div class="usage-item" onclick="toolsManager.navigateToNoteEditor('${escapedBankName}', '${escapedPatchName}', '${escapedNoteListName}', ${location.noteNumber})">
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
        document.querySelectorAll('.usage-dropdown').forEach(dropdown => {
            if (dropdown !== dropdown) {
                dropdown.style.display = 'none';
            }
        });
        
        // Toggle this dropdown
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
    
    navigateToNoteEditor(bankName, patchName, noteListName, noteNumber) {
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
        
        // Set the selected patch and bank in app state
        appState.selectedPatch = patch;
        appState.selectedPatchBank = bank;
        
        // Switch to the patch tab
        if (window.tabManager) {
            window.tabManager.switchTab('patch');
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
            const rowNoteNumber = parseInt(row.getAttribute('data-note-index'));
            
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
        const unescapedName = name.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#96;/g, '`').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        if (confirm(`Remove "${unescapedName}" from index?`)) {
            this.allNoteNames.delete(unescapedName);
            this.updateIndexDisplay();
            this.logToDebugConsole(`Removed "${unescapedName}" from index`, 'info');
        }
    }
    
    removeIndexEntry(name) {
        const unescapedName = name.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#96;/g, '`').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
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
    
    addIndexEntry() {
        const input = document.getElementById('new-entry-input');
        const name = input.value.trim();
        
        if (name && !this.allNoteNames.has(name)) {
            this.allNoteNames.add(name);
            this.updateIndexDisplay();
            input.value = '';
            this.logToDebugConsole(`Added "${name}" to index`, 'success');
        } else if (this.allNoteNames.has(name)) {
            this.logToDebugConsole(`"${name}" already exists in index`, 'warn');
        } else {
            this.logToDebugConsole('Please enter a valid note name', 'error');
        }
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
    
    populateToolsBankSelector() {
        const bankSelect = document.getElementById('tools-bank-select');
        if (!bankSelect) return;
        
        // Clear existing options except "All Banks"
        bankSelect.innerHTML = '<option value="all">All Banks</option>';
        
        if (!appState.currentMidnam) return;
        
        // Get all patch banks from the current device
        if (appState.currentMidnam.patchList) {
            const bankNames = appState.currentMidnam.patchList.map(bank => bank.name).filter(name => name);
            
            // Sort bank names and add to dropdown
            bankNames.sort().forEach(bankName => {
                const option = document.createElement('option');
                option.value = bankName;
                option.textContent = bankName;
                bankSelect.appendChild(option);
            });
        }
    }
    
    getFilteredNoteNames() {
        // TODO: Implement bank filtering
        return Array.from(this.allNoteNames);
    }
    
    collectNoteNamesFromPatches() {
        this.allNoteNames.clear();
        
        // Collect from current patch editor if it exists
        const tbody = document.getElementById('note-list-tbody');
        if (tbody) {
            const inputs = tbody.querySelectorAll('.note-name-input');
            inputs.forEach(input => {
                if (input.value.trim()) {
                    this.allNoteNames.add(input.value.trim());
                }
            });
        }
        
        // Collect from all patches in the current bank
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
        
        // Also collect from patch manager's index if available
        if (window.patchManager && window.patchManager.noteNameIndex) {
            window.patchManager.noteNameIndex.forEach(name => {
                this.allNoteNames.add(name);
            });
        }
        
        this.logToDebugConsole(`Collected ${this.allNoteNames.size} note names from patches`, 'info');
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
}

export const toolsManager = new ToolsManager();

// Make it globally available
window.toolsManager = toolsManager;
