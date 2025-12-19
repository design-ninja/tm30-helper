document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('person-form');
    const personList = document.getElementById('person-list');
    const personIdInput = document.getElementById('personId');
    const submitBtn = document.getElementById('submit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit');

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
            empty.textContent = 'No nationality found';
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
            document.getElementById('numberOfNights').value = person.numberOfNights || '';

            document.getElementById('form-title').innerText = 'Edit Profile';
            submitBtn.innerText = 'Update Profile';
            cancelEditBtn.style.display = 'inline-block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const resetForm = () => {
        form.reset();
        personIdInput.value = '';
        nationalityCodeInput.value = '';
        document.getElementById('form-title').innerText = 'Add New Person';
        submitBtn.innerText = 'Save Profile';
        cancelEditBtn.style.display = 'none';
    };

    // Delete person
    const deletePerson = async (id) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;
        await Storage.deletePerson(id);
        loadPersons();
    };

    // Render list of persons with XSS protection
    const renderPersons = (persons) => {
        if (persons.length === 0) {
            personList.innerHTML = '<p class="EmptyState">No profiles saved yet. Add your first person above.</p>';
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
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => editPerson(person.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'Options__BtnDelete';
            deleteBtn.textContent = 'Delete';
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

        if (!birthDateRegex.test(birthDate)) {
            alert('Please enter birth date in DD/MM/YYYY format');
            return;
        }

        // Validate nationality selection
        if (!nationalityCodeInput.value) {
            alert('Please select a nationality from the list');
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
            numberOfNights: document.getElementById('numberOfNights').value || ''
        };
        await savePerson(formData);
    });

    cancelEditBtn.addEventListener('click', resetForm);

    // Initial load and URL-based edit check
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    await loadPersons();
    if (editId) {
        editPerson(parseInt(editId));
    }
});
