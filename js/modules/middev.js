// MIDDEV file creation module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';

export class MiddevManager {
    constructor() {
        this.init();
    }
    
    init() {
        // Initialization if needed
    }
    
    /**
     * Clear the catalog cache to force reload
     */
    async clearCatalogCache() {
        try {
            const response = await fetch('/clear_cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.warn('Failed to clear catalog cache');
            }
        } catch (error) {
            console.warn('Error clearing catalog cache:', error);
        }
    }
    
    /**
     * Create a new .middev file for a manufacturer
     */
    async createManufacturerFile(manufacturerName) {
        if (!manufacturerName || manufacturerName.trim() === '') {
            Utils.showNotification('Manufacturer name is required', 'warning');
            return null;
        }
        
        try {
            const response = await fetch('/api/middev/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    manufacturer: manufacturerName.trim()
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Failed to create manufacturer file (HTTP ${response.status})`);
            }
            
            const result = await response.json();
            Utils.showNotification(`Created ${result.file_path}`, 'success');
            
            return result;
        } catch (error) {
            console.error('Error creating manufacturer file:', error);
            Utils.showNotification(`Failed to create manufacturer file: ${error.message}`, 'error');
            return null;
        }
    }
    
    /**
     * Add a new device to an existing .middev file
     */
    async addDeviceToManufacturer(manufacturerName, deviceModel) {
        if (!manufacturerName || manufacturerName.trim() === '') {
            Utils.showNotification('Manufacturer name is required', 'warning');
            return null;
        }
        
        if (!deviceModel || deviceModel.trim() === '') {
            Utils.showNotification('Device model is required', 'warning');
            return null;
        }
        
        try {
            const response = await fetch('/api/middev/add-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    manufacturer: manufacturerName.trim(),
                    model: deviceModel.trim()
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Failed to add device (HTTP ${response.status})`);
            }
            
            const result = await response.json();
            Utils.showNotification(`Added ${deviceModel} to ${manufacturerName}`, 'success');
            
            return result;
        } catch (error) {
            console.error('Error adding device:', error);
            Utils.showNotification(`Failed to add device: ${error.message}`, 'error');
            return null;
        }
    }
    
    /**
     * Show a prompt dialog to create a new manufacturer
     */
    async promptCreateManufacturer() {
        const manufacturerName = prompt('Enter manufacturer name:');
        
        if (manufacturerName === null) {
            return null; // User cancelled
        }
        
        if (!manufacturerName || manufacturerName.trim() === '') {
            Utils.showNotification('Manufacturer name is required', 'warning');
            return null;
        }
        
        const result = await this.createManufacturerFile(manufacturerName);
        
        // Refresh manufacturer list and select the new manufacturer if successful
        if (result && window.manufacturerManager) {
            // Clear the catalog cache so the new file is picked up
            await this.clearCatalogCache();
            
            // Reload the catalog
            await window.manufacturerManager.refreshManufacturerList();
            
            // Small delay to ensure catalog is loaded
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Select the newly created manufacturer
            const manufacturers = window.manufacturerManager.buildManufacturerList(appState.catalog || {});
            const manufacturer = manufacturers.find(m => m.name === manufacturerName.trim());
            
            if (manufacturer) {
                await window.manufacturerManager.selectManufacturer(manufacturerName.trim(), manufacturers);
            } else {
                console.warn('New manufacturer not found in catalog after refresh');
                Utils.showNotification('Manufacturer created but not yet in catalog. Please refresh the page.', 'warning');
            }
        }
        
        return result;
    }
    
    /**
     * Show a prompt dialog to add a device to the selected manufacturer
     */
    async promptAddDevice(manufacturerName) {
        if (!manufacturerName) {
            Utils.showNotification('No manufacturer selected', 'warning');
            return null;
        }
        
        const deviceModel = prompt(`Enter device model for ${manufacturerName}:`);
        
        if (deviceModel === null) {
            return null; // User cancelled
        }
        
        if (!deviceModel || deviceModel.trim() === '') {
            Utils.showNotification('Device model is required', 'warning');
            return null;
        }
        
        const result = await this.addDeviceToManufacturer(manufacturerName, deviceModel);
        
        // Refresh manufacturer list if successful
        if (result && window.manufacturerManager) {
            // Clear the catalog cache so the new device is picked up
            await this.clearCatalogCache();
            
            // Reload the catalog
            await window.manufacturerManager.refreshManufacturerList();
            
            // Small delay to ensure catalog is loaded
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Re-select the manufacturer to show the new device
            if (window.manufacturerManager.selectManufacturer) {
                const manufacturers = window.manufacturerManager.buildManufacturerList(appState.catalog || {});
                await window.manufacturerManager.selectManufacturer(manufacturerName, manufacturers);
            }
        }
        
        return result;
    }
}

export const middevManager = new MiddevManager();

// Make it globally available
window.middevManager = middevManager;

