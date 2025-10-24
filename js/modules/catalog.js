// Catalog module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { modal } from '../components/modal.js';

export class CatalogManager {
    constructor() {
        this.catalogData = {};
        this.isLoading = false;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Refresh catalog button
        const refreshBtn = document.getElementById('refresh-catalog-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshCatalog();
            });
        }
        
        // Analyze catalog button
        const analyzeBtn = document.getElementById('analyze-catalog-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.analyzeCatalog();
            });
        }
    }
    
    async loadCatalogTab() {
        if (this.isLoading) return;
        
        this.showLoadingState();
        await this.loadCatalogData();
    }
    
    showLoadingState() {
        const content = document.getElementById('catalog-content');
        if (content) {
            content.innerHTML = '<div class="loading">Loading catalog...</div>';
        }
        
        const status = document.getElementById('catalog-status');
        if (status) {
            status.textContent = 'Loading catalog data...';
        }
    }
    
    async loadCatalogData() {
        try {
            this.isLoading = true;
            
            const response = await fetch('/midnam_catalog');
            if (!response.ok) throw new Error('Failed to fetch catalog');
            
            const data = await response.json();
            this.catalogData = data;
            appState.catalog = data; // Store globally for disambiguation
            
            this.renderCatalogTable();
            this.updateCatalogStatus();
            
        } catch (error) {
            console.error('Error loading catalog:', error);
            this.showErrorState(error.message);
        } finally {
            this.isLoading = false;
        }
    }
    
    renderCatalogTable() {
        const content = document.getElementById('catalog-content');
        if (!content) return;
        
        if (!this.catalogData || Object.keys(this.catalogData).length === 0) {
            content.innerHTML = '<div class="empty-state">No catalog data available</div>';
            return;
        }
        
        const devices = Object.keys(this.catalogData).sort();
        
        content.innerHTML = `
            <table class="catalog-table">
                <thead>
                    <tr>
                        <th>Device Key</th>
                        <th>Type</th>
                        <th>Files</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${devices.map(deviceKey => {
                        const device = this.catalogData[deviceKey];
                        return `
                            <tr>
                                <td class="device-key">${Utils.escapeHtml(deviceKey)}</td>
                                <td>
                                    <span class="device-type ${device.type || 'master'}">${device.type || 'master'}</span>
                                </td>
                                <td class="file-list">
                                    ${this.generateFileListHTML(device.files || [])}
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-small btn-primary" onclick="catalogManager.viewDevice('${deviceKey}')">View</button>
                                        <button class="btn btn-small btn-secondary" onclick="catalogManager.editDevice('${deviceKey}')">Edit</button>
                                        <button class="btn btn-small btn-danger" onclick="catalogManager.deleteDevice('${deviceKey}')">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
    
    generateFileListHTML(files) {
        if (!files || files.length === 0) {
            return '<span class="text-muted">No files</span>';
        }
        
        return `
            <div class="file-list">
                ${files.map(file => `
                    <div class="file-item">
                        <span class="file-path">${Utils.escapeHtml(file.path)}</span>
                        <span class="file-size">${Utils.formatFileSize(file.size)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    updateCatalogStatus() {
        const status = document.getElementById('catalog-status');
        if (!status) return;
        
        const deviceCount = Object.keys(this.catalogData).length;
        const totalFiles = Object.values(this.catalogData).reduce((sum, device) => {
            return sum + (device.files ? device.files.length : 0);
        }, 0);
        
        status.innerHTML = `
            <div class="status-text">
                Loaded ${deviceCount} device${deviceCount !== 1 ? 's' : ''} with ${totalFiles} file${totalFiles !== 1 ? 's' : ''}
            </div>
        `;
    }
    
    showErrorState(message) {
        const content = document.getElementById('catalog-content');
        if (content) {
            content.innerHTML = `
                <div class="error">
                    <h4>Error Loading Catalog</h4>
                    <p>${Utils.escapeHtml(message)}</p>
                    <button class="btn btn-primary" onclick="catalogManager.loadCatalogData()">Retry</button>
                </div>
            `;
        }
        
        const status = document.getElementById('catalog-status');
        if (status) {
            status.textContent = 'Error loading catalog';
        }
    }
    
    async refreshCatalog() {
        await this.loadCatalogData();
        Utils.showNotification('Catalog refreshed', 'success');
    }
    
    async analyzeCatalog() {
        if (!this.catalogData || Object.keys(this.catalogData).length === 0) {
            Utils.showNotification('No catalog data to analyze', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/catalog/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    catalog: this.catalogData
                })
            });
            
            if (!response.ok) throw new Error('Failed to analyze catalog');
            
            const analysis = await response.json();
            this.showAnalysisResults(analysis);
            
        } catch (error) {
            console.error('Error analyzing catalog:', error);
            Utils.showNotification('Failed to analyze catalog', 'error');
        }
    }
    
    showAnalysisResults(analysis) {
        const resultsHTML = `
            <div class="analysis-results">
                <h3>Catalog Analysis Results</h3>
                
                <div class="analysis-section">
                    <h4>Statistics</h4>
                    <ul>
                        <li>Total Devices: ${analysis.totalDevices}</li>
                        <li>Total Files: ${analysis.totalFiles}</li>
                        <li>Master Devices: ${analysis.masterDevices}</li>
                        <li>Extending Devices: ${analysis.extendingDevices}</li>
                        <li>Average Files per Device: ${analysis.averageFilesPerDevice}</li>
                    </ul>
                </div>
                
                ${analysis.duplicates && analysis.duplicates.length > 0 ? `
                    <div class="analysis-section">
                        <h4>Duplicate Devices</h4>
                        <ul>
                            ${analysis.duplicates.map(dup => `<li>${Utils.escapeHtml(dup)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${analysis.errors && analysis.errors.length > 0 ? `
                    <div class="analysis-section">
                        <h4>Errors Found</h4>
                        <ul>
                            ${analysis.errors.map(error => `<li>${Utils.escapeHtml(error)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${analysis.warnings && analysis.warnings.length > 0 ? `
                    <div class="analysis-section">
                        <h4>Warnings</h4>
                        <ul>
                            ${analysis.warnings.map(warning => `<li>${Utils.escapeHtml(warning)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
        
        modal.show({
            title: 'Catalog Analysis',
            content: resultsHTML,
            showCancel: false,
            confirmText: 'Close'
        });
    }
    
    viewDevice(deviceKey) {
        const device = this.catalogData[deviceKey];
        if (!device) return;
        
        // Parse device key to get manufacturer and model
        const [manufacturer, model] = deviceKey.split('|');
        
        const deviceHTML = `
            <div class="device-details-view">
                <div class="device-header">
                    <h3>${Utils.escapeHtml(model)}</h3>
                    <p class="device-manufacturer">${Utils.escapeHtml(manufacturer)}</p>
                </div>
                
                <div class="device-metadata">
                    <div class="metadata-row">
                        <div class="metadata-label">Device Key:</div>
                        <div class="metadata-value">${Utils.escapeHtml(deviceKey)}</div>
                    </div>
                    
                    <div class="metadata-row">
                        <div class="metadata-label">Type:</div>
                        <div class="metadata-value">
                            <span class="device-type ${device.type || 'master'}">${device.type || 'master'}</span>
                        </div>
                    </div>
                    
                    ${device.manufacturer_id ? `
                        <div class="metadata-row">
                            <div class="metadata-label">Manufacturer ID:</div>
                            <div class="metadata-value">${Utils.escapeHtml(device.manufacturer_id)}</div>
                        </div>
                    ` : ''}
                    
                    ${device.family_id ? `
                        <div class="metadata-row">
                            <div class="metadata-label">Family ID:</div>
                            <div class="metadata-value">${Utils.escapeHtml(device.family_id)}</div>
                        </div>
                    ` : ''}
                    
                    ${device.device_id ? `
                        <div class="metadata-row">
                            <div class="metadata-label">Device ID:</div>
                            <div class="metadata-value">${Utils.escapeHtml(device.device_id)}</div>
                        </div>
                    ` : ''}
                    
                    <div class="metadata-row">
                        <div class="metadata-label">Number of Files:</div>
                        <div class="metadata-value">${device.files ? device.files.length : 0}</div>
                    </div>
                </div>
                
                ${device.files && device.files.length > 0 ? `
                    <div class="device-files-section">
                        <h4>Files</h4>
                        <div class="file-list-container">
                            ${device.files.map(file => `
                                <div class="file-item-detail">
                                    <div class="file-path-detail">${Utils.escapeHtml(file.path)}</div>
                                    <div class="file-meta-detail">
                                        <span class="file-size-detail">${Utils.formatFileSize(file.size)}</span>
                                        <span class="file-separator">•</span>
                                        <span class="file-date-detail">${Utils.formatDate(file.modified)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        modal.show({
            title: 'Device Details',
            content: deviceHTML,
            showCancel: false,
            confirmText: 'Close',
            className: 'device-details-modal'
        });
    }
    
    editDevice(deviceKey) {
        // Implementation for editing device
        Utils.showNotification('Device editing will be implemented', 'info');
    }
    
    deleteDevice(deviceKey) {
        modal.confirm(`Are you sure you want to delete device "${deviceKey}"?`, 'Delete Device')
            .then(confirmed => {
                if (confirmed) {
                    // Delete device logic
                    Utils.showNotification('Device deleted', 'success');
                }
            });
    }
    
    // Method to search catalog
    searchCatalog(query) {
        if (!query.trim()) {
            this.renderCatalogTable();
            return;
        }
        
        const filteredDevices = Object.keys(this.catalogData).filter(deviceKey => 
            deviceKey.toLowerCase().includes(query.toLowerCase())
        );
        
        // Re-render table with filtered results
        this.renderFilteredCatalogTable(filteredDevices);
    }
    
    renderFilteredCatalogTable(deviceKeys) {
        const content = document.getElementById('catalog-content');
        if (!content) return;
        
        if (deviceKeys.length === 0) {
            content.innerHTML = '<div class="empty-state">No devices found matching search criteria</div>';
            return;
        }
        
        content.innerHTML = `
            <table class="catalog-table">
                <thead>
                    <tr>
                        <th>Device Key</th>
                        <th>Type</th>
                        <th>Files</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${deviceKeys.map(deviceKey => {
                        const device = this.catalogData[deviceKey];
                        return `
                            <tr>
                                <td class="device-key">${Utils.escapeHtml(deviceKey)}</td>
                                <td>
                                    <span class="device-type ${device.type || 'master'}">${device.type || 'master'}</span>
                                </td>
                                <td class="file-list">
                                    ${this.generateFileListHTML(device.files || [])}
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-small btn-primary" onclick="catalogManager.viewDevice('${deviceKey}')">View</button>
                                        <button class="btn btn-small btn-secondary" onclick="catalogManager.editDevice('${deviceKey}')">Edit</button>
                                        <button class="btn btn-small btn-danger" onclick="catalogManager.deleteDevice('${deviceKey}')">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
    
    // Method to export catalog
    async exportCatalog(format = 'json') {
        try {
            const response = await fetch(`/api/catalog/export?format=${format}`);
            if (!response.ok) throw new Error('Failed to export catalog');
            
            const blob = await response.blob();
            const filename = `catalog_export.${format}`;
            
            Utils.downloadFile(blob, filename, response.headers.get('content-type'));
            Utils.showNotification('Catalog exported successfully', 'success');
            
        } catch (error) {
            console.error('Error exporting catalog:', error);
            Utils.showNotification('Failed to export catalog', 'error');
        }
    }
    
    // Method to get catalog statistics
    getCatalogStats() {
        if (!this.catalogData || Object.keys(this.catalogData).length === 0) {
            return null;
        }
        
        const devices = Object.keys(this.catalogData);
        const totalFiles = devices.reduce((sum, deviceKey) => {
            return sum + (this.catalogData[deviceKey].files ? this.catalogData[deviceKey].files.length : 0);
        }, 0);
        
        const masterDevices = devices.filter(deviceKey => 
            !this.catalogData[deviceKey].type || this.catalogData[deviceKey].type === 'master'
        ).length;
        
        const extendingDevices = devices.filter(deviceKey => 
            this.catalogData[deviceKey].type === 'extending'
        ).length;
        
        return {
            totalDevices: devices.length,
            totalFiles: totalFiles,
            masterDevices: masterDevices,
            extendingDevices: extendingDevices,
            averageFilesPerDevice: devices.length > 0 ? Math.round(totalFiles / devices.length) : 0
        };
    }
}

// Create global instance
export const catalogManager = new CatalogManager();

// Make it globally available
window.catalogManager = catalogManager;
