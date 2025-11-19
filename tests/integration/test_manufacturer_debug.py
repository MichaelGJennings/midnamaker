#!/usr/bin/env python3
"""
Test to check for JavaScript errors and debug manufacturer loading.
"""

import asyncio
from playwright.async_api import async_playwright

async def test_manufacturer_debug():
    """Test that captures JavaScript errors and debug info"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Capture console messages
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        
        try:
            print("🌐 Navigating to index.html...")
            
            # Set MIDI disable flag before page loads
            await page.add_init_script("window.DISABLE_MIDI_FOR_TESTING = true;")
            
            await page.goto("http://localhost:8000/index.html")
            await page.wait_for_load_state('networkidle')
            
            print("⏳ Waiting for page to load...")
            await page.wait_for_timeout(3000)
            
            # Print console messages
            print("\n📝 Console messages:")
            for msg in console_messages:
                print(f"  {msg}")
            
            # Check network requests
            print("\n🌐 Checking network requests...")
            try:
                # Try to make a direct API call to see if it works
                api_response = await page.evaluate("""
                    async () => {
                        try {
                            const response = await fetch('/api/manufacturers');
                            return { ok: response.ok, status: response.status, statusText: response.statusText };
                        } catch (error) {
                            return { error: error.message };
                        }
                    }
                """)
                print(f"  API call result: {api_response}")
            except Exception as e:
                print(f"  API call failed: {e}")
            
            # Check for manufacturer items (they're called manufacturer-option, not manufacturer-item)
            manufacturer_items = await page.locator('.manufacturer-option').count()
            print(f"\n📊 Found {manufacturer_items} manufacturer items")
            
            # Check for loading indicator
            loading = await page.locator('#manufacturer-loading').is_visible()
            print(f"⏳ Loading indicator visible: {loading}")
            
            # Check for no backend message
            no_backend = await page.locator('text=No Backend Server').is_visible()
            print(f"🚫 No Backend Server message visible: {no_backend}")
            
            # Check manufacturer dropdown
            dropdown = await page.locator('#manufacturer-dropdown-list').is_visible()
            print(f"📋 Manufacturer dropdown visible: {dropdown}")
            
            # Check manufacturer dropdown content
            dropdown_content = await page.locator('#manufacturer-dropdown-list').text_content()
            print(f"📋 Dropdown content: {dropdown_content[:200]}...")
            
            # Check if we can find any text content
            try:
                manufacturer_content = await page.locator('#manufacturer-content').text_content()
                print(f"📄 Manufacturer content: {manufacturer_content[:200]}...")
            except:
                print("📄 Manufacturer content: Not found")
            
            # Check if manufacturer manager is working
            try:
                manufacturer_status = await page.evaluate("""
                    () => {
                        if (window.manufacturerManager) {
                            return {
                                exists: true,
                                initialized: window.manufacturerManager.initialized || false
                            };
                        }
                        return { exists: false };
                    }
                """)
                print(f"🏭 Manufacturer manager: {manufacturer_status}")
            except Exception as e:
                print(f"🏭 Manufacturer manager check failed: {e}")
            
            # Try to switch to manufacturer tab to trigger loading
            try:
                manufacturer_tab = page.locator('.tab[data-tab="manufacturer"]')
                if await manufacturer_tab.is_visible():
                    await manufacturer_tab.click()
                    print("🔄 Clicked manufacturer tab to trigger loading")
                    await page.wait_for_timeout(2000)
                    
                    # Check again after tab switch
                    manufacturer_items_after = await page.locator('.manufacturer-option').count()
                    print(f"📊 Found {manufacturer_items_after} manufacturer items after tab switch")
                else:
                    print("❌ Manufacturer tab not found")
            except Exception as e:
                print(f"🔄 Tab switch failed: {e}")
            
            return False
                
        except Exception as e:
            print(f"❌ Test failed: {e}")
            await page.screenshot(path="test_manufacturer_debug_failure.png")
            return False
        finally:
            await browser.close()

async def main():
    print("🧪 Testing manufacturer loading with debug info...")
    await test_manufacturer_debug()

if __name__ == "__main__":
    asyncio.run(main())
