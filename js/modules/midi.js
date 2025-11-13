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
    
    // Alias methods for compatibility
    sendNoteOn(noteNumber, velocity = 127, channel = 0) {
        return this.playNote(noteNumber, velocity, channel);
    }
    
    sendNoteOff(noteNumber, channel = 0) {
        return this.stopNote(noteNumber, channel);
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
    
    // Send SysEx message
    sendSysEx(data) {
        if (!appState.globalMIDIState.enabled || !appState.globalMIDIState.selectedOutput) {
            return false;
        }
        
        try {
            // Debug logging
            console.log('[sendSysEx] Checking SysEx capability:', {
                hasAccess: !!appState.globalMIDIState.access,
                sysexEnabled: appState.globalMIDIState.access?.sysexEnabled,
                midiEnabled: appState.globalMIDIState.enabled,
                hasOutput: !!appState.globalMIDIState.selectedOutput
            });
            
            // Check if SysEx is supported
            if (!appState.globalMIDIState.access) {
                console.error('No MIDI access object');
                Utils.showNotification('MIDI not initialized. Please enable MIDI in the header.', 'error');
                return false;
            }
            
            if (!appState.globalMIDIState.access.sysexEnabled) {
                console.error('SysEx is not enabled');
                console.error('To enable SysEx in Chrome:');
                console.error('1. Go to chrome://settings/content/midi');
                console.error('2. Ensure localhost:8000 is set to "Allow"');
                console.error('3. Reload the page and re-enable MIDI');
                
                Utils.showNotification('SysEx not enabled. Check console for instructions.', 'error');
                return false;
            }
            
            // Ensure data is an array of numbers
            if (!Array.isArray(data)) {
                console.error('SysEx data must be an array');
                return false;
            }
            
            // Validate all bytes are in valid range (0-127 for data bytes)
            for (let i = 0; i < data.length; i++) {
                if (typeof data[i] !== 'number' || data[i] < 0 || data[i] > 255) {
                    console.error(`Invalid byte at position ${i}: ${data[i]}`);
                    return false;
                }
            }
            
            // Ensure first byte is 0xF0 (SysEx start)
            if (data[0] !== 0xF0) {
                console.warn('SysEx message should start with 0xF0, prepending...');
                data = [0xF0, ...data];
            }
            
            // Ensure last byte is 0xF7 (SysEx end)
            if (data[data.length - 1] !== 0xF7) {
                console.warn('SysEx message should end with 0xF7, appending...');
                data = [...data, 0xF7];
            }
            
            appState.globalMIDIState.selectedOutput.send(data);
            return true;
        } catch (error) {
            console.error('Error sending SysEx:', error);
            if (error.name === 'InvalidAccessError') {
                Utils.showNotification('SysEx permission denied. Please reload the page and enable MIDI with SysEx support.', 'error');
            }
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
    
    isOutputConnected() {
        return this.isMIDIEnabled() && this.isDeviceSelected();
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
