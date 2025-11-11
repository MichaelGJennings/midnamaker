# Data Test ID Reference

This document provides a comprehensive reference for all `data-testid` attributes used throughout the Midnamaker application. These IDs are designed for easy identification in testing (Playwright, Selenium) and development.

## Naming Convention

Each test ID follows a consistent pattern:
```
{prefix}_{descriptive_name}[_{index}]
```

### Prefixes

- `btn_` - Buttons
- `npt_` - Input fields
- `sel_` - Select dropdowns
- `opt_` - Option elements
- `chk_` - Checkboxes
- `rad_` - Radio buttons
- `tab_` - Tab elements
- `sec_` - Sections/containers
- `mdl_` - Modals
- `lst_` - Lists
- `itm_` - List items
- `lbl_` - Labels
- `spn_` - Spans
- `icn_` - Icons
- `div_` - Generic divs
- `tbl_` - Tables
- `row_` - Table rows
- `cel_` - Table cells
- `grp_` - Groups of related elements
- `tgl_` - Toggle elements
- `drp_` - Dropdowns
- `msg_` - Messages/notifications
- `hdr_` - Headers
- `ftr_` - Footers
- `ttp_` - Tooltips

---

## Global Elements

### Header
- `sec_header` - Main header container
- `hdr_app_title` - Application title
- `sec_global_midi_controls` - MIDI controls section
- `tgl_midi` - MIDI toggle button
- `icn_midi_dot` - MIDI status indicator dot
- `lbl_midi` - MIDI label
- `sec_midi_device` - MIDI device section
- `sel_midi_device` - MIDI device selector
- `opt_midi_device_placeholder` - MIDI device placeholder option
- `div_midi_device_info` - MIDI device info text

### Navigation Tabs
- `sec_tabs` - Tabs container
- `tab_manufacturer` - Manufacturer tab
- `tab_device` - Device tab
- `tab_patch` - Patch tab
- `tab_catalog` - Catalog tab
- `tab_tools` - Tools tab

---

## Manufacturer Tab

### Manufacturer Section
- `sec_manufacturer_tab` - Manufacturer tab content
- `sec_manufacturer_container` - Main container
- `sec_manufacturer_collapsible` - Collapsible section
- `hdr_manufacturer_section` - Section header
- `hdr_manufacturer_title` - "Select Manufacturer" title
- `grp_manufacturer_actions` - Action buttons group
- `btn_add_manufacturer` - Add manufacturer button
- `btn_toggle_manufacturer_list` - Toggle list visibility
- `icn_toggle_manufacturer` - Toggle icon
- `sec_manufacturer_content` - Content section
- `sec_manufacturer_filter` - Filter section
- `npt_manufacturer_filter` - Filter input
- `sec_manufacturer_list_container` - List container
- `lst_manufacturers` - Manufacturers list
- `msg_manufacturer_loading` - Loading message
- `msg_no_manufacturers` - Empty state message
- `msg_manufacturer_error` - Error message

### Manufacturer List Items
- `itm_manufacturer_{name}` - Individual manufacturer item (name is normalized)
- `div_manufacturer_name` - Manufacturer name
- `div_manufacturer_count` - Device count

### Device List
- `sec_device_list_container` - Device list container
- `hdr_device_list` - Device list header
- `hdr_selected_manufacturer` - Selected manufacturer name
- `grp_device_list_actions` - Device actions group
- `btn_add_device` - Add device button
- `btn_change_manufacturer` - Change manufacturer button
- `lst_devices` - Devices list
- `msg_no_devices` - No devices message
- `itm_device_{name}` - Individual device item (name is normalized)
- `div_device_name` - Device name
- `div_device_type` - Device type

### File Disambiguation
- `sec_file_disambiguation` - Disambiguation dialog
- `div_disambiguation_prompt` - Prompt message
- `lst_file_selection` - File selection list
- `itm_file_{index}` - File item
- `hdr_file_{index}` - File header
- `div_file_name` - File name
- `div_file_type_badge` - File type badge
- `div_file_meta` - File metadata
- `spn_file_path` - File path

---

## Device Tab

### Device Header
- `sec_device_tab` - Device tab content
- `hdr_device` - Device header
- `hdr_device_title` - Device title
- `grp_device_actions` - Action buttons group
- `grp_save_device_split` - Split button group
- `btn_save_device` - Save button
- `btn_save_device_dropdown` - Dropdown toggle
- `drp_save_device_menu` - Dropdown menu
- `btn_save_device_only` - Save only option
- `btn_save_device_download` - Download option
- `btn_validate_device` - Validate button

