// Content script v1.11 - English logs + Bulletproof injection
console.log('%c TM30 Helper Content Script v1.11 Loaded 🫡 ', 'background: #333; color: #fff; padding: 2px 5px; border-radius: 3px;');

// Debug: Scan for all form controls on page load
function scanFormControls() {
    const controls = Array.from(document.querySelectorAll('[formcontrolname]'))
        .map(el => el.getAttribute('formcontrolname'));
    if (controls.length > 0) {
        console.log('TM30 Helper: Detected FormControls:', controls);
    }
}
scanFormControls();
window.addEventListener('popstate', scanFormControls);
setInterval(scanFormControls, 15000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'FILL_FORM') {
        fillTM30Form(request.person);
        sendResponse({ status: 'received' });
    }
    return true;
});

async function fillTM30Form(person) {
    console.log('TM30 Helper: Starting fill sequence for', person.firstName);
    const [d, m, y] = (person.birthDate || '').split('/');

    // 0. Select Address FIRST
    await delay(300);
    await selectAddress();

    const textFields = [
        { name: 'First Name', val: person.firstName, selectors: ['input[formcontrolname="firstName"]'] },
        { name: 'Last Name', val: person.lastName, selectors: ['input[formcontrolname="familyName"]', 'input[formcontrolname="lastName"]'] },
        { name: 'Passport No.', val: person.passportNo, selectors: ['input[formcontrolname="passportNo"]'] },
        { name: 'Birth Day', val: d, selectors: ['input[formcontrolname="dayOfBirth"]'] },
        { name: 'Birth Month', val: m, selectors: ['input[formcontrolname="monthOfBirth"]'] },
        { name: 'Birth Year', val: y, selectors: ['input[formcontrolname="yearOfBirth"]'] },
        { name: 'Phone No.', val: person.phoneNo, selectors: ['input[formcontrolname="phoneNo"]'] }
    ];

    // 1. Fill standard fields
    for (const field of textFields) {
        const el = findElement(field.selectors);
        if (el) {
            setStandardValue(el, field.val);
            await delay(100);
        }
    }

    // 2. Fill Gender
    await delay(300);
    const genderEl = findElement(['mat-select[formcontrolname="genderCode"]']);
    if (genderEl) {
        await setSelectValue(genderEl, person.gender === 'M' ? 'Male' : 'Female');
    }

    // 3. Fill Nationality (Autocomplete)
    await delay(800);
    const nationEl = findElement(['input[formcontrolname="key"]']);
    if (nationEl) {
        console.log('TM30 Helper: Final step - Nationality');
        await setAutocompleteValue(nationEl, person.nationality);
    }

    console.log('TM30 Helper: Sequence complete');
}

async function selectAddress() {
    console.log('TM30 Helper: Searching for address radio button...');
    
    let radio = document.querySelector('mat-radio-button[sit-element="address-radio"]') || 
                document.querySelector('.style-list-address-cont mat-radio-button') ||
                document.querySelector('mat-radio-button');

    if (radio) {
        console.log('TM30 Helper: Found address radio. Clicking...');
        
        radio.click();
        
        const label = radio.querySelector('label');
        if (label) label.click();

        const input = radio.querySelector('input[type="radio"]');
        if (input) {
            input.click();
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        await delay(300);
    } else {
        console.warn('TM30 Helper: Could not find address radio button!');
    }
}

function findElement(selectors) {
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

function setStandardValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
}

async function setSelectValue(el, value) {
    el.click();
    await delay(600);
    const options = Array.from(document.querySelectorAll('mat-option'));
    const option = options.find(opt => opt.innerText.toLowerCase().includes(value.toLowerCase())) || 
                   options.find(opt => opt.innerText.includes('Male') || opt.innerText.includes('Female'));
    if (option) option.click();
}

async function setAutocompleteValue(el, value) {
    el.focus();
    el.click();
    
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`TM30 Helper: Typing nationality: ${value}`);

    try {
        document.execCommand('insertText', false, value);
    } catch (e) {
        console.warn('TM30 Helper: execCommand failed, falling back to property setter');
        nativeSetter.call(el, value);
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    await delay(1500);
    const options = Array.from(document.querySelectorAll('mat-option, .mat-autocomplete-panel mat-option'));
    console.log(`TM30 Helper: Options found: ${options.length}`);

    const option = options.find(opt => opt.innerText.toLowerCase().includes(value.toLowerCase())) || options[0];
    
    if (option) {
        console.log('TM30 Helper: Clicking option:', option.innerText);
        option.click();
        await delay(200);
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    } else {
        console.error('TM30 Helper: No nationality options appeared!');
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
