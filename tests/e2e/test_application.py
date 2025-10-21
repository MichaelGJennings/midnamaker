"""
End-to-End Tests using Playwright
Tests complete user workflows in the browser
"""

import pytest
from playwright.async_api import Page, expect


@pytest.mark.e2e
class TestApplicationWorkflow:
    """Test complete application workflows"""
    
    async def test_application_loads(self, app_page: Page):
        """Test that the application loads correctly"""
        # Check that main elements are present
        await expect(app_page.locator("#app")).to_be_visible()
        await expect(app_page.locator("h1")).to_contain_text("MIDI Name Editor")
        await expect(app_page.locator(".tab-navigation")).to_be_visible()
        await expect(app_page.locator("#global-midi-controls")).to_be_visible()
    
    async def test_tab_navigation(self, app_page: Page, helpers):
        """Test tab navigation functionality"""
        # Test clicking different tabs
        tabs = ["manufacturer", "device", "patch", "builder", "catalog", "debug"]
        
        for tab in tabs:
            await helpers.click_tab(app_page, tab)
            await expect(app_page.locator(f"#{tab}-tab")).to_have_class(/active/)
            await expect(app_page.locator(f"#{tab}-tab .tab-content")).to_be_visible()
    
    async def test_manufacturer_search(self, app_page: Page, helpers):
        """Test manufacturer search functionality"""
        # Click manufacturer tab
        await helpers.click_tab(app_page, "manufacturer")
        
        # Check search input is present
        search_input = app_page.locator("#manufacturer-search")
        await expect(search_input).to_be_visible()
        
        # Test typing in search
        await search_input.fill("Alesis")
        await app_page.wait_for_timeout(500)  # Wait for search results
        
        # Check that dropdown appears
        dropdown = app_page.locator("#manufacturer-dropdown-list")
        await expect(dropdown).to_be_visible()
    
    async def test_midi_controls(self, app_page: Page, helpers):
        """Test MIDI control functionality"""
        # Check MIDI controls are present
        midi_toggle = app_page.locator("#midi-toggle")
        midi_device_select = app_page.locator("#midi-device-select")
        midi_device_info = app_page.locator("#midi-device-info")
        
        await expect(midi_toggle).to_be_visible()
        await expect(midi_device_select).to_be_visible()
        await expect(midi_device_info).to_be_visible()
        
        # Test clicking MIDI toggle
        await midi_toggle.click()
        await app_page.wait_for_timeout(1000)  # Wait for MIDI initialization
        
        # Check that device select is enabled
        await expect(midi_device_select).not_to_be_disabled()
        
        # Check device info updates
        device_info_text = await midi_device_info.text_content()
        assert "Not connected" in device_info_text or "WebMIDI not supported" in device_info_text
    
    async def test_device_selection_workflow(self, app_page: Page, helpers):
        """Test complete device selection workflow"""
        # Navigate to manufacturer tab
        await helpers.click_tab(app_page, "manufacturer")
        
        # Search for a manufacturer
        await helpers.fill_manufacturer_search(app_page, "Alesis")
        await app_page.wait_for_timeout(500)
        
        # Check that devices appear
        devices_section = app_page.locator("#manufacturer-devices")
        await expect(devices_section).to_be_visible()
        
        # Look for device list items
        device_items = devices_section.locator(".device-item")
        if await device_items.count() > 0:
            # Click on first device
            await device_items.first.click()
            await app_page.wait_for_timeout(1000)  # Wait for device details to load
            
            # Navigate to device tab
            await helpers.click_tab(app_page, "device")
            
            # Check that device content is loaded
            device_content = app_page.locator("#device-content")
            await expect(device_content).not_to_contain_text("Please select a device")
    
    async def test_catalog_functionality(self, app_page: Page, helpers):
        """Test catalog tab functionality"""
        await helpers.click_tab(app_page, "catalog")
        
        # Check that catalog content loads
        catalog_content = app_page.locator("#catalog-content")
        await expect(catalog_content).to_be_visible()
        
        # Check for refresh button
        refresh_btn = app_page.locator("#refresh-catalog-btn")
        await expect(refresh_btn).to_be_visible()
        
        # Click refresh button
        await refresh_btn.click()
        await app_page.wait_for_timeout(2000)  # Wait for catalog refresh
        
        # Check that status updates
        catalog_status = app_page.locator("#catalog-status")
        await expect(catalog_status).to_be_visible()
    
    async def test_builder_functionality(self, app_page: Page, helpers):
        """Test builder tab functionality"""
        await helpers.click_tab(app_page, "builder")
        
        # Check builder content
        builder_content = app_page.locator("#builder-content")
        await expect(builder_content).to_be_visible()
        
        # Check for create button
        create_btn = app_page.locator("#create-midnam-btn")
        await expect(create_btn).to_be_visible()
        
        # Check for load template button
        template_btn = app_page.locator("#load-template-btn")
        await expect(template_btn).to_be_visible()
    
    async def test_debug_console(self, app_page: Page, helpers):
        """Test debug tab functionality"""
        await helpers.click_tab(app_page, "debug")
        
        # Check debug content
        debug_content = app_page.locator("#debug-content")
        await expect(debug_content).to_be_visible()
        
        # Check for console
        debug_console = app_page.locator("#debug-console")
        await expect(debug_console).to_be_visible()
        
        # Check for clear button
        clear_btn = app_page.locator("#clear-console-btn")
        await expect(clear_btn).to_be_visible()
        
        # Check for test MIDI button
        test_midi_btn = app_page.locator("#test-midi-btn")
        await expect(test_midi_btn).to_be_visible()


