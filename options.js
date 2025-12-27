document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n
    await I18n.init();

    // PIN Lock Elements
    const pinLock = document.getElementById('pin-lock');
    const mainContent = document.getElementById('main-content');
    const pinError = document.getElementById('pin-error');
    const pinAttempts = document.getElementById('pin-attempts');
    const pinResetBtn = document.getElementById('pin-reset-btn');

    // Security Settings Elements
    const pinSetup = document.getElementById('pin-setup');
    const pinManage = document.getElementById('pin-manage');
    const newPinDigits = document.getElementById('new-pin-digits');
    const confirmPinDigits = document.getElementById('confirm-pin-digits');
    const setPinBtn = document.getElementById('set-pin-btn');
    const changePinBtn = document.getElementById('change-pin-btn');
    const removePinBtn = document.getElementById('remove-pin-btn');

    // Initialize digit inputs - new PIN focuses to confirm PIN when complete
    if (newPinDigits) {
        PinUI.setupDigitInputs(newPinDigits, {
            onComplete: () => {
                if (confirmPinDigits) {
                    PinUI.focusFirst(confirmPinDigits);
                }
            }
        });
    }
    if (confirmPinDigits) {
        PinUI.setupDigitInputs(confirmPinDigits);
    }

    // Check if PIN is enabled and show lock screen or main content
    const pinEnabled = await PinManager.isPinEnabled();
    const sessionValid = await PinManager.isSessionValid();
    const pinLockDigits = document.getElementById('pin-lock-digits');
    
    // Setup digit inputs with auto-submit using shared PinUI
    // This must be done before showing lock screen so handlers are always attached
    if (pinLockDigits) {
        PinUI.setupDigitInputs(pinLockDigits, {
            autoSubmit: true,
            onComplete: async (pin) => {
                const isValid = await PinManager.verifyPin(pin);
                
                if (isValid) {
                    pinLock.style.display = 'none';
                    mainContent.style.display = 'block';
                } else {
                    const attempts = await PinManager.incrementAttempts();
                    PinUI.clearDigits(pinLockDigits);
                    pinError.style.display = 'block';
                    updateAttemptsDisplay(attempts);
                    
                    PinUI.shake(pinLockDigits);
                    PinUI.focusFirst(pinLockDigits);
                }
            }
        });
    }
    
    if (pinEnabled && !sessionValid) {
        pinLock.style.display = 'flex';
        mainContent.style.display = 'none';
        
        // Focus first input
        PinUI.focusFirst(pinLockDigits);
        
        const attempts = await PinManager.getAttempts();
        updateAttemptsDisplay(attempts);
    } else {
        pinLock.style.display = 'none';
        mainContent.style.display = 'block';
    }

    // Activity-based session management with debounce
    if (pinEnabled) {
        let sessionCheckInterval;
        let activityDebounceTimeout;
        
        // Extend session on user activity (debounced to avoid excessive storage calls)
        const extendSession = () => {
            if (activityDebounceTimeout) return;
            activityDebounceTimeout = setTimeout(() => {
                if (mainContent.style.display !== 'none') {
                    PinManager.startSession();
                }
                activityDebounceTimeout = null;
            }, PinManager.ACTIVITY_DEBOUNCE_DELAY);
        };
        
        // Listen for user activity events
        ['click', 'keydown', 'input', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, extendSession, { passive: true });
        });
        
        // Periodically check if session expired (when user is idle)
        sessionCheckInterval = setInterval(async () => {
            const stillValid = await PinManager.isSessionValid();
            if (!stillValid && mainContent.style.display !== 'none') {
                // Session expired after inactivity, show lock screen
                pinLock.style.display = 'flex';
                mainContent.style.display = 'none';
                PinUI.clearDigits(pinLockDigits);
                pinError.style.display = 'none';
                PinUI.focusFirst(pinLockDigits);
            }
        }, PinManager.SESSION_CHECK_INTERVAL);
        
        // Cleanup on page unload to prevent memory leaks
        window.addEventListener('beforeunload', () => {
            if (sessionCheckInterval) {
                clearInterval(sessionCheckInterval);
            }
            if (activityDebounceTimeout) {
                clearTimeout(activityDebounceTimeout);
            }
        });
    }

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

    // Lock timeout select
    const lockTimeoutSelect = document.getElementById('lock-timeout-select');

    // Update security settings UI
    const pinStatusBadge = document.getElementById('pin-status-badge');
    
    async function updateSecurityUI() {
        const enabled = await PinManager.isPinEnabled();
        if (enabled) {
            pinSetup.style.display = 'none';
            pinManage.style.display = 'block';
            
            // Update badge
            pinStatusBadge.className = 'Options__Badge Options__Badge_enabled';
            pinStatusBadge.textContent = I18n.t('options.security.badgeEnabled');
            
            // Load current timeout value
            const currentTimeout = await PinManager.getLockTimeout();
            lockTimeoutSelect.value = currentTimeout.toString();
        } else {
            pinSetup.style.display = 'block';
            pinManage.style.display = 'none';
            
            // Update badge
            pinStatusBadge.className = 'Options__Badge Options__Badge_disabled';
            pinStatusBadge.textContent = I18n.t('options.security.badgeNotSet');
        }
    }
    updateSecurityUI();

    // Lock timeout change handler
    lockTimeoutSelect.addEventListener('change', async (e) => {
        const timeout = parseInt(e.target.value, 10);
        await PinManager.setLockTimeout(timeout);
    });

    // Language selector
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.value = I18n.currentLanguage;
        languageSelector.addEventListener('change', async (e) => {
            await I18n.setLanguage(e.target.value);
        });
    }

    // Reset button handler
    pinResetBtn.addEventListener('click', async () => {
        if (confirm(I18n.t('pin.resetConfirm'))) {
            await PinManager.resetAll();
            alert(I18n.t('pin.resetSuccess'));
            pinLock.style.display = 'none';
            mainContent.style.display = 'block';
            updateSecurityUI();
            loadPersons();
        }
    });

    // Set PIN button handler
    setPinBtn.addEventListener('click', async () => {
        const newPin = PinUI.getPinFromDigits(newPinDigits);
        const confirmPin = PinUI.getPinFromDigits(confirmPinDigits);

        if (!PinManager.isValidFormat(newPin)) {
            alert(I18n.t('options.security.pinInvalid'));
            return;
        }

        if (newPin !== confirmPin) {
            alert(I18n.t('options.security.pinMismatch'));
            return;
        }

        await PinManager.setPin(newPin);
        alert(I18n.t('options.security.pinSet'));
        PinUI.clearDigits(newPinDigits);
        PinUI.clearDigits(confirmPinDigits);
        updateSecurityUI();
    });

    // Change PIN button handler
    changePinBtn.addEventListener('click', async () => {
        const currentPin = prompt(I18n.t('options.security.currentPin'));
        if (!currentPin) return;

        const isValid = await PinManager.verifyPin(currentPin);
        if (!isValid) {
            alert(I18n.t('options.security.wrongPin'));
            return;
        }

        const newPin = prompt(I18n.t('options.security.newPin'));
        if (!newPin || !PinManager.isValidFormat(newPin)) {
            alert(I18n.t('options.security.pinInvalid'));
            return;
        }

        const confirmPin = prompt(I18n.t('options.security.confirmPin'));
        if (newPin !== confirmPin) {
            alert(I18n.t('options.security.pinMismatch'));
            return;
        }

        await PinManager.setPin(newPin);
        alert(I18n.t('options.security.pinChanged'));
    });

    // Remove PIN button handler
    removePinBtn.addEventListener('click', async () => {
        const currentPin = prompt(I18n.t('options.security.currentPin'));
        if (!currentPin) return;

        const isValid = await PinManager.verifyPin(currentPin);
        if (!isValid) {
            alert(I18n.t('options.security.wrongPin'));
            return;
        }

        await PinManager.removePin();
        alert(I18n.t('options.security.pinRemoved'));
        updateSecurityUI();
    });

    const form = document.getElementById('person-form');
    const personList = document.getElementById('person-list');
    const personIdInput = document.getElementById('personId');
    const submitBtn = document.getElementById('submit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const formTitle = document.getElementById('form-title');

    // Update form state based on edit mode
    const updateFormState = () => {
        if (personIdInput.value) {
            formTitle.textContent = I18n.t('options.formTitle.edit');
            submitBtn.textContent = I18n.t('options.btn.update');
        } else {
            formTitle.textContent = I18n.t('options.formTitle.add');
            submitBtn.textContent = I18n.t('options.btn.save');
        }
    };

    // XSS protection
    const escapeHtml = (text) => {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    };

    // Auto-format birth date DD/MM/YYYY
    const birthDateInput = document.getElementById('birthDate');
    birthDateInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        if (value.length >= 5) {
            value = value.slice(0, 5) + '/' + value.slice(5);
        }
        e.target.value = value.slice(0, 10);
    });

    // Auto-format Check-in Date DD/MM/YYYY
    const checkInDateInput = document.getElementById('checkInDate');
    checkInDateInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        if (value.length >= 5) {
            value = value.slice(0, 5) + '/' + value.slice(5);
        }
        e.target.value = value.slice(0, 10);
    });

    // Auto-format Check-out Date DD/MM/YYYY
    const checkOutDateInput = document.getElementById('checkOutDate');
    checkOutDateInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        if (value.length >= 5) {
            value = value.slice(0, 5) + '/' + value.slice(5);
        }
        e.target.value = value.slice(0, 10);
    });

    // Nationality Autocomplete
    const nationalityInput = document.getElementById('nationality');
    const nationalityCodeInput = document.getElementById('nationalityCode');
    const nationalityDropdown = document.getElementById('nationality-dropdown');
    let activeIndex = -1;
    let currentResults = [];

    const showDropdown = () => {
        nationalityDropdown.classList.add('Options__AutocompleteDropdown_visible');
    };

    const hideDropdown = () => {
        nationalityDropdown.classList.remove('Options__AutocompleteDropdown_visible');
        activeIndex = -1;
    };

    const renderDropdown = (results) => {
        currentResults = results;
        nationalityDropdown.innerHTML = '';

        if (results.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'Options__AutocompleteEmpty';
            empty.textContent = I18n.t('options.noNationality');
            nationalityDropdown.appendChild(empty);
            return;
        }

        results.forEach((item, index) => {
            const option = document.createElement('div');
            option.className = 'Options__AutocompleteItem';
            if (nationalityCodeInput.value === item.code) {
                option.classList.add('Options__AutocompleteItem_selected');
            }
            if (index === activeIndex) {
                option.classList.add('Options__AutocompleteItem_active');
            }

            const codeSpan = document.createElement('span');
            codeSpan.className = 'Options__AutocompleteCode';
            codeSpan.textContent = item.code;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'Options__AutocompleteName';
            nameSpan.textContent = item.name;

            option.appendChild(codeSpan);
            option.appendChild(nameSpan);

            option.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectNationality(item);
            });

            nationalityDropdown.appendChild(option);
        });
    };

    const selectNationality = (item) => {
        nationalityInput.value = `${item.code} : ${item.name}`;
        nationalityCodeInput.value = item.code;
        hideDropdown();
    };

    nationalityInput.addEventListener('focus', () => {
        const query = nationalityInput.value;
        const results = searchNationalities(query);
        renderDropdown(results);
        showDropdown();
    });

    nationalityInput.addEventListener('input', () => {
        activeIndex = -1;
        const query = nationalityInput.value;
        const results = searchNationalities(query);
        renderDropdown(results);
        showDropdown();
        nationalityCodeInput.value = '';
    });

    nationalityInput.addEventListener('blur', () => {
        setTimeout(hideDropdown, 150);
    });

    nationalityInput.addEventListener('keydown', (e) => {
        if (!nationalityDropdown.classList.contains('Options__AutocompleteDropdown_visible')) return;

        const items = nationalityDropdown.querySelectorAll('.Options__AutocompleteItem');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            renderDropdown(currentResults);
            items[activeIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            renderDropdown(currentResults);
            items[activeIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && currentResults[activeIndex]) {
                selectNationality(currentResults[activeIndex]);
            } else if (currentResults.length > 0) {
                selectNationality(currentResults[0]);
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });

    // Load and render persons
    const loadPersons = async () => {
        const persons = await Storage.getPersons();
        renderPersons(persons);
    };

    // Save or Update person
    const savePerson = async (person) => {
        const existingId = personIdInput.value || null;
        await Storage.savePerson(person, existingId);
        resetForm();
        loadPersons();
    };

    // Edit person - Load data into form
    const editPerson = async (id) => {
        const person = await Storage.getPersonById(id);
        if (person) {
            personIdInput.value = person.id;
            document.getElementById('firstName').value = person.firstName;
            document.getElementById('lastName').value = person.lastName;
            document.getElementById('passportNo').value = person.passportNo;
            
            // Set nationality with display value
            const nationality = NATIONALITIES.find(n => n.code === person.nationalityCode);
            if (nationality) {
                nationalityInput.value = `${nationality.code} : ${nationality.name}`;
                nationalityCodeInput.value = nationality.code;
            } else {
                nationalityInput.value = person.nationality || '';
                nationalityCodeInput.value = person.nationalityCode || '';
            }
            
            document.getElementById('gender').value = person.gender;
            document.getElementById('birthDate').value = person.birthDate;
            document.getElementById('phoneNo').value = person.phoneNo || '';
            document.getElementById('checkInDate').value = person.checkInDate || '';
            document.getElementById('checkOutDate').value = person.checkOutDate || '';

            formTitle.textContent = I18n.t('options.formTitle.edit');
            submitBtn.textContent = I18n.t('options.btn.update');
            cancelEditBtn.style.display = 'inline-block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const resetForm = () => {
        form.reset();
        personIdInput.value = '';
        nationalityCodeInput.value = '';
        formTitle.textContent = I18n.t('options.formTitle.add');
        submitBtn.textContent = I18n.t('options.btn.save');
        cancelEditBtn.style.display = 'none';
    };

    // Delete person
    const deletePerson = async (id) => {
        if (!confirm(I18n.t('options.confirm.delete'))) return;
        await Storage.deletePerson(id);
        
        // Reset form if the deleted profile was being edited
        if (personIdInput.value == id) {
            resetForm();
        }
        
        loadPersons();
    };

    // Render list of persons with XSS protection
    const renderPersons = (persons) => {
        if (persons.length === 0) {
            personList.innerHTML = `<p class="EmptyState">${I18n.t('options.emptyState')}</p>`;
            return;
        }

        personList.innerHTML = '';
        persons.forEach(person => {
            const card = document.createElement('div');
            card.className = 'Options__PersonCard';

            const info = document.createElement('div');
            info.className = 'Options__PersonInfo';

            const name = document.createElement('h3');
            name.textContent = `${person.firstName} ${person.lastName}`;

            const details = document.createElement('p');
            details.textContent = `Passport: ${person.passportNo} | Nationality: ${person.nationality}`;

            info.appendChild(name);
            info.appendChild(details);

            const actions = document.createElement('div');
            actions.className = 'Options__PersonActions';

            const editBtn = document.createElement('button');
            editBtn.className = 'Options__BtnEdit';
            editBtn.textContent = I18n.t('options.btn.edit');
            editBtn.addEventListener('click', () => editPerson(person.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'Options__BtnDelete';
            deleteBtn.textContent = I18n.t('options.btn.delete');
            deleteBtn.addEventListener('click', () => deletePerson(person.id));

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            card.appendChild(info);
            card.appendChild(actions);
            personList.appendChild(card);
        });
    };

    // Form submission with validation
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const birthDate = document.getElementById('birthDate').value;
        const birthDateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

        // Only validate birth date format if provided
        if (birthDate && !birthDateRegex.test(birthDate)) {
            alert(I18n.t('options.alert.birthDateFormat'));
            return;
        }

        // Validate nationality selection
        if (!nationalityCodeInput.value) {
            alert(I18n.t('options.alert.selectNationality'));
            nationalityInput.focus();
            return;
        }

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            passportNo: document.getElementById('passportNo').value,
            nationality: nationalityInput.value,
            nationalityCode: nationalityCodeInput.value,
            gender: document.getElementById('gender').value,
            birthDate: birthDate,
            phoneNo: document.getElementById('phoneNo').value,
            checkInDate: document.getElementById('checkInDate').value || '',
            checkOutDate: document.getElementById('checkOutDate').value || ''
        };
        await savePerson(formData);
    });

    // ============================================
    // EXCEL IMPORT/EXPORT FUNCTIONALITY
    // ============================================

    const exportExcelBtn = document.getElementById('export-excel-btn');
    const importExcelBtn = document.getElementById('import-excel-btn');
    const importFileInput = document.getElementById('import-file-input');

    // Excel headers matching immigration template
    const EXCEL_HEADERS = [
        'ชื่อ\nFirst Name *',
        'ชื่อกลาง\nMiddle Name',
        'นามสกุล\nLast Name',
        'เพศ\nGender *',
        'เลขหนังสือเดินทาง\nPassport No. *',
        'สัญชาติ\nNationality *',
        'วัน เดือน ปี เกิด\nBirth Date\nDD/MM/YYYY(ค.ศ. / A.D.) \nเช่น 17/06/1985 หรือ 10/00/1985 หรือ 00/00/1985',
        'วันที่แจ้งออกจากที่พัก\nCheck-out Date\nDD/MM/YYYY(ค.ศ. / A.D.) \nเช่น 14/06/2023',
        'เบอร์โทรศัพท์\nPhone No.'
    ];

    // Export to Excel
    exportExcelBtn.addEventListener('click', async () => {
        const persons = await Storage.getPersons();
        
        if (persons.length === 0) {
            alert(I18n.t('options.alert.noProfiles'));
            return;
        }

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Sheet 1: Main data
        const mainData = [EXCEL_HEADERS];
        persons.forEach(person => {
            mainData.push([
                person.firstName || '',
                '',  // Middle Name
                person.lastName || '',
                person.gender || '',
                person.passportNo || '',
                person.nationalityCode || '',
                person.birthDate || '',
                person.checkOutDate || '',
                person.phoneNo || ''
            ]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(mainData);
        // Set column widths
        ws1['!cols'] = [
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, 'แบบแจ้งที่พัก Inform Accom');

        // Sheet 2: Nationality reference
        const nationalityData = [['', 'icao', 'สัญชาติ(ไทย)', 'สัญชาติ(อังกฤษ)']];
        NATIONALITIES.forEach(n => {
            nationalityData.push(['', n.code, '', n.name]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(nationalityData);
        XLSX.utils.book_append_sheet(wb, ws2, 'สัญชาติ Nationality');

        // Sheet 3: Gender reference
        const genderData = [
            ['', 'GENDER CODE\nรหัสเพศ', 'SEX\nเพศ'],
            ['', 'M', 'ชาย'],
            ['', 'F', 'หญิง']
        ];
        const ws3 = XLSX.utils.aoa_to_sheet(genderData);
        XLSX.utils.book_append_sheet(wb, ws3, 'เพศ Gender ');

        // Generate and download file
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `TM30-Profiles-${today}.xlsx`);
        alert(I18n.t('options.alert.exportSuccess'));
    });

    // Import from Excel
    importExcelBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data);
            
            // Read only first sheet
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            // Skip header row and filter rows with data in first column
            const dataRows = rows.slice(1).filter(row => row[0] && row[0].toString().trim());
            
            // Alert if first sheet is empty
            if (dataRows.length === 0) {
                alert(I18n.t('options.alert.emptySheet'));
                importFileInput.value = '';
                return;
            }
            
            // Helper to parse Excel dates (serial numbers or string formats)
            const parseExcelDate = (value) => {
                if (!value) return '';
                
                // If it's a number (Excel serial date)
                if (typeof value === 'number') {
                    // Excel date: days since 1900-01-01 (with Excel's leap year bug)
                    const date = new Date((value - 25569) * 86400 * 1000);
                    const day = String(date.getUTCDate()).padStart(2, '0');
                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const year = date.getUTCFullYear();
                    return `${day}/${month}/${year}`;
                }
                
                // If it's a string, try to parse various formats
                const str = value.toString().trim();
                
                // Already in DD/MM/YYYY format
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
                    return str;
                }
                
                // Short format: D/M/YY or DD/M/YY or D/MM/YY
                const shortMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
                if (shortMatch) {
                    const day = shortMatch[1].padStart(2, '0');
                    const month = shortMatch[2].padStart(2, '0');
                    let year = parseInt(shortMatch[3]);
                    // Convert 2-digit year: 00-29 = 2000s, 30-99 = 1900s
                    year = year < 30 ? 2000 + year : 1900 + year;
                    return `${day}/${month}/${year}`;
                }
                
                // Medium format: D/M/YYYY or DD/M/YYYY
                const medMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (medMatch) {
                    const day = medMatch[1].padStart(2, '0');
                    const month = medMatch[2].padStart(2, '0');
                    return `${day}/${month}/${medMatch[3]}`;
                }
                
                return str;
            };
            
            let importedCount = 0;
            for (const row of dataRows) {
                const firstName = (row[0] || '').toString().trim();
                const lastName = (row[2] || '').toString().trim();
                const gender = (row[3] || '').toString().trim().toUpperCase();
                const passportNo = (row[4] || '').toString().trim();
                const nationalityCode = (row[5] || '').toString().trim().toUpperCase();
                const birthDate = parseExcelDate(row[6]);
                const checkOutDate = parseExcelDate(row[7]);
                const phoneNo = (row[8] || '').toString().trim();

                // Validate required fields
                if (!firstName || !passportNo) continue;

                // Find nationality display name
                const nationality = NATIONALITIES.find(n => n.code === nationalityCode);
                const nationalityDisplay = nationality 
                    ? `${nationality.code} : ${nationality.name}` 
                    : nationalityCode;

                const person = {
                    firstName,
                    lastName,
                    passportNo,
                    nationality: nationalityDisplay,
                    nationalityCode: nationalityCode || '',
                    gender: gender === 'M' || gender === 'F' ? gender : 'M',
                    birthDate,
                    phoneNo,
                    checkInDate: '',
                    checkOutDate
                };

                await Storage.savePerson(person);
                importedCount++;
            }

            if (importedCount > 0) {
                alert(I18n.t('options.alert.importSuccess').replace('{count}', importedCount));
                loadPersons();
            } else {
                alert(I18n.t('options.alert.importError'));
            }
        } catch (err) {
            console.error('Import error:', err);
            alert(I18n.t('options.alert.importError'));
        }

        // Reset file input
        importFileInput.value = '';
    });

    cancelEditBtn.addEventListener('click', resetForm);

    // Initial load and URL-based edit check
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    await loadPersons();
    if (editId) {
        editPerson(editId);
    }
});