### Device Content
- `sec_device_content` - Device content area
- `msg_device_empty` - Empty state message
- `msg_device_empty_state` - Alternative empty state
- `sec_structure_editor` - Structure editor container
- `sec_device_info_grid` - Device info grid

### Device Information
- `sec_device_name_info` - Device name section
- `lbl_device_name` - Device name label
- `div_device_name_value` - Device name value
- `sec_manufacturer_info` - Manufacturer section
- `lbl_manufacturer` - Manufacturer label
- `div_manufacturer_value` - Manufacturer value
- `sec_model_info` - Model section
- `lbl_model` - Model label
- `div_model_value` - Model value
- `sec_version_info` - Version section
- `lbl_version` - Version label
- `div_version_value` - Version value

### Patch Banks
- `sec_patch_banks` - Patch banks section
- `sec_no_patch_lists` - No patch lists message
- `hdr_no_patch_lists` - Header for no lists
- `hdr_patch_banks_section` - Patch banks header section
- `hdr_patch_banks` - Patch banks title
- `btn_add_patch_bank` - Add patch bank button
- `itm_patch_bank_{index}` - Patch bank item
- `hdr_patch_bank_{index}` - Patch bank header
- `div_patch_bank_name_{index}` - Bank name
- `icn_toggle_bank_{index}` - Toggle icon
- `npt_bank_name_{index}` - Bank name input
- `grp_patch_bank_actions_{index}` - Bank actions
- `btn_edit_patch_bank_{index}` - Edit button
- `btn_delete_patch_bank_{index}` - Delete button
- `sec_patch_bank_content_{index}` - Bank content
- `sec_bank_midi_commands_{index}` - MIDI commands section
- `lbl_bank_midi_command` - MIDI command label
- `spn_midi_command` - MIDI command item
- `btn_test_bank_select_{index}` - Test bank select button

### NameSets
- `sec_namesets` - NameSets section
- `hdr_namesets_section` - NameSets header section
- `hdr_namesets` - NameSets title
- `btn_add_nameset` - Add NameSet button
- `itm_nameset_{index}` - NameSet item
- `hdr_nameset_{index}` - NameSet header
- `div_nameset_name_{index}` - NameSet name
- `spn_nameset_name` - NameSet name span
- `spn_channel_availability` - Channel availability
- `grp_nameset_actions_{index}` - NameSet actions
- `btn_edit_nameset_{index}` - Edit button
- `btn_duplicate_nameset_{index}` - Duplicate button
- `btn_delete_nameset_{index}` - Delete button

### Download Modal
- `itm_download_link` - Download link item
- `div_download_link_info` - Link info
- `div_download_filename` - Filename
- `div_download_description` - Description
- `btn_download_file` - Download button
- `div_download_separator` - Separator

---

## Patch Tab

### Patch Header
- `sec_patch_tab` - Patch tab content
- `hdr_patch` - Patch header
- `hdr_patch_title` - Patch title
- `grp_patch_actions` - Action buttons group
- `grp_save_patch_split` - Split button group
- `btn_save_patch` - Save button
- `btn_save_patch_dropdown` - Dropdown toggle
- `drp_save_patch_menu` - Dropdown menu
- `btn_save_patch_only` - Save only option
- `btn_save_patch_download` - Download option

### Patch Content
- `sec_patch_content` - Patch content area
- `msg_patch_empty` - Empty state message
- `msg_patch_empty_state` - Alternative empty state
- `sec_patch_editor` - Patch editor container
- `sec_patch_info` - Patch info section
- `hdr_patch_name` - Patch name header
- `div_patch_meta` - Patch metadata
- `spn_patch_number` - Patch number
- `spn_patch_bank` - Patch bank

### Patch Details
- `sec_patch_details` - Patch details section
- `sec_patch_information` - Information section
- `hdr_patch_information` - Information header
- `grp_patch_name_form` - Name form group
- `lbl_patch_name` - Name label
- `npt_patch_name` - Name input
- `grp_patch_number_form` - Number form group
- `lbl_patch_number` - Number label
- `npt_patch_number` - Number input

### Note Names
- `sec_note_names` - Note names section
- `hdr_note_names` - Note names header
- `sec_note_names_content` - Content area
- `div_note_list_info` - Note list info
- `lbl_note_list` - Note list label
- `spn_note_count` - Note count
- `grp_note_editor_actions` - Editor actions
- `btn_add_note` - Add note button
- `grp_note_range_control` - Range control group
- `lbl_note_range` - Range label
- `sel_note_range_min` - Min selector
- `spn_note_range_separator` - Separator
- `sel_note_range_max` - Max selector
- `btn_extend_note_range` - Extend button

