"""
Simple test to verify Enter key functionality in Note Editor
"""
import pytest
from playwright.async_api import Page, expect


@pytest.mark.asyncio
async def test_enter_key_simple(app_page: Page, helpers):
    """Test that Enter key moves focus to Add button in note editor"""
    
    # Load Alesis D4 device (has note names) and select first patch
    await helpers.load_test_device_and_patch(app_page, "Alesis", "D4")
    
    # Should now be on patch tab with patch loaded
    await app_page.wait_for_timeout(1000)
    
    # Verify patch content is loaded (not empty state)
    empty_state = app_page.locator('[data-testid="msg_patch_empty"]')
    await expect(empty_state).not_to_be_visible()
    
    # Verify patch content area exists and has content
    patch_content = app_page.locator('#patch-content')
    await expect(patch_content).to_be_visible()
    
    # Find the first note name input
    note_name_input = app_page.locator('.note-name-input').first
    await expect(note_name_input).to_be_visible(timeout=5000)
    
    # Click on the input to focus it and potentially make it editable
    await note_name_input.click()
    await app_page.wait_for_timeout(200)
    
    # Check if it's now editable by checking readonly attribute
    is_readonly = await note_name_input.get_attribute('readonly')
    print(f"After click - readonly: {is_readonly}")
    
    # If still readonly, try double-clicking
    if is_readonly is not None:
        await note_name_input.dblclick()
        await app_page.wait_for_timeout(200)
        is_readonly = await note_name_input.get_attribute('readonly')
        print(f"After double-click - readonly: {is_readonly}")
    
    # Now try to edit - use fill instead of clear+fill since it handles readonly better
    await note_name_input.fill("New Test Note")
    
    # Press Enter key
    await note_name_input.press("Enter")
    
    # Wait for focus change
    await app_page.wait_for_timeout(200)
    
    # Check what element has focus
    focused_class = await app_page.evaluate("document.activeElement.className")
    focused_id = await app_page.evaluate("document.activeElement.id")
    
    print(f"Focused element after Enter - class: {focused_class}, id: {focused_id}")
    
    # Verify focus moved to a button (could be add-note-btn or insert-btn)
    is_button = "btn" in focused_class
    is_add_or_insert = "add-note-btn" in focused_class or "insert-btn" in focused_id or "add-note-btn" in focused_id
    
    assert is_button and is_add_or_insert, \
        f"Expected focus on Add/Insert button, but got class: {focused_class}, id: {focused_id}"
    
    print(f"✅ Enter key successfully moved focus to button: {focused_id}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_enter_key_simple())
