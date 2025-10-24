// Manufacturer module
import { appState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { modal } from '../components/modal.js';

export class ManufacturerManager {
    constructor() {
        this.searchTimeout = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        // Don't load manufacturers here - let the main app handle it
    }
    
    setupEventListeners() {
        // Manufacturer search
        const searchInput = document.getElementById('manufacturer-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
            
            searchInput.addEventListener('focus', () => {
                this.showDropdown();
            });
            
            searchInput.addEventListener('blur', () => {
                // Delay hiding to allow for clicks on dropdown items
                setTimeout(() => {
                    this.hideDropdown();
                }, 200);
            });
        }
        
        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.manufacturer-search')) {
                this.hideDropdown();
            }
        });
    }
    
    async loadManufacturers() {
        try {
            // Check if we're running in a development environment without a backend
            if (window.location.protocol === 'file:' || !window.fetch) {
                this.showNoBackendMessage();
                return;
            }
            
            // Make the request directly
            const response = await fetch('/api/manufacturers');
            if (!response.ok) {
                throw new Error('Failed to fetch manufacturers');
            }
            
            const data = await response.json();
            appState.midiManufacturers = data.manufacturers;
            appState.deviceTypes = data.deviceTypes;
            
            this.renderManufacturerList();
            Utils.showNotification('Manufacturers loaded successfully', 'success');
        } catch (error) {
            // Suppress expected errors when no backend is running
            if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
                this.showNoBackendMessage();
                return;
            }
            console.error('Error loading manufacturers:', error);
            this.showNoBackendMessage();
        }
    }
    
    showNoBackendMessage() {
        const container = document.getElementById('manufacturer-devices');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Backend Server</h3>
                    <p>This application requires a backend server to load manufacturer data.</p>
                    <p>Please run the Python server: <code>python server.py</code></p>
                    <p>Then access the application at: <code>http://localhost:8000/midnamaker.html</code></p>
                </div>
            `;
        }
        
        // Hide loading indicator
        const loading = document.getElementById('manufacturer-loading');
        if (loading) {
            loading.style.display = 'none';
        }
        
        // Disable the search input
        const searchInput = document.getElementById('manufacturer-search');
        if (searchInput) {
            searchInput.disabled = true;
            searchInput.placeholder = 'Backend server required';
        }
    }
    
    renderManufacturerList() {
        const container = document.getElementById('manufacturer-devices');
        if (!container) return;
        
        if (Object.keys(appState.midiManufacturers).length === 0) {
            container.innerHTML = '<div class="empty-state">No manufacturers found</div>';
            return;
        }
        
        const manufacturers = Object.keys(appState.midiManufacturers).sort();
        container.innerHTML = manufacturers.map(manufacturer => {
            const deviceCount = appState.midiManufacturers[manufacturer].length;
            return `
                <div class="manufacturer-option" data-manufacturer="${manufacturer}">
                    <div class="manufacturer-name">${Utils.escapeHtml(manufacturer)}</div>
                    <div class="manufacturer-stats">${deviceCount} device${deviceCount !== 1 ? 's' : ''}</div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        container.querySelectorAll('.manufacturer-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const manufacturer = e.currentTarget.getAttribute('data-manufacturer');
                this.selectManufacturer(manufacturer);
            });
        });
    }
    
    handleSearch(query) {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        this.searchTimeout = setTimeout(() => {
            this.filterManufacturers(query);
        }, 300);
    }
    
    filterManufacturers(query) {
        const dropdown = document.getElementById('manufacturer-dropdown-list');
        if (!dropdown) return;
        
        if (!query.trim()) {
            this.hideDropdown();
            return;
        }
        
        const manufacturers = Object.keys(appState.midiManufacturers);
        const filtered = manufacturers.filter(manufacturer => 
            manufacturer.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="manufacturer-option">No manufacturers found</div>';
        } else {
            dropdown.innerHTML = filtered.map(manufacturer => {
                const deviceCount = appState.midiManufacturers[manufacturer].length;
                return `
                    <div class="manufacturer-option" data-manufacturer="${manufacturer}">
                        <div class="manufacturer-name">${Utils.escapeHtml(manufacturer)}</div>
                        <div class="manufacturer-stats">${deviceCount} device${deviceCount !== 1 ? 's' : ''}</div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers to dropdown items
            dropdown.querySelectorAll('.manufacturer-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const manufacturer = e.currentTarget.getAttribute('data-manufacturer');
                    this.selectManufacturer(manufacturer);
                    this.hideDropdown();
                });
            });
        }
        
        this.showDropdown();
    }
    
    showDropdown() {
        const dropdown = document.getElementById('manufacturer-dropdown-list');
        if (dropdown) {
            dropdown.classList.add('show');
        }
    }
    
    hideDropdown() {
        const dropdown = document.getElementById('manufacturer-dropdown-list');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }
    
    selectManufacturer(manufacturerName) {
        appState.selectedManufacturer = manufacturerName;
        
        // Update search input
        const searchInput = document.getElementById('manufacturer-search');
        if (searchInput) {
            searchInput.value = manufacturerName;
        }
        
        // Update UI
        document.querySelectorAll('.manufacturer-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        const selectedOption = document.querySelector(`[data-manufacturer="${manufacturerName}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // Show manufacturer details
        this.showManufacturerDetails(manufacturerName);
        
        // Switch to device tab
        this.switchToDeviceTab();
    }
    
    showManufacturerDetails(manufacturerName) {
        const detailsContainer = document.querySelector('.manufacturer-details');
        if (!detailsContainer) return;
        
        const devices = appState.midiManufacturers[manufacturerName] || [];
        
        detailsContainer.innerHTML = `
            <div class="manufacturer-info">
                <div class="info-item">
                    <div class="info-label">Manufacturer</div>
                    <div class="info-value">${Utils.escapeHtml(manufacturerName)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Device Count</div>
                    <div class="info-value">${devices.length}</div>
                </div>
            </div>
            <table class="device-table">
                <thead>
                    <tr>
                        <th>Device Name</th>
                        <th>Type</th>
                        <th>Capabilities</th>
                    </tr>
                </thead>
                <tbody>
                    ${devices.map(device => `
                        <tr data-device-id="${device.id}">
                            <td class="device-name">${Utils.escapeHtml(device.name)}</td>
                            <td class="device-type">${Utils.escapeHtml(device.type || 'Unknown')}</td>
                            <td class="device-capabilities">
                                ${device.capabilities ? device.capabilities.map(cap => 
                                    `<span class="capability-tag">${Utils.escapeHtml(cap)}</span>`
                                ).join('') : 'None'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        detailsContainer.classList.add('show');
        
        // Add device selection handlers
        detailsContainer.querySelectorAll('tr[data-device-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                const deviceId = e.currentTarget.getAttribute('data-device-id');
                this.selectDevice(deviceId);
            });
        });
    }
    
    selectDevice(deviceId) {
        const device = appState.midiManufacturers[appState.selectedManufacturer]
            .find(d => d.id === deviceId);
        
        if (!device) return;
        
        appState.selectedDevice = device;
        
        // Update UI
        document.querySelectorAll('.device-table tr').forEach(row => {
            row.classList.remove('selected');
        });
        
        const selectedRow = document.querySelector(`tr[data-device-id="${deviceId}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
        }
        
        // Load device details
        this.loadDeviceDetails(device);
    }
    
    async loadDeviceDetails(device) {
        try {
            const response = await fetch(`/api/device/${device.id}`);
            if (!response.ok) throw new Error('Failed to fetch device details');
            
            const deviceData = await response.json();
            appState.currentMidnam = deviceData;
            
            // Switch to device tab to show device configuration
            this.switchToDeviceTab();
            
            Utils.showNotification(`Loaded device: ${device.name}`, 'success');
        } catch (error) {
            console.error('Error loading device details:', error);
            Utils.showNotification('Failed to load device details', 'error');
        }
    }
    
    switchToDeviceTab() {
        // Import TabManager to switch tabs
        import('../components/tabs.js').then(({ TabManager }) => {
            const tabManager = new TabManager();
            tabManager.switchTab('device');
        });
    }
    
    // Method to refresh manufacturer data
    async refreshManufacturers() {
        await this.loadManufacturers();
    }
    
    // Method to get manufacturer statistics
    getManufacturerStats() {
        const manufacturers = Object.keys(appState.midiManufacturers);
        const totalDevices = manufacturers.reduce((sum, manufacturer) => {
            return sum + appState.midiManufacturers[manufacturer].length;
        }, 0);
        
        return {
            totalManufacturers: manufacturers.length,
            totalDevices: totalDevices,
            averageDevicesPerManufacturer: manufacturers.length > 0 ? 
                Math.round(totalDevices / manufacturers.length) : 0
        };
    }
}

// Create global instance
export const manufacturerManager = new ManufacturerManager();

// Make it globally available
window.manufacturerManager = manufacturerManager;
