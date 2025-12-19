document.addEventListener('DOMContentLoaded', async () => {
    const personList = document.getElementById('person-list');
    const openOptions = document.getElementById('open-options');

    // Load persons for selection
    const persons = await Storage.getPersons();

    if (persons.length === 0) {
        personList.innerHTML = '<div class="EmptyState">No saved profiles found.<br>Add them in settings first.</div>';
    } else {
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
            editBtn.title = 'Edit Profile';
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

    // Send message to content script to fill the form
    const fillForm = (person) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'FILL_FORM', person }, (response) => {
                    if (chrome.runtime.lastError) {
                        alert('Error: Please refresh the TM30 form page to enable the extension.');
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
