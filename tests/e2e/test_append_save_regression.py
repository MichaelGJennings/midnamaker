"""
Test for append/save functionality to prevent regressions
Tests the complete workflow of adding notes and saving them using test device
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestAppendSaveFunctionality:
    """Test append and save functionality to prevent regressions using test device"""
    
    async def test_append_note_and_save_workflow(self, app_page: Page, helpers):
        """Test the complete workflow: select test device, append note, save, reload"""
        
        # Navigate to test device
        await self._navigate_to_test_device(app_page, helpers)
        
        # Navigate to Rock Kit notes
        await self._navigate_to_rock_kit_notes(app_page)
        
        # Get initial row count
        rows = app_page.locator('[data-testid^="row_note_"]')
        initial_count = await rows.count()
        
        # Scroll to bottom and append a note
        await app_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await app_page.wait_for_timeout(500)
        
        last_row = rows.nth(initial_count - 1)
        add_button = last_row.locator('button[data-testid^="btn_insert_note_"]')
        await add_button.click()
        await app_page.wait_for_timeout(500)
        
        # Verify new row was added
        rows = app_page.locator('[data-testid^="row_note_"]')
        new_count = await rows.count()
        assert new_count == initial_count + 1, f"Expected {initial_count + 1} rows, got {new_count}"
        
        # Enter note name
        new_row = rows.nth(new_count - 1)
        note_input = new_row.locator('[data-testid^="npt_note_name_"]')
        test_note_name = "Test Append Note"
        await note_input.fill(test_note_name)
        await note_input.press("Enter")
        await app_page.wait_for_timeout(500)
        
        # Save the patch
        save_button = app_page.get_by_test_id("btn_save_patch")
        await save_button.click()
        await app_page.wait_for_timeout(2000)
        
        # Reload and verify
        await self._reload_jazz_kit_notes(app_page)
        
        # Verify the note is saved
        saved_note = app_page.locator(".note-name-input").filter(has_text=test_note_name)
        await expect(saved_note).to_be_visible()
        
        # Teardown: Clean up the test note
        await self._teardown_test_note(app_page, test_note_name)
    
    async def test_multiple_append_notes_and_save(self, app_page: Page, helpers):
        """Test appending multiple notes and saving them all"""
        
        # Navigate to test device and Standard Kit
        await self._navigate_to_test_device(app_page, helpers)
        await self._navigate_to_standard_kit_notes(app_page)
        
        # Get initial row count
        rows = app_page.locator("#note-table-body tr")
        initial_count = await rows.count()
        
        # Append 3 new notes
        test_notes = ["Test Note 1", "Test Note 2", "Test Note 3"]
        
        for i, note_name in enumerate(test_notes):
            # Scroll to bottom
            await app_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await app_page.wait_for_timeout(300)
            
            # Find last row and click + button
            current_rows = app_page.locator("#note-table-body tr")
            current_count = await current_rows.count()
            last_row = current_rows.nth(current_count - 1)
            
            add_button = last_row.locator(".add-note-btn")
            await add_button.click()
            await app_page.wait_for_timeout(300)
            
            # Enter note name
            new_row = app_page.locator("#note-table-body tr").nth(current_count)
            note_input = new_row.locator(".note-name-input")
            await note_input.fill(note_name)
            await note_input.press("Enter")
            await app_page.wait_for_timeout(300)
        
        # Verify all notes were added
        final_rows = app_page.locator("#note-table-body tr")
        final_count = await final_rows.count()
        expected_count = initial_count + len(test_notes)
        assert final_count == expected_count, f"Expected {expected_count} rows, got {final_count}"
        
        # Save the patch
        save_button = app_page.locator("#save-patch")
        await save_button.click()
        await app_page.wait_for_timeout(2000)
        
        # Reload and verify all notes are saved
        await self._reload_standard_kit_notes(app_page)
        
        # Check that all test notes are present
        for note_name in test_notes:
            saved_note = app_page.locator(".note-name-input").filter(has_text=note_name)
            await expect(saved_note).to_be_visible()
        
        # Teardown: Clean up all test notes
        for note_name in test_notes:
            await self._teardown_test_note(app_page, note_name)
    
    async def test_insert_note_in_middle_and_save(self, app_page: Page, helpers):
        """Test inserting a note in the middle (not at the end) and saving"""
        
        # Navigate to test device and Rock Kit
        await self._navigate_to_test_device(app_page, helpers)
        await self._navigate_to_rock_kit_notes(app_page)
        
        # Get initial row count
        rows = app_page.locator("#note-table-body tr")
        initial_count = await rows.count()
        
        # Find a row in the middle (not the last one)
        middle_index = initial_count // 2
        middle_row = rows.nth(middle_index)
        
        # Click the + button on the middle row
        add_button = middle_row.locator(".add-note-btn")
        await add_button.click()
        await app_page.wait_for_timeout(500)
        
        # Verify a new row was inserted
        new_count = await rows.count()
        assert new_count == initial_count + 1, f"Expected {initial_count + 1} rows, got {new_count}"
        
        # Enter a note name for the inserted note
        inserted_row = rows.nth(middle_index + 1)  # The new row should be after the clicked row
        note_input = inserted_row.locator(".note-name-input")
        await note_input.fill("Inserted Note")
        await note_input.press("Enter")
        await app_page.wait_for_timeout(500)
        
        # Save the patch
        save_button = app_page.locator("#save-patch")
        await save_button.click()
        await app_page.wait_for_timeout(2000)
        
        # Reload and verify the inserted note is saved
        await self._reload_rock_kit_notes(app_page)
        
        # Look for our inserted note
        inserted_note = app_page.locator(".note-name-input").filter(has_text="Inserted Note")
        await expect(inserted_note).to_be_visible()
        
        # Teardown: Clean up the inserted note
        await self._teardown_test_note(app_page, "Inserted Note")
    
    async def _navigate_to_test_device(self, app_page: Page, helpers):
        """Helper method to navigate to TestManufacturer/TestModel"""
        # Navigate to manufacturer tab and select TestManufacturer
        await helpers.click_tab(app_page, "manufacturer")
        search_input = app_page.locator("#manufacturer-search")
        await search_input.fill("TestManufacturer")
        await app_page.wait_for_timeout(500)
        
        testmanufacturer_option = app_page.locator("#manufacturer-dropdown-list .manufacturer-item").filter(has_text="TestManufacturer")
        await testmanufacturer_option.click()
        
        # Navigate to device tab and select TestModel
        await helpers.click_tab(app_page, "device")
        await app_page.wait_for_timeout(1000)
        
        testmodel_device = app_page.locator(".device-item").filter(has_text="TestModel")
        await testmodel_device.click()
    
    async def _navigate_to_standard_kit_notes(self, app_page: Page):
        """Helper method to navigate to Standard Kit note editor"""
        await app_page.locator("#patch-tab").click()
        await app_page.wait_for_timeout(1000)
        
        rhythm_bank = app_page.locator(".patch-bank").filter(has_text="Rhythm")
        expand_btn = rhythm_bank.locator(".expand-btn")
        await expand_btn.click()
        await app_page.wait_for_timeout(500)
        
        standard_kit_patch = app_page.locator(".patch-item").filter(has_text="Standard Kit")
        edit_btn = standard_kit_patch.locator("button").filter(has_text="Edit Note Names")
        await edit_btn.click()
        
        await app_page.wait_for_timeout(1000)
    
    async def _navigate_to_rock_kit_notes(self, app_page: Page):
        """Helper method to navigate to Rock Kit note editor"""
        await app_page.locator("#patch-tab").click()
        await app_page.wait_for_timeout(1000)
        
        rhythm_bank = app_page.locator(".patch-bank").filter(has_text="Rhythm")
        expand_btn = rhythm_bank.locator(".expand-btn")
        await expand_btn.click()
        await app_page.wait_for_timeout(500)
        
        rock_kit_patch = app_page.locator(".patch-item").filter(has_text="Rock Kit")
        edit_btn = rock_kit_patch.locator("button").filter(has_text="Edit Note Names")
        await edit_btn.click()
        
        await app_page.wait_for_timeout(1000)
    
    async def _navigate_to_jazz_kit_notes(self, app_page: Page):
        """Helper method to navigate to Jazz Kit note editor"""
        await app_page.locator("#patch-tab").click()
        await app_page.wait_for_timeout(1000)
        
        rhythm_bank = app_page.locator(".patch-bank").filter(has_text="Rhythm")
        expand_btn = rhythm_bank.locator(".expand-btn")
        await expand_btn.click()
        await app_page.wait_for_timeout(500)
        
        jazz_kit_patch = app_page.locator(".patch-item").filter(has_text="Jazz Kit")
        edit_btn = jazz_kit_patch.locator("button").filter(has_text="Edit Note Names")
        await edit_btn.click()
        
        await app_page.wait_for_timeout(1000)
    
    async def _reload_standard_kit_notes(self, app_page: Page):
        """Helper method to reload Standard Kit note editor"""
        await app_page.locator("#patch-tab").click()
        await app_page.wait_for_timeout(1000)
        
        rhythm_bank = app_page.locator(".patch-bank").filter(has_text="Rhythm")
        expand_btn = rhythm_bank.locator(".expand-btn")
        await expand_btn.click()
        await app_page.wait_for_timeout(500)
        
        standard_kit_patch = app_page.locator(".patch-item").filter(has_text="Standard Kit")
        edit_btn = standard_kit_patch.locator("button").filter(has_text="Edit Note Names")
        await edit_btn.click()
        
        await app_page.wait_for_timeout(1000)
    
    async def _reload_rock_kit_notes(self, app_page: Page):
        """Helper method to reload Rock Kit note editor"""
        await app_page.locator("#patch-tab").click()
        await app_page.wait_for_timeout(1000)
        
        rhythm_bank = app_page.locator(".patch-bank").filter(has_text="Rhythm")
        expand_btn = rhythm_bank.locator(".expand-btn")
        await expand_btn.click()
        await app_page.wait_for_timeout(500)
        
        rock_kit_patch = app_page.locator(".patch-item").filter(has_text="Rock Kit")
        edit_btn = rock_kit_patch.locator("button").filter(has_text="Edit Note Names")
        await edit_btn.click()
        
        await app_page.wait_for_timeout(1000)
    
    async def _reload_jazz_kit_notes(self, app_page: Page):
        """Helper method to reload Jazz Kit note editor"""
        await app_page.locator("#patch-tab").click()
        await app_page.wait_for_timeout(1000)
        
        rhythm_bank = app_page.locator(".patch-bank").filter(has_text="Rhythm")
        expand_btn = rhythm_bank.locator(".expand-btn")
        await expand_btn.click()
        await app_page.wait_for_timeout(500)
        
        jazz_kit_patch = app_page.locator(".patch-item").filter(has_text="Jazz Kit")
        edit_btn = jazz_kit_patch.locator("button").filter(has_text="Edit Note Names")
        await edit_btn.click()
        
        await app_page.wait_for_timeout(1000)
    
    async def _teardown_test_note(self, app_page: Page, note_name: str):
        """Helper method to delete a test note and verify cleanup"""
        # Find and delete the test note
        test_note_input = app_page.locator(".note-name-input").filter(has_text=note_name)
        await expect(test_note_input).to_be_visible()
        
        # Find the row containing the test note
        test_row = test_note_input.locator("..").locator("..")  # Go up to the tr element
        remove_button = test_row.locator(".remove-note-btn")
        await expect(remove_button).to_be_visible()
        
        # Click the remove button
        await remove_button.click()
        await app_page.wait_for_timeout(500)
        
        # Confirm deletion if there's a confirmation dialog
        try:
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
        
        # Verify the note is deleted by checking it's not visible
        test_note_input = app_page.locator(".note-name-input").filter(has_text=note_name)
        await expect(test_note_input).not_to_be_visible()
