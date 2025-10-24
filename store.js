// Global state management
export const state = {
  selectedPatch: null,
  selectedPatchBank: null,
  selectedManufacturer: null,
  selectedDevice: null,
  
  // MIDI state
  midiEnabled: false,
  midiAccess: null,
  selectedOutput: null,
  
  // Patch bank data
  patchBanks: [],
  
  // Loaded midnam data
  currentMidnam: null,
  
  // Initialize state
  init() {
    this.loadMIDI();
    this.loadPatches();
  },
  
  async loadMIDI() {
    try {
      const access = await navigator.requestMIDIAccess();
      this.midiAccess = access;
      this.midiEnabled = true;
      
      // Setup MIDI input/output handlers
      access.onstatechange = (event) => {
        console.log('MIDI state changed:', event);
      };
      
      // Select first available output
      const outputs = Array.from(access.outputs.values());
      if (outputs.length > 0) {
        this.selectedOutput = outputs[0];
      }
    } catch (err) {
      console.error('Failed to access MIDI:', err);
      this.midiEnabled = false;
    }
  },
  
  async loadPatches() {
    // Load patch data from server
    try {
      const response = await fetch('/api/patch/banks');
      if (response.ok) {
        this.patchBanks = await response.json();
      }
    } catch (err) {
      console.error('Failed to load patches:', err);
    }
  },
  
  // Set selected patch
  setSelectedPatch(patch) {
    this.selectedPatch = patch;
  },
  
  // Set selected bank
  setSelectedBank(bank) {
    this.selectedPatchBank = bank;
  },
  
  // Set selected manufacturer
  setSelectedManufacturer(manufacturer) {
    this.selectedManufacturer = manufacturer;
  },
  
  // Set selected device
  setSelectedDevice(device) {
    this.selectedDevice = device;
  },
  
  // Add patch to bank
  addPatch(bankIndex, patch) {
    if (this.patchBanks[bankIndex]) {
      this.patchBanks[bankIndex].patches.push(patch);
    }
  },
  
  // Remove patch from bank
  removePatch(bankIndex, patchIndex) {
    if (this.patchBanks[bankIndex] && this.patchBanks[bankIndex].patches[patchIndex]) {
      this.patchBanks[bankIndex].patches.splice(patchIndex, 1);
    }
  },
  
  // Update patch
  updatePatch(bankIndex, patchIndex, patchData) {
    if (this.patchBanks[bankIndex] && this.patchBanks[bankIndex].patches[patchIndex]) {
      this.patchBanks[bankIndex].patches[patchIndex] = {
        ...this.patchBanks[bankIndex].patches[patchIndex],
        ...patchData
      };
    }
  }
};


