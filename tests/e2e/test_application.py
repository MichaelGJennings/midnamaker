"""
End-to-End Tests using Playwright
Tests complete user workflows in the browser
"""

import pytest
import re
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestApplicationWorkflow:
    """Test complete application workflows"""
    
    async def test_application_loads(self, app_page: Page):
        """Test that the application loads correctly"""
        # Check that main elements are present
        await expect(app_page.get_by_test_id("hdr_app_title")).to_contain_text("Midnamaker")
        await expect(app_page.get_by_test_id("sec_tabs")).to_be_visible()
        await expect(app_page.get_by_test_id("sec_global_midi_controls")).to_be_visible()
    
    async def test_tab_navigation(self, app_page: Page, helpers):
        """Test tab navigation functionality"""
        # Test clicking different tabs
        tabs = ["manufacturer", "device", "patch", "catalog", "tools"]
        
        for tab in tabs:
            await helpers.click_tab(app_page, tab)
            await expect(app_page.get_by_test_id(f"sec_{tab}_tab")).to_have_class(re.compile("active"))
            await expect(app_page.get_by_test_id(f"sec_{tab}_tab")).to_be_visible()
    
    async def test_manufacturer_filter(self, app_page: Page, helpers):
        """Test manufacturer filter functionality"""
        # Click manufacturer tab
        await helpers.click_tab(app_page, "manufacturer")
        
        # Check filter input is present
        filter_input = app_page.get_by_test_id("npt_manufacturer_filter")
        await expect(filter_input).to_be_visible()
        
        # Test typing in filter
        await filter_input.fill("Alesis")
        await app_page.wait_for_timeout(500)  # Wait for filter to apply
        
        # Check that filtered items appear
        filtered_items = app_page.locator('[data-testid^="itm_manufacturer_"]:visible')
        assert await filtered_items.count() > 0, "Should have filtered results"
    
    async def test_midi_controls(self, app_page: Page, helpers):
        """Test MIDI control functionality"""
        # Note: MIDI is disabled in the app_page fixture for testing
        # This test only checks that MIDI controls are present
        midi_toggle = app_page.get_by_test_id("tgl_midi")
        midi_device_select = app_page.get_by_test_id("sel_midi_device")
        midi_device_info = app_page.get_by_test_id("div_midi_device_info")
        
        await expect(midi_toggle).to_be_visible()
        await expect(midi_device_select).to_be_visible()
        await expect(midi_device_info).to_be_visible()
        
        # MIDI is disabled during tests, so device select remains disabled
        # Just check that it exists
        is_disabled = await midi_device_select.is_disabled()
        assert is_disabled, "MIDI device select should be disabled when MIDI is off"
    
    async def test_device_selection_workflow(self, app_page: Page, helpers):
        """Test complete device selection workflow"""
        # Navigate to manufacturer tab
        await helpers.click_tab(app_page, "manufacturer")
        
        # Filter for a manufacturer
        await helpers.fill_manufacturer_filter(app_page, "Alesis")
        await app_page.wait_for_timeout(500)
        
        # Select Alesis manufacturer
        await helpers.select_manufacturer(app_page, "Alesis")
        await app_page.wait_for_timeout(1000)
        
        # Check that devices appear
        device_container = app_page.get_by_test_id("sec_device_list_container")
        await expect(device_container).to_be_visible()
        
        # Look for device list items
        device_items = app_page.locator('[data-testid^="itm_device_"]')
        device_count = await device_items.count()
        # Just verify devices are listed
        assert device_count > 0, f"Should have device items listed, found {device_count}"
    
    async def test_catalog_functionality(self, app_page: Page, helpers):
        """Test catalog tab functionality"""
        await helpers.click_tab(app_page, "catalog")
        
        # Check that catalog content loads
        catalog_content = app_page.get_by_test_id("sec_catalog_content")
        await expect(catalog_content).to_be_visible()
        
        # Check for refresh button
        refresh_btn = app_page.get_by_test_id("btn_refresh_catalog")
        await expect(refresh_btn).to_be_visible()
        
        # Click refresh button
        await refresh_btn.click()
        await app_page.wait_for_timeout(2000)  # Wait for catalog refresh
        
        # Check that catalog table has content
        catalog_table = app_page.locator('.catalog-table')
        if await catalog_table.count() > 0:
            # Verify table has rows
            rows = app_page.locator('.catalog-table tbody tr')
            row_count = await rows.count()
            assert row_count > 0, "Catalog should have device entries"
    
    async def test_tools_console(self, app_page: Page, helpers):
        """Test tools tab functionality"""
        await helpers.click_tab(app_page, "tools")
        
        # Check tools content
        tools_content = app_page.get_by_test_id("sec_tools_content")
        await expect(tools_content).to_be_visible()
        
        # Check for console
        debug_console = app_page.get_by_test_id("div_debug_console")
        await expect(debug_console).to_be_visible()
        
        # Check for clear button
        clear_btn = app_page.get_by_test_id("btn_clear_console")
        await expect(clear_btn).to_be_visible()


