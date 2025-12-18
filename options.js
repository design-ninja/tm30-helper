document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('person-form');
    const personList = document.getElementById('person-list');
    const personIdInput = document.getElementById('personId');
    const submitBtn = document.getElementById('submit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // Load persons from storage
    const loadPersons = () => {
        chrome.storage.local.get(['persons'], (result) => {
            const persons = result.persons || [];
            renderPersons(persons);
        });
    };

    // Save or Update person to storage
    const savePerson = (person) => {
        chrome.storage.local.get(['persons'], (result) => {
            const persons = result.persons || [];
            const id = personIdInput.value;

            if (id) {
                // Update existing
                const index = persons.findIndex(p => p.id == id);
                if (index !== -1) {
                    persons[index] = { ...persons[index], ...person };
                }
            } else {
                // Add new
                persons.push({ id: Date.now(), ...person });
            }

            chrome.storage.local.set({ persons }, () => {
                resetForm();
                loadPersons();
            });
        });
    };

    // Edit person - Load data into form
    const editPerson = (id) => {
        chrome.storage.local.get(['persons'], (result) => {
            const persons = result.persons || [];
            const person = persons.find(p => p.id == id);
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
        });
    };

    const resetForm = () => {
        form.reset();
        personIdInput.value = '';
        document.getElementById('form-title').innerText = 'Add New Person';
        submitBtn.innerText = 'Save Profile';
        cancelEditBtn.style.display = 'none';
    };

    // Delete person from storage
    const deletePerson = (id) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;
        chrome.storage.local.get(['persons'], (result) => {
            const persons = result.persons || [];
            const updatedPersons = persons.filter(p => p.id !== id);
            chrome.storage.local.set({ persons: updatedPersons }, () => {
                loadPersons();
            });
        });
    };

    // Render list of persons
    const renderPersons = (persons) => {
        if (persons.length === 0) {
            personList.innerHTML = '<p class="empty-msg">No profiles saved yet. Add your first person above.</p>';
            return;
        }

        personList.innerHTML = '';
        persons.forEach(person => {
            const card = document.createElement('div');
            card.className = 'person-card';
            card.innerHTML = `
                <div class="person-info">
                    <h3>${person.firstName} ${person.lastName}</h3>
                    <p>Passport: ${person.passportNo} | Nationality: ${person.nationality}</p>
                </div>
                <div class="person-actions">
                    <button class="btn-edit" data-id="${person.id}">Edit</button>
                    <button class="btn-delete" data-id="${person.id}">Delete</button>
                </div>
            `;
            personList.appendChild(card);
        });

        // Event listeners
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                editPerson(id);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                deletePerson(id);
            });
        });
    };

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            passportNo: document.getElementById('passportNo').value,
            nationality: document.getElementById('nationality').value,
            gender: document.getElementById('gender').value,
            birthDate: document.getElementById('birthDate').value,
            phoneNo: document.getElementById('phoneNo').value
        };
        savePerson(formData);
    });

    cancelEditBtn.addEventListener('click', resetForm);

    // Initial load and URL-based edit check
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    chrome.storage.local.get(['persons'], (result) => {
        const persons = result.persons || [];
        renderPersons(persons);
        if (editId) {
            editPerson(parseInt(editId));
        }
    });
});
