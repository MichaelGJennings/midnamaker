// Main application entry point
// Note: Modules are loaded individually in HTML, so we access them as globals

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Main.js DOMContentLoaded triggered');
    
    // Simple initialization - modules should be available by now
    const initializeApp = () => {
        // Create tab manager if available
        let tabManager;
        if (window.TabManager) {
            tabManager = new window.TabManager();
        } else {
            console.warn('TabManager not available, creating minimal tab functionality');
            // Create a minimal tab manager
            tabManager = {
                registerTabCallback: () => {},
                switchTab: () => {},
                getCurrentTab: () => 'manufacturer',
                isTabActive: () => false
            };
        }
    
    // Register tab callbacks with fallbacks
    tabManager.registerTabCallback('manufacturer', () => {
        const mgr = window.manufacturerManager;
        if (mgr && mgr.loadManufacturers) {
            mgr.loadManufacturers();
        }
    });
    
    tabManager.registerTabCallback('device', () => {
        const mgr = window.deviceManager;
        if (mgr && mgr.loadDeviceTab) {
            mgr.loadDeviceTab();
        }
    });
    
    tabManager.registerTabCallback('patch', () => {
        const mgr = window.patchManager;
        if (mgr && mgr.loadPatchTab) {
            mgr.loadPatchTab();
        }
    });
    
    tabManager.registerTabCallback('catalog', () => {
        const mgr = window.catalogManager;
        if (mgr && mgr.loadCatalogTab) {
            mgr.loadCatalogTab();
        }
    });
    
    tabManager.registerTabCallback('tools', () => {
        const mgr = window.toolsManager;
        if (mgr && mgr.loadToolsTab) {
            mgr.loadToolsTab();
        }
    });
    
    // Initialize main app
    if (window.App) {
        window.app = new window.App();
    } else {
        console.warn('App not available yet; skipping App initialization for now');
    }
    
    // Ensure globals exist without referencing undeclared identifiers
    window.manufacturerManager = window.manufacturerManager || null;
    window.deviceManager = window.deviceManager || null;
    window.patchManager = window.patchManager || null;
    window.catalogManager = window.catalogManager || null;
    window.toolsManager = window.toolsManager || null;
    window.keyboardManager = window.keyboardManager || null;
    window.midiManager = window.midiManager || null;
    window.tabManager = tabManager;
    
    // Add test method for debugging
    console.log('Creating global test functions...');
    window.testTooltip = () => {
        if (patchManager && patchManager.testTooltip) {
            patchManager.testTooltip();
        } else {
            console.log('PatchManager not available for tooltip test');
        }
    };
    window.refreshTooltips = () => {
        if (patchManager && patchManager.refreshAllNoteDisplayTooltips) {
            patchManager.refreshAllNoteDisplayTooltips();
        } else {
            console.log('PatchManager not available for tooltip refresh');
        }
    };
    window.testMIDIStatus = () => {
        console.log('MIDI Status:', {
            enabled: window.midiManager?.isMIDIEnabled(),
            deviceSelected: window.midiManager?.isDeviceSelected(),
            combined: patchManager?.getMIDIStatus?.() || 'PatchManager not available'
        });
    };
    
        console.log('MIDI Name Editor initialized successfully');
        console.log('Loaded modules:', {
            TabManager: typeof window.TabManager,
            App: typeof window.App,
            manufacturerManager: typeof window.manufacturerManager,
            deviceManager: typeof window.deviceManager,
            patchManager: typeof window.patchManager,
            catalogManager: typeof window.catalogManager,
            toolsManager: typeof window.toolsManager,
            keyboardManager: typeof window.keyboardManager,
            midiManager: typeof window.midiManager
        });
        console.log('Available test functions:', {
            testTooltip: typeof window.testTooltip,
            refreshTooltips: typeof window.refreshTooltips,
            testMIDIStatus: typeof window.testMIDIStatus
        });
    };
    
    // Initialize with a slightly longer delay to ensure all modules are loaded
    setTimeout(initializeApp, 50);
});
