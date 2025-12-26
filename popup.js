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

    // Check if PIN is enabled and if session is valid
    const pinEnabled = await PinManager.isPinEnabled();
    const sessionValid = await PinManager.isSessionValid();
    
    if (pinEnabled && !sessionValid) {
        // Show PIN lock screen
        pinLock.style.display = 'flex';
        mainContent.style.display = 'none';
        
        // Setup digit inputs with auto-submit using shared PinUI
        PinUI.setupDigitInputs(pinLockDigits, {
            autoSubmit: true,
            onComplete: async (pin) => {
                const isValid = await PinManager.verifyPin(pin);
                
                if (isValid) {
                    // Unlock
                    pinLock.style.display = 'none';
                    mainContent.style.display = 'block';
                    await loadProfiles();
                } else {
                    // Wrong PIN
                    const attempts = await PinManager.incrementAttempts();
                    PinUI.clearDigits(pinLockDigits);
                    pinError.style.display = 'block';
                    updateAttemptsDisplay(attempts);
                    
                    // Shake animation
                    PinUI.shake(pinLockDigits);
                    
                    // Focus first input
                    PinUI.focusFirst(pinLockDigits);
                }
            }
        });
        
        // Focus first input
        PinUI.focusFirst(pinLockDigits);
        
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
            PinUI.disableInputs(pinLockDigits);
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
