# Playwright Configuration
# This file configures Playwright for end-to-end testing

import os
import pytest
from typing import AsyncGenerator

# Optional Playwright imports for E2E tests
try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_TIMEOUT = 30000  # 30 seconds

# Playwright fixtures (only available if Playwright is installed)
if PLAYWRIGHT_AVAILABLE:
    @pytest.fixture(scope="function")
    async def browser_context_args():
        """Configure browser context for all tests"""
        return {
            "viewport": {"width": 1280, "height": 720},
            "ignore_https_errors": True,
            "accept_downloads": True,
            "permissions": ["midi", "midi-sysex"],  # Grant MIDI permissions
        }

    @pytest.fixture(scope="function")
    async def browser_type_launch_args():
        """Configure browser launch arguments"""
        return {
            "headless": True,  # Set to False for debugging
            "slow_mo": 0,      # Add delay between actions (ms)
        }

    @pytest.fixture(scope="function")
    async def playwright_browser(browser_type_launch_args, browser_context_args):
        """Function-scoped browser instance"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(**browser_type_launch_args)
            context = await browser.new_context(**browser_context_args)
            yield browser
            await context.close()
            await browser.close()

    @pytest.fixture
    async def page(playwright_browser: Browser) -> AsyncGenerator[Page, None]:
        """Create a new page for each test"""
        context = await playwright_browser.new_context()
        page = await context.new_page()
        
        # Set default timeout
        page.set_default_timeout(TEST_TIMEOUT)
        
        # Add console logging for debugging (filter out MIDI-related messages)
        def console_handler(msg):
            # Filter out MIDI-related console messages during testing
            if any(keyword in msg.text.lower() for keyword in ['midi', 'notallowederror', 'webmidi', 'skipped for testing']):
                return
            print(f"Console {msg.type}: {msg.text}")
        
        page.on("console", console_handler)
        page.on("pageerror", lambda error: print(f"Page error: {error}"))
        
        yield page
        await context.close()

    @pytest.fixture
    async def app_page(page: Page):
        """Navigate to the main application page"""
        # Set environment variable to disable MIDI during testing
        await page.add_init_script("""
            // Disable MIDI initialization during testing
            window.DISABLE_MIDI_FOR_TESTING = true;
        """)
        
        await page.goto(f"{BASE_URL}/index.html")
        await page.wait_for_load_state("networkidle")
        return page
    
    @pytest.fixture
    async def app_page_with_midi(page: Page):
        """Navigate to the main application page WITH MIDI enabled"""
        # Don't disable MIDI for this fixture
        await page.goto(f"{BASE_URL}/index.html")
        await page.wait_for_load_state("networkidle")
        return page

# Test data fixtures
@pytest.fixture
def sample_midnam_data():
    """Sample MIDI name document data for testing"""
    return {
        "manufacturer": "Test Manufacturer",
        "model": "Test Model",
        "author": "Test Author",
        "banks": [
            {
                "name": "Bank 1",
                "rom": False,
                "patches": [
                    {"number": 0, "name": "Patch 1"},
                    {"number": 1, "name": "Patch 2"},
                ]
            }
        ]
    }

@pytest.fixture
def sample_middev_data():
    """Sample MIDI device type data for testing"""
    return {
        "manufacturer": "Test Manufacturer",
        "model": "Test Model",
        "supports_general_midi": True,
        "is_sampler": False,
        "is_drum_machine": False,
    }

# Utility functions for tests (only available if Playwright is installed)
if PLAYWRIGHT_AVAILABLE:
    class TestHelpers:
        """Helper methods for common test operations"""
        
        @staticmethod
        async def wait_for_tab_content(page: Page, tab_name: str):
            """Wait for tab content to load"""
            await page.wait_for_selector(f'[data-testid="sec_{tab_name}_tab"]')
        
        @staticmethod
        async def click_tab(page: Page, tab_name: str):
            """Click on a tab and wait for content to load"""
            await page.get_by_test_id(f"tab_{tab_name}").click()
            await TestHelpers.wait_for_tab_content(page, tab_name)
        
        @staticmethod
        async def fill_manufacturer_filter(page: Page, manufacturer: str):
            """Fill the manufacturer filter field"""
            await page.get_by_test_id("npt_manufacturer_filter").fill(manufacturer)
            await page.wait_for_timeout(500)  # Wait for filter to apply
        
        @staticmethod
        async def select_manufacturer(page: Page, manufacturer: str):
            """Select a manufacturer from the list"""
            await TestHelpers.fill_manufacturer_filter(page, manufacturer)
            # Find and click the manufacturer item - use text-based selector as fallback
            manufacturer_items = page.locator('[data-testid^="itm_manufacturer_"]')
            count = await manufacturer_items.count()
            for i in range(count):
                item = manufacturer_items.nth(i)
                text = await item.text_content()
                if manufacturer.lower() in text.lower():
                    await item.click()
                    await page.wait_for_timeout(1000)
                    return
            # Fallback: click by text
            await page.locator(f'text="{manufacturer}"').first.click()
            await page.wait_for_timeout(1000)
        
        @staticmethod
        async def enable_midi(page: Page):
            """Enable MIDI by clicking the MIDI toggle"""
            await page.get_by_test_id("tgl_midi").click()
            await page.wait_for_timeout(1000)  # Wait for MIDI initialization
        
        @staticmethod
        async def select_midi_device(page: Page, device_name: str):
            """Select a MIDI device from the dropdown"""
            await page.get_by_test_id("sel_midi_device").select_option(label=device_name)
            await page.wait_for_timeout(500)
        
        @staticmethod
        async def load_test_device(page: Page, manufacturer: str = "TestManufacturer", device: str = "TestModel"):
            """Load a test device (defaults to TestManufacturer TestModel)"""
            # Navigate to manufacturer tab
            await page.click('[data-testid="tab_manufacturer"]')
            await page.wait_for_timeout(1000)
            
            # Make sure manufacturer section is expanded
            manufacturer_section = page.locator('#manufacturer-section-collapsible')
            section_class = await manufacturer_section.get_attribute('class')
            if 'collapsed' in section_class:
                # Click header to expand
                await page.click('[data-testid="hdr_manufacturer_section"]')
                await page.wait_for_timeout(500)
            
            # Filter and select manufacturer
            await TestHelpers.fill_manufacturer_filter(page, manufacturer)
            await page.wait_for_timeout(500)
            
            # Click on manufacturer (use force to bypass overlapping elements)
            manufacturer_items = page.locator('[data-testid^="itm_manufacturer_"]')
            count = await manufacturer_items.count()
            for i in range(count):
                item = manufacturer_items.nth(i)
                text = await item.text_content()
                if manufacturer.lower() in text.lower():
                    await item.click(force=True)
                    await page.wait_for_timeout(1000)
                    break
            
            # Wait for device list to load
            await page.wait_for_timeout(500)
            
            # Click on device (use force to bypass overlapping elements)
            device_items = page.locator('[data-testid^="itm_device_"]')
            device_count = await device_items.count()
            for i in range(device_count):
                item = device_items.nth(i)
                text = await item.text_content()
                if device.lower() in text.lower():
                    await item.click(force=True)
                    await page.wait_for_timeout(2000)  # Wait for device to load
                    break
            
            # Should now be on device tab with device loaded
            return page
        
        @staticmethod
        async def select_first_patch(page: Page):
            """Click on the first patch in the device tab to load it in patch editor"""
            # Make sure we're on device tab
            await page.click('[data-testid="tab_device"]')
            await page.wait_for_timeout(1000)
            
            # Wait for device content to load
            await page.wait_for_selector('.patch-name.clickable', timeout=10000)
            
            # Find and click first patch name
            first_patch = page.locator('.patch-name.clickable').first
            await first_patch.wait_for(state='visible')
            await first_patch.click()
            await page.wait_for_timeout(1500)
            
            # Verify we're now on patch tab
            patch_tab_active = await page.locator('[data-tab="patch"].active').count()
            if patch_tab_active == 0:
                # If not automatically switched, switch manually
                await page.click('[data-testid="tab_patch"]')
                await page.wait_for_timeout(500)
            
            # Should now be on patch tab with patch loaded
            return page
        
        @staticmethod
        async def load_test_device_and_patch(page: Page, manufacturer: str = "TestManufacturer", device: str = "TestModel"):
            """Load a test device and select the first patch"""
            await TestHelpers.load_test_device(page, manufacturer, device)
            await TestHelpers.select_first_patch(page)
            return page

    @pytest.fixture
    def helpers():
        """Provide test helper methods"""
        return TestHelpers
