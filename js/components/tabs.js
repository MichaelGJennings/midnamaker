// Tab navigation component
export class TabManager {
    constructor() {
        this.currentTab = 'manufacturer';
        this.tabCallbacks = new Map();
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready before setting up listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupTabListeners();
            });
        } else {
            this.setupTabListeners();
        }
    }
    
    setupTabListeners() {
        const tabs = document.querySelectorAll('.tab');
        if (tabs.length === 0) {
            console.warn('No .tab elements found, TabManager will have limited functionality');
            return;
        }
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }
    
    switchTab(tabName) {
        // Update tab UI
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Update content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`${tabName}-tab`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        this.currentTab = tabName;
        
        // Execute tab callback if registered
        if (this.tabCallbacks.has(tabName)) {
            this.tabCallbacks.get(tabName)();
        }
    }
    
    registerTabCallback(tabName, callback) {
        this.tabCallbacks.set(tabName, callback);
    }
    
    getCurrentTab() {
        return this.currentTab;
    }
    
    isTabActive(tabName) {
        return this.currentTab === tabName;
    }
}

// Make TabManager globally available
window.TabManager = TabManager;
