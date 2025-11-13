# DTD Compliance Enforcement

## Overview

The MIDNAM Maker now automatically enforces DTD compliance when saving files. This prevents the creation of invalid XML structures that don't conform to the MIDINameDocument DTD specification.

## Key DTD Rules Enforced

### 1. NoteNameList Placement
**Rule**: `NoteNameList` elements must be at the `MasterDeviceNames` level, NOT in `ChannelNameSet`.

**DTD Spec**: `ChannelNameSet` can only have **ONE** `(NoteNameList | UsesNoteNameList)?` element (optional).

**Automatic Fix**: If multiple `NoteNameList` elements are found in a `ChannelNameSet`, they are automatically moved to the `MasterDeviceNames` level.

### 2. Element Ordering in ChannelNameSet
**Rule**: Elements in `ChannelNameSet` must follow this specific order:
1. `AvailableForChannels` (required, first)
2. `(NoteNameList | UsesNoteNameList)?` (optional, max 1)
3. `(ControlNameList | UsesControlNameList)?` (optional)
4. `PatchBank+` (required, one or more)

**Automatic Fix**: If elements are in the wrong order (e.g., `PatchBank` before `NoteNameList`), they are automatically reordered to match the DTD spec.

### 3. Note Element Format
**Rule**: `Note` elements must be **EMPTY** (self-closing).

**Correct**:
```xml
<Note Number="60" Name="Middle C" />
```

**Incorrect**:
```xml
<Note Number="60" Name="Middle C"></Note>  <!-- Has content between tags -->
```

## When Compliance Checks Run

The `_ensure_dtd_compliance()` function runs automatically before saving in:

1. **`save_patch()`** - When saving individual patch edits
2. **`save_midnam_structure()`** - When saving the entire MIDNAM structure

## For Developers

### How to Add a New Compliance Rule

1. Edit `_ensure_dtd_compliance()` in `server.py`
2. Add your fix logic to the function
3. Append a description to `fixes_applied[]`
4. Return the count of fixes applied

Example:

```python
def _ensure_dtd_compliance(self, root):
    fixes_applied = []
    
    # Your new fix
    for element in root.findall('.//SomeElement'):
        if needs_fix(element):
            fix_element(element)
            fixes_applied.append(f"Fixed SomeElement")
    
    if fixes_applied:
        print("[DTD Compliance] Applied fixes:")
        for fix in fixes_applied:
            print(f"  - {fix}")
    
    return len(fixes_applied)
```

### Testing Compliance

Run the DTD validation tests:

```bash
# Test all MIDNAM files against DTD
pytest tests/integration/test_dtd_validation.py -v -m dtd

# Test specific validations
pytest tests/integration/test_dtd_validation.py::TestDTDValidation::test_all_midnam_files_validate_against_dtd -v -m dtd
```

## Current Validation Status

As of the last run:
- **Total MIDNAM files**: ~400
- **DTD compliant**: ~396 (99%)
- **Failed validation**: 4 files
  - `TestManufacturer_TestModel.midnam` (test file)
  - `Moog_Slim_Phatty.midnam` (Values element structure)
  - `Novation_Circuit.midnam` (element ordering)
  - `Moog_Grandmother.midnam` (device without patches)

## References

- **DTD Specification**: `/dtd/MIDINameDocument10.dtd`
- **Compliance Function**: `server.py:_ensure_dtd_compliance()`
- **Validation Tests**: `tests/integration/test_dtd_validation.py`
- **Fixed Files**: `patchfiles/Alesis_D4.midnam` (98 html:note elements fixed)

## Test Notes

Of the 400 midnam files that were read in, rewritten out and validated against the DTD, just a couple failed validation.
- Moog Slim Phatty includes a `<Values>` element structure.
- Moog Grandmother has no patches, just controllers.  (Which makes sense, but it's not a valid midnam.)

(I'm not counting the test devices since they are deliberately invalid.)