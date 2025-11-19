// Patch module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { isHostedVersion } from '../core/hosting.js';
import { testPatch as testPatchHelper } from '../utils/midiHelpers.js';
import { modal } from '../components/modal.js';
import { midiManager } from './midi.js';

export class PatchManager {
    constructor() {
        this.selectedPatchList = null;
        this.selectedPatch = null;
        this.patchEditMode = false;  // Track if we're in patch editing mode
        this.noteNameIndex = new Set();
        this.drumNames = [
            'Kick', 'Snare', 'Hi-Hat', 'Crash', 'Ride', 'Tom', 'Open Hat', 'Closed Hat',
            'Rim Shot', 'Side Stick', 'Bell', 'Splash', 'China', 'Cowbell', 'Tambourine',
            'Shaker', 'Clap', 'Snap', 'Stick', 'Brush', 'Mallet', 'Finger', 'Thumb'
        ];
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    // Helper methods for note display and MIDI
    getPianoKeyName(noteNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteIndex = noteNumber % 12;
        return `${noteNames[noteIndex]}${octave}`;
    }
    
    isBlackKey(noteNumber) {
        const noteIndex = noteNumber % 12;
        return [1, 3, 6, 8, 10].includes(noteIndex); // C#, D#, F#, G#, A#
    }
    
    getMIDIStatus() {
        // Check if MIDI is enabled AND a device is selected
        return window.midiManager && window.midiManager.isMIDIEnabled() && window.midiManager.isDeviceSelected();
    }
    
    getMIDIDeviceName() {
        // Get selected MIDI device name from the global MIDI manager
        if (window.midiManager && window.midiManager.isMIDIEnabled()) {
            return window.midiManager.getSelectedDeviceName() || 'MIDI Device';
        }
        return 'No MIDI Device Selected';
    }
    
    getNoteName(noteNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const note = noteNames[noteNumber % 12];
        return `${note}${octave}`;
    }
    
    updateTooltipPosition(event) {
        const tooltip = document.getElementById('keyboard-tooltip');
        if (tooltip && tooltip.style.display === 'flex') {
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 40) + 'px';
        }
    }
    
    playNote(noteNumber) {
        // Use the global MIDI manager to play the note
        if (midiManager && midiManager.isMIDIEnabled()) {
            const velocity = 100; // Default velocity
            const duration = 200; // Duration in milliseconds
            
            // Send note on
            midiManager.playNote(noteNumber, velocity);
            
            // Send note off after duration
            setTimeout(() => {
                midiManager.stopNote(noteNumber);
            }, duration);
        } else {
            // MIDI not enabled - silent
        }
    }
    
    getDefaultNoteName(noteNumber) {
        return this.getPianoKeyName(noteNumber);
    }
    
