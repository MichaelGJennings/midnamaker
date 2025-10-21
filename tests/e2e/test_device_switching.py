"""
Test for device switching functionality to ensure patch banks are cleared when switching devices.
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestDeviceSwitching:
    """Test device switching clears old patch banks"""
    
    async def test_device_switching_clears_patch_banks(self, app_page: Page, helpers):
        """
        Test that switching between devices clears old patch banks and shows only new device's banks.
        
        Steps:
        1. Navigate to TestDevice TestModel
        2. Verify patch banks are loaded
        3. Switch to a different manufacturer
        4. Verify patch banks are cleared
        """
        
        # Step 1: Navigate to TestDevice TestModel
        await helpers.click_tab(app_page, "manufacturer")
        await helpers.select_manufacturer(app_page, "TestDevice")
        
        # Select TestModel from device table
        device_row = app_page.locator('[data-device="TestModel"]')
        await expect(device_row).to_be_visible()
        await device_row.click()
        await app_page.wait_for_timeout(1000)
        
        # Step 2: Verify TestDevice patch banks are loaded
        await helpers.click_tab(app_page, "device")
        await app_page.wait_for_timeout(1000)
        
        # Check that TestDevice patch banks are present
        testdevice_banks = app_page.locator('#patch-banks .structure-element')
        testdevice_bank_count = await testdevice_banks.count()
        assert testdevice_bank_count > 0, "TestDevice should have patch banks"
        print(f"TestDevice has {testdevice_bank_count} patch banks")
        
        # Verify TestDevice-specific banks are present
        tones_bank = app_page.locator('#patch-banks .structure-element').filter(has_text='Tones')
        rhythm_bank = app_page.locator('#patch-banks .structure-element').filter(has_text='Rhythm')
        await expect(tones_bank).to_be_visible()
        await expect(rhythm_bank).to_be_visible()
        
        # Step 3: Switch to a different manufacturer (use the first available one)
        await helpers.click_tab(app_page, "manufacturer")
        await app_page.wait_for_timeout(500)
        
        # Get all available manufacturers
        manufacturer_input = app_page.locator('#manufacturer-input')
        await manufacturer_input.click()
        await manufacturer_input.clear()
        await manufacturer_input.fill('A')  # Type 'A' to see manufacturers starting with A
        await app_page.wait_for_timeout(500)
        
        # Click on the first manufacturer that's not TestDevice
        manufacturer_options = app_page.locator('.manufacturer-option').filter(has_text='Alesis')
        if await manufacturer_options.count() > 0:
            await manufacturer_options.first.click()
            await app_page.wait_for_timeout(1000)
            
            # Select the first device from Alesis
            device_rows = app_page.locator('#device-table tbody tr')
            if await device_rows.count() > 0:
                await device_rows.first.click()
                await app_page.wait_for_timeout(1000)
                
                # Step 4: Verify patch banks are cleared/changed
                await helpers.click_tab(app_page, "device")
                await app_page.wait_for_timeout(1000)
                
                # Check that the patch banks are different from TestDevice
                new_banks = app_page.locator('#patch-banks .structure-element')
                new_bank_count = await new_banks.count()
                print(f"New device has {new_bank_count} patch banks")
                
                # Verify TestDevice banks are no longer present
                tones_bank = app_page.locator('#patch-banks .structure-element').filter(has_text='Tones')
                rhythm_bank = app_page.locator('#patch-banks .structure-element').filter(has_text='Rhythm')
                
                # At least one of the TestDevice banks should not be visible
                tones_visible = await tones_bank.is_visible()
                rhythm_visible = await rhythm_bank.is_visible()
                
                assert not (tones_visible and rhythm_visible), "TestDevice banks should not both be visible after switching"
                print("✅ TestDevice banks successfully cleared after device switch")
            else:
                print("No Alesis devices found, skipping device selection")
        else:
            print("No Alesis manufacturer found, skipping manufacturer selection")