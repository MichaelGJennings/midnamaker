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
        
        // Check if hosted version - use browser storage
        const { isHostedVersion } = await import('../core/hosting.js');
        if (isHostedVersion()) {
            return await this.createManufacturerFileHosted(manufacturerName);
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
     * Create manufacturer file in browser storage (hosted version)
     */
    async createManufacturerFileHosted(manufacturerName) {
        try {
            // Generate basic MIDDEV XML structure
            const middevXml = `<?xml version='1.0' encoding='utf-8'?>
<MIDIDevice>
  <Manufacturer>${manufacturerName.trim()}</Manufacturer>
  <Devices>
  </Devices>
</MIDIDevice>`;
            
            const filePath = `patchfiles/${manufacturerName.trim()}.middev`;
            
            // Save to browser storage
            const { browserStorage } = await import('../core/storage.js');
            const result = await browserStorage.saveMidnam({
                file_path: filePath,
                midnam: middevXml,
                manufacturer: manufacturerName.trim(),
                model: 'New Manufacturer'
            });
            
            Utils.showNotification(`Created ${filePath} in browser storage`, 'success');
            
            return {
                file_path: filePath,
                success: true
            };
        } catch (error) {
            console.error('Error creating manufacturer file in browser storage:', error);
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
        
        // Check if hosted version - use browser storage
        const { isHostedVersion } = await import('../core/hosting.js');
        if (isHostedVersion()) {
            return await this.addDeviceToManufacturerHosted(manufacturerName, deviceModel);
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
     * Add device to manufacturer file in browser storage (hosted version)
     */
    async addDeviceToManufacturerHosted(manufacturerName, deviceModel) {
        try {
            const filePath = `patchfiles/${manufacturerName.trim()}.middev`;
            
            // Get existing file from browser storage
            const { browserStorage } = await import('../core/storage.js');
            const existingFile = await browserStorage.getMidnam(filePath);
            
            let middevXml;
            if (existingFile && existingFile.midnam) {
                // Parse existing XML and add device
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(existingFile.midnam, 'text/xml');
                
                // Check for parse errors
                const parseError = xmlDoc.querySelector('parsererror');
                if (parseError) {
                    throw new Error('Invalid existing MIDDEV file');
                }
                
                // Find Devices element
                let devicesElem = xmlDoc.querySelector('Devices');
                if (!devicesElem) {
                    // Create Devices element if it doesn't exist
                    devicesElem = xmlDoc.createElement('Devices');
                    const root = xmlDoc.querySelector('MIDIDevice');
                    if (root) {
                        root.appendChild(devicesElem);
                    } else {
                        throw new Error('Invalid MIDDEV structure');
                    }
                }
                
                // Create Device element
                const deviceElem = xmlDoc.createElement('Device');
                deviceElem.setAttribute('Name', deviceModel.trim());
                devicesElem.appendChild(deviceElem);
                
                // Convert back to XML string
                middevXml = new XMLSerializer().serializeToString(xmlDoc);
            } else {
                // Create new file
                middevXml = `<?xml version='1.0' encoding='utf-8'?>
<MIDIDevice>
  <Manufacturer>${manufacturerName.trim()}</Manufacturer>
  <Devices>
    <Device Name="${deviceModel.trim()}" />
  </Devices>
</MIDIDevice>`;
            }
            
            // Save updated file
            const result = await browserStorage.saveMidnam({
                file_path: filePath,
                midnam: middevXml,
                manufacturer: manufacturerName.trim(),
                model: deviceModel.trim()
            });
            
            Utils.showNotification(`Added ${deviceModel} to ${manufacturerName} in browser storage`, 'success');
            
            return {
                file_path: filePath,
                success: true
            };
        } catch (error) {
            console.error('Error adding device in browser storage:', error);
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

