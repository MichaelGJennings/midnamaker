"""
Test to verify that note name changes are preserved when switching tabs
and clicking "Edit Note Names" button.
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.asyncio
async def test_note_name_preservation(app_page: Page, helpers):
    """Test that note name changes are preserved across tab switches."""
    
    # Load Alesis D4 device (has note names) and select first patch
    print("Step 1: Loading Alesis D4 device...")
    await helpers.load_test_device_and_patch(app_page, "Alesis", "D4")
    
    # Should now be on patch tab with patch loaded
    await app_page.wait_for_timeout(1000)
    
    # Find the first note name input
    print("Step 2: Finding note name input...")
    note_name_input = app_page.locator('.note-name-input').first
    await expect(note_name_input).to_be_visible(timeout=5000)
    
    # Click to make it editable
    await note_name_input.click()
    await app_page.wait_for_timeout(200)
    
    # Get the original value
    original_value = await note_name_input.input_value()
    print(f"Original note name: {original_value}")
    
    # Change the note name
    print("Step 3: Changing note name...")
    new_value = "TestNote123"
    await note_name_input.fill(new_value)
    
    # Verify the change was made
    current_value = await note_name_input.input_value()
    assert current_value == new_value, f"Expected '{new_value}', got '{current_value}'"
    print(f"✓ Note name changed to: {new_value}")
    
    # Switch to Device tab
    print("Step 4: Switching to Device tab...")
    await app_page.click('[data-testid="tab_device"]')
    await app_page.wait_for_timeout(1000)
    
    # Switch to Patch tab
    print("Step 5: Switching back to Patch tab...")
    await app_page.click('[data-testid="tab_patch"]')
    await app_page.wait_for_timeout(1000)
    
    # Find the same note input field again
    print("Step 6: Verifying note name preservation...")
    note_input_after = app_page.locator('.note-name-input').first
    await note_input_after.wait_for(state='visible')
    
    # Check if the value is preserved
    preserved_value = await note_input_after.input_value()
    
    if preserved_value == new_value:
        print("✅ SUCCESS: Note name change was preserved!")
        assert True
    else:
        print(f"❌ FAILURE: Expected '{new_value}', got '{preserved_value}'")
        # Take a screenshot for debugging
        await app_page.screenshot(path='test_failure.png')
        assert False, f"Note name not preserved. Expected '{new_value}', got '{preserved_value}'"


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_note_name_preservation())