@pytest.mark.e2e
@pytest.mark.slow
class TestMIDIFunctionality:
    """Test MIDI-related functionality (requires MIDI hardware)"""
    
    async def test_midi_device_selection(self, app_page: Page, helpers):
        """Test MIDI device selection workflow"""
        # Enable MIDI
        await helpers.enable_midi(app_page)
        
        # Check device dropdown is populated
        device_select = app_page.get_by_test_id("sel_midi_device")
        options = await device_select.locator("option").all()
        
        # Should have at least the placeholder option
        assert len(options) >= 1
        
        # If there are MIDI devices available, test selection
        if len(options) > 1:
            # Select first real device (not placeholder)
            await device_select.select_option(index=1)
            await app_page.wait_for_timeout(500)
            
            # Check device info updates
            device_info = app_page.get_by_test_id("div_midi_device_info")
            device_info_text = await device_info.text_content()
            assert "Connected:" in device_info_text or "Not connected" in device_info_text
    
    async def test_midi_note_playback(self, app_page: Page, helpers):
        """Test MIDI note playback functionality"""
        # Enable MIDI and select device
        await helpers.enable_midi(app_page)
        
        device_select = app_page.get_by_test_id("sel_midi_device")
        options = await device_select.locator("option").all()
        
        if len(options) > 1:
            await device_select.select_option(index=1)
            await app_page.wait_for_timeout(500)
            
            # Navigate to device tab to test note playback
            await helpers.click_tab(app_page, "device")
            
            # Look for playable note elements (these might not have specific test IDs)
            playable_notes = app_page.locator(".note-number-display")
            if await playable_notes.count() > 0:
                # Click on first playable note
                await playable_notes.first.click()
                await app_page.wait_for_timeout(200)  # Wait for note to play


@pytest.mark.e2e
class TestErrorHandling:
    """Test error handling in the UI"""
    
    async def test_invalid_manufacturer_filter(self, app_page: Page, helpers):
        """Test filtering for non-existent manufacturer"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Filter for non-existent manufacturer
        await helpers.fill_manufacturer_filter(app_page, "NonExistentManufacturer123")
        await app_page.wait_for_timeout(500)
        
        # Check that no items are visible
        visible_items = app_page.locator('[data-testid^="itm_manufacturer_"]:visible')
        count = await visible_items.count()
        assert count == 0, "Should have no visible manufacturers for invalid filter"
    
    async def test_midi_not_supported(self, app_page: Page):
        """Test behavior when WebMIDI is not supported"""
        # This test would need to be run in a browser that doesn't support WebMIDI
        # or with WebMIDI disabled
        
        midi_toggle = app_page.get_by_test_id("tgl_midi")
        await midi_toggle.click()
        
        # Check that appropriate message is shown
        device_info = app_page.get_by_test_id("div_midi_device_info")
        device_info_text = await device_info.text_content()
        
        # Should show either connection status or not supported message
        assert len(device_info_text) > 0


@pytest.mark.e2e
@pytest.mark.slow
class TestPerformance:
    """Test application performance"""
    
    async def test_catalog_load_performance(self, app_page: Page, helpers):
        """Test catalog loading performance"""
        import time
        
        await helpers.click_tab(app_page, "catalog")
        
        # Measure time to load catalog
        start_time = time.time()
        
        refresh_btn = app_page.get_by_test_id("btn_refresh_catalog")
        await refresh_btn.click()
        
        # Wait for catalog table to appear with content
        await app_page.wait_for_timeout(3000)
        
        # Check that catalog has loaded
        catalog_table = app_page.locator('.catalog-table')
        await expect(catalog_table).to_be_attached()
        
        load_time = time.time() - start_time
        
        # Catalog should load within reasonable time (10 seconds)
        assert load_time < 10, f"Catalog took too long to load: {load_time:.2f}s"
    
    async def test_manufacturer_search_performance(self, app_page: Page, helpers):
        """Test manufacturer search performance"""
        import time
        
        await helpers.click_tab(app_page, "manufacturer")
        
        # Measure filter performance
        start_time = time.time()
        
        await helpers.fill_manufacturer_filter(app_page, "Alesis")
        await app_page.wait_for_timeout(1000)  # Wait for filter to apply
        
        filter_time = time.time() - start_time
        
        # Filter should be fast (under 2 seconds)
        assert filter_time < 2, f"Filter took too long: {filter_time:.2f}s"


@pytest.mark.e2e
class TestAccessibility:
    """Test accessibility features"""
    
    async def test_keyboard_navigation(self, app_page: Page):
        """Test keyboard navigation"""
        # Test tab navigation with keyboard
        await app_page.keyboard.press("Tab")
        
        # Check that focus is visible
        focused_element = app_page.locator(":focus")
        await expect(focused_element).to_be_visible()
    
    async def test_aria_labels(self, app_page: Page):
        """Test that important elements have ARIA labels"""
        # Check for ARIA labels on interactive elements
        midi_toggle = app_page.get_by_test_id("tgl_midi")
        await expect(midi_toggle).to_be_visible()
        
        # Check that buttons have accessible names
        buttons = app_page.locator("button")
        button_count = await buttons.count()
        
        for i in range(min(button_count, 5)):  # Check first 5 buttons
            button = buttons.nth(i)
            button_text = await button.text_content()
            button_aria_label = await button.get_attribute("aria-label")
            
            # Button should have either text content or aria-label
            assert button_text or button_aria_label, f"Button {i} lacks accessible name"
    
    async def test_contrast_ratios(self, app_page: Page):
        """Test that text has sufficient contrast"""
        # This would require more sophisticated testing
        # For now, just check that text elements are visible
        text_elements = app_page.locator("h1, h2, h3, p, span")
        await expect(text_elements.first).to_be_visible()



