"""
Test to verify that the Alesis D4 Aggressive patch shows all 61 notes instead of just 46.
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestAlesisD4NoteCount:
    """Test that Alesis D4 Aggressive shows correct note count"""
    
    async def test_alesis_d4_aggressive_note_count(self, app_page: Page, helpers):
        """
        Test that the Alesis D4 Aggressive patch shows all 61 notes, not just 46.
        
        Steps:
        1. Navigate to Alesis D4
        2. Select Aggressive patch
        3. Verify note count is 61, not 46
        """
        
        # Step 1: Navigate to Alesis D4
        await helpers.click_tab(app_page, "manufacturer")
        await app_page.wait_for_timeout(500)
        
        # Use manufacturer input to find Alesis
        manufacturer_input = app_page.locator('#manufacturer-input')
        await manufacturer_input.click()
        await manufacturer_input.clear()
        await manufacturer_input.fill('Alesis')
        await app_page.wait_for_timeout(500)
        
        # Click on Alesis manufacturer option
        manufacturer_options = app_page.locator('.manufacturer-option').filter(has_text='Alesis')
        await expect(manufacturer_options).to_be_visible()
        await manufacturer_options.first.click()
        await app_page.wait_for_timeout(1000)
        
        # Select D4 from device table
        device_row = app_page.locator('[data-device="D4"]')
        await expect(device_row).to_be_visible()
        await device_row.click()
        await app_page.wait_for_timeout(1000)
        
        # Step 2: Select Aggressive patch
        await helpers.click_tab(app_page, "patch")
        await app_page.wait_for_timeout(1000)
        
        # Select Aggressive patch from dropdown
        patch_selector = app_page.locator("#patch-select")
        await expect(patch_selector).to_be_visible()
        
        # Wait for options to be populated
        await app_page.wait_for_function("() => document.querySelector('#patch-select').options.length > 1")
        
        # Debug: Print available options
        options = await app_page.evaluate("() => Array.from(document.querySelector('#patch-select').options).map(opt => opt.text)")
        print(f"Available patch options: {options}")
        
        # Find and select the Aggressive patch
        aggressive_option = None
        for option_text in options:
            if 'Aggressive' in option_text:
                aggressive_option = option_text
                break
        
        assert aggressive_option, "Aggressive patch not found in options"
        await patch_selector.select_option(aggressive_option)
        await app_page.wait_for_timeout(1000)
        
        # Step 3: Verify note count is 61, not 46
        # Wait for note editor to load
        notes_grid = app_page.locator("#note-table-body")
        await expect(notes_grid).to_be_visible()
        await app_page.wait_for_timeout(1000)
        
        # Count the actual notes displayed
        note_inputs = app_page.locator(".note-name-input")
        note_count = await note_inputs.count()
        
        print(f"Found {note_count} notes in Aggressive patch")
        
        # The Aggressive patch should have 61 notes, not 46
        assert note_count == 61, f"Expected 61 notes in Aggressive patch, got {note_count}"
        
        # Additional verification: check that we can see notes at the end
        if note_count > 0:
            last_note = note_inputs.nth(note_count - 1)
            last_note_value = await last_note.input_value()
            print(f"Last note: '{last_note_value}'")
            
            # The last note should be one of the higher-numbered notes
            assert last_note_value, "Last note should have a value"
