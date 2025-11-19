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
            const deviceModel = 'New Device';
            const deviceId = `${manufacturerName.trim()}|${deviceModel}`;
            
            // Generate basic MIDNAM XML structure with a dummy device
            const midnamXml = `<?xml version='1.0' encoding='utf-8'?>
<MIDINameDocument>
  <Author>User Created</Author>
  <MasterDeviceNames>
    <Manufacturer>${Utils.escapeXml(manufacturerName.trim())}</Manufacturer>
    <Model>${deviceModel}</Model>
    <CustomDeviceMode Name="Default">
      <ChannelNameSetAssignments>
        <ChannelNameSetAssign Channel="1" NameSet="Name Set 1" />
      </ChannelNameSetAssignments>
    </CustomDeviceMode>
    <ChannelNameSet Name="Name Set 1">
      <AvailableForChannels>
        <AvailableChannel Channel="1" Available="true" />
      </AvailableForChannels>
      <PatchBank Name="Bank 1">
        <PatchNameList>
          <Patch Number="0" Name="Patch 1" ProgramChange="0">
            <UsesNoteNameList Name="Notes" />
          </Patch>
        </PatchNameList>
      </PatchBank>
    </ChannelNameSet>
    <NoteNameList Name="Notes">
      <Note Number="36" Name="Kick" />
      <Note Number="38" Name="Snare" />
      <Note Number="42" Name="Hi-Hat" />
    </NoteNameList>
  </MasterDeviceNames>
</MIDINameDocument>`;
            
            const filePath = `patchfiles/${manufacturerName.trim()}_${deviceModel}.midnam`;
            
            // Save to browser storage
            const { browserStorage } = await import('../core/storage.js');
            const result = await browserStorage.saveMidnam({
                file_path: filePath,
                midnam: midnamXml,
                manufacturer: manufacturerName.trim(),
                model: deviceModel
            });
            
            // Add to catalog immediately for UI refresh
            appState.catalog[deviceId] = {
                manufacturer: manufacturerName.trim(),
                model: deviceModel,
                type: 'Synth',
                files: [{ path: filePath }]
            };
            
            Utils.showNotification(`Created ${manufacturerName} with starter device`, 'success');
            
            return {
                file_path: filePath,
                device_id: deviceId,
                manufacturer: manufacturerName.trim(),
                model: deviceModel,
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
            const deviceId = `${manufacturerName.trim()}|${deviceModel.trim()}`;
            
            // Create a new MIDNAM file for the device
            const midnamXml = `<?xml version='1.0' encoding='utf-8'?>
<MIDINameDocument>
  <Author>User Created</Author>
  <MasterDeviceNames>
    <Manufacturer>${Utils.escapeXml(manufacturerName.trim())}</Manufacturer>
    <Model>${Utils.escapeXml(deviceModel.trim())}</Model>
    <CustomDeviceMode Name="Default">
      <ChannelNameSetAssignments>
        <ChannelNameSetAssign Channel="1" NameSet="Name Set 1" />
      </ChannelNameSetAssignments>
    </CustomDeviceMode>
    <ChannelNameSet Name="Name Set 1">
      <AvailableForChannels>
        <AvailableChannel Channel="1" Available="true" />
      </AvailableForChannels>
      <PatchBank Name="Bank 1">
        <PatchNameList>
          <Patch Number="0" Name="Patch 1" ProgramChange="0">
            <UsesNoteNameList Name="Notes" />
          </Patch>
        </PatchNameList>
      </PatchBank>
    </ChannelNameSet>
    <NoteNameList Name="Notes">
      <Note Number="36" Name="Kick" />
      <Note Number="38" Name="Snare" />
      <Note Number="42" Name="Hi-Hat" />
    </NoteNameList>
  </MasterDeviceNames>
</MIDINameDocument>`;
            
            const filePath = `patchfiles/${manufacturerName.trim()}_${deviceModel.trim()}.midnam`;
            
            // Save to browser storage
            const { browserStorage } = await import('../core/storage.js');
            const result = await browserStorage.saveMidnam({
                file_path: filePath,
                midnam: midnamXml,
                manufacturer: manufacturerName.trim(),
                model: deviceModel.trim()
            });
            
            // Add to catalog immediately for UI refresh
            appState.catalog[deviceId] = {
                manufacturer: manufacturerName.trim(),
                model: deviceModel.trim(),
                type: 'Synth',
                files: [{ path: filePath }]
            };
            
            Utils.showNotification(`Added ${deviceModel} to ${manufacturerName}`, 'success');
            
            return {
                file_path: filePath,
                device_id: deviceId,
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
            // Refresh the manufacturer dropdown dynamically
            await window.manufacturerManager.refreshManufacturerListDynamic();
            
            // Select the newly created manufacturer
            const manufacturers = window.manufacturerManager.buildManufacturerList(appState.catalog || {});
            const manufacturer = manufacturers.find(m => m.name === manufacturerName.trim());
            
            if (manufacturer) {
                await window.manufacturerManager.selectManufacturer(manufacturerName.trim(), manufacturers);
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
            // For hosted version, the device was already added to catalog in addDeviceToManufacturerHosted
            // Just refresh the manufacturer dropdown dynamically
            await window.manufacturerManager.refreshManufacturerListDynamic();
            
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

