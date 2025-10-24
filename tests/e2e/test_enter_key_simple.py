"""
Simple test to verify Enter key functionality in Note Editor
"""
import pytest
from playwright.async_api import async_playwright, expect


@pytest.mark.asyncio
async def test_enter_key_simple():
    """Simple test that creates a note input and tests Enter key"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            # Navigate to the application
            await page.goto("http://localhost:8000/midi_name_editor.html")
            await page.wait_for_load_state("networkidle")
            
            # Go to Patch tab
            await page.click('[data-tab="patch"]')
            await page.wait_for_timeout(1000)
            
            # Create a simple note editor by executing JavaScript
            await page.evaluate("""
                // Create a simple note editor for testing
                const container = document.getElementById('patch-editor-container');
                if (container) {
                    container.innerHTML = `
                        <div class="structure-item">
                            <h3>Test Note Editor</h3>
                            <div class="note-table-container">
                                <table class="note-table" id="note-table">
                                    <thead>
                                        <tr>
                                            <th>Note #</th>
                                            <th>Note Name</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="note-table-body">
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                    
                    // Add a test note row
                    addNoteRow(36, 'Test Note');
                }
            """)
            
            await page.wait_for_timeout(500)
            
            # Find the note name input
            note_name_input = page.locator('.note-name-input').first
            await expect(note_name_input).to_be_visible()
            
            # Clear and type a new note name
            await note_name_input.clear()
            await note_name_input.fill("New Test Note")
            
            # Press Enter key
            await note_name_input.press("Enter")
            
            # Wait for focus change
            await page.wait_for_timeout(200)
            
            # Check what element has focus
            focused_element = await page.evaluate("document.activeElement")
            focused_tag = await page.evaluate("document.activeElement.tagName")
            focused_class = await page.evaluate("document.activeElement.className")
            
            print(f"Focused element after Enter: {focused_tag} with class: {focused_class}")
            
            # Verify focus moved to Add button
            assert "add-note-btn" in focused_class, f"Expected focus on Add button, but got class: {focused_class}"
            
            print("✅ Enter key successfully moved focus to Add button")
            
        finally:
            await browser.close()









