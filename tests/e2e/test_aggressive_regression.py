"""
Focused regression test for the specific append/save issue
Tests the exact reproduction steps using the test device
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestAppendSaveRegression:
    """Focused test for the specific append/save regression using test device"""
    
    async def test_testdevice_append_save_regression(self, app_page: Page, helpers):
        """
        Test the exact reproduction steps using TestDevice TestModel:
        1. Navigate to TestDevice TestModel
        2. Select "Rock Kit" patch
        3. Scroll to bottom and click the last + button
        4. Enter a new note name and press Enter to commit
        5. Click Save
        6. Reload the "Rock Kit" patch
        7. Verify new note name is there
        8. Teardown: Delete the appended rows and verify cleanup
        """
        
        # Step 1: Navigate to TestDevice TestModel
        await helpers.click_tab(app_page, "manufacturer")
        await helpers.select_manufacturer(app_page, "TestDevice")
        
        # Select TestModel from device table
        device_row = app_page.locator('[data-device="TestModel"]')
        await expect(device_row).to_be_visible()
        await device_row.click()
        await app_page.wait_for_timeout(1000)
        
        # Step 2: Select "Rock Kit" patch
        await helpers.click_tab(app_page, "patch")
        
        # Wait for patch dropdown to be populated
        await app_page.wait_for_timeout(2000)
        
        # Select Rock Kit patch
        patch_selector = app_page.locator("#patch-select")
        await expect(patch_selector).to_be_visible()
        
        # Wait for options to be populated
        await app_page.wait_for_function("() => document.querySelector('#patch-select').options.length > 1")
        
        # Debug: Print available options
        options = await app_page.evaluate("() => Array.from(document.querySelector('#patch-select').options).map(opt => opt.text)")
        print(f"Available patch options: {options}")
        
        await patch_selector.select_option("Rhythm - Rock Kit")
        await app_page.wait_for_timeout(1000)
        
        # Step 3: Navigate to note editor (should be in patch tab)
        # Verify we're in the note editor
        notes_grid = app_page.locator("#note-table-body")
        await expect(notes_grid).to_be_visible()
        
        # Scroll to bottom
        await app_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await app_page.wait_for_timeout(500)
        
        # Find the last row and click its + button
        rows = app_page.locator("#note-table-body tr")
        row_count = await rows.count()
        assert row_count > 0, "Should have at least one note row"
        
        last_row = rows.nth(row_count - 1)
        add_button = last_row.locator(".add-note-btn")
        await expect(add_button).to_be_visible()
        await add_button.click()
        await app_page.wait_for_timeout(500)
        
        # Step 4: Enter a new note name and press Enter to commit
        new_row_count = await rows.count()
        assert new_row_count == row_count + 1, f"Expected {row_count + 1} rows, got {new_row_count}"
        
        new_row = rows.nth(new_row_count - 1)
        note_name_input = new_row.locator(".note-name-input")
        await expect(note_name_input).to_be_visible()
        
        # Use a unique note name with timestamp to avoid conflicts
        import time
        test_note_name = f"Regression Test Note {int(time.time())}"
        await note_name_input.fill(test_note_name)
        await note_name_input.press("Enter")
        await app_page.wait_for_timeout(500)
        
        # Debug: Verify the note was added to the DOM
        all_notes_before_save = await app_page.evaluate("() => Array.from(document.querySelectorAll('.note-name-input')).map(input => input.value)")
        print(f"Notes before save: {all_notes_before_save[-5:]}")  # Last 5 notes
        assert test_note_name in all_notes_before_save, f"Test note '{test_note_name}' not found in DOM before save"
        
        # Step 5: Click Save
        save_button = app_page.locator("#save-patch")
        await expect(save_button).to_be_visible()
        
        # Listen for dialog (alert) messages
        dialog_message = None
        async def dialog_handler(dialog):
            nonlocal dialog_message
            dialog_message = dialog.message
            print(f"Dialog: {dialog.type} - {dialog.message}")
            await dialog.accept()
        
        app_page.on("dialog", dialog_handler)
        
        await save_button.click()
        
        # Wait for save to complete and check for any error messages
        await app_page.wait_for_timeout(2000)
        
        # Print the dialog message if one appeared
        if dialog_message:
            print(f"Save result: {dialog_message}")
        else:
            print("No dialog appeared after save")
        
        # Check if there are any error messages
        error_messages = await app_page.evaluate("() => Array.from(document.querySelectorAll('.error, .alert')).map(el => el.textContent)")
        if error_messages:
            print(f"Error messages after save: {error_messages}")
        
        # Check console logs for save-related messages
        console_logs = await app_page.evaluate("() => window.consoleLogs || []")
        save_logs = [log for log in console_logs if 'save' in log.lower() or 'error' in log.lower()]
        if save_logs:
            print(f"Save-related console logs: {save_logs}")
        
        # Step 6: Reload the "Rock Kit" patch
        await patch_selector.select_option("Rhythm - Rock Kit")
        await app_page.wait_for_timeout(1000)
        
        # Step 7: Verify new note name is there
        await app_page.wait_for_timeout(1000)
        
        # Scroll to bottom to see the last notes
        await app_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await app_page.wait_for_timeout(500)
        
        # Debug: Print all visible note names
        all_note_inputs = await app_page.evaluate("() => Array.from(document.querySelectorAll('.note-name-input')).map(input => input.value)")
        print(f"All visible note names: {all_note_inputs[-10:]}")  # Last 10 notes
        
        # Verify our test note name is in the list
        assert test_note_name in all_note_inputs, f"Test note '{test_note_name}' not found in saved notes. Found: {all_note_inputs[-10:]}"
        
        # Verify the last note has our test note name
        all_notes = app_page.locator(".note-name-input")
        note_count = await all_notes.count()
        last_note = all_notes.nth(note_count - 1)
        await expect(last_note).to_be_visible()
        last_note_value = await last_note.input_value()
        assert last_note_value == test_note_name, f"Expected last note to be '{test_note_name}', got '{last_note_value}'"
        
        # Step 8: Teardown - Delete the appended rows and verify cleanup
        await self._teardown_test_notes(app_page, test_note_name)
    
    async def _teardown_test_notes(self, app_page: Page, test_note_name: str):
        """Teardown: Delete test notes and verify they are removed from the file"""
        
        # Find the test note by iterating through all inputs and checking their values
        all_notes = app_page.locator(".note-name-input")
        note_count = await all_notes.count()
        test_note_index = -1
        
        for i in range(note_count):
            note_input = all_notes.nth(i)
            value = await note_input.input_value()
            if value == test_note_name:
                test_note_index = i
                break
        
        assert test_note_index >= 0, f"Test note '{test_note_name}' not found in note list for deletion"
        
        # Get the test note input and find its row
        test_note_input = all_notes.nth(test_note_index)
        await expect(test_note_input).to_be_visible()
        
        # Find the row containing the test note using evaluate to traverse DOM
        test_row = await app_page.evaluate(f"""
            () => {{
                const inputs = Array.from(document.querySelectorAll('.note-name-input'));
                const testInput = inputs[{test_note_index}];
                return testInput ? testInput.closest('tr') !== null : false;
            }}
        """)
        assert test_row, "Could not find row containing test note"
        
        # Get the remove button for this row
        remove_button = app_page.locator("#note-table-body tr").nth(test_note_index).locator(".remove-note-btn")
        await expect(remove_button).to_be_visible()
        
        # Click the remove button
        await remove_button.click()
        await app_page.wait_for_timeout(500)
        
        # Confirm deletion if there's a confirmation dialog
        try:
            # Check if there's a confirmation dialog
            confirm_dialog = app_page.locator("text=Remove this note?")
            if await confirm_dialog.is_visible():
                await app_page.locator("button:has-text('OK')").click()
                await app_page.wait_for_timeout(500)
        except:
            pass  # No confirmation dialog
        
        # Save the changes
        save_button = app_page.locator("#save-patch")
        await save_button.click()
        await app_page.wait_for_timeout(2000)
        
        # Clear any pending changes and force a fresh reload
        await app_page.evaluate("""
            () => {
                // Clear all pending changes
                if (window.pendingChanges) {
                    window.pendingChanges.noteData.clear();
                    window.pendingChanges.hasUnsavedChanges = false;
                    window.pendingChanges.lastModified = null;
                    console.log('Cleared all pending changes');
                }
                
                // Force reload the patch by clearing the note editor and reloading
                const container = document.getElementById('patch-editor-container');
                if (container) {
                    container.innerHTML = '<div class="loading">Reloading patch...</div>';
                }
            }
        """)
        await app_page.wait_for_timeout(500)
        
        # Now reload the patch notes
        await self._reload_rock_kit_notes(app_page)
        
        # Verify the test note is no longer present by checking all input values
        all_note_values = await app_page.evaluate("() => Array.from(document.querySelectorAll('.note-name-input')).map(input => input.value)")
        assert test_note_name not in all_note_values, f"Test note '{test_note_name}' still present after deletion"
        
        # Verify we're back to the original number of notes
        all_notes = app_page.locator(".note-name-input")
        note_count = await all_notes.count()
        # Rock Kit should have 46 notes (copied from Alesis D4 Aggressive)
        assert note_count == 46, f"Expected 46 notes after cleanup, got {note_count}"
    
    async def _reload_rock_kit_notes(self, app_page: Page):
        """Helper method to reload Rock Kit note editor"""
        # Reload the Rock Kit patch
        patch_selector = app_page.locator("#patch-select")
        await patch_selector.select_option("Rhythm - Rock Kit")
        await app_page.wait_for_timeout(1000)
