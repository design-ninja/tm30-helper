// Utility functions for TM30 Helper

// Delay constants for form interactions
const DELAYS = {
    SHORT: 100,
    MEDIUM: 300,
    SELECT_ANIMATION: 600,
    FIELD_LOAD: 800,
    AUTOCOMPLETE: 1500
};

// Promise-based delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// XSS protection: escape HTML entities
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Validate birth date format DD/MM/YYYY
function validateBirthDate(date) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = date.match(regex);
    if (!match) return false;
    const [, d, m, y] = match;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    return day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900 && year <= new Date().getFullYear();
}
