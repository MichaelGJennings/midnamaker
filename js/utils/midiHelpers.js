// MIDI Helper utilities for sending MIDI messages and formatting MIDI data
import { Utils } from '../core/utils.js';

/**
 * Format MIDI commands into a tooltip string
 * @param {Array} midiCommands - Array of MIDI command objects
 * @returns {string} Formatted tooltip text
 */
export function formatMidiCommandsTooltip(midiCommands) {
    if (!midiCommands || midiCommands.length === 0) return '';
    return midiCommands.map(cmd => `Control ${cmd.control} = ${cmd.value}`).join(', ');
}

/**
 * Send bank select MIDI commands for a patch list
 * @param {Object} patchList - Patch list with midi_commands
 * @param {string} bankName - Name of the bank for notification
 * @returns {boolean} Success status
 */
export function sendBankSelectMidi(patchList, bankName) {
    if (!patchList || !patchList.midi_commands || patchList.midi_commands.length === 0) {
        Utils.showNotification('No MIDI commands found for this bank', 'warning');
        return false;
    }

    // Check if MIDI is enabled and device selected
    if (!window.midiManager || !window.midiManager.isMIDIEnabled()) {
        Utils.showNotification('MIDI not enabled', 'warning');
        return false;
    }

    if (!window.midiManager.isDeviceSelected()) {
        Utils.showNotification('No MIDI output device selected', 'warning');
        return false;
    }

    // Send all MIDI commands for this bank
    let success = true;
    for (const cmd of patchList.midi_commands) {
        if (cmd.type === 'ControlChange') {
            const controller = parseInt(cmd.control);
            const value = parseInt(cmd.value);
            const sent = window.midiManager.sendControlChange(controller, value, 0);
            if (!sent) success = false;
        }
    }

    if (success) {
        Utils.showNotification(`Bank "${bankName}" selected via MIDI`, 'success');
    } else {
        Utils.showNotification('Failed to send some MIDI commands', 'error');
    }

    return success;
}

/**
 * Send a program change with optional bank select commands
 * @param {Object} patchList - Patch list with midi_commands
 * @param {Object} patch - Patch object with programChange
 * @param {number} patchIndex - Index of the patch
 * @param {string} patchName - Name of the patch for notification
 * @returns {Promise<boolean>} Success status
 */
export async function sendProgramChange(patchList, patch, patchIndex, patchName) {
    if (!patch) return false;

    const programChange = patch.programChange !== undefined ? patch.programChange : patchIndex;

    // Check if MIDI is enabled
    if (!window.midiManager || !window.midiManager.isOutputConnected()) {
        Utils.showNotification('MIDI output not connected', 'warning');
        return false;
    }

    // Send bank select MIDI commands if they exist
    if (patchList && patchList.midi_commands && patchList.midi_commands.length > 0) {
        for (const cmd of patchList.midi_commands) {
            if (cmd.type === 'ControlChange') {
                window.midiManager.sendControlChange(parseInt(cmd.control), parseInt(cmd.value), 0);
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    // Send program change
    window.midiManager.sendProgramChange(programChange);

    const displayName = patchName || patch.name || `Patch ${patchIndex + 1}`;
    Utils.showNotification(`Program Change sent: ${displayName} (PC ${programChange})`, 'success');

    return true;
}

/**
 * Test a patch by sending program change and playing test notes
 * @param {Object} patchList - Patch list with midi_commands
 * @param {Object} patch - Patch object to test
 * @param {number} patchIndex - Index of the patch
 * @returns {Promise<boolean>} Success status
 */
export async function testPatch(patchList, patch, patchIndex) {
    if (!patch) return false;

    const programChange = patch.programChange !== undefined ? patch.programChange : patchIndex;

    // Check if MIDI is enabled
    if (!window.midiManager || !window.midiManager.isOutputConnected()) {
        Utils.showNotification('MIDI output not connected', 'warning');
        return false;
    }

    // Send bank select MIDI commands if they exist
    if (patchList && patchList.midi_commands && patchList.midi_commands.length > 0) {
        for (const cmd of patchList.midi_commands) {
            if (cmd.type === 'ControlChange') {
                window.midiManager.sendControlChange(parseInt(cmd.control), parseInt(cmd.value), 0);
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    // Send program change
    window.midiManager.sendProgramChange(programChange);

    // Wait a bit for the program change to take effect
    await new Promise(resolve => setTimeout(resolve, 50));

    // Play 3 random notes (C, E, G shuffled)
    const notes = [60, 64, 67];
    const randomNotes = notes.sort(() => Math.random() - 0.5).slice(0, 3);

    for (const note of randomNotes) {
        window.midiManager.sendNoteOn(note, 100);
        await new Promise(resolve => setTimeout(resolve, 200)); // 8th note at 150 BPM
        window.midiManager.sendNoteOff(note);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small gap
    }

    return true;
}

/**
 * Check if MIDI output is available and connected
 * @returns {boolean} True if MIDI output is ready
 */
export function isMidiOutputReady() {
    return window.midiManager && window.midiManager.isOutputConnected();
}

/**
 * Check if MIDI is enabled
 * @returns {boolean} True if MIDI is enabled
 */
export function isMidiEnabled() {
    return window.midiManager && window.midiManager.isMIDIEnabled();
}

