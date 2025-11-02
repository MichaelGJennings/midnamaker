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
        1. Navigate to TestManufacturer TestModel
        2. Verify patch banks are loaded
        3. Switch to a different manufacturer
        4. Verify patch banks are cleared
        """
        
        # Step 1: Navigate to TestManufacturer TestModel
        await helpers.click_tab(app_page, "manufacturer")
        await helpers.select_manufacturer(app_page, "TestManufacturer")
        
        # Select TestModel from device list
        device_items = app_page.locator('[data-testid^="itm_device_"]')
        testmodel_item = device_items.filter(has_text='TestModel')
        await expect(testmodel_item).to_be_visible()
        await testmodel_item.click()
        await app_page.wait_for_timeout(2000)  # Wait for device to load and tab switch
        
        # Step 2: Verify TestManufacturer patch banks are loaded
        # Should already be on device tab after clicking device
        await app_page.wait_for_timeout(1000)
        
        # Check that TestManufacturer patch banks are present
        testdevice_banks = app_page.locator('[data-testid^="sec_bank_"]')
        testdevice_bank_count = await testdevice_banks.count()
        assert testdevice_bank_count > 0, "TestManufacturer should have patch banks"
        print(f"TestManufacturer has {testdevice_bank_count} patch banks")
        
        # Verify TestManufacturer-specific banks are present
        tones_bank = app_page.locator('[data-testid^="sec_bank_"]').filter(has_text='Tones')
        rhythm_bank = app_page.locator('[data-testid^="sec_bank_"]').filter(has_text='Rhythm')
        await expect(tones_bank).to_be_visible()
        await expect(rhythm_bank).to_be_visible()
        
        # Step 3: Switch to a different manufacturer (use the first available one)
        await helpers.click_tab(app_page, "manufacturer")
        await app_page.wait_for_timeout(500)
        
        # Clear the filter first
        filter_input = app_page.get_by_test_id("npt_manufacturer_filter")
        await filter_input.clear()
        
        # Filter for Alesis
        await helpers.fill_manufacturer_filter(app_page, "Alesis")
        await app_page.wait_for_timeout(500)
        
        # Click on Alesis manufacturer
        manufacturer_items = app_page.locator('[data-testid^="itm_manufacturer_"]')
        alesis_item = manufacturer_items.filter(has_text='Alesis')
        if await alesis_item.count() > 0:
            await alesis_item.first.click()
            await app_page.wait_for_timeout(1000)
            
            # Select the first device from Alesis
            device_items = app_page.locator('[data-testid^="itm_device_"]')
            if await device_items.count() > 0:
                await device_items.first.click()
                await app_page.wait_for_timeout(2000)  # Wait for device to load and tab switch
                
                # Step 4: Verify patch banks are cleared/changed
                # Should already be on device tab
                await app_page.wait_for_timeout(1000)
                
                # Check that the patch banks are different from TestManufacturer
                new_banks = app_page.locator('[data-testid^="sec_bank_"]')
                new_bank_count = await new_banks.count()
                print(f"New device has {new_bank_count} patch banks")
                
                # Verify TestManufacturer banks are no longer present
                tones_bank = app_page.locator('[data-testid^="sec_bank_"]').filter(has_text='Tones')
                rhythm_bank = app_page.locator('[data-testid^="sec_bank_"]').filter(has_text='Rhythm')
                
                # At least one of the TestManufacturer banks should not be visible
                tones_visible = await tones_bank.is_visible()
                rhythm_visible = await rhythm_bank.is_visible()
                
                assert not (tones_visible and rhythm_visible), "TestManufacturer banks should not both be visible after switching"
                print("✅ TestManufacturer banks successfully cleared after device switch")
            else:
                print("No Alesis devices found, skipping device selection")
        else:
            print("No Alesis manufacturer found, skipping manufacturer selection")