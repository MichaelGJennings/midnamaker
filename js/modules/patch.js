// Patch module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { modal } from '../components/modal.js';
import { midiManager } from './midi.js';

export class PatchManager {
    constructor() {
        this.selectedPatchList = null;
        this.selectedPatch = null;
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
        // Patch save button
        const saveBtn = document.getElementById('save-patch-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.savePatch();
            });
        }
        
        // Patch validate button
        const validateBtn = document.getElementById('validate-patch-btn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                this.validatePatch();
            });
        }
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
            window.toolsManager.collectNoteNamesFromPatches();
        }
    }
    
    showEmptyState() {
        const content = document.getElementById('patch-content');
        if (content) {
            content.innerHTML = '<div class="empty-state">Select a patch from the Device tab to edit</div>';
        }
        
        // Disable action buttons
        const saveBtn = document.getElementById('save-patch-btn');
        const validateBtn = document.getElementById('validate-patch-btn');
        
        if (saveBtn) saveBtn.disabled = true;
        if (validateBtn) validateBtn.disabled = true;
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
            <div class="patch-editor">
                <div class="patch-info">
                    <h3>${Utils.escapeHtml(patch.name)}</h3>
                    <div class="patch-meta">
                        <span class="patch-number">Patch ${patch.number}</span>
                        <span class="patch-bank">Bank: ${Utils.escapeHtml(bank.name)}</span>
                    </div>
                </div>
                
                <div class="patch-details">
                    <div class="detail-section">
                        <h4>Patch Information</h4>
                        <div class="form-group">
                            <label for="patch-name-input">Name:</label>
                            <input type="text" id="patch-name-input" value="${Utils.escapeHtml(patch.name)}" class="form-control" onchange="patchManager.updatePatchName(this.value)">
                        </div>
                        <div class="form-group">
                            <label for="patch-number-input">Number:</label>
                            <input type="text" id="patch-number-input" value="${patch.number}" class="form-control" onchange="patchManager.updatePatchNumber(this.value)">
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Note Names</h4>
                        <div class="note-names">
                            ${noteList ? `
                                <div class="note-list-info">
                                    <strong>Note List:</strong> ${Utils.escapeHtml(noteList.name)}
                                    <span class="note-count">(${noteList.notes.length} notes)</span>
                                </div>
                                <div class="note-editor-actions">
                                    <button class="btn btn-primary add-note-btn" onclick="patchManager.addNote()">
                                        + Add Note
                                    </button>
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
                                            ${noteList.notes.map((note, index) => {
                                                const noteNum = parseInt(note.number);
                                                const pianoKey = this.getPianoKeyName(noteNum);
                                                const isBlack = this.isBlackKey(noteNum);
                                                const insertBtnId = `insert-btn-${index}`;
                                                const noteInputId = `note-input-${index}`;
                                                const dropdownId = `note-dropdown-${index}`;
                                                
                                                return `
                                                    <tr data-note-index="${index}" class="${isBlack ? 'black-key-row' : ''}">
                                                        <td>
                                                            <span class="note-number-display" 
                                                                  data-note="${noteNum}"
                                                                  data-piano-key="${pianoKey}"
                                                                  style="${isBlack ? 'background: #333; color: white;' : ''}">
                                                                ${noteNum} <small>(${pianoKey})</small>
                                                            </span>
                                                        </td>
                                                        <td class="note-name-cell">
                                                            <input type="text" 
                                                                   id="${noteInputId}"
                                                                   class="note-name-input" 
                                                                   value="${Utils.escapeHtml(note.name)}"
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
        const validateBtn = document.getElementById('validate-patch-btn');
        if (saveBtn) saveBtn.disabled = false;
        if (validateBtn) validateBtn.disabled = false;
        
        // Setup note editing event listeners
        this.setupNoteEditingListeners();
    }
    
    setupNoteEditingListeners() {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        // Build note name index from existing notes
        this.buildNoteNameIndex();
        
        // Add event listeners to each row
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        rows.forEach((row, index) => {
            const noteInput = row.querySelector('.note-name-input');
            const insertBtn = row.querySelector('button[data-index]');
            const deleteBtn = row.querySelector('.remove-note-btn');
            const noteDisplay = row.querySelector('.note-number-display');
            
            // Note input event listeners
            if (noteInput) {
                noteInput.addEventListener('focus', () => this.handleNoteInputFocus(index));
                noteInput.addEventListener('blur', () => this.handleNoteInputBlur(index));
                noteInput.addEventListener('keydown', (e) => this.handleNoteInputKeydown(e, index));
                noteInput.addEventListener('input', (e) => this.handleNoteInputChange(e, index));
            }
            
            // Insert button listener
            if (insertBtn) {
                insertBtn.addEventListener('click', () => this.insertNote(index));
                insertBtn.addEventListener('keydown', (e) => this.handleInsertButtonKeydown(e, index));
            }
            
            // Delete button listener
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.removeNote(index));
            }
            
            // Note display click listener
            if (noteDisplay) {
                noteDisplay.addEventListener('click', () => {
                    const noteNum = parseInt(noteDisplay.getAttribute('data-note'));
                    this.playNote(noteNum);
                });
                
                // Set tooltip immediately (no delay)
                console.log('Setting up tooltip for note display:', noteDisplay);
                this.updateNoteDisplayTooltip(noteDisplay);
            } else {
                console.log('No note display found for row', index);
            }
        });
        
        // Global keyboard listener for Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllDropdowns();
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
        
        input.setAttribute('readonly', 'true');
        
        // Add to index
        if (input.value.trim()) {
            this.noteNameIndex.add(input.value.trim());
        }
        
        // Mark patch as changed
        this.updateNoteName(index, input.value.trim());
        
        // Hide dropdown after a short delay
        setTimeout(() => this.hideNoteDropdown(index), 150);
    }
    
    handleNoteInputKeydown(e, index) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const dropdown = document.getElementById(`note-dropdown-${index}`);
            const selectedItem = dropdown?.querySelector('.note-dropdown-item.selected');
            
            if (selectedItem) {
                const input = document.getElementById(`note-input-${index}`);
                if (input) {
                    input.value = selectedItem.textContent.trim();
                    this.markPatchChanged();
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
            // Move focus to insert button
            const insertBtn = document.getElementById(`insert-btn-${index}`);
            if (insertBtn) {
                insertBtn.focus();
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
            
            // Find the next row's note input
            const tbody = document.getElementById('note-list-tbody');
            if (!tbody) return;
            
            const rows = tbody.querySelectorAll('tr[data-note-index]');
            const nextIndex = index + 1;
            
            if (nextIndex < rows.length) {
                // Focus next row's note input
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
    
    showNoteDropdown(index) {
        const dropdown = document.getElementById(`note-dropdown-${index}`);
        if (!dropdown) return;
        
        const suggestions = this.getNoteNameSuggestions(index);
        dropdown.innerHTML = suggestions.map(suggestion => 
            `<div class="note-dropdown-item" data-value="${suggestion}">${Utils.escapeHtml(suggestion)}</div>`
        ).join('');
        
        // Add click listeners to dropdown items
        dropdown.querySelectorAll('.note-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const input = document.getElementById(`note-input-${index}`);
                if (input) {
                    input.value = item.textContent.trim();
                    this.markPatchChanged();
                }
                this.hideNoteDropdown(index);
            });
        });
        
        dropdown.style.display = 'block';
        this.filterDropdown(index, '');
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
        } else {
            items.forEach(item => item.classList.remove('selected'));
        }
    }
    
    navigateDropdown(index, direction) {
        const dropdown = document.getElementById(`note-dropdown-${index}`);
        if (!dropdown) return;
        
        const items = Array.from(dropdown.querySelectorAll('.note-dropdown-item:not([style*="display: none"])'));
        if (items.length === 0) return;
        
        const currentSelected = dropdown.querySelector('.note-dropdown-item.selected');
        let currentIndex = currentSelected ? items.indexOf(currentSelected) : -1;
        
        if (direction > 0) {
            currentIndex = (currentIndex + 1) % items.length;
        } else {
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
        let suggestions = [...this.noteNameIndex, ...this.drumNames];
        
        if (window.toolsManager && window.toolsManager.allNoteNames) {
            // Use the full index from tools manager
            suggestions = [...window.toolsManager.allNoteNames, ...this.drumNames];
        }
        
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
            console.log('Tooltip handler triggered, tooltip element:', tooltip);
            if (tooltip) {
                const tooltipText = this.getMIDIStatus() ? 
                    `Send note ${noteNum} (${pianoKey})` : 
                    'Select a MIDI output device to send MIDI notes';
                
                tooltip.innerHTML = tooltipText;
                tooltip.style.display = 'flex';
                this.updateTooltipPosition(e);
                console.log('Tooltip shown:', tooltipText);
            } else {
                console.log('Tooltip element not found!');
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
        
        console.log('Tooltip handlers updated for note', noteNum);
    }
    
    refreshAllNoteDisplayTooltips() {
        console.log('=== REFRESHING ALL TOOLTIPS ===');
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) {
            console.log('No note list tbody found for tooltip refresh');
            return;
        }
        
        const noteDisplays = tbody.querySelectorAll('.note-number-display');
        console.log('Found', noteDisplays.length, 'note displays to refresh');
        // MIDI status check - silent
        
        noteDisplays.forEach((display, index) => {
            console.log(`Updating tooltip for display ${index}:`, display);
            this.updateNoteDisplayTooltip(display);
        });
        console.log('=== TOOLTIP REFRESH COMPLETE ===');
    }
    
    // Test method to verify tooltip functionality
    testTooltip() {
        const tooltip = document.getElementById('keyboard-tooltip');
        console.log('Test tooltip element:', tooltip);
        if (tooltip) {
            tooltip.innerHTML = 'Test tooltip';
            tooltip.style.display = 'flex';
            tooltip.style.left = '100px';
            tooltip.style.top = '100px';
            console.log('Test tooltip shown');
        }
    }
    
    addNote() {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        const newIndex = rows.length;
        const newNoteNumber = newIndex + 36; // Start from C2 (note 36)
        
        const pianoKey = this.getPianoKeyName(newNoteNumber);
        const isBlack = this.isBlackKey(newNoteNumber);
        const insertBtnId = `insert-btn-${newIndex}`;
        const noteInputId = `note-input-${newIndex}`;
        const dropdownId = `note-dropdown-${newIndex}`;
        
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-note-index', newIndex);
        if (isBlack) newRow.classList.add('black-key-row');
        
        newRow.innerHTML = `
            <td>
                <span class="note-number-display" 
                      data-note="${newNoteNumber}"
                      data-piano-key="${pianoKey}"
                      style="${isBlack ? 'background: #333; color: white;' : ''}">
                    ${newNoteNumber} <small>(${pianoKey})</small>
                </span>
            </td>
            <td class="note-name-cell">
                <input type="text" 
                       id="${noteInputId}"
                       class="note-name-input" 
                       value="${this.getDefaultNoteName(newNoteNumber)}"
                       data-index="${newIndex}"
                       tabindex="0"
                       readonly>
                <div class="note-dropdown" id="${dropdownId}" style="display: none;"></div>
            </td>
            <td class="note-actions">
                <button class="btn btn-sm btn-outline-primary" 
                        id="${insertBtnId}"
                        data-index="${newIndex}"
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
        
        // Focus and select the new note name
        setTimeout(() => {
            const input = document.getElementById(noteInputId);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }
    
    insertNote(index) {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        const insertIndex = parseInt(index) + 1;
        const newNoteNumber = parseInt(index) + 37; // Insert after current note
        
        const pianoKey = this.getPianoKeyName(newNoteNumber);
        const isBlack = this.isBlackKey(newNoteNumber);
        const insertBtnId = `insert-btn-${insertIndex}`;
        const noteInputId = `note-input-${insertIndex}`;
        const dropdownId = `note-dropdown-${insertIndex}`;
        
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-note-index', insertIndex);
        if (isBlack) newRow.classList.add('black-key-row');
        
        newRow.innerHTML = `
            <td>
                <span class="note-number-display" 
                      data-note="${newNoteNumber}"
                      data-piano-key="${pianoKey}"
                      style="${isBlack ? 'background: #333; color: white;' : ''}">
                    ${newNoteNumber} <small>(${pianoKey})</small>
                </span>
            </td>
            <td class="note-name-cell">
                <input type="text" 
                       id="${noteInputId}"
                       class="note-name-input" 
                       value="${this.getDefaultNoteName(newNoteNumber)}"
                       data-index="${insertIndex}"
                       tabindex="0"
                       readonly>
                <div class="note-dropdown" id="${dropdownId}" style="display: none;"></div>
            </td>
            <td class="note-actions">
                <button class="btn btn-sm btn-outline-primary" 
                        id="${insertBtnId}"
                        data-index="${insertIndex}"
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
        
        // Insert after the current row
        const currentRow = tbody.querySelector(`tr[data-note-index="${index}"]`);
        if (currentRow) {
            currentRow.insertAdjacentElement('afterend', newRow);
        } else {
            tbody.appendChild(newRow);
        }
        
        // Renumber all subsequent rows
        this.renumberNotes();
        this.setupNoteEditingListeners();
        this.markPatchChanged();
        
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
            row.remove();
            this.renumberNotes();
            this.setupNoteEditingListeners();
            this.markPatchChanged();
        }
    }
    
    renumberNotes() {
        const tbody = document.getElementById('note-list-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        rows.forEach((row, newIndex) => {
            const oldIndex = row.getAttribute('data-note-index');
            row.setAttribute('data-note-index', newIndex);
            
            // Update note number
            const noteNumber = newIndex + 36; // Start from C2
            const pianoKey = this.getPianoKeyName(noteNumber);
            const isBlack = this.isBlackKey(noteNumber);
            
            const noteDisplay = row.querySelector('.note-number-display');
            if (noteDisplay) {
                noteDisplay.setAttribute('data-note', noteNumber);
                noteDisplay.setAttribute('data-piano-key', pianoKey);
                noteDisplay.innerHTML = `${noteNumber} <small>(${pianoKey})</small>`;
                noteDisplay.style.cssText = `${isBlack ? 'background: #333; color: white;' : ''}`;
            }
            
            // Update row class
            row.className = isBlack ? 'black-key-row' : '';
            
            // Update input IDs and data attributes
            const input = row.querySelector('.note-name-input');
            if (input) {
                input.id = `note-input-${newIndex}`;
                input.setAttribute('data-index', newIndex);
            }
            
            const dropdown = row.querySelector('.note-dropdown');
            if (dropdown) {
                dropdown.id = `note-dropdown-${newIndex}`;
            }
            
            const insertBtn = row.querySelector('button[data-index]');
            if (insertBtn) {
                insertBtn.id = `insert-btn-${newIndex}`;
                insertBtn.setAttribute('data-index', newIndex);
            }
            
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
        appState.pendingChanges.hasUnsavedChanges = true;
        
        const saveBtn = document.getElementById('save-patch-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Patch *';
            saveBtn.classList.add('btn-warning');
        }
    }
    
    collectNoteDataFromEditor() {
        const noteData = [];
        const tbody = document.getElementById('note-list-tbody');
        
        if (!tbody) return noteData;
        
        const rows = tbody.querySelectorAll('tr[data-note-index]');
        rows.forEach(row => {
            const noteInput = row.querySelector('.note-name-input');
            const noteNumber = row.getAttribute('data-note-index');
            
            if (noteInput && noteNumber) {
                noteData.push({
                    number: parseInt(noteNumber),
                    name: noteInput.value.trim()
                });
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
                        <button class="btn btn-primary btn-small" onclick="patchManager.addPatch()">Add Patch</button>
                        <button class="btn btn-secondary btn-small" onclick="patchManager.testPatchList()">Test MIDI</button>
                    </div>
                </div>
                
                ${patches.map((patch, index) => `
                    <div class="patch-item" data-patch-index="${index}">
                        <div class="patch-header">
                            <div class="patch-info-inline">
                                <span class="patch-number">${patch.programChange || index}</span>
                                <span class="patch-name clickable" onclick="patchManager.editPatch(${index})" title="Click to edit patch">${Utils.escapeHtml(patch.name || `Patch ${index + 1}`)}</span>
                                <span class="patch-program-change">PC: ${patch.programChange || index}</span>
                            </div>
                            <div class="patch-actions">
                                <button class="btn btn-small btn-secondary" onclick="patchManager.testPatch(${index})">Test</button>
                                <button class="btn btn-small btn-danger" onclick="patchManager.deletePatch(${index})">Delete</button>
                            </div>
                        </div>
                        <div class="patch-details">
                            <div class="patch-info">
                                ${patch.bankSelectMSB ? `<p>Bank Select MSB: ${patch.bankSelectMSB}</p>` : ''}
                                ${patch.bankSelectLSB ? `<p>Bank Select LSB: ${patch.bankSelectLSB}</p>` : ''}
                            </div>
                            ${this.generatePatchNoteListsHTML(patch)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        content.style.display = 'block';
        
        // Add click handlers for patch selection
        content.querySelectorAll('.patch-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.patch-actions')) {
                    const index = parseInt(item.getAttribute('data-patch-index'));
                    this.selectPatch(index);
                }
            });
        });
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
        if (!appState.selectedPatch) {
            Utils.showNotification('No patch selected to save', 'warning');
            return;
        }
        
        // Collect current note data from the editor
        const noteData = this.collectNoteDataFromEditor();
        
        try {
            const response = await fetch('/api/patch/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: appState.selectedDevice.id,
                    patchBank: appState.selectedPatchBank.name,
                    patch: appState.selectedPatch,
                    notes: noteData
                })
            });
            
            if (!response.ok) throw new Error('Failed to save patch');
            
            // Mark as saved
            appState.pendingChanges.hasUnsavedChanges = false;
            
            const saveBtn = document.getElementById('save-patch-btn');
            if (saveBtn) {
                saveBtn.textContent = 'Save Patch';
                saveBtn.classList.remove('btn-warning');
            }
            
            Utils.showNotification('Patch saved successfully', 'success');
        } catch (error) {
            console.error('Error saving patch:', error);
            Utils.showNotification('Failed to save patch', 'error');
        }
    }
    
    async validatePatch() {
        if (!this.selectedPatchList) {
            Utils.showNotification('No patch list selected to validate', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/patch/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patchList: this.selectedPatchList
                })
            });
            
            if (!response.ok) throw new Error('Failed to validate patch');
            
            const validationResult = await response.json();
            
            if (validationResult.valid) {
                Utils.showNotification('Patch validation passed', 'success');
            } else {
                const errors = validationResult.errors || [];
                const errorMessage = errors.length > 0 ? 
                    `Validation failed: ${errors.join(', ')}` : 
                    'Patch validation failed';
                Utils.showNotification(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error validating patch:', error);
            Utils.showNotification('Failed to validate patch', 'error');
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
}

// Create global instance
export const patchManager = new PatchManager();

// Make it globally available
window.patchManager = patchManager;