    setupEventListeners() {
        // Patch save button (main click action)
        const saveBtn = document.getElementById('save-patch-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.savePatch();
            });
        }
        
        // Split button dropdown toggle
        const dropdownBtn = document.getElementById('save-patch-dropdown-btn');
        const dropdownMenu = document.getElementById('save-patch-menu');
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
        const saveOnlyBtn = document.getElementById('save-patch-only');
        if (saveOnlyBtn) {
            saveOnlyBtn.addEventListener('click', () => {
                if (dropdownMenu) dropdownMenu.style.display = 'none';
                this.savePatch();
            });
        }
        
        // Download action (no save required)
        const saveDownloadBtn = document.getElementById('save-patch-download');
        if (saveDownloadBtn) {
            saveDownloadBtn.addEventListener('click', async () => {
                if (dropdownMenu) dropdownMenu.style.display = 'none';
                await this.showDownloadModal();
            });
        }
        
        // Setup download modal
        this.setupDownloadModal();
    }
    
    loadPatchTab() {
        if (!appState.currentMidnam || !appState.selectedPatch) {
            this.showEmptyState();
            return;
        }
        
        // Only re-render if patch content doesn't exist or if we're switching patches
        const content = document.getElementById('patch-content');
        const hasExistingContent = content && content.querySelector('.note-table');
        
        if (!hasExistingContent) {
            this.renderPatchEditor();
        } else {
            // Just ensure the patch editor is properly initialized
            this.setupNoteEditingListeners();
        }
        
        // Refresh the tools manager's index to ensure dropdown has all names
        if (window.toolsManager) {
            window.toolsManager.collectNoteNamesFromPatches(true); // Silent - no logging
        }
    }
    
    showEmptyState() {
        const content = document.getElementById('patch-content');
        if (content) {
            content.innerHTML = '<div class="empty-state" data-testid="msg_patch_empty_state">Select a patch from the Device tab to edit</div>';
        }
        
        // Disable action buttons
        const saveBtn = document.getElementById('save-patch-btn');
        
        if (saveBtn) saveBtn.disabled = true;
    }
    
    renderPatchEditor() {
        const content = document.getElementById('patch-content');
        if (!content || !appState.selectedPatch) return;
        
        const patch = appState.selectedPatch;
        const bank = appState.selectedPatchBank;
        const deviceData = appState.currentMidnam;
        
        // Find the note list for this patch
        let noteList = null;
        const noteListName = patch.usesNoteList || patch.note_list_name;
        if (noteListName && deviceData.note_lists) {
            noteList = deviceData.note_lists.find(nl => nl.name === noteListName);
        }
        
        content.innerHTML = `
            <div class="patch-editor" data-testid="sec_patch_editor">
                <div class="patch-info" data-testid="sec_patch_info">
                    <h3 data-testid="hdr_patch_name">${Utils.escapeHtml(patch.name)}</h3>
                    <div class="patch-meta" data-testid="div_patch_meta">
                        <span class="patch-number" data-testid="spn_patch_number">Patch ${patch.number}</span>
                        <span class="patch-bank" data-testid="spn_patch_bank">Bank: ${Utils.escapeHtml(bank.name)}</span>
                    </div>
                </div>
                
                <div class="patch-details" data-testid="sec_patch_details">
                    <div class="detail-section" data-testid="sec_patch_information">
                        <h4 data-testid="hdr_patch_information">Patch Information</h4>
                        <div class="form-group" data-testid="grp_patch_name_form">
                            <label for="patch-name-input" data-testid="lbl_patch_name">Name:</label>
                            <input type="text" id="patch-name-input" value="${Utils.escapeHtml(patch.name)}" class="form-control" onchange="patchManager.updatePatchName(this.value)" data-testid="npt_patch_name">
                        </div>
                        <div class="form-group" data-testid="grp_patch_number_form">
                            <label for="patch-number-input" data-testid="lbl_patch_number">Number:</label>
                            <input type="text" id="patch-number-input" value="${patch.number}" class="form-control" onchange="patchManager.updatePatchNumber(this.value)" data-testid="npt_patch_number">
                        </div>
                    </div>
                    
                    <div class="detail-section" data-testid="sec_note_names">
                        <h4 data-testid="hdr_note_names">Note Names</h4>
                        <div class="note-names" data-testid="sec_note_names_content">
                            ${noteList ? `
                                <div class="note-list-info" data-testid="div_note_list_info">
                                    <strong data-testid="lbl_note_list">Note List:</strong> ${Utils.escapeHtml(noteList.name)}
                                    <span class="note-count" data-testid="spn_note_count">(${noteList.notes.length} notes)</span>
                                </div>
                                <div class="note-editor-actions" data-testid="grp_note_editor_actions">
                                    <button class="btn btn-primary add-note-btn" onclick="patchManager.addNote()" data-testid="btn_add_note">
                                        + Add Note
                                    </button>
                                    <div class="note-range-control" data-testid="grp_note_range_control">
                                        <label data-testid="lbl_note_range">Note Range:</label>
                                        <select id="note-range-min" class="note-range-select" data-testid="sel_note_range_min">
                                            ${this.generateNoteRangeOptions('min', noteList.notes)}
                                        </select>
                                        <span data-testid="spn_note_range_separator">to</span>
                                        <select id="note-range-max" class="note-range-select" data-testid="sel_note_range_max">
                                            ${this.generateNoteRangeOptions('max', noteList.notes)}
                                        </select>
                                        <button class="btn btn-secondary btn-sm" onclick="patchManager.updateNoteRange()" data-testid="btn_extend_note_range">
                                            Extend
                                        </button>
                                    </div>
                                </div>
                                <div class="note-table-container" data-testid="sec_note_table_container">
                                    <table class="note-table" data-testid="tbl_notes">
                                        <thead data-testid="hdr_note_table">
                                            <tr data-testid="row_note_table_header">
                                                <th data-testid="cel_note_number_header">Note #</th>
                                                <th data-testid="cel_note_name_header">Name</th>
                                                <th data-testid="cel_note_actions_header">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="note-list-tbody" data-testid="lst_notes_tbody">
                                            ${noteList.notes.map((note, index) => {
                                                const noteNum = parseInt(note.number);
                                                const pianoKey = this.getPianoKeyName(noteNum);
                                                const isBlack = this.isBlackKey(noteNum);
                                                const insertBtnId = `insert-btn-${index}`;
                                                const noteInputId = `note-input-${index}`;
                                                const dropdownId = `note-dropdown-${index}`;
                                                
                                                return `
                                                    <tr data-note-index="${index}" class="${isBlack ? 'black-key-row' : ''}" data-testid="row_note_${index}">
                                                        <td data-testid="cel_note_number_${index}">
                                                            <span class="note-number-display ${isBlack ? 'black-key' : 'white-key'}" 
                                                                  data-note="${noteNum}"
                                                                  data-piano-key="${pianoKey}"
                                                                  data-testid="spn_note_display_${index}">
                                                                ${noteNum} <small>(${pianoKey})</small>
                                                            </span>
                                                        </td>
                                                        <td class="note-name-cell" data-testid="cel_note_name_${index}">
                                                            <input type="text" 
                                                                   id="${noteInputId}"
                                                                   class="note-name-input" 
                                                                   value="${Utils.escapeHtml(note.name)}"
                                                                   data-index="${index}"
                                                                   tabindex="${index === 0 ? '1' : '0'}"
                                                                   data-testid="npt_note_name_${index}"
                                                                   readonly>
                                                            <div class="note-dropdown" id="${dropdownId}" style="display: none;" data-testid="drp_note_suggestions_${index}"></div>
                                                        </td>
                                                        <td class="note-actions" data-testid="cel_note_actions_${index}">
                                                            <button class="btn btn-sm btn-outline-primary" 
                                                                    id="${insertBtnId}"
                                                                    data-index="${index}"
                                                                    tabindex="${index === 0 ? '2' : '0'}"
                                                                    title="Insert Note"
                                                                    data-testid="btn_insert_note_${index}">
                                                                +I
                                                            </button>
                                                            <button class="btn btn-sm btn-danger remove-note-btn" 
                                                                    data-index="${index}"
                                                                    tabindex="-1"
                                                                    title="Delete Note">
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : `
                                <p>No note names available for this patch.</p>
                                <div class="note-editor-actions">
                                    <button class="btn btn-primary add-note-btn" onclick="patchManager.addNote()">
                                        + Add Note List
                                    </button>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Enable buttons
        const saveBtn = document.getElementById('save-patch-btn');
        if (saveBtn) saveBtn.disabled = false;
        
        // Setup note editing event listeners
        this.setupNoteEditingListeners();
        
        // Populate the global note name index from the current bank
        if (window.toolsManager && window.toolsManager.collectNoteNamesFromPatches) {
            window.toolsManager.collectNoteNamesFromPatches(true); // Silent - no logging
        }
    }
    
    setupNoteEditingListeners() {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        // Build note name index from existing notes
        this.buildNoteNameIndex();
        
        // Remove old event listeners by replacing tbody with a clone
        // This prevents duplicate listeners from accumulating
        if (!tbody.dataset.listenersInitialized) {
            // First time setup - use event delegation on tbody
            tbody.dataset.listenersInitialized = 'true';
            
            // Use event delegation for click events
            tbody.addEventListener('click', (e) => {
                const target = e.target;
                
                // Handle insert button clicks (button with ID starting with "insert-btn-")
                if (target.tagName === 'BUTTON' && target.id && target.id.startsWith('insert-btn-')) {
                    const index = parseInt(target.getAttribute('data-index'));
                    if (!isNaN(index)) {
                        this.insertNote(index);
                    }
                    return;
                }
                
                // Handle delete button clicks
                if (target.classList.contains('remove-note-btn') || target.closest('.remove-note-btn')) {
                    const row = target.closest('tr[data-note-index]');
                    if (row) {
                        const index = parseInt(row.getAttribute('data-note-index'));
                        if (!isNaN(index)) {
                            this.removeNote(index);
                        }
                    }
                    return;
                }
                
                // Handle note number display clicks (for MIDI playback)
                if (target.classList.contains('note-number-display')) {
                    const noteNum = parseInt(target.getAttribute('data-note'));
                    if (!isNaN(noteNum)) {
                        this.playNote(noteNum);
                    }
                    return;
                }
            });
            
            // Use event delegation for keydown events
            tbody.addEventListener('keydown', (e) => {
                const target = e.target;
                
                // Handle insert button keydown (button with ID starting with "insert-btn-")
                if (target.tagName === 'BUTTON' && target.id && target.id.startsWith('insert-btn-')) {
                    const index = parseInt(target.getAttribute('data-index'));
                    if (!isNaN(index)) {
                        this.handleInsertButtonKeydown(e, index);
                    }
                    return;
                }
                
                // Handle note input keydown
                if (target.classList.contains('note-name-input')) {
                    const row = target.closest('tr[data-note-index]');
                    if (row) {
                        const index = parseInt(row.getAttribute('data-note-index'));
                        if (!isNaN(index)) {
                            this.handleNoteInputKeydown(e, index);
                        }
                    }
                    return;
                }
            });
            
            // Use event delegation for focus events
            tbody.addEventListener('focus', (e) => {
                const target = e.target;
                if (target.classList.contains('note-name-input')) {
                    const row = target.closest('tr[data-note-index]');
                    if (row) {
                        const index = parseInt(row.getAttribute('data-note-index'));
                        if (!isNaN(index)) {
                            this.handleNoteInputFocus(index);
                        }
                    }
                }
            }, true); // Use capture phase for focus events
            
            // Use event delegation for blur events
            tbody.addEventListener('blur', (e) => {
                const target = e.target;
                if (target.classList.contains('note-name-input')) {
                    const row = target.closest('tr[data-note-index]');
                    if (row) {
                        const index = parseInt(row.getAttribute('data-note-index'));
                        if (!isNaN(index)) {
                            this.handleNoteInputBlur(index);
                        }
                    }
                }
            }, true); // Use capture phase for blur events
            
            // Use event delegation for input events
            tbody.addEventListener('input', (e) => {
                const target = e.target;
                if (target.classList.contains('note-name-input')) {
                    const row = target.closest('tr[data-note-index]');
                    if (row) {
                        const index = parseInt(row.getAttribute('data-note-index'));
                        if (!isNaN(index)) {
                            this.handleNoteInputChange(e, index);
                        }
                    }
                }
            });
            
            // Global keyboard listener for Escape key (only add once)
            if (!this.escapeListenerInitialized) {
                this.escapeListenerInitialized = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this.hideAllDropdowns();
                    }
                });
            }
        }
        
        // Update tooltips for all note displays
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        rows.forEach((row) => {
            const noteDisplay = row.querySelector('.note-number-display');
            if (noteDisplay) {
                this.updateNoteDisplayTooltip(noteDisplay);
            }
        });
    }
    
    buildNoteNameIndex() {
        this.noteNameIndex.clear();
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const inputs = tbody.querySelectorAll('.note-name-input');
        inputs.forEach(input => {
            if (input.value.trim()) {
                this.noteNameIndex.add(input.value.trim());
            }
        });
    }
    
    handleNoteInputFocus(index) {
        const input = document.getElementById(`note-input-${index}`);
        if (!input) return;
        
        input.removeAttribute('readonly');
        input.select();
        this.showNoteDropdown(index);
        this.scrollToShowDropdown(index);
    }
    
    handleNoteInputBlur(index) {
        const input = document.getElementById(`note-input-${index}`);
        if (!input) return;
        
        // Add to index immediately
        const newNoteName = input.value.trim();
        if (newNoteName) {
            this.noteNameIndex.add(newNoteName);
            
            // Also add to tools manager's global index if available
            if (window.toolsManager && window.toolsManager.allNoteNames) {
                window.toolsManager.allNoteNames.add(newNoteName);
            }
        }
        
        // Mark patch as changed
        this.updateNoteName(index, newNoteName);
        
        // Hide dropdown after a delay (gives time for dropdown clicks to register)
        setTimeout(() => {
            input.setAttribute('readonly', 'true');
            this.hideNoteDropdown(index);
        }, 200);
    }
    
    handleNoteInputKeydown(e, index) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const dropdown = document.getElementById(`note-dropdown-${index}`);
            const selectedItem = dropdown?.querySelector('.note-dropdown-item.selected');
            const input = document.getElementById(`note-input-${index}`);
            
            if (selectedItem && input) {
                input.value = selectedItem.textContent.trim();
                this.markPatchChanged();
            }
            
            // Add current value to index immediately
            if (input && input.value.trim()) {
                const newNoteName = input.value.trim();
                this.noteNameIndex.add(newNoteName);
                
                // Also add to tools manager's global index if available
                if (window.toolsManager && window.toolsManager.allNoteNames) {
                    window.toolsManager.allNoteNames.add(newNoteName);
                }
            }
            
            // Move focus to insert button
            const insertBtn = document.getElementById(`insert-btn-${index}`);
            if (insertBtn) {
                insertBtn.focus();
            }
            
            this.hideNoteDropdown(index);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            
            if (e.shiftKey) {
                // Shift+Tab: Move to previous row's insert button
                const tbody = document.getElementById('note-list-tbody');
                if (!tbody) return;
                
                const rows = tbody.querySelectorAll('tr[data-note-index]');
                const prevIndex = index - 1;
                
                if (prevIndex >= 0) {
                    const prevRow = rows[prevIndex];
                    const prevInsertBtn = prevRow.querySelector('button[data-index]');
                    if (prevInsertBtn) {
                        prevInsertBtn.focus();
                    }
                }
                // If it's the first row, Shift+Tab does nothing
            } else {
                // Tab: Move focus to insert button in current row
                const insertBtn = document.getElementById(`insert-btn-${index}`);
                if (insertBtn) {
                    insertBtn.focus();
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateDropdown(index, 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateDropdown(index, -1);
        }
    }
    
    handleNoteInputChange(e, index) {
        this.filterDropdown(index, e.target.value);
    }
    
    handleInsertButtonKeydown(e, index) {
        if (e.key === 'Tab') {
            e.preventDefault();
            
            const tbody = document.getElementById('note-list-tbody');
            if (!tbody) return;
            
            const rows = tbody.querySelectorAll('tr[data-note-index]');
            
            if (e.shiftKey) {
                // Shift+Tab: Move back to current row's note input
                const currentRow = rows[index];
                const currentInput = currentRow.querySelector('.note-name-input');
                if (currentInput) {
                    currentInput.focus();
                    currentInput.select();
                }
            } else {
                // Tab: Move to next row's note input
                const nextIndex = index + 1;
                
                if (nextIndex < rows.length) {
                    const nextRow = rows[nextIndex];
                    const nextInput = nextRow.querySelector('.note-name-input');
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                    }
                }
                // If it's the last row, Tab does nothing (prevented by e.preventDefault())
            }
        }
    }
    
    showNoteDropdown(index) {
        const dropdown = document.getElementById(`note-dropdown-${index}`);
        if (!dropdown) return;
        
        const suggestions = this.getNoteNameSuggestions(index);
        dropdown.innerHTML = suggestions.map(suggestion => 
            `<div class="note-dropdown-item" data-value="${suggestion}">${Utils.escapeHtml(suggestion)}</div>`
        ).join('');
        
        // Add click listeners to dropdown items
        dropdown.querySelectorAll('.note-dropdown-item').forEach(item => {
            // Use mousedown to prevent blur on the input
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent input from losing focus
                const input = document.getElementById(`note-input-${index}`);
                if (input) {
                    input.value = item.textContent.trim();
                    this.markPatchChanged();
                }
                this.hideNoteDropdown(index);
                // Re-focus the input after selection
                if (input) {
                    input.focus();
                    // Move cursor to end
                    setTimeout(() => {
                        input.setSelectionRange(input.value.length, input.value.length);
                    }, 0);
                }
            });
        });
        
        // Position the dropdown using fixed positioning
        this.positionDropdown(index, dropdown);
        
        dropdown.style.display = 'block';
        this.filterDropdown(index, '');
    }
    
    positionDropdown(index, dropdown) {
        const input = document.getElementById(`note-input-${index}`);
        if (!input) return;
        
        const inputRect = input.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownMaxHeight = 200; // Match CSS max-height
        
        // Calculate if there's space below
        const spaceBelow = viewportHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;
        
        // Position dropdown
        dropdown.style.position = 'fixed';
        dropdown.style.left = `${inputRect.left}px`;
        dropdown.style.width = `${inputRect.width}px`;
        dropdown.style.minWidth = '200px';
        
        // Decide whether to show above or below
        if (spaceBelow >= dropdownMaxHeight || spaceBelow >= spaceAbove) {
            // Show below
            dropdown.style.top = `${inputRect.bottom}px`;
            dropdown.style.bottom = 'auto';
            dropdown.classList.remove('dropdown-above');
        } else {
            // Show above
            dropdown.style.bottom = `${viewportHeight - inputRect.top}px`;
            dropdown.style.top = 'auto';
            dropdown.classList.add('dropdown-above');
        }
    }
    
    hideNoteDropdown(index) {
        const dropdown = document.getElementById(`note-dropdown-${index}`);
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    hideAllDropdowns() {
        const dropdowns = document.querySelectorAll('.note-dropdown');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }
    
    filterDropdown(index, filter) {
        const dropdown = document.getElementById(`note-dropdown-${index}`);
        if (!dropdown) return;
        
        const items = dropdown.querySelectorAll('.note-dropdown-item');
        let visibleCount = 0;
        let exactMatch = null;
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = text.includes(filter.toLowerCase());
            item.style.display = matches ? 'block' : 'none';
            
            // Remove selection from hidden items
            if (!matches && item.classList.contains('selected')) {
                item.classList.remove('selected');
            }
            
            if (matches) {
                visibleCount++;
                if (text === filter.toLowerCase()) {
                    exactMatch = item;
                }
            }
        });
        
        // Auto-select if exact match and only one visible
        if (exactMatch && visibleCount === 1) {
            items.forEach(item => item.classList.remove('selected'));
            exactMatch.classList.add('selected');
        }
        
        // Keep dropdown visible if there are matches
        if (visibleCount > 0) {
            dropdown.style.display = 'block';
            // Reposition in case content changed or scroll occurred
            this.positionDropdown(index, dropdown);
        }
    }
    
    navigateDropdown(index, direction) {
        const dropdown = document.getElementById(`note-dropdown-${index}`);
        if (!dropdown) return;
        
        const items = Array.from(dropdown.querySelectorAll('.note-dropdown-item:not([style*="display: none"])'));
        if (items.length === 0) return;
        
        const currentSelected = dropdown.querySelector('.note-dropdown-item.selected');
        let currentIndex = currentSelected ? items.indexOf(currentSelected) : -1;
        
        // direction > 0 means ArrowDown: move forward (next item, higher index)
        // direction < 0 means ArrowUp: move backward (previous item, lower index)
        if (direction > 0) {
            // ArrowDown: move to next item (higher index)
            currentIndex = (currentIndex + 1) % items.length;
        } else {
            // ArrowUp: move to previous item (lower index)
            currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        }
        
        items.forEach(item => item.classList.remove('selected'));
        items[currentIndex].classList.add('selected');
        
        // Scroll selected item into view
        items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
    
    scrollToShowDropdown(index) {
        const input = document.getElementById(`note-input-${index}`);
        if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    getNoteNameSuggestions(index) {
        // Get suggestions from the tools manager's full index if available
        let suggestions = [];
        
        // First priority: use the full index from tools manager
        if (window.toolsManager && window.toolsManager.allNoteNames && window.toolsManager.allNoteNames.size > 0) {
            suggestions = [...window.toolsManager.allNoteNames];
        } else {
            // Fallback: use local index
            suggestions = [...this.noteNameIndex];
        }
        
        // Add drum names
        suggestions = [...suggestions, ...this.drumNames];
        
        // Remove duplicates and sort
        return [...new Set(suggestions)].sort();
    }
    
    updateNoteDisplayTooltip(noteDisplay) {
        const noteNum = parseInt(noteDisplay.getAttribute('data-note'));
        const pianoKey = noteDisplay.getAttribute('data-piano-key');
        
        // Tooltip updated silently
        
        // Remove any existing tooltip event listeners
        noteDisplay.removeEventListener('mouseenter', noteDisplay._tooltipHandler);
        noteDisplay.removeEventListener('mouseleave', noteDisplay._tooltipLeaveHandler);
        noteDisplay.removeEventListener('mousemove', noteDisplay._tooltipMoveHandler);
        
        // Create new tooltip handlers using the original approach
        noteDisplay._tooltipHandler = (e) => {
            const tooltip = document.getElementById('keyboard-tooltip');
            if (tooltip) {
                const tooltipText = this.getMIDIStatus() ? 
                    `Send note ${noteNum} (${pianoKey})` : 
                    'Select a MIDI output device to send MIDI notes';
                
                tooltip.innerHTML = tooltipText;
                tooltip.style.display = 'flex';
                this.updateTooltipPosition(e);
            }
        };
        
        noteDisplay._tooltipLeaveHandler = () => {
            const tooltip = document.getElementById('keyboard-tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        };
        
        noteDisplay._tooltipMoveHandler = (e) => {
            this.updateTooltipPosition(e);
        };
        
        // Add the new event listeners
        noteDisplay.addEventListener('mouseenter', noteDisplay._tooltipHandler);
        noteDisplay.addEventListener('mouseleave', noteDisplay._tooltipLeaveHandler);
        noteDisplay.addEventListener('mousemove', noteDisplay._tooltipMoveHandler);
    }
    
    refreshAllNoteDisplayTooltips() {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) {
            return;
        }
        
        const noteDisplays = tbody.querySelectorAll('.note-number-display');
        
        noteDisplays.forEach((display) => {
            this.updateNoteDisplayTooltip(display);
        });
    }
    
    // Test method to verify tooltip functionality
    testTooltip() {
        const tooltip = document.getElementById('keyboard-tooltip');
        if (tooltip) {
            tooltip.innerHTML = 'Test tooltip';
            tooltip.style.display = 'flex';
            tooltip.style.left = '100px';
            tooltip.style.top = '100px';
        }
    }
    
    addNote() {
        let tbody = document.getElementById('note-list-tbody');
        
        // If no tbody exists, we need to create the entire note list structure
        if (!tbody) {
            this.createNoteListStructure();
            tbody = document.getElementById('note-list-tbody');
            if (!tbody) {
                console.error('Failed to create note list structure');
                return;
            }
        }
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        const newIndex = rows.length;
        
        // Determine the new note number based on existing notes
        let newNoteNumber = 36; // Default to C2 if no notes exist
        if (rows.length > 0) {
            // Get the last note's number and add 1
            const lastRow = rows[rows.length - 1];
            const lastNoteDisplay = lastRow.querySelector('.note-number-display');
            if (lastNoteDisplay) {
                const lastNoteNumber = parseInt(lastNoteDisplay.getAttribute('data-note'));
                newNoteNumber = lastNoteNumber + 1;
            }
        }
        
        const pianoKey = this.getPianoKeyName(newNoteNumber);
        const isBlack = this.isBlackKey(newNoteNumber);
        const insertBtnId = `insert-btn-${newIndex}`;
        const noteInputId = `note-input-${newIndex}`;
        const dropdownId = `note-dropdown-${newIndex}`;
        
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-note-index', newIndex);
        newRow.setAttribute('data-testid', `row_note_${newIndex}`);
        if (isBlack) newRow.classList.add('black-key-row');
        
        newRow.innerHTML = `
            <td data-testid="cel_note_number_${newIndex}">
                <span class="note-number-display ${isBlack ? 'black-key' : 'white-key'}" 
                      data-note="${newNoteNumber}"
                      data-piano-key="${pianoKey}"
                      data-testid="spn_note_number_${newIndex}">
                    ${newNoteNumber} <small>(${pianoKey})</small>
                </span>
            </td>
            <td class="note-name-cell" data-testid="cel_note_name_${newIndex}">
                <input type="text" 
                       id="${noteInputId}"
                       class="note-name-input" 
                       value="${this.getDefaultNoteName(newNoteNumber)}"
                       data-index="${newIndex}"
                       data-testid="npt_note_name_${newIndex}"
                       tabindex="0"
                       readonly>
                <div class="note-dropdown" id="${dropdownId}" style="display: none;"></div>
            </td>
            <td class="note-actions" data-testid="cel_note_actions_${newIndex}">
                <button class="btn btn-sm btn-outline-primary" 
                        id="${insertBtnId}"
                        data-index="${newIndex}"
                        data-testid="btn_insert_note_${newIndex}"
                        tabindex="0"
                        title="Insert Note">
                    +I
                </button>
                <button class="btn btn-sm btn-danger remove-note-btn" 
                        data-index="${newIndex}"
                        tabindex="-1"
                        title="Delete Note">
                    ×
                </button>
            </td>
        `;
        
        tbody.appendChild(newRow);
        this.setupNoteEditingListeners();
        this.markPatchChanged();
        this.updateNoteCount();
        this.updateNoteRangeDropdowns();
        
        // Focus and select the new note name
        setTimeout(() => {
            const input = document.getElementById(noteInputId);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }
    
    updateNoteCount() {
        const tbody = document.getElementById('note-list-tbody');
        const noteCountSpan = document.querySelector('.note-count');
        if (tbody && noteCountSpan) {
            const count = tbody.querySelectorAll('tr[data-note-index]').length;
            noteCountSpan.textContent = `(${count} note${count !== 1 ? 's' : ''})`;
        }
    }
    
    updateNoteRangeDropdowns() {
        const tbody = document.getElementById('note-list-tbody');
        const minSelect = document.getElementById('note-range-min');
        const maxSelect = document.getElementById('note-range-max');
        
        if (!tbody || !minSelect || !maxSelect) return;
        
        // Get current notes for constraint calculation
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        const notes = [];
        rows.forEach(row => {
            const noteNumSpan = row.querySelector('.note-number-display');
            if (noteNumSpan) {
                const noteNum = parseInt(noteNumSpan.getAttribute('data-note'));
                if (!isNaN(noteNum)) {
                    notes.push({ number: noteNum });
                }
            }
        });
        
        // Regenerate options
        minSelect.innerHTML = this.generateNoteRangeOptions('min', notes);
        maxSelect.innerHTML = this.generateNoteRangeOptions('max', notes);
    }
    
    generateNoteRangeOptions(type, notes) {
        // Generate options for min and max dropdowns
        // Min: 0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120
        // Max: 24, 36, 48, 60, 72, 84, 96, 108, 120, 127
        
        const minOptions = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120];
        const maxOptions = [24, 36, 48, 60, 72, 84, 96, 108, 120, 127];
        
        let options = type === 'min' ? minOptions : maxOptions;
        let currentMin = null;
        let currentMax = null;
        let defaultMin = 36;  // Default to C2
        let defaultMax = 96;  // Default to C7
        
        // If notes exist, determine constraints
        if (notes && notes.length > 0) {
            const noteNumbers = notes.map(n => parseInt(n.number)).filter(n => !isNaN(n));
            if (noteNumbers.length > 0) {
                currentMin = Math.min(...noteNumbers);
                currentMax = Math.max(...noteNumbers);
            }
        }
        
        // Filter options based on constraints only if notes exist
        if (type === 'min') {
            if (currentMin !== null) {
                // Min can't be higher than the lowest existing note
                options = options.filter(opt => opt <= currentMin);
                if (options.length === 0) options = [currentMin]; // Always include at least current min
            }
            // If no notes exist, show all options
        } else {
            if (currentMax !== null) {
                // Max can't be lower than the highest existing note
                options = options.filter(opt => opt >= currentMax);
                if (options.length === 0) options = [currentMax]; // Always include at least current max
            }
            // If no notes exist, show all options
        }
        
        // Generate HTML options
        return options.map(noteNum => {
            const pianoKey = this.getPianoKeyName(noteNum);
            // Select current min/max if exists, otherwise select default
            const shouldSelect = currentMin !== null 
                ? ((type === 'min' && noteNum === currentMin) || (type === 'max' && noteNum === currentMax))
                : ((type === 'min' && noteNum === defaultMin) || (type === 'max' && noteNum === defaultMax));
            return `<option value="${noteNum}" ${shouldSelect ? 'selected' : ''}>${noteNum} (${pianoKey})</option>`;
        }).join('');
    }
    
    updateNoteRange() {
        const minSelect = document.getElementById('note-range-min');
        const maxSelect = document.getElementById('note-range-max');
        const tbody = document.getElementById('note-list-tbody');
        
        if (!minSelect || !maxSelect || !tbody) {
            console.error('Note range controls not found');
            return;
        }
        
        const minNote = parseInt(minSelect.value);
        const maxNote = parseInt(maxSelect.value);
        
        if (isNaN(minNote) || isNaN(maxNote) || minNote > maxNote) {
            Utils.showNotification('Range must be wider', 'error');
            return;
        }
        
        // Get existing notes as a map and determine current range
        const existingNotes = new Map();
        let currentMin = null;
        let currentMax = null;
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        rows.forEach(row => {
            const noteNumSpan = row.querySelector('.note-number-display');
            const noteInput = row.querySelector('.note-name-input');
            if (noteNumSpan && noteInput) {
                const noteNum = parseInt(noteNumSpan.getAttribute('data-note'));
                const noteName = noteInput.value;
                if (!isNaN(noteNum)) {
                    existingNotes.set(noteNum, noteName);
                    if (currentMin === null || noteNum < currentMin) currentMin = noteNum;
                    if (currentMax === null || noteNum > currentMax) currentMax = noteNum;
                }
            }
        });
        
        // Validate that we're not shrinking the range below existing notes
        if (existingNotes.size > 0) {
            if (minNote > currentMin) {
                Utils.showNotification(`Cannot raise minimum above ${currentMin} - would lose existing notes`, 'error');
                this.logToDebugConsole(`Range extension blocked: min ${minNote} > current min ${currentMin}`, 'error');
                return;
            }
            if (maxNote < currentMax) {
                Utils.showNotification(`Cannot lower maximum below ${currentMax} - would lose existing notes`, 'error');
                this.logToDebugConsole(`Range extension blocked: max ${maxNote} < current max ${currentMax}`, 'error');
                return;
            }
        }
        
        // Clear the tbody
        tbody.innerHTML = '';
        
        // Build new note list with all notes in range
        let index = 0;
        for (let noteNum = minNote; noteNum <= maxNote; noteNum++) {
            const noteName = existingNotes.has(noteNum) 
                ? existingNotes.get(noteNum) 
                : this.getDefaultNoteName(noteNum);
            
            const pianoKey = this.getPianoKeyName(noteNum);
            const isBlack = this.isBlackKey(noteNum);
            const insertBtnId = `insert-btn-${index}`;
            const noteInputId = `note-input-${index}`;
            const dropdownId = `note-dropdown-${index}`;
            
            const newRow = document.createElement('tr');
            newRow.setAttribute('data-note-index', index);
            if (isBlack) newRow.classList.add('black-key-row');
            
            newRow.innerHTML = `
                <td>
                    <span class="note-number-display ${isBlack ? 'black-key' : 'white-key'}" 
                          data-note="${noteNum}"
                          data-piano-key="${pianoKey}">
                        ${noteNum} <small>(${pianoKey})</small>
                    </span>
                </td>
                <td class="note-name-cell">
                    <input type="text" 
                           id="${noteInputId}"
                           class="note-name-input" 
                           value="${Utils.escapeHtml(noteName)}"
                           data-index="${index}"
                           tabindex="${index === 0 ? '1' : '0'}"
                           readonly>
                    <div class="note-dropdown" id="${dropdownId}" style="display: none;"></div>
                </td>
                <td class="note-actions">
                    <button class="btn btn-sm btn-outline-primary" 
                            id="${insertBtnId}"
                            data-index="${index}"
                            tabindex="${index === 0 ? '2' : '0'}"
                            title="Insert Note">
                        +I
                    </button>
                    <button class="btn btn-sm btn-danger remove-note-btn" 
                            data-index="${index}"
                            tabindex="-1"
                            title="Delete Note">
                        ×
                    </button>
                </td>
            `;
            
            tbody.appendChild(newRow);
            index++;
        }
        
        this.setupNoteEditingListeners();
        this.markPatchChanged();
        this.updateNoteCount();
        this.updateNoteRangeDropdowns();
        
        const addedCount = (maxNote - minNote + 1) - existingNotes.size;
        this.logToDebugConsole(`Updated note range: ${minNote}-${maxNote} (${addedCount} new notes added)`, 'info');
        Utils.showNotification(`Note range updated: ${minNote}-${maxNote}`, 'success');
    }
    
    createNoteListStructure() {
        // Find the note-names container that currently shows "No note names available"
        const noteNamesContainer = document.querySelector('.note-names');
        if (!noteNamesContainer) {
            console.error('Could not find note-names container');
            return;
        }
        
        // Create a note list name based on the patch name
        const patchName = appState.selectedPatch?.name || 'Patch';
        const noteListName = `${patchName} Notes`;
        
        // Replace the content with the note list structure
        noteNamesContainer.innerHTML = `
            <div class="note-list-info">
                <strong>Note List:</strong> ${Utils.escapeHtml(noteListName)}
                <span class="note-count">(0 notes)</span>
            </div>
            <div class="note-editor-actions">
                <button class="btn btn-primary add-note-btn" onclick="patchManager.addNote()">
                    + Add Note
                </button>
                <div class="note-range-control">
                    <label>Note Range:</label>
                    <select id="note-range-min" class="note-range-select">
                        ${this.generateNoteRangeOptions('min', [])}
                    </select>
                    <span>to</span>
                    <select id="note-range-max" class="note-range-select">
                        ${this.generateNoteRangeOptions('max', [])}
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="patchManager.updateNoteRange()">
                        Extend
                    </button>
                </div>
            </div>
            <div class="note-table-container">
                <table class="note-table">
                    <thead>
                        <tr>
                            <th>Note #</th>
                            <th>Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="note-list-tbody">
                    </tbody>
                </table>
            </div>
        `;
        
        // Update the patch to use this new note list
        if (appState.selectedPatch) {
            appState.selectedPatch.usesNoteList = noteListName;
            appState.selectedPatch.note_list_name = noteListName;
        }
        
        // Log the creation
        this.logToDebugConsole(`Created new note list: "${noteListName}"`, 'info');
        this.markPatchChanged();
    }
    
    insertNote(index) {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        // Get the current row to find its actual MIDI note number
        const currentRow = tbody.querySelector(`tr[data-note-index="${index}"]`);
        if (!currentRow) return;
        
        const currentNoteDisplay = currentRow.querySelector('.note-number-display');
        if (!currentNoteDisplay) return;
        
        const currentNoteNumber = parseInt(currentNoteDisplay.getAttribute('data-note'));
        const insertIndex = parseInt(index) + 1;
        const newNoteNumber = currentNoteNumber + 1; // Insert after current note
        
        const pianoKey = this.getPianoKeyName(newNoteNumber);
        const isBlack = this.isBlackKey(newNoteNumber);
        const insertBtnId = `insert-btn-${insertIndex}`;
        const noteInputId = `note-input-${insertIndex}`;
        const dropdownId = `note-dropdown-${insertIndex}`;
        
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-note-index', insertIndex);
        newRow.setAttribute('data-testid', `row_note_${insertIndex}`);
        if (isBlack) newRow.classList.add('black-key-row');
        
        newRow.innerHTML = `
            <td data-testid="cel_note_number_${insertIndex}">
                <span class="note-number-display ${isBlack ? 'black-key' : 'white-key'}" 
                      data-note="${newNoteNumber}"
                      data-piano-key="${pianoKey}"
                      data-testid="spn_note_number_${insertIndex}">
                    ${newNoteNumber} <small>(${pianoKey})</small>
                </span>
            </td>
            <td class="note-name-cell" data-testid="cel_note_name_${insertIndex}">
                <input type="text" 
                       id="${noteInputId}"
                       class="note-name-input" 
                       value="${this.getDefaultNoteName(newNoteNumber)}"
                       data-index="${insertIndex}"
                       data-testid="npt_note_name_${insertIndex}"
                       tabindex="0"
                       readonly>
                <div class="note-dropdown" id="${dropdownId}" style="display: none;"></div>
            </td>
            <td class="note-actions" data-testid="cel_note_actions_${insertIndex}">
                <button class="btn btn-sm btn-outline-primary" 
                        id="${insertBtnId}"
                        data-index="${insertIndex}"
                        data-testid="btn_insert_note_${insertIndex}"
                        tabindex="0"
                        title="Insert Note">
                    +I
                </button>
                <button class="btn btn-sm btn-danger remove-note-btn" 
                        data-index="${insertIndex}"
                        tabindex="-1"
                        title="Delete Note">
                    ×
                </button>
            </td>
        `;
        
        // Insert after the current row (currentRow is already defined at the top)
        if (currentRow) {
            currentRow.insertAdjacentElement('afterend', newRow);
        } else {
            tbody.appendChild(newRow);
        }
        
        // Renumber all subsequent rows
        this.renumberNotes();
        this.setupNoteEditingListeners();
        this.markPatchChanged();
        this.updateNoteRangeDropdowns();
        
        // Focus and select the new note name
        setTimeout(() => {
            const input = document.getElementById(noteInputId);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }
    
    removeNote(index) {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const row = tbody.querySelector(`tr[data-note-index="${index}"]`);
        if (row) {
            const noteDisplay = row.querySelector('.note-number-display');
            const noteNumber = noteDisplay ? noteDisplay.getAttribute('data-note') : 'unknown';
            
            row.remove();
            this.renumberNotes();
            this.setupNoteEditingListeners();
            this.markPatchChanged();
            this.updateNoteCount();
            this.updateNoteRangeDropdowns();
            
            this.logToDebugConsole(`Removed note ${noteNumber} (was at row index ${index})`, 'info');
        }
    }
    
    renumberNotes() {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        if (rows.length === 0) return;
        
        // Get the starting note number from the first row
        const firstRow = rows[0];
        const firstNoteDisplay = firstRow.querySelector('.note-number-display');
        const startingNoteNumber = firstNoteDisplay ? parseInt(firstNoteDisplay.getAttribute('data-note')) : 36;
        
        console.log(`[renumberNotes] Renumbering ${rows.length} rows starting from note ${startingNoteNumber}`);
        
        rows.forEach((row, newIndex) => {
            const oldIndex = row.getAttribute('data-note-index');
            row.setAttribute('data-note-index', newIndex);
            
            // Calculate the new MIDI note number based on position in the list
            const noteNumber = startingNoteNumber + newIndex;
            const pianoKey = this.getPianoKeyName(noteNumber);
            const isBlack = this.isBlackKey(noteNumber);
            
            // Update the note display
            const noteDisplay = row.querySelector('.note-number-display');
            if (noteDisplay) {
                noteDisplay.setAttribute('data-note', noteNumber);
                noteDisplay.setAttribute('data-piano-key', pianoKey);
                noteDisplay.innerHTML = `${noteNumber} <small>(${pianoKey})</small>`;
                noteDisplay.className = `note-number-display ${isBlack ? 'black-key' : 'white-key'}`;
            }
            
            // Update row styling for black/white keys
            if (isBlack) {
                row.classList.add('black-key-row');
            } else {
                row.classList.remove('black-key-row');
            }
            
            if (oldIndex !== String(newIndex)) {
                console.log(`[renumberNotes] Row ${oldIndex} → ${newIndex}, Note: ${noteNumber} (${pianoKey})`);
            }
            
            // Update input IDs and data attributes to match new index
            const input = row.querySelector('.note-name-input');
            if (input) {
                input.id = `note-input-${newIndex}`;
                input.setAttribute('data-index', newIndex);
            }
            
            const dropdown = row.querySelector('.note-dropdown');
            if (dropdown) {
                dropdown.id = `note-dropdown-${newIndex}`;
            }
            
            // Update insert button
            const insertBtn = row.querySelector('button.btn-outline-primary:not(.remove-note-btn)');
            if (insertBtn) {
                insertBtn.id = `insert-btn-${newIndex}`;
                insertBtn.setAttribute('data-index', newIndex);
            }
            
            // Update delete button
            const deleteBtn = row.querySelector('.remove-note-btn');
            if (deleteBtn) {
                deleteBtn.setAttribute('data-index', newIndex);
            }
        });
    }
    
    updateNoteNumber(index, newNumber) {
        this.markPatchChanged();
    }
    
    updateNoteName(index, newName) {
        this.markPatchChanged();
    }
    
    updatePatchName(newName) {
        if (appState.selectedPatch) {
            appState.selectedPatch.name = newName;
            this.markPatchChanged();
        }
    }
    
    updatePatchNumber(newNumber) {
        if (appState.selectedPatch) {
            appState.selectedPatch.number = newNumber;
            this.markPatchChanged();
        }
    }
    
    markPatchChanged() {
        // Use global save state management
        appState.markAsChanged();
    }
    
    collectNoteDataFromEditor() {
        const noteData = [];
        const tbody = document.getElementById('note-list-tbody');
        
        if (!tbody) return noteData;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        rows.forEach(row => {
            const noteInput = row.querySelector('.note-name-input');
            const noteDisplay = row.querySelector('.note-number-display');
            
            if (noteInput && noteDisplay) {
                const noteNumber = noteDisplay.getAttribute('data-note');
                if (noteNumber) {
                    noteData.push({
                        number: parseInt(noteNumber),
                        name: noteInput.value.trim()
                    });
                }
            }
        });
        
        return noteData;
    }
    
    request2FA() {
        // Placeholder for two-factor authentication
        Utils.showNotification('Two-factor authentication required', 'info');
    }
    
    
    generatePatchSelectionHTML(patchLists) {
        return `
            <div class="patch-selection">
                <label for="patch-list-select">Select Patch List:</label>
                <select id="patch-list-select">
                    <option value="">Choose a patch list...</option>
                    ${patchLists.map((patchList, index) => `
                        <option value="${index}">${Utils.escapeHtml(patchList.name || `Patch List ${index + 1}`)}</option>
                    `).join('')}
                </select>
            </div>
            
            <div id="patch-list-content" class="patch-list-content" style="display: none;">
                <!-- Patch list content will be loaded here -->
            </div>
        `;
    }
    
    setupPatchEventListeners() {
        const patchListSelect = document.getElementById('patch-list-select');
        if (patchListSelect) {
            patchListSelect.addEventListener('change', (e) => {
                const index = parseInt(e.target.value);
                if (!isNaN(index)) {
                    this.selectPatchList(index);
                } else {
                    this.hidePatchListContent();
                }
            });
        }
    }
    
    selectPatchList(index) {
        const patchLists = appState.currentMidnam.patchList || [];
        if (index < 0 || index >= patchLists.length) return;
        
        this.selectedPatchList = patchLists[index];
        this.renderPatchListContent();
    }
    
    renderPatchListContent() {
        const content = document.getElementById('patch-list-content');
        if (!content || !this.selectedPatchList) return;
        
        const patches = this.selectedPatchList.patch || [];
        
        content.innerHTML = `
            <div class="patch-list">
                <div class="patch-list-header">
                    <h3>${Utils.escapeHtml(this.selectedPatchList.name || 'Unnamed Patch List')}</h3>
                    <div class="patch-list-actions">
                        <button class="btn btn-primary btn-small" id="btn_patch-list-edit" onclick="patchManager.togglePatchEditMode()">${this.patchEditMode ? 'Done' : 'Edit'}</button>
                        <button class="btn btn-primary btn-small" onclick="patchManager.addPatch()">Add Patch</button>
                        <button class="btn btn-secondary btn-small" onclick="patchManager.testPatchList()">Test MIDI</button>
                    </div>
                </div>
                
                ${this.patchEditMode ? this.renderPatchEditTable(patches) : patches.map((patch, index) => {
                    const defaultName = 'Patch ' + (index + 1);
                    const patchName = patch.name || defaultName;
                    const patchNumber = patch.Number !== undefined ? patch.Number : index;
                    const programChange = patch.programChange !== undefined ? patch.programChange : index;
                    return `
                    <div class="patch-item" data-patch-index="${index}">
                        <div class="patch-header">
                            <div class="patch-info-inline">
                                <span class="patch-number clickable-pc" 
                                      data-patch-index="${index}"
                                      data-program-change="${programChange}">${patchNumber}</span>
                                <span class="patch-name clickable" onclick="patchManager.editPatch(${index})" title="Click to edit patch">${Utils.escapeHtml(patchName)}</span>
                                <span class="patch-program-change clickable-pc"
                                      data-patch-index="${index}"
                                      data-program-change="${programChange}">PC: ${programChange}</span>
                            </div>
                            <div class="patch-actions">
                                <button class="btn btn-small btn-secondary" onclick="patchManager.testPatch(${index})">Test</button>
                                <button class="btn btn-small btn-danger" onclick="patchManager.deletePatch(${index})">Delete</button>
                            </div>
                        </div>
                        <div class="patch-details">
                            <div class="patch-info">
                                ${patch.bankSelectMSB ? '<p>Bank Select MSB: ' + patch.bankSelectMSB + '</p>' : ''}
                                ${patch.bankSelectLSB ? '<p>Bank Select LSB: ' + patch.bankSelectLSB + '</p>' : ''}
                            </div>
                            ${this.generatePatchNoteListsHTML(patch)}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        
        content.style.display = 'block';
        
        if (!this.patchEditMode) {
            // Add click handlers for patch selection (only in view mode)
            content.querySelectorAll('.patch-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('.patch-actions')) {
                        const index = parseInt(item.getAttribute('data-patch-index'));
                        this.selectPatch(index);
                    }
                });
            });
            
            // Setup MIDI-related event listeners for clickable-pc elements
            this.setupPatchTabMIDIListeners();
        } else {
            // In edit mode, setup patch editing event listeners
            this.setupPatchEditListeners();
        }
    }
    
    generatePatchNoteListsHTML(patch) {
        if (!patch.noteListReference || patch.noteListReference.length === 0) {
            return '<div class="patch-note-lists"><p>No note lists assigned</p></div>';
        }
        
        return `
            <div class="patch-note-lists">
                <h4>Note Lists:</h4>
                ${patch.noteListReference.map(ref => `
                    <div class="note-list-reference">
                        <span class="note-list-name">${Utils.escapeHtml(ref.name || 'Unnamed Note List')}</span>
                        <div class="note-list-actions">
                            <button class="btn btn-small btn-primary" onclick="patchManager.editNoteListReference('${ref.name}')">Edit</button>
                            <button class="btn btn-small btn-danger" onclick="patchManager.removeNoteListReference('${ref.name}')">Remove</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    hidePatchListContent() {
        const content = document.getElementById('patch-list-content');
        if (content) {
            content.style.display = 'none';
        }
        this.selectedPatchList = null;
        this.selectedPatch = null;
    }
    
    selectPatch(index) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patches = this.selectedPatchList.patch;
        if (index < 0 || index >= patches.length) return;
        
        this.selectedPatch = patches[index];
        
        // Update UI to show selected patch
        document.querySelectorAll('.patch-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-patch-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
    }
    
    async savePatch() {
        // If we're in patch edit mode (editing patch list, not individual patch), use global save
        if (this.patchEditMode && appState.pendingChanges.hasUnsavedChanges && appState.currentMidnam) {
            if (window.deviceManager && window.deviceManager.saveMidnamStructure) {
                await window.deviceManager.saveMidnamStructure();
                return;
            }
        }
        
        if (!appState.selectedPatch) {
            Utils.showNotification('No patch selected to save', 'warning');
            return;
        }
        
        // Store the original patch name before updating
        const originalName = appState.selectedPatch.originalName || appState.selectedPatch.name;
        
        // Collect current patch name and number from editor inputs
        const nameInput = document.getElementById('patch-name-input');
        const numberInput = document.getElementById('patch-number-input');
        
        const updatedName = nameInput ? nameInput.value.trim() : appState.selectedPatch.name;
        const updatedNumber = numberInput ? numberInput.value.trim() : appState.selectedPatch.number;
        
        // Collect current note data from the editor
        const noteData = this.collectNoteDataFromEditor();
        
        // Get file path for better error reporting
        const filePath = (appState.selectedDevice && appState.selectedDevice.file_path) 
            ? appState.selectedDevice.file_path 
            : (appState.currentMidnam && appState.currentMidnam.file_path)
                ? appState.currentMidnam.file_path
                : 'unknown file';
        
        // Route to appropriate save method based on environment
        if (isHostedVersion()) {
            await this.savePatchHosted(originalName, updatedName, updatedNumber, noteData, filePath);
        } else {
            await this.savePatchToServer(originalName, updatedName, updatedNumber, noteData, filePath);
        }
    }

    async savePatchHosted(originalName, updatedName, updatedNumber, noteData, filePath) {
        try {
            // Update the original name to the new name for future saves
            if (appState.selectedPatch) {
                appState.selectedPatch.originalName = updatedName;
                appState.selectedPatch.name = updatedName;
                appState.selectedPatch.number = updatedNumber;
            }
            
            // Update the note list in appState.currentMidnam to reflect saved changes
            const noteListName = appState.selectedPatch.usesNoteList || appState.selectedPatch.note_list_name;
            if (noteListName && appState.currentMidnam && appState.currentMidnam.note_lists) {
                const noteList = appState.currentMidnam.note_lists.find(nl => nl.name === noteListName);
                if (noteList) {
                    // Update the notes in the cached note list
                    noteList.notes = noteData.map(note => ({
                        number: note.number,
                        name: note.name
                    }));
                }
            }
            
            // Update the patch in the cached patch_banks data
            if (appState.currentMidnam && appState.currentMidnam.patch_banks && appState.selectedPatchBank) {
                const bank = appState.currentMidnam.patch_banks.find(b => b.name === appState.selectedPatchBank.name);
                if (bank) {
                    const patchIndex = bank.patches.findIndex(p => p.name === originalName);
                    if (patchIndex !== -1) {
                        bank.patches[patchIndex].name = updatedName;
                        bank.patches[patchIndex].number = updatedNumber;
                    }
                }
            }
            
            // Mark as having changes so global save will work
            appState.markAsChanged();
            
            // Now save the entire MIDNAM structure to browser storage
            if (window.deviceManager && window.deviceManager.saveMidnamStructure) {
                await window.deviceManager.saveMidnamStructure();
            } else {
                throw new Error('Device manager not available');
            }
            
            this.logToDebugConsole(`✓ Patch saved successfully to browser storage`, 'success');
        } catch (error) {
            console.error('Error saving patch to browser:', error);
            this.logToDebugConsole(`✗ Failed to save patch: ${error.message}`, 'error');
            Utils.showNotification(`Save failed: ${error.message}`, 'error');
        }
    }

    async savePatchToServer(originalName, updatedName, updatedNumber, noteData, filePath) {
        try {
            const response = await fetch('/api/patch/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: appState.selectedDevice.id,
                    patchBank: appState.selectedPatchBank.name,
                    originalPatchName: originalName,
                    patch: {
                        ...appState.selectedPatch,
                        name: updatedName,
                        number: updatedNumber
                    },
                    notes: noteData,
                    noteListName: appState.selectedPatch?.usesNoteList || appState.selectedPatch?.note_list_name
                })
            });
            
            if (!response.ok) {
                // Try to extract error message from response
                let errorMessage = response.statusText || `HTTP ${response.status}`;
                
                try {
                    const errorText = await response.text();
                    // Try to parse as JSON first
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorJson.message || errorMessage;
                    } catch {
                        // Not JSON, use the text directly if it's meaningful and not HTML
                        if (errorText && errorText.length < 200 && !errorText.includes('<!DOCTYPE')) {
                            errorMessage = errorText;
                        }
                    }
                } catch {
                    // Couldn't read response body, use statusText
                }
                
                // Log detailed error to debug console
                this.logToDebugConsole(`✗ Failed to save patch to: ${filePath}`, 'error');
                this.logToDebugConsole(`  Error: ${errorMessage}`, 'error');
                
                // Special handling for 422 (invalid XML)
                if (response.status === 422) {
                    this.logToDebugConsole('  ⚠ The file contains invalid XML. Use the Validate button to see details.', 'error');
                }
                
                // Special handling for 404 (file not in catalog due to invalid structure)
                if (response.status === 404 && errorMessage.includes('No valid file found')) {
                    this.logToDebugConsole('  ⚠ The file was excluded from the catalog due to invalid XML structure.', 'error');
                    this.logToDebugConsole('  ℹ Required: MIDINameDocument root element, Manufacturer, and Model elements.', 'info');
                }
                
                throw new Error(errorMessage);
            }
            
            // Update the original name to the new name for future saves
            if (appState.selectedPatch) {
                appState.selectedPatch.originalName = updatedName;
                appState.selectedPatch.name = updatedName;
                appState.selectedPatch.number = updatedNumber;
            }
            
            // Update the note list in appState.currentMidnam to reflect saved changes
            const noteListName = appState.selectedPatch.usesNoteList || appState.selectedPatch.note_list_name;
            if (noteListName && appState.currentMidnam && appState.currentMidnam.note_lists) {
                const noteList = appState.currentMidnam.note_lists.find(nl => nl.name === noteListName);
                if (noteList) {
                    // Update the notes in the cached note list
                    noteList.notes = noteData.map(note => ({
                        number: note.number,
                        name: note.name
                    }));
                }
            }
            
            // Update the patch in the cached patch_banks data
            if (appState.currentMidnam && appState.currentMidnam.patch_banks && appState.selectedPatchBank) {
                const bank = appState.currentMidnam.patch_banks.find(b => b.name === appState.selectedPatchBank.name);
                if (bank) {
                    const patchIndex = bank.patches.findIndex(p => p.name === originalName);
                    if (patchIndex !== -1) {
                        bank.patches[patchIndex].name = updatedName;
                        bank.patches[patchIndex].number = updatedNumber;
                    }
                }
            }
            
            // Mark as saved globally
            appState.markAsSaved();
            
            this.logToDebugConsole(`✓ Patch saved successfully to: ${filePath}`, 'success');
            Utils.showNotification('Patch saved to file successfully', 'success');
        } catch (error) {
            console.error('Error saving patch:', error);
            
            // Show user-friendly error notification
            const errorMsg = error.message || 'Failed to save patch';
            
            // Check if this is an XML validation error
            if (errorMsg.toLowerCase().includes('invalid xml') || errorMsg.toLowerCase().includes('parse error')) {
                Utils.showNotification('Cannot save: File contains invalid XML. Check debug console for details.', 'error');
            } else {
                Utils.showNotification(`Save failed: ${errorMsg}`, 'error');
            }
        }
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
        // Delegate to device manager's download modal which handles both local and hosted
        if (window.deviceManager && window.deviceManager.showDownloadModal) {
            await window.deviceManager.showDownloadModal();
        } else {
            Utils.showNotification('Download functionality not available', 'error');
        }
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
    
    logToDebugConsole(message, type = 'info') {
        if (window.toolsManager && window.toolsManager.logToDebugConsole) {
            window.toolsManager.logToDebugConsole(message, type);
        }
    }
    
    addPatch() {
        modal.prompt('Enter patch name:', '', 'Add New Patch')
            .then(patchName => {
                if (patchName) {
                    // Add new patch logic
                    Utils.showNotification('Patch added successfully', 'success');
                }
            });
    }
    
    editPatch(index) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patch = this.selectedPatchList.patch[index];
        if (!patch) return;
        
        // Store current patch
        this.currentPatch = patch;
        this.currentPatchIndex = index;
        
        // Store the original name for saving purposes
        if (!patch.originalName) {
            patch.originalName = patch.name;
        }
        
        // Set app state for the patch editor
        appState.selectedPatch = patch;
        appState.selectedPatchBank = this.selectedPatchList;
        
        // Use the existing renderPatchEditor method which creates the proper note editor
        this.renderPatchEditor();
    }
    
    deletePatch(index) {
        modal.confirm('Are you sure you want to delete this patch?', 'Delete Patch')
            .then(confirmed => {
                if (confirmed) {
                    // Delete patch logic
                    Utils.showNotification('Patch deleted', 'success');
                }
            });
    }
    
    async testPatch(index) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patch = this.selectedPatchList.patch[index];
        if (!patch) return;
        
        try {
            // Send bank select if specified
            if (patch.bankSelectMSB !== undefined) {
                midiManager.sendBankSelect(patch.bankSelectMSB, patch.bankSelectLSB || 0);
            }
            
            // Send program change
            const programChange = patch.programChange || index;
            midiManager.sendProgramChange(programChange);
            
            Utils.showNotification(`Sent patch: ${patch.name || `Patch ${index + 1}`}`, 'success');
        } catch (error) {
            console.error('Error testing patch:', error);
            Utils.showNotification('Failed to test patch', 'error');
        }
    }
    
    async testPatchList() {
        if (!this.selectedPatchList) return;
        
        try {
            const patches = this.selectedPatchList.patch || [];
            let currentIndex = 0;
            
            const playNextPatch = () => {
                if (currentIndex >= patches.length) {
                    Utils.showNotification('Patch list test completed', 'success');
                    return;
                }
                
                const patch = patches[currentIndex];
                this.testPatch(currentIndex);
                
                currentIndex++;
                setTimeout(playNextPatch, 1000); // 1 second between patches
            };
            
            playNextPatch();
        } catch (error) {
            console.error('Error testing patch list:', error);
            Utils.showNotification('Failed to test patch list', 'error');
        }
    }
    
    setupPatchTabMIDIListeners() {
        const content = document.getElementById('patch-list-content');
        if (!content) return;
        
        // Select all clickable-pc elements (both patch-number and patch-program-change)
        const pcButtons = content.querySelectorAll('.patch-number.clickable-pc, .patch-program-change.clickable-pc');
        
        pcButtons.forEach(button => {
            // Set up click handler
            button.addEventListener('click', (e) => {
                // Prevent the parent patch-item click handler from firing
                e.stopPropagation();
                const patchIndex = parseInt(button.getAttribute('data-patch-index'));
                this.sendProgramChangeFromPatchTab(patchIndex);
            });
            
            // Set up dynamic tooltip and cursor
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
    
    async sendProgramChangeFromPatchTab(patchIndex) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patch = this.selectedPatchList.patch[patchIndex];
        if (!patch) return;
        
        const programChange = patch.programChange !== undefined ? patch.programChange : patchIndex;
        
        // Check if MIDI is enabled
        if (!window.midiManager || !window.midiManager.isOutputConnected()) {
            Utils.showNotification('MIDI output not connected', 'warning');
            return;
        }
        
        // Send bank select if specified
        if (patch.bankSelectMSB !== undefined) {
            window.midiManager.sendBankSelect(patch.bankSelectMSB, patch.bankSelectLSB || 0, 0);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Send program change
        window.midiManager.sendProgramChange(programChange, 0);
        
        const patchName = patch.name || `Patch ${patchIndex + 1}`;
        Utils.showNotification(`Program Change sent: ${patchName} (PC ${programChange})`, 'success');
    }
    
    editNoteListReference(noteListName) {
        // Implementation for editing note list reference
        Utils.showNotification('Note list reference editing will be implemented', 'info');
    }
    
    removeNoteListReference(noteListName) {
        modal.confirm('Are you sure you want to remove this note list reference?', 'Remove Note List Reference')
            .then(confirmed => {
                if (confirmed) {
                    // Remove note list reference logic
                    Utils.showNotification('Note list reference removed', 'success');
                }
            });
    }
    
    // Method to refresh patch data
    async refreshPatches() {
        if (!appState.currentMidnam) return;
        
        this.renderPatchEditor();
    }
    
    // Method to get patch statistics
    getPatchStats() {
        if (!appState.currentMidnam || !appState.currentMidnam.patchList) return null;
        
        const patchLists = appState.currentMidnam.patchList;
        const totalPatches = patchLists.reduce((sum, pl) => sum + (pl.patch ? pl.patch.length : 0), 0);
        
        return {
            patchLists: patchLists.length,
            totalPatches: totalPatches,
            averagePatchesPerList: patchLists.length > 0 ? 
                Math.round(totalPatches / patchLists.length) : 0
        };
    }
    
    // Patch editing methods
    togglePatchEditMode() {
        this.patchEditMode = !this.patchEditMode;
        this.renderPatchListContent();
    }
    
    renderPatchEditTable(patches) {
        if (patches.length === 0) {
            return '<div class="empty-state">No patches to edit. Click "Add Patch" to create one.</div>';
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
                    <tbody id="patch-edit-tbody">
                        ${patches.map((patch, index) => {
                            const patchId = patch.Number || index;
                            const programChange = patch.programChange !== undefined ? patch.programChange : index;
                            
                            return `
                                <tr data-patch-index="${index}">
                                    <td>
                                        <input type="text" 
                                               class="patch-id-input"
                                               value="${patchId}"
                                               data-index="${index}"
                                               tabindex="0"
                                               onkeydown="patchManager.handlePatchEditKeydown(event, ${index}, 'id')"
                                               onchange="patchManager.updatePatchId(${index}, this.value)">
                                    </td>
                                    <td>
                                        <input type="text" 
                                               class="patch-name-input-edit"
                                               value="${Utils.escapeHtml(patch.name || `Patch ${index + 1}`)}"
                                               data-index="${index}"
                                               tabindex="0"
                                               onkeydown="patchManager.handlePatchEditKeydown(event, ${index}, 'name')"
                                               onchange="patchManager.updatePatchNameInEdit(${index}, this.value)">
                                    </td>
                                    <td>
                                        <input type="number" 
                                               class="patch-program-change-input"
                                               value="${programChange}"
                                               min="0"
                                               max="127"
                                               data-index="${index}"
                                               tabindex="0"
                                               onkeydown="patchManager.handlePatchEditKeydown(event, ${index}, 'pc')"
                                               onchange="patchManager.updateProgramChange(${index}, this.value)">
                                    </td>
                                    <td class="patch-edit-actions">
                                        <button class="btn btn-sm btn-outline-primary" 
                                                data-index="${index}"
                                                tabindex="0"
                                                onkeydown="patchManager.handlePatchEditKeydown(event, ${index}, 'insert')"
                                                onclick="patchManager.insertPatchAt(${index})"
                                                title="Insert patch after this one">
                                            +I
                                        </button>
                                        <button class="btn btn-sm btn-secondary" 
                                                tabindex="-1"
                                                onclick="patchManager.testPatchInEditMode(${index})"
                                                title="Test this patch">
                                            <img src="assets/kbd.svg" alt="Test" width="16" height="16" style="vertical-align: middle;">
                                        </button>
                                        <button class="btn btn-sm btn-danger" 
                                                tabindex="-1"
                                                onclick="patchManager.deletePatchInEditMode(${index})"
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
    
    setupPatchEditListeners() {
        // No special listeners needed for now, all handled via onchange
    }
    
    updatePatchId(index, value) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patch = this.selectedPatchList.patch[index];
        if (patch) {
            patch.Number = value;
            this.markPatchChanged();
        }
    }
    
    updatePatchNameInEdit(index, value) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patch = this.selectedPatchList.patch[index];
        if (patch) {
            patch.name = value;
            this.markPatchChanged();
        }
    }
    
    updateProgramChange(index, value) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 127) {
            Utils.showNotification('Program Change must be between 0 and 127', 'warning');
            return;
        }
        
        const patch = this.selectedPatchList.patch[index];
        if (patch) {
            patch.programChange = numValue;
            this.markPatchChanged();
        }
    }
    
    handlePatchEditKeydown(event, patchIndex, field) {
        // Handle Enter key on name field - jump to Insert button
        if (event.key === 'Enter' && field === 'name') {
            event.preventDefault();
            this.focusPatchEditField(patchIndex, 'insert');
            return;
        }
        
        if (event.key !== 'Tab') return;
        
        event.preventDefault();
        
        const tbody = document.getElementById('patch-edit-tbody');
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
                this.focusPatchEditField(patchIndex, prevField);
            }
        } else {
            // Tab: go to next field or next row
            if (currentFieldIndex === fields.length - 1) {
                // Last field, go to first field of next row
                if (patchIndex < rows.length - 1) {
                    this.focusPatchEditField(patchIndex + 1, 'id');
                }
            } else {
                // Go to next field in same row
                const nextField = fields[currentFieldIndex + 1];
                this.focusPatchEditField(patchIndex, nextField);
            }
        }
    }
    
    focusPatchEditField(patchIndex, field) {
        const tbody = document.getElementById('patch-edit-tbody');
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
    
    insertPatchAt(index) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patches = this.selectedPatchList.patch;
        
        // Insert after the current row
        const insertPosition = index + 1;
        
        // Smart ID generation from previous patch
        const previousPatch = patches[index];
        const smartId = previousPatch ? this.smartIncrementPatchId(previousPatch.Number || index) : insertPosition;
        
        // Create new patch
        const newPatch = {
            name: `New Patch ${insertPosition + 1}`,
            Number: smartId,
            programChange: insertPosition
        };
        
        // Insert at position (after current row)
        patches.splice(insertPosition, 0, newPatch);
        
        // Renumber program changes for patches after insertion point
        this.renumberPatches(insertPosition + 1);
        
        this.markPatchChanged();
        this.renderPatchListContent();
        
        // Focus and select the name field of the new patch
        setTimeout(() => {
            this.focusPatchEditField(insertPosition, 'name');
        }, 0);
    }
    
    deletePatchInEditMode(index) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patches = this.selectedPatchList.patch;
        
        if (patches.length === 1) {
            Utils.showNotification('Cannot delete the last patch', 'warning');
            return;
        }
        
        modal.confirm('Are you sure you want to delete this patch?', 'Delete Patch')
            .then(confirmed => {
                if (confirmed) {
                    // Remove patch
                    patches.splice(index, 1);
                    
                    // Renumber program changes
                    this.renumberPatches(index);
                    
                    this.markPatchChanged();
                    this.renderPatchListContent();
                }
            });
    }
    
    renumberPatches(startIndex) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patches = this.selectedPatchList.patch;
        
        // Only renumber programChange values, not Patch IDs
        for (let i = startIndex; i < patches.length; i++) {
            patches[i].programChange = i;
        }
    }
    
    async testPatchInEditMode(index) {
        if (!this.selectedPatchList || !this.selectedPatchList.patch) return;
        
        const patch = this.selectedPatchList.patch[index];
        await testPatchHelper(this.selectedPatchList, patch, index);
    }
}

// Create global instance
export const patchManager = new PatchManager();

// Make it globally available
window.patchManager = patchManager;
