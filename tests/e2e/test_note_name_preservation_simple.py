"""
Simplified test to verify that note name changes are preserved when switching tabs
and clicking "Edit Note Names" button.
"""

import pytest
from playwright.async_api import async_playwright


@pytest.mark.asyncio
async def test_note_name_preservation_simple():
    """Test that note name changes are preserved across tab switches."""
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            # Step 1: Load the application
            await page.goto('http://localhost:8000/midi_name_editor.html')
            await page.wait_for_load_state('networkidle')
            
            # Step 2: Directly load the D4 MIDNAM file via URL
            print("Step 1: Loading D4 MIDNAM file directly...")
            await page.goto('http://localhost:8000/patchfiles/Alesis/D4.midnam')
            await page.wait_for_timeout(1000)
            
            # Go back to the editor
            await page.goto('http://localhost:8000/midi_name_editor.html')
            await page.wait_for_load_state('networkidle')
            
            # Step 3: Load D4 via manufacturer selection
            print("Step 2: Loading D4 via manufacturer selection...")
            
            # Click on Manufacturer tab
            await page.click('[data-tab="manufacturer"]')
            await page.wait_for_timeout(500)
            
            # Search for Alesis
            await page.fill('#manufacturer-input', 'Alesis')
            await page.wait_for_timeout(1000)
            
            # Click on Alesis manufacturer from dropdown
            await page.click('.manufacturer-option:has-text("Alesis")')
            await page.wait_for_timeout(1000)
            
            # Click on D4 device
            await page.click('.device-table tr:has-text("D4")')
            await page.wait_for_timeout(2000)
            
            # Step 4: Switch to Device tab and find Edit Note Names button
            print("Step 3: Looking for Edit Note Names button...")
            
            # Switch to Device tab
            await page.click('[data-tab="device"]')
            await page.wait_for_timeout(1000)
            
            # Take a screenshot to see what's on the page
            await page.screenshot(path='device_tab_debug.png')
            
            # Look for any button with "Edit" in the text
            edit_buttons = page.locator('button:has-text("Edit")')
            button_count = await edit_buttons.count()
            print(f"Found {button_count} buttons with 'Edit' text")
            
            if button_count > 0:
                # Click the first Edit button
                await edit_buttons.first.click()
                await page.wait_for_timeout(1000)
                
                # Step 5: Enter a new name for a note and commit the change
                print("Step 4: Entering new note name...")
                
                # Find the first note name input field
                note_input = page.locator('.note-name-input').first
                await note_input.wait_for(state='visible', timeout=5000)
                await note_input.click()
                
                # Clear existing text and enter new name
                await note_input.fill('')
                await note_input.type('TestNote123')
                
                # Commit the change by pressing Tab
                await note_input.press('Tab')
                await page.wait_for_timeout(500)
                
                # Verify the change was made
                note_value = await note_input.input_value()
                assert note_value == 'TestNote123', f"Expected 'TestNote123', got '{note_value}'"
                print(f"✓ Note name changed to: {note_value}")
                
                # Step 6: Switch to Device tab
                print("Step 5: Switching to Device tab...")
                await page.click('[data-tab="device"]')
                await page.wait_for_timeout(500)
                
                # Step 7: Switch to Patch tab
                print("Step 6: Switching to Patch tab...")
                await page.click('[data-tab="patch"]')
                await page.wait_for_timeout(500)
                
                # Step 8: Click Edit Note Names again
                print("Step 7: Clicking Edit Note Names again...")
                edit_buttons = page.locator('button:has-text("Edit")')
                await edit_buttons.first.click()
                await page.wait_for_timeout(1000)
                
                # Step 9: Verify that the change has been preserved
                print("Step 8: Verifying note name preservation...")
                
                # Find the same note input field again
                note_input_after = page.locator('.note-name-input').first
                await note_input_after.wait_for(state='visible')
                
                # Check if the value is preserved
                preserved_value = await note_input_after.input_value()
                
                if preserved_value == 'TestNote123':
                    print("✓ SUCCESS: Note name change was preserved!")
                    assert True
                else:
                    print(f"✗ FAILURE: Expected 'TestNote123', got '{preserved_value}'")
                    assert False, f"Note name not preserved. Expected 'TestNote123', got '{preserved_value}'"
            else:
                print("No Edit buttons found - taking screenshot for debugging")
                await page.screenshot(path='no_edit_buttons.png')
                assert False, "No Edit buttons found on Device tab"
            
        except Exception as e:
            print(f"Test failed with error: {e}")
            # Take a screenshot for debugging
            await page.screenshot(path='test_failure.png')
            raise
        
        finally:
            await browser.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_note_name_preservation_simple())







