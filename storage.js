// Storage module for TM30 Helper
// Provides async API for working with chrome.storage.local

const Storage = {
    async getPersons() {
        return new Promise(resolve => {
            chrome.storage.local.get(['persons'], (result) => {
                resolve(result.persons || []);
            });
        });
    },

    async savePersons(persons) {
        return new Promise(resolve => {
            chrome.storage.local.set({ persons }, resolve);
        });
    },

    async savePerson(person, existingId = null) {
        const persons = await this.getPersons();

        if (existingId) {
            const index = persons.findIndex(p => p.id == existingId);
            if (index !== -1) {
                persons[index] = { ...persons[index], ...person };
            }
        } else {
            persons.push({ id: Date.now(), ...person });
        }

        await this.savePersons(persons);
        return persons;
    },

    async deletePerson(id) {
        const persons = await this.getPersons();
        const updatedPersons = persons.filter(p => p.id !== id);
        await this.savePersons(updatedPersons);
        return updatedPersons;
    },

    async getPersonById(id) {
        const persons = await this.getPersons();
        return persons.find(p => p.id == id) || null;
    }
};
