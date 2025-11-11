# MIDNAM Reload API - Implementation Summary

## Overview

Added a new API endpoint `/api/midnam/reload` that reloads a MIDNAM file from disk, clearing the catalog cache and re-indexing the file. This is particularly useful for testing to verify that saved changes persist.

## Changes Made

### 1. Server-Side (server.py)

#### New Endpoint: POST `/api/midnam/reload`

**Location:** Lines 576-741 in server.py

**Request Body:**
```json
{
  "file_path": "patchfiles/Ensoniq_TS_10_12.midnam",
  "device_id": "Ensoniq|TS-10"  // Optional
}
```

**Response:**
```json
{
  "id": "Ensoniq|TS-10",
  "name": "TS-10",
  "type": "Synthesizer",
  "file_path": "patchfiles/Ensoniq_TS_10_12.midnam",
  "midnam_content": "<?xml version...",
  "custom_device_modes": [...],
  "channel_name_sets": [
    {
      "name": "Name Set 1",
      "available_channels": [...],
      "patch_banks": [...]
    }
  ],
  "patch_banks": [...]
}
```

**What it does:**
1. Clears the `midnam_catalog_cache.json` file to force re-indexing
2. Reads the MIDNAM file fresh from disk
3. Parses and extracts all device information:
   - Custom device modes
   - Channel name sets with available channels
   - Patch banks with MIDI commands
   - All patches with their program change numbers
4. Returns the complete device structure

**Error Responses:**
- `400`: Missing file_path
- `404`: File not found
- `422`: Invalid XML in file
- `500`: Other errors (with traceback)

### 2. Client-Side (js/modules/device.js)

#### New Method: `DeviceManager.reloadDevice()`

**Location:** Lines 1081-1156 in js/modules/device.js

**Usage:**
```javascript
// From browser console or tests:
const reloadedData = await window.deviceManager.reloadDevice();

// Returns the reloaded device data or null on error
```

**What it does:**
1. Validates that a device is loaded
2. Calls the `/api/midnam/reload` API endpoint
3. Updates `appState.currentMidnam` with fresh data
4. Transforms the device data (same as initial load)
5. Re-renders the device configuration UI
6. Marks the state as saved (no unsaved changes)
7. Logs detailed information to the debug console

**Notifications:**
- Success: "Device reloaded successfully"
- Warnings: "No device loaded to reload"
- Errors: "Failed to reload device"

## Use Cases

### 1. Testing Saved Changes

```javascript
// 1. Make changes to a device
await window.deviceManager.addPatchBank();

// 2. Save the changes
await window.deviceManager.saveDevice();

// 3. Reload from disk
const reloaded = await window.deviceManager.reloadDevice();

// 4. Verify changes are present
console.assert(reloaded.patch_banks.length === expectedCount);
```

### 2. Direct API Testing

```bash
# Using curl
curl -X POST http://localhost:8000/api/midnam/reload \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "patchfiles/Ensoniq_TS_10_12.midnam",
    "device_id": "Ensoniq|TS-10"
  }'
```

### 3. Playwright Tests

See `test_reload_example.py` for a complete example that:
1. Loads a device
2. Adds a bank
3. Saves changes
4. Reloads from disk
5. Verifies the bank persists

## Benefits

1. **Testing**: Easily verify that saves work correctly
2. **Debugging**: Reload to see actual file contents without page refresh
3. **Cache Management**: Automatically clears cache to ensure fresh data
4. **Development**: Faster iteration when modifying MIDNAM files externally

## Example Test Script

A complete example test is provided in `test_reload_example.py`:

```bash
# Run the full workflow test
python test_reload_example.py

# Or test the API directly
python test_reload_example.py direct
```

## Debug Console Output

When reloading, you'll see detailed logs:

```
Reloading device from: patchfiles/Ensoniq_TS_10_12.midnam
✓ Device reloaded successfully from: patchfiles/Ensoniq_TS_10_12.midnam
  Found 1 channel name sets
  Found 5 patch banks
```

## Integration with Existing Features

- **Works with**: Save functionality, validation, device switching
- **Clears cache**: Forces catalog re-indexing (same as `/clear_cache`)
- **State management**: Properly updates appState and marks as saved
- **UI updates**: Re-renders device configuration automatically

## API Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/midnam/save` | POST | Save changes to MIDNAM file |
| `/api/midnam/reload` | POST | Reload MIDNAM file from disk |
| `/clear_cache` | POST | Clear catalog cache only |
| `/api/device/{id}` | GET | Load device (may use cached catalog) |

## Bug Fix Included

As part of this work, also fixed a critical bug in `addPatchBank()`:

**Issue**: When adding a new bank, the `channelNameSet` property was not set, causing the bank to be lost when saving.

**Fix**: Lines 1098-1130 in js/modules/device.js now:
1. Determine the correct ChannelNameSet (from existing banks or first available)
2. Create a default ChannelNameSet if none exist
3. Set the `channelNameSet` property on the new bank (line 1154)
4. Log which ChannelNameSet the bank was added to

This ensures new banks are properly saved to the XML file.

## Documentation Updated

- `README.md`: Added `/api/midnam/reload` to API Endpoints section
- `test_reload_example.py`: Complete example test demonstrating usage
- This document: Comprehensive implementation summary

