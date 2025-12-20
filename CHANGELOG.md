# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2025-12-20

### Added
- Excel export with immigration template format
- Excel import from existing templates
- Check-in Date field in profiles
- Check-out Date field in profiles
- Auto-fill support for Check-in Date on TM30 form

### Technical
- SheetJS (xlsx) library for Excel file handling
- Multi-sheet Excel export matching official template

## [1.1.0] - 2025-12-19

### Added
- Thai language support for the entire interface
- Language selector in options page header
- Internationalization (i18n) module for translations

## [1.0.0] - 2025-12-19

### Added
- Profile management for storing traveler information
- Auto-fill functionality for TM30 forms
- Support for nationality autocomplete
- Gender and date field handling
- Options page for managing profiles
- Popup for quick profile selection

### Technical
- MutationObserver for efficient DOM monitoring
- XSS protection with safe DOM methods
- Birth date validation (DD/MM/YYYY format)
- Shared storage module for data management
