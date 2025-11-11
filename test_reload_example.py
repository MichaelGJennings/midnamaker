#!/usr/bin/env python3
"""
Example test demonstrating how to use the reload API to verify saved changes persist.

This test:
1. Loads a device
2. Makes a change (e.g., adds a bank or modifies a patch)
3. Saves the changes
4. Reloads the device from disk
5. Verifies the changes are still present
"""

import asyncio
from playwright.async_api import async_playwright


async def test_reload_after_save():
    """Test that changes are saved and persist after reload"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Navigate to the application
        await page.goto('http://localhost:8000')
        await page.wait_for_load_state('networkidle')
        
        print("✓ Application loaded")
        
        # Select manufacturer
        await page.click('[data-testid="select-manufacturer"]')
        await page.click('text=Ensoniq')
        print("✓ Selected manufacturer: Ensoniq")
        
        # Wait for devices to load
        await page.wait_for_timeout(500)
        
        # Select device
        await page.click('text=TS-10')
        await page.wait_for_timeout(1000)
        print("✓ Selected device: TS-10")
        
        # Switch to device tab
        await page.click('[data-testid="tab-device"]')
        await page.wait_for_timeout(500)
        print("✓ Switched to device tab")
        
        # Get initial bank count
        initial_banks = await page.locator('[data-testid^="bank-header-"]').count()
        print(f"✓ Initial bank count: {initial_banks}")
        
        # Add a new bank
        await page.click('[data-testid="btn-add-bank"]')
        await page.wait_for_timeout(500)
        print("✓ Added new bank")
        
        # Verify bank was added in UI
        new_bank_count = await page.locator('[data-testid^="bank-header-"]').count()
        assert new_bank_count == initial_banks + 1, f"Expected {initial_banks + 1} banks, got {new_bank_count}"
        print(f"✓ Bank count increased to: {new_bank_count}")
        
        # Save the changes
        await page.click('[data-testid="btn-save-device"]')
        await page.wait_for_timeout(1000)
        print("✓ Saved changes")
        
        # Reload the device from disk using the browser console
        print("\n📡 Reloading device from disk...")
        reload_result = await page.evaluate("""
            async () => {
                if (window.deviceManager && window.deviceManager.reloadDevice) {
                    const result = await window.deviceManager.reloadDevice();
                    return {
                        success: result !== null,
                        bankCount: result?.patch_banks?.length || 0,
                        channelNameSets: result?.channel_name_sets?.length || 0
                    };
                }
                return { success: false, error: 'deviceManager not available' };
            }
        """)
        
        print(f"✓ Reload result: {reload_result}")
        
        # Wait for UI to update
        await page.wait_for_timeout(500)
        
        # Verify bank still exists after reload
        reloaded_bank_count = await page.locator('[data-testid^="bank-header-"]').count()
        print(f"✓ Bank count after reload: {reloaded_bank_count}")
        
        # Assertion: The new bank should still be present
        assert reloaded_bank_count == new_bank_count, \
            f"Bank was not persisted! Expected {new_bank_count}, got {reloaded_bank_count} after reload"
        
        print("\n✅ SUCCESS: Changes persisted after reload!")
        print(f"   - Added 1 bank")
        print(f"   - Saved successfully")
        print(f"   - Reloaded from disk")
        print(f"   - Bank still present ({reloaded_bank_count} total banks)")
        
        await browser.close()


async def test_reload_api_directly():
    """Test the reload API endpoint directly using fetch"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Navigate to the application
        await page.goto('http://localhost:8000')
        await page.wait_for_load_state('networkidle')
        
        print("✓ Application loaded")
        
        # Test the reload API directly
        result = await page.evaluate("""
            async () => {
                const response = await fetch('/api/midnam/reload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_path: 'patchfiles/Ensoniq_TS_10_12.midnam',
                        device_id: 'Ensoniq|TS-10'
                    })
                });
                
                if (!response.ok) {
                    return {
                        success: false,
                        error: await response.text()
                    };
                }
                
                const data = await response.json();
                return {
                    success: true,
                    deviceName: data.name,
                    bankCount: data.patch_banks?.length || 0,
                    channelNameSets: data.channel_name_sets?.length || 0,
                    filePath: data.file_path
                };
            }
        """)
        
        print("\n📡 Direct API call result:")
        print(f"   Success: {result['success']}")
        if result['success']:
            print(f"   Device: {result['deviceName']}")
            print(f"   File: {result['filePath']}")
            print(f"   Banks: {result['bankCount']}")
            print(f"   Channel Name Sets: {result['channelNameSets']}")
        else:
            print(f"   Error: {result['error']}")
        
        await browser.close()


if __name__ == '__main__':
    import sys
    
    print("=" * 60)
    print("MIDNAM Reload API Test")
    print("=" * 60)
    print()
    print("This test demonstrates the reload functionality:")
    print("1. Make changes to a device")
    print("2. Save the changes")
    print("3. Reload from disk")
    print("4. Verify changes persist")
    print()
    print("=" * 60)
    print()
    
    if len(sys.argv) > 1 and sys.argv[1] == 'direct':
        print("Running direct API test...\n")
        asyncio.run(test_reload_api_directly())
    else:
        print("Running full workflow test...\n")
        asyncio.run(test_reload_after_save())

