// PIN Manager for Thai TM30 Helper
// Provides PIN-based access control using SHA-256 hashing

const PinManager = {
    MAX_ATTEMPTS: 3,
    DEFAULT_TIMEOUT: 300000, // 5 minutes in milliseconds
    SESSION_CHECK_INTERVAL: 5000, // Check session every 5 seconds
    SHAKE_ANIMATION_DURATION: 500, // Shake animation duration in ms
    ACTIVITY_DEBOUNCE_DELAY: 1000, // Debounce delay for activity tracking
    
    // Hash PIN using SHA-256
    async hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Check if PIN is enabled
    async isPinEnabled() {
        return new Promise(resolve => {
            chrome.storage.local.get(['pinHash'], (result) => {
                resolve(!!result.pinHash);
            });
        });
    },

    // Get lock timeout setting
    async getLockTimeout() {
        return new Promise(resolve => {
            chrome.storage.local.get(['pinLockTimeout'], (result) => {
                resolve(result.pinLockTimeout || PinManager.DEFAULT_TIMEOUT);
            });
        });
    },

    // Set lock timeout setting
    async setLockTimeout(timeout) {
        return new Promise(resolve => {
            chrome.storage.local.set({ pinLockTimeout: timeout }, resolve);
        });
    },

    // Set new PIN
    async setPin(pin) {
        const hash = await this.hashPin(pin);
        return new Promise(resolve => {
            chrome.storage.local.set({ pinHash: hash, pinAttempts: 0 }, resolve);
        });
    },

    // Verify PIN and start session on success
    async verifyPin(pin) {
        const hash = await this.hashPin(pin);
        return new Promise(resolve => {
            chrome.storage.local.get(['pinHash'], (result) => {
                const isValid = result.pinHash === hash;
                if (isValid) {
                    // Reset attempts and start session on success
                    this.startSession();
                    chrome.storage.local.set({ pinAttempts: 0 });
                }
                resolve(isValid);
            });
        });
    },

    // Start unlock session using saved timeout
    async startSession() {
        const timeout = await this.getLockTimeout();
        const expiresAt = Date.now() + timeout;
        return new Promise(resolve => {
            chrome.storage.local.set({ pinSessionExpires: expiresAt }, resolve);
        });
    },

    // Check if session is still valid
    async isSessionValid() {
        return new Promise(resolve => {
            chrome.storage.local.get(['pinSessionExpires'], (result) => {
                if (!result.pinSessionExpires) {
                    resolve(false);
                    return;
                }
                resolve(Date.now() < result.pinSessionExpires);
            });
        });
    },

    // Clear session
    async clearSession() {
        return new Promise(resolve => {
            chrome.storage.local.remove(['pinSessionExpires'], resolve);
        });
    },

    // Get failed attempts count
    async getAttempts() {
        return new Promise(resolve => {
            chrome.storage.local.get(['pinAttempts'], (result) => {
                resolve(result.pinAttempts || 0);
            });
        });
    },

    // Increment failed attempts
    async incrementAttempts() {
        const attempts = await this.getAttempts();
        const newAttempts = attempts + 1;
        return new Promise(resolve => {
            chrome.storage.local.set({ pinAttempts: newAttempts }, () => {
                resolve(newAttempts);
            });
        });
    },

    // Remove PIN (keeping data)
    async removePin() {
        return new Promise(resolve => {
            chrome.storage.local.remove(['pinHash', 'pinAttempts', 'pinSessionExpires'], resolve);
        });
    },

    // Reset all data (PIN + persons + session)
    async resetAll() {
        return new Promise(resolve => {
            chrome.storage.local.remove(['pinHash', 'pinAttempts', 'pinSessionExpires', 'persons'], resolve);
        });
    },

    // Validate PIN format (exactly 4 digits)
    isValidFormat(pin) {
        return /^\d{4}$/.test(pin);
    }
};

// PIN UI Helpers - shared functions for PIN digit inputs
const PinUI = {
    // Get PIN value from digit inputs container
    getPinFromDigits(container) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        return Array.from(inputs).map(i => i.value).join('');
    },

    // Clear all digit inputs in container
    clearDigits(container) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        inputs.forEach(i => {
            i.value = '';
            i.classList.remove('PinDigits__Input_filled');
        });
    },

    // Setup digit inputs with auto-focus and optional auto-submit
    setupDigitInputs(container, { onComplete, autoSubmit = false } = {}) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        
        inputs.forEach((input, index) => {
            input.addEventListener('input', async (e) => {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = value.slice(0, 1);
                
                if (value && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                } else if (value && index === inputs.length - 1 && onComplete && !autoSubmit) {
                    onComplete();
                }
                
                e.target.classList.toggle('PinDigits__Input_filled', !!value);
                
                // Auto-submit when all 4 digits entered
                if (autoSubmit) {
                    const pin = PinUI.getPinFromDigits(container);
                    if (pin.length === 4 && onComplete) {
                        await onComplete(pin);
                    }
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    inputs[index - 1].focus();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text');
                const digits = paste.replace(/\D/g, '').slice(0, 4);
                digits.split('').forEach((digit, i) => {
                    if (inputs[i]) {
                        inputs[i].value = digit;
                        inputs[i].classList.add('PinDigits__Input_filled');
                    }
                });
                if (digits.length === 4 && onComplete) {
                    if (autoSubmit) {
                        onComplete(digits);
                    } else {
                        onComplete();
                    }
                } else if (digits.length > 0 && !autoSubmit) {
                    inputs[Math.min(digits.length, inputs.length - 1)].focus();
                }
            });
        });
    },

    // Focus first input in container
    focusFirst(container) {
        const input = container.querySelector('.PinDigits__Input');
        if (input) input.focus();
    },

    // Disable all inputs in container
    disableInputs(container) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        inputs.forEach(i => i.disabled = true);
    },

    // Apply shake animation to container
    shake(container) {
        container.classList.add('PinLock__Input_shake');
        setTimeout(() => {
            container.classList.remove('PinLock__Input_shake');
        }, PinManager.SHAKE_ANIMATION_DURATION);
    }
};
