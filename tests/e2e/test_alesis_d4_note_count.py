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
        
        # Use manufacturer filter to find Alesis
        await helpers.select_manufacturer(app_page, "Alesis")
        await app_page.wait_for_timeout(1000)
        
        # Select D4 from device list
        device_items = app_page.locator('[data-testid^="itm_device_"]')
        d4_item = device_items.filter(has_text='D4')
        await expect(d4_item).to_be_visible()
        await d4_item.click()
        await app_page.wait_for_timeout(2000)  # Wait for device to load and tab switch
        
        # Step 2: Select Aggressive patch
        # Should already be on device tab, find and click "Aggressive" patch
        await app_page.wait_for_timeout(1000)
        
        # Click on Aggressive patch in the device tab
        aggressive_patch = app_page.locator("text=Aggressive").first
        await expect(aggressive_patch).to_be_visible()
        await aggressive_patch.click()
        await app_page.wait_for_timeout(1000)
        
        # Step 3: Verify note count is 61, not 46
        # Wait for note editor to load (should be in patch tab now)
        notes_grid = app_page.get_by_test_id("lst_notes_tbody")
        await expect(notes_grid).to_be_visible()
        await app_page.wait_for_timeout(1000)
        
        # Count the actual notes displayed
        note_inputs = app_page.locator('[data-testid^="npt_note_name_"]')
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
