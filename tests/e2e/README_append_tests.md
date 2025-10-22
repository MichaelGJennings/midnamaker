# Append/Save Regression Tests

This directory contains Playwright tests to ensure the append/save functionality has no regressions.

## Test Files

### `test_aggressive_regression.py`
- **Purpose**: Tests the exact reproduction steps for the append/save bug using test device
- **Test**: `test_rock_kit_append_save_regression`
- **Steps**: 
  1. Select manufacturer TestManufacturer
  2. Select TestModel
  3. Expand Rhythm bank
  4. Under "Rock Kit" select Edit Note Names
  5. Scroll to bottom and click the last + button
  6. Enter a new note name and press Enter to commit
  7. Click Save
  8. Repeat setup steps to load the "Rock Kit" note names
  9. Verify new note name is there
  10. Teardown: Delete the appended rows and verify cleanup

### `test_append_save_regression.py`
- **Purpose**: Comprehensive tests for append/save functionality using test device
- **Tests**:
  - `test_append_note_and_save_workflow`: Basic append and save workflow (Jazz Kit)
  - `test_multiple_append_notes_and_save`: Append multiple notes and save (Standard Kit)
  - `test_insert_note_in_middle_and_save`: Insert note in middle (Rock Kit)

## Running the Tests

### Prerequisites
1. Install Playwright: `pip install playwright`
2. Install browsers: `playwright install`
3. Start the server: `python server.py`

### Run All Tests
```bash
python run_append_tests.py
```

### Run Specific Test
```bash
python run_append_tests.py test_rock_kit_append_save_regression
```

### Run with Pytest Directly
```bash
# Run the rock kit regression test
pytest tests/e2e/test_aggressive_regression.py -v

# Run all append/save tests
pytest tests/e2e/test_append_save_regression.py -v

# Run specific test
pytest tests/e2e/test_aggressive_regression.py::TestAppendSaveRegression::test_rock_kit_append_save_regression -v
```

## What the Tests Verify

1. **Append Functionality**: 
   - Clicking the + button on the last row adds a new note at the end
   - The new note gets the correct sequential MIDI note number
   - The note name can be entered and committed with Enter

2. **Save Functionality**:
   - The save button works correctly
   - New notes are persisted to the XML file
   - The save process completes without errors

3. **Load Functionality**:
   - After saving, the notes can be reloaded
   - The saved notes appear in the correct order
   - The note names are preserved correctly

4. **Regression Prevention**:
   - The exact reproduction steps from the bug report work correctly
   - Multiple append operations work correctly
   - Insert operations (middle rows) work correctly

5. **Teardown and Cleanup**:
   - All test notes are automatically deleted after each test
   - File is returned to its original state
   - No test data persists between test runs

## Test Device

The tests use a special test MIDNAM file (`TestManufacturer_TestModel.midnam`) with:
- **Manufacturer**: TestManufacturer
- **Model**: TestModel
- **Two banks**: "Tones" and "Rhythm"
- **Three rhythm patches**: Standard Kit, Rock Kit, Jazz Kit
- **Note name lists**: Each rhythm patch has 81 notes (MIDI notes 36-81)

## Test Data

The tests use unique note names with timestamps to avoid conflicts:
- `Regression Test Note {timestamp}` for the main regression test
- `Test Note 1`, `Test Note 2`, `Test Note 3` for multiple append tests
- `Inserted Note` for middle insertion tests
- All test notes are automatically cleaned up after each test

## Debugging

If tests fail:

1. **Check server is running**: Make sure `python server.py` is running on port 8000
2. **Check browser installation**: Run `playwright install` if needed
3. **Check test output**: Look at the detailed output for specific failure points
4. **Run with debug**: Add `--headed` flag to see browser actions:
   ```bash
   pytest tests/e2e/test_aggressive_regression.py -v --headed
   ```

## Test Maintenance

When modifying the append/save functionality:

1. **Run these tests** to ensure no regressions
2. **Update tests** if the UI changes (selectors, button text, etc.)
3. **Add new test cases** for any new functionality
4. **Keep tests focused** on the specific functionality being tested