### Note Table
- `sec_note_table_container` - Table container
- `tbl_notes` - Notes table
- `hdr_note_table` - Table header
- `row_note_table_header` - Header row
- `cel_note_number_header` - Note # header
- `cel_note_name_header` - Name header
- `cel_note_actions_header` - Actions header
- `lst_notes_tbody` - Table body
- `row_note_{index}` - Note row
- `cel_note_number_{index}` - Note number cell
- `spn_note_display_{index}` - Note display
- `cel_note_name_{index}` - Note name cell
- `npt_note_name_{index}` - Note name input
- `drp_note_suggestions_{index}` - Suggestions dropdown
- `cel_note_actions_{index}` - Actions cell
- `btn_insert_note_{index}` - Insert button

---

## Catalog Tab

### Catalog Header
- `sec_catalog_tab` - Catalog tab content
- `hdr_catalog` - Catalog header
- `hdr_catalog_title` - Catalog title
- `grp_catalog_actions` - Action buttons group
- `btn_refresh_catalog` - Refresh button
- `btn_analyze_catalog` - Analyze button

### Catalog Content
- `sec_catalog_content` - Catalog content area
- `msg_catalog_loading` - Loading message
- `msg_catalog_loading_state` - Loading state
- `msg_no_catalog_data` - No data message
- `div_catalog_status` - Status container
- `div_catalog_status_text` - Status text

### Catalog Table
- `tbl_catalog` - Catalog table
- `hdr_catalog_table` - Table header
- `row_catalog_header` - Header row
- `cel_device_key_header` - Device key header
- `cel_type_header` - Type header
- `cel_files_header` - Files header
- `cel_actions_header` - Actions header
- `row_catalog_device_{index}` - Device row
- `cel_device_key_{index}` - Device key cell
- `cel_device_type_{index}` - Type cell
- `spn_device_type` - Type span
- `cel_device_files_{index}` - Files cell
- `cel_device_actions_{index}` - Actions cell
- `grp_catalog_device_actions_{index}` - Actions group
- `btn_view_device_{index}` - View button
- `btn_edit_device_{index}` - Edit button
- `btn_delete_device_{index}` - Delete button

### File List
- `spn_no_files` - No files message
- `lst_device_files_{deviceIndex}` - Files list
- `itm_file_{deviceIndex}_{fileIndex}` - File item
- `spn_file_path` - File path
- `spn_file_size` - File size

---

## Tools Tab

### Tools Header
- `sec_tools_tab` - Tools tab content
- `sec_tools_content` - Tools content area

### File Upload
- `sec_tool_upload` - Upload section
- `hdr_upload_files` - Upload header
- `div_upload_description` - Description
- `sec_upload_area` - Upload area
- `npt_file_upload` - File input
- `btn_choose_files` - Choose files button
- `icn_file_upload` - Upload icon
- `lst_upload_files` - Upload files list
- `btn_upload_files` - Upload button
- `itm_upload_file_{index}` - File item
- `spn_upload_file_name` - File name
- `spn_upload_file_size` - File size
- `btn_remove_upload_file` - Remove button

### Installation Instructions
- `sec_tool_install_instructions` - Instructions section
- `hdr_install_instructions` - Instructions header
- `div_install_description` - Description
- `sec_install_info` - Info section
- `div_install_locations_intro` - Intro text
- `lst_install_locations` - Locations list
- `itm_install_macos` - macOS item
- `itm_install_windows` - Windows item
- `itm_install_linux` - Linux item
- `div_install_note` - Note

### Note Consistency Tool
- `hdr_note_consistency_tool` - Tool header
- `div_note_consistency_description` - Description
- `sec_bank_selector` - Bank selector section
- `lbl_filter_bank` - Filter label
- `sel_tools_bank` - Bank selector
- `opt_all_banks` - All banks option
- `opt_bank_{index}` - Bank option
- `lbl_sort_by` - Sort label
- `sel_tools_sort` - Sort selector
- `opt_sort_alphabetical` - Alphabetical option
- `opt_sort_usage` - Usage count option
- `btn_refresh_note_list` - Refresh button
- `sec_index_stats` - Stats section
- `spn_index_count` - Entry count
- `spn_index_size` - Size
- `spn_pending_changes` - Pending changes
- `sec_index_search` - Search section
- `npt_index_search` - Search input
- `btn_clear_search` - Clear button
- `lst_index_entries` - Entries list
- `msg_no_note_names` - Empty state
- `msg_no_note_names_display` - Display empty state
- `itm_note_name_{index}` - Note name item
- `div_note_entry_content_{index}` - Entry content
- `spn_note_name` - Note name
- `spn_usage_count` - Usage count
- `drp_note_usage_{index}` - Usage dropdown
- `grp_note_actions_{index}` - Actions group
- `btn_remove_note` - Remove button

