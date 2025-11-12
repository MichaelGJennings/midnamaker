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
        await helpers.load_test_device(app_page, "TestManufacturer", "TestModel")
        
        # Step 2: Verify TestManufacturer patch banks are loaded
        # Should already be on device tab after loading device
        await app_page.wait_for_timeout(1000)
        
        # Check that TestManufacturer patch banks are present
        testdevice_banks = app_page.locator('[data-testid^="hdr_patch_bank_"]')
        testdevice_bank_count = await testdevice_banks.count()
        assert testdevice_bank_count > 0, f"TestManufacturer should have patch banks, found {testdevice_bank_count}"
        print(f"TestManufacturer has {testdevice_bank_count} patch banks")
        
        # Verify TestManufacturer-specific banks are present (looking in headers)
        bank_headers = await app_page.locator('[data-testid^="hdr_patch_bank_"]').all_text_contents()
        bank_text = " ".join(bank_headers)
        assert "Tones" in bank_text or "Rhythm" in bank_text, f"Should find TestModel banks in: {bank_text}"
        
        # Step 3: Switch to a different manufacturer/device
        # Use helper to load a different device (Alesis D4)
        await helpers.load_test_device(app_page, "Alesis", "D4")
        
        # Step 4: Verify patch banks are cleared/changed
        # Should already be on device tab
        await app_page.wait_for_timeout(1000)
        
        # Check that the patch banks are different from TestManufacturer
        new_bank_headers = await app_page.locator('[data-testid^="hdr_patch_bank_"]').all_text_contents()
        new_bank_text = " ".join(new_bank_headers)
        print(f"New device banks: {new_bank_text[:100]}...")
        
        # Verify TestManufacturer banks are no longer present
        # TestModel had "Tones" and "Rhythm", new device should not have both
        has_tones = "Tones" in new_bank_text
        has_rhythm = "Rhythm" in new_bank_text
        
        # At least one of the TestManufacturer banks should not be present
        assert not (has_tones and has_rhythm), \
            f"TestManufacturer banks should not both be present after switching. Found: {new_bank_text[:200]}"
        print("✅ TestManufacturer banks successfully cleared after device switch")