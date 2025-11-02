# MIDI Name Editor Refactoring Summary

## Overview
The monolithic `midi_name_editor.html` file (7,166 lines) has been successfully refactored into a modular, maintainable structure. The refactoring separates concerns into logical modules while preserving all functionality.

## File Structure

### Original Structure
- `midi_name_editor.html` - Single monolithic file (7,166 lines)
  - CSS: Lines 7-1809 (~1,800 lines)
  - HTML: Lines 1810-2035 (~225 lines)
  - JavaScript: Lines 2036-7166 (~5,100 lines)

### New Structure
```
index.html                            # Clean HTML structure with complete data-testid attributes (284 lines)
css/
├── core.css                         # Base styles and layout
├── midi.css                         # MIDI-specific styles
├── manufacturer.css                 # Manufacturer tab styles
├── device.css                       # Device tab styles
├── patch.css                        # Patch tab styles
├── catalog.css                      # Catalog tab styles
└── tools.css                        # Tools tab styles

js/
├── core/
│   ├── app.js                       # Main application logic
│   ├── state.js                     # Global state management
│   └── utils.js                     # Utility functions
├── components/
│   ├── tabs.js                      # Tab navigation component
│   ├── modal.js                     # Modal component
│   └── keyboard.js                  # Keyboard/MIDI component
├── modules/
│   ├── midi.js                      # MIDI functionality
│   ├── manufacturer.js              # Manufacturer management
│   ├── device.js                    # Device management
│   ├── patch.js                     # Patch management
│   └── catalog.js                   # Catalog management
└── main.js                          # Application entry point
```


## Module Descriptions

### Core Modules
- **app.js**: Main application initialization and coordination
- **state.js**: Global state management with MIDI state persistence
- **utils.js**: Common utility functions (formatting, validation, etc.)

### Component Modules
- **tabs.js**: Tab navigation management
- **modal.js**: Modal dialog system with common patterns
- **keyboard.js**: MIDI keyboard input and virtual keyboard

### Feature Modules
- **midi.js**: MIDI device management and communication
- **manufacturer.js**: Manufacturer selection and device listing
- **device.js**: Device configuration and structure editing
- **patch.js**: Patch editing and MIDI testing
- **catalog.js**: Catalog management and analysis

## Migration Guide

### For Users
- Use `index.html` as the primary application entry point
- All functionality remains the same
- Better performance and stability

### For Developers
- Individual modules can be modified independently
- New features can be added as separate modules
- Testing can be done on individual components
- CSS changes are isolated to specific feature files

## Next Steps

1. **Testing**: Comprehensive testing of all modules
2. **Documentation**: API documentation for each module


1) Tab order should only be between the note editing field and the Add/Insert button.  There's no reason to tab to the note number and for safety we don't want to be able to focus the delete row button with the keyboard.
2) In the note field, pressing enter commits the contents of the field unless there is a selection from the dropdown, in which case that entry takes precedence.  In either case the field is to be blurred and the focus moved to the Add/Insert button.
3) The dropdown for the index is populated from the existing note names used in the bank, plus from a list of typical drum names. 
4) New note names get added to the index onBlur (Whether it's by clicking outside the field, or use of the enter or tab keys)
5) Inserting or deleting causes  subsequent notes to be renumbered, preserving the piano styling
6) Default note names when rows are added are the corresponding note on a chromatic piano key, either natural or sharp.  When the new row is created, the default text is selected and ready for replacement.
7) Note numbers also display the piano key name parenthetically.
8) hovering over the note number control reveals a tooltip featuring @kbd.svg that says "Send note <x> (<piano key name>)" unless no MIDI device has been selected.  In that case the tooltip should read "Select a MIDI output device to send MIDI notes"
9) the backround of the rows for the black keys should be tinted a little darker.
10) As you type, the dropdown list gets filtered to the matches.  When it reaches an exact match and the dropdown list contains exactly one item, that item should be selected to indicate that the Enter key will commit a note name that is from the index (i.e. consistent with usage elsewhere in the patch bank)
11) When tabbing to or creating a new row, the page should be scrolled in order to expose a few entries in the dropdown that will appear below the item.
12) When the dropdown is available, the down arrow selects the topmost item in the list, and the bottom arrow selects the last one, revealing it if necessary.  The arrow keys can wrap the list in either direction.
13) The dropdown appears whenever a Note Name field is focused.  It is dismissed if the user hits the Escape key or clicks elsewhere on the page.
Selecting items in the usage dropdown in the Note Name Consistency Tool  should allow the user to jump directly to the instance in the Note Editor.
