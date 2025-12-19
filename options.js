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
            document.getElementById('nationality').value = person.nationality;
            document.getElementById('gender').value = person.gender;
            document.getElementById('birthDate').value = person.birthDate;
            document.getElementById('phoneNo').value = person.phoneNo || '';

            document.getElementById('form-title').innerText = 'Edit Profile';
            submitBtn.innerText = 'Update Profile';
            cancelEditBtn.style.display = 'inline-block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const resetForm = () => {
        form.reset();
        personIdInput.value = '';
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

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            passportNo: document.getElementById('passportNo').value,
            nationality: document.getElementById('nationality').value,
            gender: document.getElementById('gender').value,
            birthDate: birthDate,
            phoneNo: document.getElementById('phoneNo').value
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