### Debug Console
- `sec_tool_debug` - Debug section
- `hdr_debug_console` - Console header
- `hdr_debug_title` - Console title
- `btn_clear_console` - Clear button
- `div_debug_console` - Console container
- `div_debug_message` - Debug message

---

## Modals

### Generic Modal
- `mdl_overlay` - Modal overlay
- `mdl_generic` - Generic modal
- `hdr_modal` - Modal header
- `hdr_modal_title` - Modal title
- `btn_modal_close` - Close button
- `div_modal_body` - Modal body
- `ftr_modal` - Modal footer
- `btn_modal_cancel` - Cancel button
- `btn_modal_confirm` - Confirm button
- `btn_modal_cancel_dynamic` - Dynamic cancel button
- `btn_modal_confirm_dynamic` - Dynamic confirm button

### Disambiguation Modal
- `mdl_disambiguation_overlay` - Overlay
- `mdl_disambiguation` - Modal
- `hdr_disambiguation` - Header
- `hdr_disambiguation_title` - Title
- `div_disambiguation_body` - Body
- `div_disambiguation_message` - Message
- `lst_disambiguation` - List
- `ftr_disambiguation` - Footer
- `btn_disambiguation_cancel` - Cancel button

### Download Modal
- `mdl_download_overlay` - Overlay
- `mdl_download` - Modal
- `hdr_download` - Header
- `hdr_download_title` - Title
- `btn_download_close` - Close button
- `div_download_body` - Body
- `div_download_instructions` - Instructions
- `div_download_note` - Note
- `lst_download_links` - Links list
- `ftr_download` - Footer
- `btn_download_cancel` - Cancel button

---

## Components

### Keyboard Tooltip
- `ttp_keyboard` - Keyboard tooltip (static, in HTML)
- `ttp_keyboard_key` - Keyboard key tooltip (dynamic)
- `icn_keyboard` - Keyboard icon
- `spn_key_mapping` - Key mapping text

---

## Playwright/Selenium Usage Examples

### Basic Selection
```javascript
// Playwright
await page.getByTestId('btn_save_device').click();
await page.getByTestId('npt_manufacturer_filter').fill('Roland');
await page.getByTestId('tab_patch').click();

// Selenium (Python)
driver.find_element(By.CSS_SELECTOR, '[data-testid="btn_save_device"]').click()
driver.find_element(By.CSS_SELECTOR, '[data-testid="npt_manufacturer_filter"]').send_keys('Roland')
driver.find_element(By.CSS_SELECTOR, '[data-testid="tab_patch"]').click()
```

### Indexed Elements
```javascript
// Click the first manufacturer
await page.getByTestId('itm_manufacturer_0').click();

// Edit the second patch bank
await page.getByTestId('btn_edit_patch_bank_1').click();

// Check the third note in the list
const noteValue = await page.getByTestId('npt_note_name_2').inputValue();
```

### Visibility Checks
```javascript
// Check if empty state is visible
await expect(page.getByTestId('msg_device_empty')).toBeVisible();

// Wait for loading to disappear
await expect(page.getByTestId('msg_catalog_loading')).not.toBeVisible();
```

### Complex Interactions
```javascript
// Open dropdown and select option
await page.getByTestId('btn_save_device_dropdown').click();
await page.getByTestId('btn_save_device_download').click();

// Fill form and submit
await page.getByTestId('npt_patch_name').fill('My Patch');
await page.getByTestId('npt_patch_number').fill('1');
await page.getByTestId('btn_save_patch').click();
```

---

## Notes

- **Uniqueness**: All IDs are unique except for repeated items in lists (which use indexed suffixes)
- **Consistency**: Prefixes are always lowercase and 3-4 characters
- **Naming**: Names are descriptive and use snake_case
- **Dynamic Elements**: Elements created via JavaScript have the same ID scheme as static HTML
- **Normalization**: Dynamic IDs based on user data (like manufacturer names) are normalized (lowercase, spaces to underscores)

---

## Maintenance

When adding new UI elements:
1. Choose the appropriate prefix from the list above
2. Use descriptive snake_case naming
3. Add index suffix if element is part of a series
4. Document the new ID in this file
5. Ensure uniqueness within the context

---

**Last Updated**: 2025-11-02
**Version**: 1.0.0

