// MIDI module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';

export class MIDIManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // MIDI toggle button
        const midiToggle = document.getElementById('midi-toggle');
        if (midiToggle) {
            midiToggle.addEventListener('click', () => {
                appState.toggleMIDI();
            });
        }
        
        // MIDI device selection
        const midiDeviceSelect = document.getElementById('midi-device-select');
        if (midiDeviceSelect) {
            midiDeviceSelect.addEventListener('change', () => {
                appState.selectMIDIDevice();
            });
        }
    }
    
    // Play a MIDI note
    playNote(noteNumber, velocity = 127, channel = 0) {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            console.warn('MIDI not enabled or no device selected');
            return false;
        }
        
        try {
            const noteOn = [0x90 + channel, noteNumber, velocity];
            appState.globalMIDIState.selectedOutput.send(noteOn);
            return true;
        } catch (error) {
            console.error('Error playing MIDI note:', error);
            return false;
        }
    }
    
    // Stop a MIDI note
    stopNote(noteNumber, channel = 0) {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            return false;
        }
        
        try {
            const noteOff = [0x80 + channel, noteNumber, 0];
            appState.globalMIDIState.selectedOutput.send(noteOff);
            return true;
        } catch (error) {
            console.error('Error stopping MIDI note:', error);
            return false;
        }
    }
    
    // Send a program change message
    sendProgramChange(program, channel = 0) {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            return false;
        }
        
        try {
            const programChange = [0xC0 + channel, program];
            appState.globalMIDIState.selectedOutput.send(programChange);
            return true;
        } catch (error) {
            console.error('Error sending program change:', error);
            return false;
        }
    }
    
    // Send bank select messages
    sendBankSelect(msb, lsb = 0, channel = 0) {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            return false;
        }
        
        try {
            const bankSelectMSB = [0xB0 + channel, 0x00, msb];
            const bankSelectLSB = [0xB0 + channel, 0x20, lsb];
            
            appState.globalMIDIState.selectedOutput.send(bankSelectMSB);
            appState.globalMIDIState.selectedOutput.send(bankSelectLSB);
            return true;
        } catch (error) {
            console.error('Error sending bank select:', error);
            return false;
        }
    }
    
    // Send control change message
    sendControlChange(controller, value, channel = 0) {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            return false;
        }
        
        try {
            const controlChange = [0xB0 + channel, controller, value];
            appState.globalMIDIState.selectedOutput.send(controlChange);
            return true;
        } catch (error) {
            console.error('Error sending control change:', error);
            return false;
        }
    }
    
    // Test MIDI connection
    async testMIDIConnection() {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            Utils.showNotification('MIDI not enabled or no device selected', 'warning');
            return false;
        }
        
        try {
            // Send a test note (middle C)
            this.playNote(60, 100);
            
            // Stop the note after 500ms
            setTimeout(() => {
                this.stopNote(60);
            }, 500);
            
            Utils.showNotification('MIDI test note sent successfully', 'success');
            return true;
        } catch (error) {
            console.error('MIDI test failed:', error);
            Utils.showNotification('MIDI test failed', 'error');
            return false;
        }
    }
    
    // Get available MIDI devices
    getAvailableDevices() {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.access) {
            return [];
        }
        
        const outputs = Array.from(appState.globalMIDIState.access.outputs.values());
        return outputs.map(output => ({
            id: output.id,
            name: output.name,
            manufacturer: output.manufacturer,
            state: output.state
        }));
    }
    
    // Check if MIDI is available and enabled
    isMIDIAvailable() {
        return !!navigator.requestMIDIAccess;
    }
    
    isMIDIEnabled() {
        return appState.globalMIDIState.enabled;
    }
    
    isDeviceSelected() {
        return !!appState.globalMIDIState.selectedOutput;
    }
    
    getSelectedDevice() {
        return appState.globalMIDIState.selectedOutput ? {
            id: appState.globalMIDIState.selectedOutputId,
            name: appState.globalMIDIState.deviceName,
            output: appState.globalMIDIState.selectedOutput
        } : null;
    }
    
    getSelectedDeviceName() {
        return appState.globalMIDIState.deviceName || 'MIDI Device';
    }
    
    // Utility method to convert note name to MIDI number
    noteNameToNumber(noteName) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        
        if (!match) return null;
        
        const [, note, octave] = match;
        const noteIndex = noteNames.indexOf(note);
        
        if (noteIndex === -1) return null;
        
        return (parseInt(octave) + 1) * 12 + noteIndex;
    }
    
    // Utility method to convert MIDI number to note name
    numberToNoteName(noteNumber) {
        return appState.midiNoteToName(noteNumber);
    }
}

// Create global instance
export const midiManager = new MIDIManager();

// Make it globally available
window.midiManager = midiManager;
