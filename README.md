# MIDI Name Editor

A comprehensive web-based editor for creating and editing MIDI Name Documents (.midnam files) and MIDI Device Types (.middev files). This tool provides an intuitive interface for managing MIDI device configurations, patch names, and note mappings.

## Features

### 🏭 **Manufacturer Selection**
- Browse and search through official MIDI manufacturer IDs
- Integration with [midi-manufacturers npm package](https://studiocode.dev/doc/midi-manufacturers/)
- Automatic device detection from existing .middev files

### 🎛️ **Device Management**
- Load existing device definitions from .middev files
- Create new device configurations
- Support for various device types (Drum Machines, Samplers, Effect Units, etc.)
- Device capability detection (General MIDI, MMC, etc.)

### 🏗️ **Structure Editor**
- Visual editing of MIDI Name Document structure
- Channel Name Set configuration
- Patch Bank management
- Note Name List creation and editing
- Real-time XML validation

### 🎵 **Note Name Editor**
- Intuitive note mapping interface
- Piano-style keyboard visualization
- MIDI note number display with musical note names
- WebMIDI integration for real-time testing
- Bulk editing capabilities
- Export/import functionality

## File Structure

```
midnams/
├── midi_name_editor.html      # Main application interface
├── d4_editor.html            # Legacy D4-specific editor
├── server.py                 # Python HTTP server
├── dtd/                      # XML DTD definitions
│   ├── MIDINameDocument10.dtd
│   └── MIDIDeviceTypes.dtd
├── patchfiles/               # Device definitions and examples
│   ├── Alesis/
│   │   ├── Alesis.middev
│   │   └── D4.midnam
│   ├── Yamaha/
│   ├── Roland/
│   └── ...
└── Alesis/                   # Legacy D4 files
    └── D4.midnam
```

## Getting Started

### Prerequisites
- Python 3.6 or higher
- Modern web browser with WebMIDI support (Chrome, Edge, Opera)

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
   Navigate to: http://localhost:8000/midi_name_editor.html

## Usage Guide

### 1. Manufacturer Selection
- Browse the grid of available manufacturers
- Use the search box to filter manufacturers
- Click on a manufacturer card to select it
- The system will automatically load available devices

### 2. Device Configuration
- Select from existing devices or create a new one
- View device capabilities and MIDI specifications
- Load existing .midnam files for editing

### 3. Structure Editing
- Configure Channel Name Sets
- Add and manage Patch Banks
- Create Note Name Lists for drum machines
- Validate XML structure in real-time

### 4. Note Name Editing
- Switch to the "Note Names" tab
- Edit note mappings with piano-style interface
- Use WebMIDI to test note triggers
- Export configurations for use in DAWs

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
- **Apple Logic Pro** - Basic support
- **PreSonus Studio One** - Basic support

*Note: Note Names will only appear in a few specific DAWs like Avid Pro Tools. Most DAWs will show generic note numbers.*

## WebMIDI Integration

The editor includes WebMIDI support for:
- Real-time note triggering
- Device connection status
- Program change testing
- MIDI device selection

### Enabling WebMIDI
1. Click "Enable MIDI" in the interface
2. Grant browser permissions for MIDI access
3. Select your MIDI device from the dropdown
4. Test note triggers by clicking the piano keys

## API Endpoints

The server provides the following endpoints:

- `GET /manufacturers` - List of MIDI manufacturers
- `GET /patchfiles/*.middev` - Device definition files
- `GET /patchfiles/*.midnam` - MIDI name documents
- `POST /save_d4.php` - Save D4 configuration (legacy)
- `POST /validate_d4.php` - Validate XML structure (legacy)

## Development

### Adding New Manufacturers
1. Add manufacturer data to the server's manufacturer list
2. Create corresponding .middev files in the patchfiles directory
3. Update the manufacturer file mapping in the HTML

### Extending Device Support
1. Create .middev files following the MIDIDeviceTypes DTD
2. Add device-specific .midnam templates
3. Update the device loading logic

### Customizing the Interface
- Modify `midi_name_editor.html` for UI changes
- Update `server.py` for backend functionality
- Add new DTD files in the `dtd/` directory

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

## Version History

- **v2.0** - Complete rewrite with multi-tab interface and manufacturer support
- **v1.0** - Initial D4-specific editor with note name functionality