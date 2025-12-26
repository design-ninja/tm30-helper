document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n
    await I18n.init();

    const pinLock = document.getElementById('pin-lock');
    const mainContent = document.getElementById('main-content');
    const pinLockDigits = document.getElementById('pin-lock-digits');
    const pinError = document.getElementById('pin-error');
    const pinAttempts = document.getElementById('pin-attempts');
    const pinResetBtn = document.getElementById('pin-reset-btn');
    const personList = document.getElementById('person-list');
    const openOptions = document.getElementById('open-options');

    // Helper function to get PIN value from digit inputs
    function getPinFromDigits(container) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        return Array.from(inputs).map(i => i.value).join('');
    }

    // Helper function to clear digit inputs
    function clearDigits(container) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        inputs.forEach(i => {
            i.value = '';
            i.classList.remove('PinDigits__Input_filled');
        });
    }

    // Setup auto-focus between digit inputs with auto-submit
    function setupLockDigitInputs(container, onComplete) {
        const inputs = container.querySelectorAll('.PinDigits__Input');
        inputs.forEach((input, index) => {
            input.addEventListener('input', async (e) => {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = value.slice(0, 1);
                
                if (value && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
                
                e.target.classList.toggle('PinDigits__Input_filled', !!value);
                
                // Auto-submit when all 4 digits entered
                const pin = getPinFromDigits(container);
                if (pin.length === 4) {
                    await onComplete(pin);
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
                if (digits.length === 4) {
                    onComplete(digits);
                }
            });
        });
    }

    // Check if PIN is enabled and if session is valid
    const pinEnabled = await PinManager.isPinEnabled();
    const sessionValid = await PinManager.isSessionValid();
    
    if (pinEnabled && !sessionValid) {
        // Show PIN lock screen
        pinLock.style.display = 'flex';
        mainContent.style.display = 'none';
        
        // Setup digit inputs with auto-submit
        setupLockDigitInputs(pinLockDigits, async (pin) => {
            const isValid = await PinManager.verifyPin(pin);
            
            if (isValid) {
                // Unlock
                pinLock.style.display = 'none';
                mainContent.style.display = 'block';
                await loadProfiles();
            } else {
                // Wrong PIN
                const attempts = await PinManager.incrementAttempts();
                clearDigits(pinLockDigits);
                pinError.style.display = 'block';
                updateAttemptsDisplay(attempts);
                
                // Shake animation
                pinLockDigits.classList.add('PinLock__Input_shake');
                setTimeout(() => pinLockDigits.classList.remove('PinLock__Input_shake'), 500);
                
                // Focus first input
                pinLockDigits.querySelector('.PinDigits__Input').focus();
            }
        });
        
        // Focus first input
        pinLockDigits.querySelector('.PinDigits__Input').focus();
        
        // Update attempts display
        const attempts = await PinManager.getAttempts();
        updateAttemptsDisplay(attempts);
    } else {
        // No PIN set, show main content directly
        pinLock.style.display = 'none';
        mainContent.style.display = 'block';
        await loadProfiles();
    }

    // Update attempts display and show reset button if needed
    function updateAttemptsDisplay(attempts) {
        const remaining = PinManager.MAX_ATTEMPTS - attempts;
        
        if (attempts > 0 && remaining > 0) {
            pinAttempts.textContent = I18n.t('pin.attemptsLeft').replace('{count}', remaining);
            pinAttempts.style.display = 'block';
        }
        
        if (attempts >= PinManager.MAX_ATTEMPTS) {
            pinResetBtn.style.display = 'block';
            const inputs = pinLockDigits.querySelectorAll('.PinDigits__Input');
            inputs.forEach(i => i.disabled = true);
        }
    }

    // Reset button handler
    pinResetBtn.addEventListener('click', async () => {
        if (confirm(I18n.t('pin.resetConfirm'))) {
            await PinManager.resetAll();
            alert(I18n.t('pin.resetSuccess'));
            pinLock.style.display = 'none';
            mainContent.style.display = 'block';
            await loadProfiles();
        }
    });

    // Load profiles function
    async function loadProfiles() {
        const persons = await Storage.getPersons();

        if (persons.length === 0) {
            personList.innerHTML = `<div class="EmptyState">
                ${I18n.t('popup.emptyState')}
                <button class="EmptyState__Btn" id="add-profiles-btn">${I18n.t('popup.addProfiles')}</button>
            </div>`;
            openOptions.style.display = 'none';
            
            // Add click handler for Add Profiles button
            document.getElementById('add-profiles-btn').addEventListener('click', () => {
                chrome.runtime.openOptionsPage();
            });
        } else {
            personList.innerHTML = '';
            openOptions.style.display = 'block';
            persons.forEach(person => {
                const item = document.createElement('div');
                item.className = 'Popup__PersonItem';

                const info = document.createElement('div');
                info.className = 'Popup__PersonInfo';

                const name = document.createElement('span');
                name.className = 'Popup__PersonName';
                name.textContent = `${person.firstName} ${person.lastName}`;

                const details = document.createElement('span');
                details.className = 'Popup__PersonDetails';
                details.textContent = `${person.passportNo} | ${person.nationality}`;

                info.appendChild(name);
                info.appendChild(details);

                // Click on info area to fill form
                info.addEventListener('click', () => {
                    fillForm(person);
                    window.close();
                });

                const editBtn = document.createElement('button');
                editBtn.className = 'Popup__BtnEdit';
                editBtn.title = I18n.t('popup.editProfile');
                editBtn.textContent = '✏️';
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    chrome.tabs.create({ url: `options.html?edit=${person.id}` });
                });

                item.appendChild(info);
                item.appendChild(editBtn);
                personList.appendChild(item);
            });
        }
    }

    // Send message to content script to fill the form
    const fillForm = (person) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'FILL_FORM', person }, (response) => {
                    if (chrome.runtime.lastError) {
                        alert(I18n.t('popup.error.refresh'));
                        console.error(chrome.runtime.lastError);
                    }
                });
            }
        });
    };

    openOptions.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
});
