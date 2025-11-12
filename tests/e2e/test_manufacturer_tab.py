"""
E2E tests for the new Manufacturer tab functionality
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestManufacturerTab:
    """Tests for the Manufacturer tab functionality"""
    
    async def test_manufacturer_list_loads(self, app_page: Page, helpers):
        """Test that manufacturer list loads on startup"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for manufacturer list to load
        manufacturer_list = app_page.get_by_test_id("lst_manufacturers")
        await expect(manufacturer_list).to_be_visible()
        
        # Check that we have manufacturer items
        manufacturer_items = app_page.locator('[data-testid^="itm_manufacturer_"]')
        count = await manufacturer_items.count()
        assert count > 0, "Should have at least one manufacturer"
    
    async def test_manufacturer_filter(self, app_page: Page, helpers):
        """Test that manufacturer filter works"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Type in filter
        filter_input = app_page.get_by_test_id("npt_manufacturer_filter")
        await filter_input.fill("Alesis")
        
        # Wait for filter to apply
        await app_page.wait_for_timeout(500)
        
        # Check that filtered results are shown
        visible_items = app_page.locator('[data-testid^="itm_manufacturer_"]:visible')
        count = await visible_items.count()
        assert count > 0, "Should have filtered results"
        
        # Check that all visible items contain "alesis" (case-insensitive)
        for i in range(count):
            item = visible_items.nth(i)
            text = await item.text_content()
            assert "alesis" in text.lower(), f"Item should contain 'alesis': {text}"
    
    async def test_select_manufacturer_shows_devices(self, app_page: Page, helpers):
        """Test that selecting a manufacturer shows device list"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Find and click Alesis manufacturer
        alesis_items = app_page.locator('[data-testid^="itm_manufacturer_"]')
        alesis_found = False
        
        item_count = await alesis_items.count()
        for i in range(item_count):
            item = alesis_items.nth(i)
            text = await item.text_content()
            if "Alesis" in text:
                await item.click()
                alesis_found = True
                break
        
        assert alesis_found, "Alesis manufacturer should be found"
        
        # Wait for device list to appear
        await app_page.wait_for_timeout(1000)
        
        # Check that device list container is visible
        device_container = app_page.get_by_test_id("sec_device_list_container")
        await expect(device_container).to_be_visible()
        
        # Check that device list has items
        device_items = app_page.locator('[data-testid^="itm_device_"]')
        count = await device_items.count()
        assert count > 0, "Should have at least one device"
    
    async def test_select_device_switches_to_device_tab(self, app_page: Page, helpers):
        """Test that selecting a device switches to device tab"""
        # Use the helper to load a device we know has a MIDNAM file
        await helpers.load_test_device(app_page, "Alesis", "D4")
        
        # Wait for device to load and tab to switch
        await app_page.wait_for_timeout(2000)
        
        # Check that we're on device tab with content loaded
        device_tab = app_page.get_by_test_id("sec_device_tab")
        device_content = app_page.get_by_test_id("sec_device_content")
        
        # Check if either tab has active class or device content is visible
        tab_classes = await device_tab.get_attribute("class")
        is_content_visible = await device_content.is_visible()
        
        assert "active" in tab_classes or is_content_visible, \
            f"Device tab should be active or content visible. Tab classes: {tab_classes}, Content visible: {is_content_visible}"
    
    async def test_clear_manufacturer_selection(self, app_page: Page, helpers):
        """Test that 'Change Manufacturer' button clears selection"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Select a manufacturer
        manufacturer_items = app_page.locator('[data-testid^="itm_manufacturer_"]')
        if await manufacturer_items.count() > 0:
            await manufacturer_items.first.click()
            await app_page.wait_for_timeout(1000)
            
            # Device list should be visible
            device_container = app_page.get_by_test_id("sec_device_list_container")
            await expect(device_container).to_be_visible()
            
            # Click "Change Manufacturer" button
            clear_btn = app_page.get_by_test_id("btn_change_manufacturer")
            await clear_btn.click()
            await app_page.wait_for_timeout(500)
            
            # Device list should be hidden
            display = await device_container.evaluate("el => window.getComputedStyle(el).display")
            assert display == "none", "Device list should be hidden"
    
    async def test_returning_to_manufacturer_tab_preserves_state(self, app_page: Page, helpers):
        """Test that returning to manufacturer tab preserves state"""
        await helpers.click_tab(app_page, "manufacturer")
        await app_page.wait_for_timeout(1000)
        
        # Select a manufacturer
        manufacturer_items = app_page.locator('[data-testid^="itm_manufacturer_"]')
        manufacturer_name = None
        if await manufacturer_items.count() > 0:
            first_item = manufacturer_items.first
            manufacturer_name = await first_item.text_content()
            await first_item.click()
            await app_page.wait_for_timeout(1000)
        
        # Switch to device tab
        await helpers.click_tab(app_page, "device")
        await app_page.wait_for_timeout(500)
        
        # Switch back to manufacturer tab
        await helpers.click_tab(app_page, "manufacturer")
        await app_page.wait_for_timeout(500)
        
        # Device list should still be visible
        device_container = app_page.get_by_test_id("sec_device_list_container")
        display = await device_container.evaluate("el => window.getComputedStyle(el).display")
        assert display != "none", "Device list should still be visible after returning to tab"

