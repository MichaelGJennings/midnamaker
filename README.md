# MIDI Name Editor

A comprehensive web-based editor for creating and editing MIDI Name Documents (.midnam files) and MIDI Device Types (.middev files). This tool provides an intuitive interface for managing MIDI device configurations, patch names, and note mappings. In some DAWs (notably Pro Tools and Digital Performer), these files provide automatic access to patch banks and individual patch names within the DAW.  Pro Tools even shows you individual note names in piano roll editors (think drum kits or noteswitches). (Hey MOTU! Add support for this!)

I've used this tool to add note name lists for the Alesis D4.  If you're using that with a supported DAW, you're welcome to install it into your system.

## Features

Existing midnam and middev files can be dropped into the `patchlist` directory and will be cataloged at app startup.  You can select from a list of manufacturers, and it will display device names from the middev files that have corresponding midnam files.  You can add new devices and define new patch lists.

After selecting the device, you'll see patch bank lists and other items from the midnam file.  At this point you may wish to select your device from the MIDI menu in the upper right. (See list of supported browsers below.)  This adds a few convenience features detailed below.

When selecting a bank, a list of the patches in that bank will be expanded. You can add or edit patches, and add or edit note name lists for when you want to see individual note names in Pro Tools.  When editing note lists you can add, insert or delete items, and enter or update their names.  A dropdown will allow you to select names that have already been used elsewhere in the patch bank.  Note numbers corresponding to black keys are displayed as white on black to more easily correlate with a keyboard controller.

If you have set your output device to your MIDI device, clicing the note number will send that note number, which is super helpful for double-checking that, for example, the drums are what you think they are, or even for auditioning sounds. 

Save your changes with the button at the bottom. A backup of the old version of the file wil be created in the directory. 

The Tools tab contains a "Note Name Consistency Tool" which can be used to control what appears in the note name field dropdown.  You can delete items that you don't want to see in the dropdowns here, but it's important to note that if the item is used somewhere, it will come back the next time you edit that device bank.  To fix that, select the item in the tool and a popup will appear.  If it's unused, you can delete it, otherwise you can jump to the Note Name editor where it's used and fix it there.  This is a good way to ensure consistency if that matters to you.

## Getting Started

This is a web application meant to be run locally on your machine, and you will need to install Python 3.6 or later to run it.  Here are further details:

### Prerequisites
- Python 3.6 or higher
- Modern web browser with WebMIDI support (Chrome, Edge, Opera) (optional -- this is just for MIDI convenience features)

### Installation

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd midnams
   ```

2. **Start the server**
   ```bash
   python3 server.py
   ```

3. **Open the editor**
   Navigate to: http://localhost:8000/index.html

## Usage Guide

### 1. Manufacturer Selection
- Use the search box to filter manufacturers
- Click on a manufacturer to select it
- The system will automatically load the manufacturer's devices list based on the contents of the manufacturer .middev file.

### 2. Device Configuration
- Select from existing devices or create a new one
- If there is already a midnam file for the device in the `patchlist` directory it will be loaded and ready for editing.
- Optionally, set the MIDI output device to your device (list is provided on Mac via Audio/MIDI Setup) for some convenience features.

### 3. Structure Editing
- Configure Channel Name Sets
- Add and manage Patch Banks
- Create Note Name Lists for drum machines
- Validate XML structure in real-time

### 4. Note Name Editing
- When you see a patch, use the button labeled "Edit Note Names" or "Add Note Names"
- Clicking the 

## File Formats

### MIDINameDocument (.midnam)
XML files that define how MIDI devices are named and organized in DAWs. Contains:
- Channel Name Sets
- Patch Banks and Patches
- Note Name Lists
- Control Name Lists

### MIDIDeviceTypes (.middev)
XML files that define MIDI device capabilities and specifications. Contains:
- Device identification (Manufacturer ID, Family, Member)
- MIDI capabilities (Notes, Program Changes, etc.)
- Channel configurations
- Device type classifications

## Supported DAWs

MIDI Name Documents are primarily supported by:
- **Avid Pro Tools** - Full support for note names and patch names
- **Steinberg Cubase** - Limited support
- **PreSonus Studio One** - Basic support

*Note: Note Names will only appear in a few specific DAWs like Avid Pro Tools. Most DAWs will show generic note numbers.*

## WebMIDI Integration

The editor includes WebMIDI support for:
- MIDI device selection
- Real-time note triggering
- Device connection status
- Program change testing

### Enabling WebMIDI
2. When prompted, grant browser permissions for MIDI access
3. Select your MIDI device from the dropdown
4. Test note triggers by clicking the note numbers in the Note Name editor

## API Documentation

For developers integrating with MIDNAMaker or writing automated tests, comprehensive API documentation is available in the `docs/` folder:

- **[API Specification (OpenAPI/Swagger)](docs/api-spec.yaml)** - Complete REST API reference with request/response schemas

The API provides endpoints for:
- Manufacturer and device catalog management
- MIDNAM and MIDDEV file operations
- Device validation and testing
- Cache management

## Development

### Adding New Manufacturers
1. Add manufacturer data to the server's manufacturer list
2. Create corresponding .middev files in the patchfiles directory
3. Update the manufacturer file mapping in the HTML

### Extending Device Support
1. Create .middev files following the MIDIDeviceTypes DTD (included)
2. Add device-specific .midnam templates
3. Update the device loading logic

### Customizing the Interface
- Modify `index.html` for UI changes
- Update `server.py` for backend functionality

## Troubleshooting

### Server Issues
- **Port 8000 in use**: Kill existing Python processes with `pkill -f python3`
- **File not found**: Ensure you're running from the correct directory
- **Permission errors**: Check file permissions in the patchfiles directory

### WebMIDI Issues
- **MIDI not available**: Use Chrome, Edge, or Opera browser
- **Device not detected**: Check MIDI device drivers and connections
- **Permission denied**: Grant MIDI access in browser settings

### XML Validation
- **DTD errors**: Ensure DTD files are properly referenced
- **Structure errors**: Use the built-in validator in the Structure tab
- **Encoding issues**: Ensure files are saved as UTF-8

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with multiple devices and DAWs
5. Submit a pull request

## License

This project is open source. Please check the license file for details.

## Acknowledgments

- MIDI Manufacturers Association for the DTD specifications
- [StudioCode.dev](https://studiocode.dev/doc/midi-manufacturers/) for manufacturer ID data
- The MIDI community for device definitions and examples
- The [Ardour project](https://github.com/ardour) for their collection of midnam files, which were great for testing
- [Digicake.com](http://digicake.com/midnams) for more files to test with