@pytest.mark.e2e
@pytest.mark.slow
class TestMIDIFunctionality:
    """Test MIDI-related functionality (requires MIDI hardware)"""
    
    async def test_midi_device_selection(self, app_page: Page, helpers):
        """Test MIDI device selection workflow"""
        # Enable MIDI
        await helpers.enable_midi(app_page)
        
        # Check device dropdown is populated
        device_select = app_page.locator("#midi-device-select")
        options = await device_select.locator("option").all()
        
        # Should have at least the placeholder option
        assert len(options) >= 1
        
        # If there are MIDI devices available, test selection
        if len(options) > 1:
            # Select first real device (not placeholder)
            await device_select.select_option(index=1)
            await app_page.wait_for_timeout(500)
            
            # Check device info updates
            device_info = app_page.locator("#midi-device-info")
            device_info_text = await device_info.text_content()
            assert "Connected:" in device_info_text or "Not connected" in device_info_text
    
    async def test_midi_note_playback(self, app_page: Page, helpers):
        """Test MIDI note playback functionality"""
        # Enable MIDI and select device
        await helpers.enable_midi(app_page)
        
        device_select = app_page.locator("#midi-device-select")
        options = await device_select.locator("option").all()
        
        if len(options) > 1:
            await device_select.select_option(index=1)
            await app_page.wait_for_timeout(500)
            
            # Navigate to device tab to test note playback
            await helpers.click_tab(app_page, "device")
            
            # Look for playable note elements
            playable_notes = app_page.locator(".note-number-cell.playable")
            if await playable_notes.count() > 0:
                # Click on first playable note
                await playable_notes.first.click()
                await app_page.wait_for_timeout(200)  # Wait for note to play


@pytest.mark.e2e
class TestErrorHandling:
    """Test error handling in the UI"""
    
    async def test_invalid_manufacturer_search(self, app_page: Page, helpers):
        """Test searching for non-existent manufacturer"""
        await helpers.click_tab(app_page, "manufacturer")
        
        # Search for non-existent manufacturer
        await helpers.fill_manufacturer_search(app_page, "NonExistentManufacturer123")
        await app_page.wait_for_timeout(500)
        
        # Check that appropriate message is shown
        devices_section = app_page.locator("#manufacturer-devices")
        await expect(devices_section).to_be_visible()
    
    async def test_midi_not_supported(self, app_page: Page):
        """Test behavior when WebMIDI is not supported"""
        # This test would need to be run in a browser that doesn't support WebMIDI
        # or with WebMIDI disabled
        
        midi_toggle = app_page.locator("#midi-toggle")
        await midi_toggle.click()
        
        # Check that appropriate message is shown
        device_info = app_page.locator("#midi-device-info")
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
        
        refresh_btn = app_page.locator("#refresh-catalog-btn")
        await refresh_btn.click()
        
        # Wait for catalog to load
        await app_page.wait_for_selector("#catalog-status", timeout=10000)
        
        load_time = time.time() - start_time
        
        # Catalog should load within reasonable time (10 seconds)
        assert load_time < 10, f"Catalog took too long to load: {load_time:.2f}s"
    
    async def test_manufacturer_search_performance(self, app_page: Page, helpers):
        """Test manufacturer search performance"""
        import time
        
        await helpers.click_tab(app_page, "manufacturer")
        
        # Measure search performance
        start_time = time.time()
        
        await helpers.fill_manufacturer_search(app_page, "Alesis")
        await app_page.wait_for_timeout(1000)  # Wait for search results
        
        search_time = time.time() - start_time
        
        # Search should be fast (under 2 seconds)
        assert search_time < 2, f"Search took too long: {search_time:.2f}s"


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
        midi_toggle = app_page.locator("#midi-toggle")
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



