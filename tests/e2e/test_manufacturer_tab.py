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
        manufacturer_list = app_page.locator("#manufacturer-list")
        await expect(manufacturer_list).to_be_visible()
        
        # Check that we have manufacturer items
        manufacturer_items = app_page.locator(".manufacturer-list-item")
        count = await manufacturer_items.count()
        assert count > 0, "Should have at least one manufacturer"
    
    async def test_manufacturer_filter(self, app_page: Page, helpers):
        """Test that manufacturer filter works"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Type in filter
        filter_input = app_page.locator("#manufacturer-filter")
        await filter_input.fill("Alesis")
        
        # Wait for filter to apply
        await app_page.wait_for_timeout(500)
        
        # Check that filtered results are shown
        visible_items = app_page.locator(".manufacturer-list-item:visible")
        count = await visible_items.count()
        assert count > 0, "Should have filtered results"
        
        # Check that all visible items contain "Alesis"
        for i in range(count):
            item = visible_items.nth(i)
            text = await item.text_content()
            assert "Alesis" in text.lower(), f"Item should contain 'Alesis': {text}"
    
    async def test_select_manufacturer_shows_devices(self, app_page: Page, helpers):
        """Test that selecting a manufacturer shows device list"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Find and click Alesis manufacturer
        alesis_items = app_page.locator(".manufacturer-list-item")
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
        device_container = app_page.locator("#device-list-container")
        await expect(device_container).to_be_visible()
        
        # Check that device list has items
        device_items = app_page.locator(".device-list-item")
        count = await device_items.count()
        assert count > 0, "Should have at least one device"
    
    async def test_select_device_switches_to_device_tab(self, app_page: Page, helpers):
        """Test that selecting a device switches to device tab"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Find and click Alesis manufacturer
        alesis_items = app_page.locator(".manufacturer-list-item")
        item_count = await alesis_items.count()
        for i in range(item_count):
            item = alesis_items.nth(i)
            text = await item.text_content()
            if "Alesis" in text:
                await item.click()
                break
        
        # Wait for device list
        await app_page.wait_for_timeout(1000)
        
        # Click first device
        device_items = app_page.locator(".device-list-item")
        if await device_items.count() > 0:
            await device_items.first.click()
            
            # Wait for tab switch
            await app_page.wait_for_timeout(2000)
            
            # Check that we're on device tab
            device_tab = app_page.locator("#device-tab")
            class_attr = await device_tab.get_attribute("class")
            assert "active" in class_attr, "Device tab should be active"
    
    async def test_clear_manufacturer_selection(self, app_page: Page, helpers):
        """Test that 'Change Manufacturer' button clears selection"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Wait for list to load
        await app_page.wait_for_timeout(1000)
        
        # Select a manufacturer
        manufacturer_items = app_page.locator(".manufacturer-list-item")
        if await manufacturer_items.count() > 0:
            await manufacturer_items.first.click()
            await app_page.wait_for_timeout(1000)
            
            # Device list should be visible
            device_container = app_page.locator("#device-list-container")
            await expect(device_container).to_be_visible()
            
            # Click "Change Manufacturer" button
            clear_btn = app_page.locator("#clear-manufacturer-selection")
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
        manufacturer_items = app_page.locator(".manufacturer-list-item")
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
        device_container = app_page.locator("#device-list-container")
        display = await device_container.evaluate("el => window.getComputedStyle(el).display")
        assert display != "none", "Device list should still be visible after returning to tab"

