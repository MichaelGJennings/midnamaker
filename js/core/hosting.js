/**
 * Hosting detection and notifications
 * Detects if running on Vercel/hosted and shows appropriate messages
 */

import { appState } from './state.js';

export function isHostedVersion() {
    // Detect if we're on Vercel or other hosting platform
    const hostname = window.location.hostname;
    
    return (
        hostname.includes('vercel.app') ||
        hostname.includes('vercel.com') ||
        (hostname !== 'localhost' && hostname !== '127.0.0.1')
    );
}

/**
 * Initialize beforeunload warning to prevent data loss
 */
export function initDataLossWarning() {
    window.addEventListener('beforeunload', (e) => {
        // Check if hosted version and has user data
        if (isHostedVersion()) {
            const hasUnsavedChanges = appState.pendingChanges?.hasUnsavedChanges;
            const hasUserCreatedDevices = hasUserDataInCatalog();
            
            if (hasUnsavedChanges || hasUserCreatedDevices) {
                e.preventDefault();
                e.returnValue = ''; // Modern browsers ignore custom messages
                return ''; // For older browsers
            }
        }
    });
}

/**
 * Check if catalog contains user-created devices
 */
function hasUserDataInCatalog() {
    if (!appState.catalog) return false;
    
    // Check if any device in catalog is user-created by checking IndexedDB
    // User-created devices are stored in browser storage
    return checkBrowserStorageExists();
}

/**
 * Check if browser storage has any saved files
 */
async function checkBrowserStorageExists() {
    try {
        const { browserStorage } = await import('./storage.js');
        const stats = await browserStorage.getStats();
        return stats.count > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Cache user data to localStorage for recovery
 */
export async function cacheUserData() {
    if (!isHostedVersion()) return;
    
    try {
        const { browserStorage } = await import('./storage.js');
        const stats = await browserStorage.getStats();
        
        const cacheData = {
            timestamp: Date.now(),
            fileCount: stats.count,
            totalSize: stats.totalSize,
            hasUnsavedChanges: appState.pendingChanges?.hasUnsavedChanges || false
        };
        
        localStorage.setItem('midnamaker_cache', JSON.stringify(cacheData));
    } catch (error) {
        console.error('[Hosting] Error caching user data:', error);
    }
}

/**
 * Restore user data from localStorage cache if available
 */
export async function restoreUserDataCache() {
    if (!isHostedVersion()) return null;
    
    try {
        const cachedData = localStorage.getItem('midnamaker_cache');
        if (!cachedData) return null;
        
        const cache = JSON.parse(cachedData);
        
        // Check if cache is recent (within last hour)
        const cacheAge = Date.now() - cache.timestamp;
        if (cacheAge > 3600000) { // 1 hour
            localStorage.removeItem('midnamaker_cache');
            return null;
        }
        
        return cache;
    } catch (error) {
        console.error('[Hosting] Error restoring cache:', error);
        return null;
    }
}

/**
 * Periodically cache user data
 */
export function startPeriodicCaching() {
    if (!isHostedVersion()) return;
    
    // Cache every 30 seconds
    setInterval(() => {
        cacheUserData();
    }, 30000);
}

export function initHostingNotification() {
    if (!isHostedVersion()) {
        return; // Local version, no notification needed
    }
    
    // Create hosted version banner
    const banner = document.createElement('div');
    banner.className = 'hosted-banner';
    banner.innerHTML = `
        <div class="hosted-banner-content">
            <span class="hosted-banner-icon">🌐</span>
            <div class="hosted-banner-text">
                <strong>Hosted Version</strong>
                <span>Browse 470+ MIDNAM files • Edit & save to browser • Download • Full MIDI support</span>
            </div>
            <button class="hosted-banner-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    
    // Insert at top of page
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Update save button tooltips for hosted mode
    updateSaveButtonsForHostedMode();
    
    // Initialize data loss prevention
    initDataLossWarning();
    startPeriodicCaching();
    
    // Try to restore cache on load
    restoreUserDataCache().then(cache => {
        if (cache && cache.fileCount > 0) {
            console.log('[Hosting] Found cached user data:', cache);
        }
    });
}

function updateSaveButtonsForHostedMode() {
    // Update main save button tooltips to indicate browser storage
    const mainSaveButtons = document.querySelectorAll('#save-device-btn, #save-patch-btn');
    
    mainSaveButtons.forEach(button => {
        const originalTitle = button.title || '';
        button.title = 'Save to browser storage (or download to file)';
    });
    
    console.log('✓ Hosted mode: Save buttons will use browser storage');
}

export function showHostedModeMessage(action) {
    // Show a friendly message when user tries to save
    const message = `
        <div style="text-align: center; padding: 20px;">
            <h3>📥 Download Instead</h3>
            <p>You're using the hosted version of Midnamaker.</p>
            <p>Changes can't be saved to the server, but you can <strong>download</strong> your edited files!</p>
            <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
                <li>✅ All edits work in your browser</li>
                <li>✅ Use the "Download Files" option</li>
                <li>✅ Install downloaded files in your DAW</li>
            </ul>
            <p style="font-size: 0.9em; color: #666;">
                Want full save functionality? Run Midnamaker locally or use the desktop app.
            </p>
        </div>
    `;
    
    // You can display this in a modal or notification
    // For now, just log it
    console.info('Hosted mode:', action, 'redirected to download');
    
    return message;
}

