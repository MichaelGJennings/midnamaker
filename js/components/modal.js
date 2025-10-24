// Modal component
export class Modal {
    constructor() {
        this.activeModal = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.close();
            }
        });
        
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });
    }
    
    show(options = {}) {
        const {
            title = 'Modal',
            content = '',
            showCancel = true,
            showConfirm = true,
            cancelText = 'Cancel',
            confirmText = 'OK',
            onCancel = null,
            onConfirm = null,
            className = ''
        } = options;
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay" id="modal-overlay">
                <div class="modal-content ${className}">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" id="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${showCancel ? `<button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>` : ''}
                        ${showConfirm ? `<button class="btn btn-primary" id="modal-confirm">${confirmText}</button>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        this.close();
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('modal-overlay');
        this.activeModal = modal;
        
        // Setup event listeners
        const closeBtn = modal.querySelector('#modal-close');
        const cancelBtn = modal.querySelector('#modal-cancel');
        const confirmBtn = modal.querySelector('#modal-confirm');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (onCancel) onCancel();
                this.close();
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (onConfirm) onConfirm();
                this.close();
            });
        }
        
        // Show modal with animation
        setTimeout(() => {
            modal.style.display = 'flex';
        }, 10);
        
        return modal;
    }
    
    close() {
        if (this.activeModal) {
            this.activeModal.remove();
            this.activeModal = null;
        }
    }
    
    // Convenience methods for common modal types
    confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
                onCancel: () => resolve(false),
                onConfirm: () => resolve(true)
            });
        });
    }
    
    alert(message, title = 'Alert') {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
                showCancel: false,
                confirmText: 'OK',
                onConfirm: () => resolve()
            });
        });
    }
    
    prompt(message, defaultValue = '', title = 'Input') {
        return new Promise((resolve) => {
            const inputId = 'modal-prompt-input';
            this.show({
                title,
                content: `
                    <p>${message}</p>
                    <input type="text" id="${inputId}" value="${defaultValue}" class="form-control" style="width: 100%; margin-top: 1rem;">
                `,
                onConfirm: () => {
                    const input = document.getElementById(inputId);
                    resolve(input ? input.value : defaultValue);
                },
                onCancel: () => resolve(null)
            });
            
            // Focus input after modal is shown
            setTimeout(() => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
        });
    }
    
    loading(message = 'Loading...') {
        return this.show({
            title: '',
            content: `
                <div style="text-align: center; padding: 2rem;">
                    <div style="margin-bottom: 1rem;">${message}</div>
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `,
            showCancel: false,
            showConfirm: false,
            className: 'loading-modal'
        });
    }
}

// Create global instance
export const modal = new Modal();
