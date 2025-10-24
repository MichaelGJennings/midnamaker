#!/usr/bin/env python3
"""
Test to check if manufacturers load correctly.
"""

import asyncio
from playwright.async_api import async_playwright

async def test_manufacturer_loading():
    """Test that manufacturers load correctly"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            print("🌐 Navigating to midnamaker.html...")
            await page.goto("http://localhost:8000/midnamaker.html")
            
            # Disable MIDI for testing to prevent permission requests
            await page.evaluate("window.DISABLE_MIDI_FOR_TESTING = true;")
            
            await page.wait_for_load_state('networkidle')
            
            print("⏳ Waiting for manufacturers to load...")
            
            # Click on manufacturer tab to trigger loading
            manufacturer_tab = page.locator('.tab[data-tab="manufacturer"]')
            if await manufacturer_tab.is_visible():
                await manufacturer_tab.click()
                print("✅ Clicked manufacturer tab")
            
            await page.wait_for_timeout(3000)
            
            # Check for manufacturer items (they're called manufacturer-option, not manufacturer-item)
            manufacturer_items = await page.locator('.manufacturer-option').count()
            print(f"📊 Found {manufacturer_items} manufacturer items")
            
            if manufacturer_items > 0:
                print("✅ Manufacturers loaded successfully!")
                
                # Check for Alesis specifically
                alesis_items = await page.locator('.manufacturer-option:has-text("Alesis")').count()
                print(f"🎯 Found {alesis_items} Alesis manufacturer(s)")
                
                if alesis_items > 0:
                    print("✅ Alesis manufacturer found!")
                    return True
                else:
                    print("❌ Alesis manufacturer not found")
                    return False
            else:
                print("❌ No manufacturer items found")
                
                # Check for error messages
                no_backend = await page.locator('text=No Backend Server').is_visible()
                if no_backend:
                    print("❌ 'No Backend Server' message is showing")
                
                loading = await page.locator('text=Loading manufacturers').is_visible()
                if loading:
                    print("⏳ Still showing 'Loading manufacturers'")
                
                return False
                
        except Exception as e:
            print(f"❌ Test failed: {e}")
            await page.screenshot(path="test_manufacturer_loading_failure.png")
            return False
        finally:
            await browser.close()

async def main():
    print("🧪 Testing manufacturer loading...")
    success = await test_manufacturer_loading()
    
    if success:
        print("\n🎉 Manufacturer loading test PASSED!")
    else:
        print("\n💥 Manufacturer loading test FAILED!")

if __name__ == "__main__":
    asyncio.run(main())
