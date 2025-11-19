/**
 * Hosting detection and notifications
 * Detects if running on Vercel/hosted and shows appropriate messages
 */

export function isHostedVersion() {
    // Detect if we're on Vercel or other hosting platform
    const hostname = window.location.hostname;
    
    return (
        hostname.includes('vercel.app') ||
        hostname.includes('vercel.com') ||
        (hostname !== 'localhost' && hostname !== '127.0.0.1')
    );
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


