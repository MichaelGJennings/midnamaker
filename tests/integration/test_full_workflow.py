#!/usr/bin/env python3
"""
Comprehensive test for the full patch editor workflow.
This test will navigate through: Manufacturer → Device → Patch and verify the interactive note editor works.
"""

import asyncio
from playwright.async_api import async_playwright

async def test_full_patch_editor_workflow():
    """Test the complete workflow from manufacturer selection to patch editing"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            print("🌐 Navigating to index.html...")
            await page.goto("http://localhost:8000/index.html")
            
            # Disable MIDI for testing to prevent permission requests
            await page.add_init_script("window.DISABLE_MIDI_FOR_TESTING = true;")
            
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(3000)
            
            print("📄 Page loaded successfully")
            
            # Step 1: Wait for manufacturers to load
            print("⏳ Waiting for manufacturers to load...")
            try:
                await page.wait_for_selector('.manufacturer-option', timeout=10000)
                print("✅ Manufacturers loaded")
            except:
                print("⚠️  Manufacturers not loaded, checking if we can proceed...")
                # Check if there's a "No Backend Server" message
                no_backend = await page.locator('text=No Backend Server').is_visible()
                if no_backend:
                    print("❌ Backend server not running - cannot test full workflow")
                    return False
            
            # Step 2: Select Alesis manufacturer
            print("🔍 Looking for Alesis manufacturer...")
            alesis_items = await page.locator('.manufacturer-option:has-text("Alesis")').count()
            if alesis_items > 0:
                print(f"✅ Found {alesis_items} Alesis manufacturer(s)")
                await page.locator('.manufacturer-option:has-text("Alesis")').first.click()
                await page.wait_for_timeout(1000)
                print("✅ Selected Alesis manufacturer")
            else:
                print("❌ Alesis manufacturer not found")
                return False
            
            # Step 3: Select D4 device
            print("🔍 Looking for D4 device...")
            d4_items = await page.locator('.device-item:has-text("D4")').count()
            if d4_items > 0:
                print(f"✅ Found {d4_items} D4 device(s)")
                await page.locator('.device-item:has-text("D4")').first.click()
                await page.wait_for_timeout(1000)
                print("✅ Selected D4 device")
            else:
                print("❌ D4 device not found")
                return False
            
            # Step 4: Expand Factory Drumsets bank
            print("🔍 Looking for Factory Drumsets bank...")
            factory_banks = await page.locator('.bank-item:has-text("Factory Drumsets")').count()
            if factory_banks > 0:
                print(f"✅ Found {factory_banks} Factory Drumsets bank(s)")
                await page.locator('.bank-item:has-text("Factory Drumsets")').first.click()
                await page.wait_for_timeout(1000)
                print("✅ Expanded Factory Drumsets bank")
            else:
                print("❌ Factory Drumsets bank not found")
                return False
            
            # Step 5: Find and click Edit button for "Hard & Rockin'" patch
            print("🔍 Looking for Hard & Rockin' patch...")
            hard_rockin_patches = await page.locator('.patch-item:has-text("Hard & Rockin\'")').count()
            if hard_rockin_patches > 0:
                print(f"✅ Found {hard_rockin_patches} Hard & Rockin' patch(es)")
                
                # Look for Edit button
                edit_buttons = await page.locator('.patch-item:has-text("Hard & Rockin\'") .patch-actions button:has-text("Edit")').count()
                if edit_buttons > 0:
                    print(f"✅ Found {edit_buttons} Edit button(s)")
                    await page.locator('.patch-item:has-text("Hard & Rockin\'") .patch-actions button:has-text("Edit")').first.click()
                    await page.wait_for_timeout(1000)
                    print("✅ Clicked Edit button for Hard & Rockin' patch")
                else:
                    print("❌ Edit button not found for Hard & Rockin' patch")
                    return False
            else:
                print("❌ Hard & Rockin' patch not found")
                return False
            
            # Step 6: Verify we're on the Patch tab and the interactive editor is loaded
            print("🔍 Checking if we're on the Patch tab...")
            patch_tab_content = await page.locator('#patch-tab').is_visible()
            if patch_tab_content:
                print("✅ Patch tab is visible")
                
                # Check for interactive note editor elements
                note_table = await page.locator('.note-table').is_visible()
                if note_table:
                    print("✅ Interactive note table found")
                    
                    # Check for note displays with piano keys
                    note_displays = await page.locator('.note-number-display').count()
                    if note_displays > 0:
                        print(f"✅ Found {note_displays} note displays")
                        
                        # Check first note display has piano key
                        first_note = await page.locator('.note-number-display').first.text_content()
                        if '(' in first_note and ')' in first_note:
                            print(f"✅ First note has piano key: {first_note}")
                        else:
                            print(f"❌ First note missing piano key: {first_note}")
                            return False
                        
                        # Check for editable note inputs
                        note_inputs = await page.locator('.note-name-input').count()
                        if note_inputs > 0:
                            print(f"✅ Found {note_inputs} editable note inputs")
                            
                            # Test clicking on a note input
                            first_input = page.locator('.note-name-input').first
                            await first_input.click()
                            await page.wait_for_timeout(500)
                            
                            # Check if input becomes editable (readonly attribute removed)
                            readonly = await first_input.get_attribute('readonly')
                            if readonly is None:
                                print("✅ Note input becomes editable when clicked")
                            else:
                                print("❌ Note input remains readonly when clicked")
                                return False
                            
                            # Check for action buttons
                            add_btn = await page.locator('.add-note-btn').is_visible()
                            if add_btn:
                                print("✅ Add note button found")
                            else:
                                print("❌ Add note button not found")
                                return False
                            
                            insert_btns = await page.locator('button:has-text("+I")').count()
                            if insert_btns > 0:
                                print(f"✅ Found {insert_btns} insert buttons")
                            else:
                                print("❌ Insert buttons not found")
                                return False
                            
                            # Test tooltip on note number
                            first_note_display = page.locator('.note-number-display').first
                            await first_note_display.hover()
                            await page.wait_for_timeout(500)
                            
                            tooltip = await first_note_display.get_attribute('title')
                            if tooltip:
                                print(f"✅ Tooltip found: {tooltip}")
                            else:
                                print("❌ Tooltip not found")
                                return False
                            
                            print("🎉 All interactive note editor features working correctly!")
                            return True
                        else:
                            print("❌ No editable note inputs found")
                            return False
                    else:
                        print("❌ No note displays found")
                        return False
                else:
                    print("❌ Interactive note table not found")
                    return False
            else:
                print("❌ Patch tab not visible")
                return False
                
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            await page.screenshot(path="test_failure_full_workflow.png")
            return False
        finally:
            await browser.close()

async def main():
    print("🧪 Testing full patch editor workflow...")
    print("This test will navigate: Manufacturer → Device → Patch → Interactive Editor")
    print()
    
    success = await test_full_patch_editor_workflow()
    
    if success:
        print("\n🎉 FULL WORKFLOW TEST PASSED!")
        print("✅ Manufacturer selection works")
        print("✅ Device selection works") 
        print("✅ Patch bank expansion works")
        print("✅ Patch editing works")
        print("✅ Interactive note editor loads correctly")
        print("✅ All note editor features working (tooltips, piano keys, editing, etc.)")
    else:
        print("\n💥 FULL WORKFLOW TEST FAILED!")
        print("There are issues in the workflow that need to be fixed.")

if __name__ == "__main__":
    asyncio.run(main())
