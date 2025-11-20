#!/usr/bin/env python3
"""
Simple HTTP server for Midnamaker
Run with: python3 server.py
Then open: http://localhost:8000/index.html
"""

import http.server
import socketserver
import os
import sys
import json
from urllib.parse import urlparse, parse_qs

class MIDINameHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()
    
    def do_HEAD(self):
        # Handle HEAD requests - same as GET but without body
        self.do_GET()
    
    def do_GET(self):
        # Strip query parameters for path matching
        path_without_query = self.path.split('?')[0]
        
        if path_without_query.startswith('/patchfiles/'):
            self.serve_patchfile()
        elif path_without_query == '/manufacturers' or path_without_query == '/api/manufacturers':
            self.serve_manufacturers()
        elif path_without_query.startswith('/api/device/'):
            self.serve_device_details()
        elif path_without_query == '/midnam_catalog' or path_without_query == '/api/midnam_catalog':
            self.serve_midnam_catalog()
        elif path_without_query.startswith('/analyze_file/'):
            self.analyze_midnam_file()
        elif path_without_query.startswith('/api/download/midnam/'):
            self.download_midnam()
        elif path_without_query.startswith('/api/download/middev/'):
            self.download_middev()
        elif path_without_query.startswith('/api/download/zip/'):
            self.download_zip()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/save_file':
            self.save_file()
        elif self.path == '/api/patch/save':
            self.save_patch()
        elif self.path == '/api/midnam/save':
            self.save_midnam_structure()
        elif self.path == '/api/midnam/reload':
            self.reload_midnam()
        elif self.path == '/api/validate':
            self.validate_midnam()
        elif self.path == '/api/middev/create':
            self.create_middev_file()
        elif self.path == '/api/middev/add-device':
            self.add_device_to_middev()
        elif self.path == '/clear_cache':
            self.clear_cache()
        elif self.path == '/merge_files':
            self.merge_midnam_files()
        elif self.path == '/delete_file':
            self.delete_midnam_file()
        elif self.path == '/api/upload_files':
            self.upload_files()
        else:
            self.send_error(404)
    
    def save_file(self):
        try:
            import json
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            
            # Parse JSON data
            data = json.loads(post_data)
            file_path = data.get('file_path')
            xml_content = data.get('xml_content')
            
            if not file_path or not xml_content:
                self.send_error(400, "Missing file_path or xml_content")
                return
            
            # Create backup
            import shutil
            from datetime import datetime
            backup_name = f'{file_path}.backup.{datetime.now().strftime("%Y-%m-%d-%H-%M-%S")}'
            shutil.copy(file_path, backup_name)
            
            # Save new content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(xml_content)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True, 
                'backup': backup_name,
                'file_path': file_path
            }).encode())
            
        except Exception as e:
            self.send_error(500, f"Error saving file: {str(e)}")
    
    def save_patch(self):
        """Save patch changes"""
        try:
            import json
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            
            # Parse JSON data
            data = json.loads(post_data)
            device_id = data.get('deviceId')
            patch_bank = data.get('patchBank')
            patch = data.get('patch')
            original_patch_name = data.get('originalPatchName')
            notes = data.get('notes', [])
            note_list_name = data.get('noteListName')
            
            if not device_id or not patch:
                self.send_error(400, "Missing required fields")
                return
            
            # Use original name to find the patch, fall back to current name
            patch_name_to_find = original_patch_name if original_patch_name else patch.get('name')
            
            # Find the corresponding .midnam file
            patch_files = self.get_patch_files()
            device_file = None
            
            for pfile in patch_files:
                if pfile.get('id') == device_id:
                    device_file = pfile.get('file_path')
                    break
            
            if not device_file:
                # NOTE: We cannot auto-create a valid file because we only extract and store
                # the portions of the XML we're editing (patches, notes). We don't maintain
                # a complete representation of all XML elements, so we can't reconstruct a
                # valid .midnam file from scratch.
                
                # Log details for debugging
                print(f"[save_patch] No valid file found for <{device_id}> for the update")
                print(f"[save_patch] This device may have been excluded from the catalog due to invalid XML or missing required elements")
                print(f"[save_patch] Available devices in catalog: {len(patch_files)}")
                for pf in patch_files[:5]:  # Show first 5 devices
                    print(f"  - {pf.get('id')} -> {pf.get('file_path')}")
                if len(patch_files) > 5:
                    print(f"  ... and {len(patch_files) - 5} more")
                
                self.send_error(404, f"No valid file found for <{device_id}> for the update. The file may have invalid XML or missing required elements (MIDINameDocument root, Manufacturer, Model).")
                return
            
            if not os.path.exists(device_file):
                self.send_error(404, f"Device file not found: {device_file}")
                return
            
            # Parse XML and update patch notes
            import xml.etree.ElementTree as ET
            try:
                tree = ET.parse(device_file)
                root = tree.getroot()
            except ET.ParseError as e:
                self.send_error(422, f"Cannot save to invalid XML file: {device_file}. Parse error: {str(e)}")
                return
            
            # Find the patch and update its note list
            patch_found = False
            for bank in root.findall('.//PatchBank'):
                if bank.get('Name') == patch_bank:
                    for patch_elem in bank.findall('.//Patch'):
                        if patch_elem.get('Name') == patch_name_to_find:
                            patch_found = True
                            
                            # Update patch name and number
                            if patch.get('name'):
                                patch_elem.set('Name', patch.get('name'))
                            if patch.get('number'):
                                patch_elem.set('Number', patch.get('number'))
                            
                            # Handle note list
                            # First check if note list name was provided in request (for new note lists)
                            # Otherwise check existing UsesNoteNameList element
                            actual_note_list_name = note_list_name
                            uses_note_list = patch_elem.find('UsesNoteNameList')
                            
                            if not actual_note_list_name and uses_note_list is not None:
                                actual_note_list_name = uses_note_list.get('Name')
                            
                            if actual_note_list_name and notes:
                                # Ensure the patch has a UsesNoteNameList element
                                if uses_note_list is None:
                                    uses_note_list = ET.SubElement(patch_elem, 'UsesNoteNameList')
                                uses_note_list.set('Name', actual_note_list_name)
                                
                                # Find or create the note list
                                note_list_elem = None
                                for note_list in root.findall('.//NoteNameList'):
                                    if note_list.get('Name') == actual_note_list_name:
                                        note_list_elem = note_list
                                        break
                                
                                if note_list_elem is None:
                                    # Create new note list - need to find the right parent
                                    # Note lists typically go in MasterDeviceNames or ChannelNameSet
                                    master_device = root.find('.//MasterDeviceNames')
                                    if master_device is not None:
                                        # Find or create CustomNoteNameList container
                                        custom_note_name_list = master_device.find('CustomNoteNameList')
                                        if custom_note_name_list is None:
                                            custom_note_name_list = ET.SubElement(master_device, 'CustomNoteNameList')
                                        note_list_elem = ET.SubElement(custom_note_name_list, 'NoteNameList')
                                        note_list_elem.set('Name', actual_note_list_name)
                                        print(f"[save_patch] Created new NoteNameList: {actual_note_list_name}")
                                
                                if note_list_elem is not None:
                                    # Clear existing notes
                                    for note in note_list_elem.findall('Note'):
                                        note_list_elem.remove(note)
                                    
                                    # Add updated notes
                                    for note_data in notes:
                                        note_elem = ET.SubElement(note_list_elem, 'Note')
                                        note_elem.set('Number', str(note_data.get('number', '')))
                                        note_elem.set('Name', note_data.get('name', ''))
                                    
                                    print(f"[save_patch] Updated NoteNameList '{actual_note_list_name}' with {len(notes)} notes")
                            
                            break
                    if patch_found:
                        break
            
            if not patch_found:
                self.send_error(404, f"Patch '{patch_name_to_find}' not found in bank '{patch_bank}'")
                return
            
            # Ensure DTD compliance before saving
            print("[save_patch] Checking DTD compliance...")
            fixes_count = self._ensure_dtd_compliance(root)
            if fixes_count > 0:
                print(f"[save_patch] Applied {fixes_count} DTD compliance fix(es)")
            
            # Create backup
            import shutil
            from datetime import datetime
            backup_name = f'{device_file}.backup.{datetime.now().strftime("%Y-%m-%d-%H-%M-%S")}'
            shutil.copy(device_file, backup_name)
            
            # Pretty print XML
            self.indent_xml(root)
            
            # Save updated XML with pretty printing
            tree.write(device_file, encoding='utf-8', xml_declaration=True)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'backup': backup_name,
                'device_id': device_id,
                'patch_name': patch.get('name')
            }).encode())
            
        except Exception as e:
            self.send_error(500, f"Error saving patch: {str(e)}")
    
    def _update_patch_bank(self, patch_bank_elem, frontend_bank):
        """Helper method to update an existing PatchBank element"""
        import xml.etree.ElementTree as ET
        
        # Update bank name
        if 'name' in frontend_bank:
            patch_bank_elem.set('Name', frontend_bank['name'])
        
        # Update MIDI commands
        if 'midi_commands' in frontend_bank:
            # Remove existing MIDICommands
            existing_midi_commands = patch_bank_elem.find('MIDICommands')
            if existing_midi_commands is not None:
                patch_bank_elem.remove(existing_midi_commands)
            
            # Add new MIDICommands if there are any
            if frontend_bank['midi_commands']:
                midi_commands_elem = ET.Element('MIDICommands')
                # Insert MIDICommands before PatchNameList
                patch_name_list = patch_bank_elem.find('PatchNameList')
                if patch_name_list is not None:
                    patch_name_list_index = list(patch_bank_elem).index(patch_name_list)
                    patch_bank_elem.insert(patch_name_list_index, midi_commands_elem)
                else:
                    patch_bank_elem.insert(0, midi_commands_elem)
                
                for cmd in frontend_bank['midi_commands']:
                    if cmd.get('type') == 'ControlChange':
                        cc_elem = ET.SubElement(midi_commands_elem, 'ControlChange')
                        cc_elem.set('control', str(cmd.get('control', '0')))
                        cc_elem.set('value', str(cmd.get('value', '0')))
        
        # Update patches
        if 'patch' in frontend_bank:
            patch_name_list = patch_bank_elem.find('PatchNameList')
            if patch_name_list is not None:
                # Clear existing patches
                patch_name_list.clear()
                
                # Add updated patches
                for patch_data in frontend_bank['patch']:
                    patch_elem = ET.SubElement(patch_name_list, 'Patch')
                    patch_elem.set('Name', patch_data.get('name', ''))
                    patch_elem.set('Number', str(patch_data.get('Number', '')))
                    patch_elem.set('ProgramChange', str(patch_data.get('programChange', '')))
    
    def _create_patch_bank(self, parent_elem, frontend_bank):
        """Helper method to create a new PatchBank DEFINITION (with all children)"""
        import xml.etree.ElementTree as ET
        
        # Create new PatchBank element
        new_patch_bank = ET.SubElement(parent_elem, 'PatchBank')
        new_patch_bank.set('Name', frontend_bank.get('name', 'New Bank'))
        
        # Add MIDI commands if present
        if 'midi_commands' in frontend_bank and frontend_bank['midi_commands']:
            midi_commands_elem = ET.SubElement(new_patch_bank, 'MIDICommands')
            for cmd in frontend_bank['midi_commands']:
                if cmd.get('type') == 'ControlChange':
                    cc_elem = ET.SubElement(midi_commands_elem, 'ControlChange')
                    cc_elem.set('control', str(cmd.get('control', '0')))
                    cc_elem.set('value', str(cmd.get('value', '0')))
        
        # Add PatchNameList
        patch_name_list = ET.SubElement(new_patch_bank, 'PatchNameList')
        
        # Add patches
        if 'patch' in frontend_bank:
            for patch_data in frontend_bank['patch']:
                patch_elem = ET.SubElement(patch_name_list, 'Patch')
                patch_elem.set('Name', patch_data.get('name', ''))
                patch_elem.set('Number', str(patch_data.get('Number', '')))
                patch_elem.set('ProgramChange', str(patch_data.get('programChange', '')))
        
        return new_patch_bank
    
    def _create_patch_bank_reference(self, parent_elem, bank_name):
        """Helper method to create a PatchBank REFERENCE (empty element with just Name)"""
        import xml.etree.ElementTree as ET
        
        # Create empty PatchBank reference element
        ref = ET.SubElement(parent_elem, 'PatchBank')
        ref.set('Name', bank_name)
        return ref
    
    def _ensure_dtd_compliance(self, root):
        """
        Ensure the XML structure complies with DTD requirements.
        
        Key DTD rules:
        1. ChannelNameSet can only have ONE (NoteNameList | UsesNoteNameList)?
        2. ChannelNameSet element order: AvailableForChannels, (NoteNameList | UsesNoteNameList)?, 
           (ControlNameList | UsesControlNameList)?, PatchBank+
        3. NoteNameLists should be at MasterDeviceNames level
        """
        import xml.etree.ElementTree as ET
        
        fixes_applied = []
        
        for master_device in root.findall('.//MasterDeviceNames'):
            # Fix 1: Move any NoteNameLists from ChannelNameSets to MasterDeviceNames
            for channel_name_set in master_device.findall('.//ChannelNameSet'):
                note_lists_in_cns = [child for child in channel_name_set if child.tag == 'NoteNameList']
                
                if len(note_lists_in_cns) > 0:
                    fixes_applied.append(f"Moving {len(note_lists_in_cns)} NoteNameList(s) from ChannelNameSet '{channel_name_set.get('Name')}' to MasterDeviceNames")
                    
                    for note_list in note_lists_in_cns:
                        channel_name_set.remove(note_list)
                        master_device.append(note_list)
                
                # Fix 2: Ensure proper element ordering in ChannelNameSet
                # DTD order: AvailableForChannels, (NoteNameList | UsesNoteNameList)?, 
                #            (ControlNameList | UsesControlNameList)?, PatchBank+
                children = list(channel_name_set)
                
                # Categorize children
                available_for_channels = []
                note_or_control_refs = []  # NoteNameList, UsesNoteNameList, ControlNameList, UsesControlNameList
                patch_banks = []
                other = []
                
                for child in children:
                    if child.tag == 'AvailableForChannels':
                        available_for_channels.append(child)
                    elif child.tag in ('NoteNameList', 'UsesNoteNameList', 'ControlNameList', 'UsesControlNameList'):
                        note_or_control_refs.append(child)
                    elif child.tag == 'PatchBank':
                        patch_banks.append(child)
                    else:
                        other.append(child)
                
                # Check if reordering is needed
                needs_reorder = False
                if len(children) > 0:
                    current_order = [c.tag for c in children]
                    
                    # Simple check: if PatchBank comes before Note/Control lists, we need to reorder
                    if patch_banks and note_or_control_refs:
                        first_patch_bank_idx = children.index(patch_banks[0])
                        for ref in note_or_control_refs:
                            if children.index(ref) > first_patch_bank_idx:
                                needs_reorder = True
                                break
                
                if needs_reorder:
                    cns_name = channel_name_set.get('Name', 'unnamed')
                    fixes_applied.append(f"Reordering elements in ChannelNameSet '{cns_name}' to match DTD")
                    
                    # Clear and re-add in correct order
                    for child in children:
                        channel_name_set.remove(child)
                    
                    # Add back in DTD order
                    for child in available_for_channels:
                        channel_name_set.append(child)
                    
                    # Separate note and control refs for proper ordering
                    note_refs = [c for c in note_or_control_refs if c.tag in ('NoteNameList', 'UsesNoteNameList')]
                    control_refs = [c for c in note_or_control_refs if c.tag in ('ControlNameList', 'UsesControlNameList')]
                    
                    # DTD allows max one note ref
                    if len(note_refs) > 1:
                        fixes_applied.append(f"  WARNING: ChannelNameSet '{cns_name}' has {len(note_refs)} note references, DTD allows only 1")
                        # Keep only the first one
                        note_refs = note_refs[:1]
                    
                    # Add note refs (max 1)
                    for child in note_refs:
                        channel_name_set.append(child)
                    
                    # Add control refs
                    for child in control_refs:
                        channel_name_set.append(child)
                    
                    # Add patch banks
                    for child in patch_banks:
                        channel_name_set.append(child)
                    
                    # Add any other elements at the end
                    for child in other:
                        channel_name_set.append(child)
        
        if fixes_applied:
            print("[DTD Compliance] Applied fixes:")
            for fix in fixes_applied:
                print(f"  - {fix}")
        
        return len(fixes_applied)
    
    def save_midnam_structure(self):
        """Save the entire MIDNAM structure from frontend"""
        try:
            import json
            import xml.etree.ElementTree as ET
            import shutil
            from datetime import datetime
            from xml.dom import minidom
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            data = json.loads(post_data)
            
            file_path = data.get('file_path')
            midnam = data.get('midnam')
            
            if not file_path or not midnam:
                self.send_error(400, "Missing file_path or midnam data")
                return
            
            # Check if file exists
            if not os.path.exists(file_path):
                self.send_error(404, f"File not found: {file_path}")
                return
            
            # Parse existing file to get its structure and DOCTYPE
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Read the original file to extract DOCTYPE if present
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # Extract DOCTYPE declaration if present
            doctype_line = ''
            for line in original_content.split('\n'):
                if '<!DOCTYPE' in line:
                    doctype_line = line.strip() + '\n'
                    break
            
            # Update the XML with changes from midnam structure
            # Handle hierarchical ChannelNameSet structure
            for master_device in root.findall('.//MasterDeviceNames'):
                # First handle ChannelNameSets
                if 'channelNameSets' in midnam:
                    existing_name_sets = {ns.get('Name'): ns for ns in master_device.findall('.//ChannelNameSet')}
                    frontend_name_sets = {ns.get('name'): ns for ns in midnam['channelNameSets']}
                    
                    # Remove ChannelNameSets that no longer exist
                    for name_set_name in list(existing_name_sets.keys()):
                        if name_set_name not in frontend_name_sets:
                            master_device.remove(existing_name_sets[name_set_name])
                            print(f"[save_midnam_structure] Removed ChannelNameSet: {name_set_name}")
                    
                    # Update existing or create new ChannelNameSets
                    for frontend_name_set in midnam['channelNameSets']:
                        name_set_name = frontend_name_set.get('name')
                        channel_name_set = existing_name_sets.get(name_set_name)
                        
                        if channel_name_set is None:
                            # Create new ChannelNameSet
                            channel_name_set = ET.SubElement(master_device, 'ChannelNameSet')
                            channel_name_set.set('Name', name_set_name)
                            print(f"[save_midnam_structure] Created new ChannelNameSet: {name_set_name}")
                        
                        # Update AvailableForChannels
                        if 'available_channels' in frontend_name_set:
                            available_for_channels = channel_name_set.find('AvailableForChannels')
                            if available_for_channels is None:
                                available_for_channels = ET.SubElement(channel_name_set, 'AvailableForChannels')
                            else:
                                # Clear existing channels
                                available_for_channels.clear()
                            
                            # Add channels
                            for ch in frontend_name_set['available_channels']:
                                channel_elem = ET.SubElement(available_for_channels, 'AvailableChannel')
                                channel_elem.set('Channel', str(ch.get('channel', '1')))
                                channel_elem.set('Available', 'true' if ch.get('available') else 'false')
                            
                            print(f"[save_midnam_structure] Updated AvailableForChannels for NameSet: {name_set_name}")
                
                # Now handle patch banks - Save FULL PatchBank elements inside ChannelNameSets
                # According to the DTD, PatchBank elements must have content and belong inside ChannelNameSet
                
                if 'patchList' in midnam:
                    # Group patch banks by their ChannelNameSet
                    banks_by_nameset = {}
                    for bank in midnam['patchList']:
                        name_set = bank.get('channelNameSet')
                        if name_set:
                            if name_set not in banks_by_nameset:
                                banks_by_nameset[name_set] = []
                            banks_by_nameset[name_set].append(bank)
                    
                    # Remove any PatchBank elements at MasterDeviceNames level (incorrect location)
                    existing_banks_at_root = [b for b in master_device if b.tag == 'PatchBank']
                    for existing_bank in existing_banks_at_root:
                        bank_name = existing_bank.get('Name')
                        master_device.remove(existing_bank)
                        print(f"[save_midnam_structure] Removed incorrectly placed PatchBank '{bank_name}' from MasterDeviceNames level")
                    
                    # Save FULL PatchBank definitions inside their respective ChannelNameSets
                    for channel_name_set in master_device.findall('.//ChannelNameSet'):
                        name_set_name = channel_name_set.get('Name')
                        frontend_banks = banks_by_nameset.get(name_set_name, [])
                        
                        # Remove ALL existing PatchBank elements from this ChannelNameSet
                        existing_banks = channel_name_set.findall('./PatchBank')
                        for existing_bank in existing_banks:
                            bank_name = existing_bank.get('Name')
                            channel_name_set.remove(existing_bank)
                            print(f"[save_midnam_structure] Removed PatchBank '{bank_name}' from ChannelNameSet '{name_set_name}' (will recreate)")
                        
                        # Create FULL PatchBank elements (with MIDICommands and PatchNameList) for this NameSet
                        # Must insert after AvailableForChannels and any Uses* elements, before other content
                        for frontend_bank in frontend_banks:
                            bank_name = frontend_bank.get('name')
                            
                            # Create full PatchBank with all content
                            self._create_patch_bank(channel_name_set, frontend_bank)
                            print(f"[save_midnam_structure] Created full PatchBank '{bank_name}' inside ChannelNameSet '{name_set_name}'")
            
            # Update NoteNameLists
            for master_device in root.findall('.//MasterDeviceNames'):
                if 'note_lists' in midnam:
                    # Remove existing NoteNameLists
                    existing_note_lists = master_device.findall('NoteNameList')
                    for note_list in existing_note_lists:
                        master_device.remove(note_list)
                    
                    # Add new NoteNameLists
                    for note_list_data in midnam['note_lists']:
                        note_list_elem = ET.Element('NoteNameList')
                        note_list_elem.set('Name', note_list_data.get('name', 'Notes'))
                        
                        # Add Note elements
                        if 'notes' in note_list_data:
                            for note in note_list_data['notes']:
                                note_elem = ET.SubElement(note_list_elem, 'Note')
                                note_elem.set('Number', str(note.get('number', 0)))
                                note_elem.set('Name', note.get('name', ''))
                        
                        # Append to master device (before ControlNameLists if they exist)
                        master_device.append(note_list_elem)
                        print(f"[save_midnam_structure] Saved NoteNameList: {note_list_data.get('name', 'Notes')}")
            
            # Update ControlNameLists
            for master_device in root.findall('.//MasterDeviceNames'):
                # Update or create ControlNameLists
                if 'control_lists' in midnam:
                    # Remove existing ControlNameLists
                    existing_control_lists = master_device.findall('ControlNameList')
                    for control_list in existing_control_lists:
                        master_device.remove(control_list)
                    
                    # Add new ControlNameLists
                    for control_list_data in midnam['control_lists']:
                        control_list_elem = ET.Element('ControlNameList')
                        control_list_elem.set('Name', control_list_data.get('name', 'Controls'))
                        
                        # Add Control elements
                        if 'controls' in control_list_data:
                            for control in control_list_data['controls']:
                                control_elem = ET.SubElement(control_list_elem, 'Control')
                                control_elem.set('Type', control.get('type', '7bit'))
                                control_elem.set('Number', str(control.get('number', 0)))
                                control_elem.set('Name', control.get('name', ''))
                        
                        # Append to master device (at the end)
                        master_device.append(control_list_elem)
                        print(f"[save_midnam_structure] Saved ControlNameList: {control_list_data.get('name', 'Controls')}")
                
                # Update UsesControlNameList in ChannelNameSets (independent of control_lists changes)
                if 'activeControlListName' in midnam and midnam['activeControlListName']:
                    for channel_name_set in master_device.findall('.//ChannelNameSet'):
                        # Remove existing UsesControlNameList
                        existing_uses = channel_name_set.find('UsesControlNameList')
                        if existing_uses is not None:
                            channel_name_set.remove(existing_uses)
                        
                        # Add new UsesControlNameList (insert after AvailableForChannels)
                        uses_control_elem = ET.Element('UsesControlNameList')
                        uses_control_elem.set('Name', midnam['activeControlListName'])
                        
                        # Find the position to insert (after AvailableForChannels)
                        available_for_channels = channel_name_set.find('AvailableForChannels')
                        if available_for_channels is not None:
                            insert_index = list(channel_name_set).index(available_for_channels) + 1
                            channel_name_set.insert(insert_index, uses_control_elem)
                        else:
                            # If no AvailableForChannels, insert at beginning
                            channel_name_set.insert(0, uses_control_elem)
                        
                        print(f"[save_midnam_structure] Set active ControlNameList: {midnam['activeControlListName']}")
            
            # Update SupportsStandardDeviceMode
            for master_device in root.findall('.//MasterDeviceNames'):
                # Remove existing SupportsStandardDeviceMode elements
                existing_standard_modes = master_device.findall('SupportsStandardDeviceMode')
                for standard_mode in existing_standard_modes:
                    master_device.remove(standard_mode)
                
                # Add SupportsStandardDeviceMode if enabled
                if midnam.get('supportsStandardDeviceMode', False):
                    standard_mode_name = midnam.get('standardDeviceModeName', 'General MIDI')
                    
                    # Create the SupportsStandardDeviceMode element
                    standard_mode_elem = ET.Element('SupportsStandardDeviceMode')
                    standard_mode_elem.set('Name', standard_mode_name)
                    
                    # Insert after Model elements but before CustomDeviceMode
                    # Find the position to insert
                    insert_index = 0
                    for i, child in enumerate(master_device):
                        if child.tag == 'Model':
                            insert_index = i + 1
                        elif child.tag == 'CustomDeviceMode':
                            break
                    
                    master_device.insert(insert_index, standard_mode_elem)
                    print(f"[save_midnam_structure] Saved SupportsStandardDeviceMode: {standard_mode_name}")
            
            # Ensure DTD compliance before saving
            print("[save_midnam_structure] Checking DTD compliance...")
            fixes_count = self._ensure_dtd_compliance(root)
            if fixes_count > 0:
                print(f"[save_midnam_structure] Applied {fixes_count} DTD compliance fix(es)")
            
            # Create backup
            backup_name = f'{file_path}.backup.{datetime.now().strftime("%Y-%m-%d-%H-%M-%S")}'
            shutil.copy(file_path, backup_name)
            
            # Convert to string with pretty printing
            xml_str = ET.tostring(root, encoding='unicode', method='xml')
            dom = minidom.parseString(xml_str)
            pretty_xml = dom.toprettyxml(indent='\t', encoding=None)
            
            # Remove extra blank lines
            lines = [line for line in pretty_xml.split('\n') if line.strip()]
            pretty_xml = '\n'.join(lines[1:])  # Skip the XML declaration from minidom
            
            # Add proper XML declaration and DOCTYPE
            xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
            if not doctype_line:
                doctype_line = '<!DOCTYPE MIDINameDocument PUBLIC "-//MIDI Manufacturers Association//DTD MIDINameDocument 1.0//EN" "http://www.midi.org/dtds/MIDINameDocument10.dtd">\n'
            
            full_xml = xml_declaration + doctype_line + '\n' + pretty_xml
            
            # Write to file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(full_xml)
            
            print(f"[save_midnam_structure] Saved changes to: {file_path}")
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'backup': backup_name,
                'file_path': file_path
            }).encode())
            
        except ET.ParseError as e:
            print(f"[save_midnam_structure] XML Parse Error: {str(e)}")
            self.send_error(422, f"Cannot save invalid XML file: {str(e)}")
        except Exception as e:
            print(f"[save_midnam_structure] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error saving file: {str(e)}")
    
    def reload_midnam(self):
        """Reload a MIDNAM file from disk, clearing cache and re-indexing.
        Useful for testing to verify that saved changes persist."""
        try:
            import json
            import xml.etree.ElementTree as ET
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            data = json.loads(post_data)
            
            file_path = data.get('file_path')
            device_id = data.get('device_id')  # Optional: used to identify which device to return
            
            if not file_path:
                self.send_error(400, "Missing file_path")
                return
            
            print(f"[reload_midnam] Reloading file: {file_path}")
            
            # Check if file exists
            if not os.path.exists(file_path):
                self.send_error(404, f"File not found: {file_path}")
                return
            
            # Clear the catalog cache to force re-indexing
            cache_file = 'midnam_catalog_cache.json'
            if os.path.exists(cache_file):
                os.remove(cache_file)
                print(f"[reload_midnam] Cleared catalog cache")
            
            # Read and parse the file fresh from disk
            with open(file_path, 'r', encoding='utf-8') as f:
                midnam_content = f.read()
            
            # Parse the XML to extract device details
            root_elem = ET.fromstring(midnam_content)
            
            # Extract device information (same as serve_device_details)
            device_info = self.extract_device_info(root_elem, file_path)
            
            if not device_info:
                self.send_error(500, "Failed to extract device information from file")
                return
            
            # Build full device details response
            device_details = {
                'id': device_id or f"{device_info['manufacturer']}|{device_info['model']}",
                'name': device_info['model'],
                'type': device_info.get('type', 'Unknown'),
                'file_path': file_path,
                'manufacturer_id': device_info.get('manufacturer_id'),
                'family_id': device_info.get('family_id'),
                'device_id': device_info.get('device_id'),
                'midnam_content': midnam_content,
                'raw_xml': midnam_content
            }
            
            # Extract CustomDeviceModes with full hierarchy
            note_lists = root_elem.findall('.//NoteNameList')
            patches = root_elem.findall('.//Patch')
            
            # Extract CustomDeviceModes (there can be multiple)
            device_details['custom_device_modes'] = []
            custom_modes = root_elem.findall('.//CustomDeviceMode')
            
            for mode in custom_modes:
                mode_name = mode.get('Name', 'Default Mode')
                
                # Extract ChannelNameSetAssignments
                channel_assignments = []
                assignments = mode.findall('.//ChannelNameSetAssign')
                for assignment in assignments:
                    channel_assignments.append({
                        'channel': assignment.get('Channel'),
                        'name_set': assignment.get('NameSet')
                    })
                
                device_details['custom_device_modes'].append({
                    'name': mode_name,
                    'channel_assignments': channel_assignments
                })
            
            # Extract SupportsStandardDeviceMode
            device_details['supportsStandardDeviceMode'] = False
            device_details['standardDeviceModeName'] = 'General MIDI'
            standard_mode_elem = root_elem.find('.//SupportsStandardDeviceMode')
            if standard_mode_elem is not None:
                device_details['supportsStandardDeviceMode'] = True
                mode_name = standard_mode_elem.get('Name')
                if mode_name:
                    device_details['standardDeviceModeName'] = mode_name
            
            # Extract ChannelNameSets with their PatchBanks
            device_details['channel_name_sets'] = []
            channel_name_sets = root_elem.findall('.//ChannelNameSet')
            
            for cns in channel_name_sets:
                name_set_name = cns.get('Name', 'Default')
                
                # Extract AvailableForChannels
                available_channels = []
                available_channel_elements = cns.findall('.//AvailableChannel')
                for ac in available_channel_elements:
                    available_channels.append({
                        'channel': ac.get('Channel'),
                        'available': ac.get('Available', 'true').lower() == 'true'
                    })
                
                # Extract PatchBanks
                patch_banks = []
                for bank in cns.findall('./PatchBank'):  # Direct children only
                    bank_name = bank.get('Name', 'Unnamed Bank')
                    
                    # Extract MIDI commands
                    midi_commands = []
                    midi_cmds_elem = bank.find('MIDICommands')
                    if midi_cmds_elem is not None:
                        for cc in midi_cmds_elem.findall('ControlChange'):
                            midi_commands.append({
                                'type': 'ControlChange',
                                'control': cc.get('Control'),
                                'value': cc.get('Value')
                            })
                    
                    # Extract patches
                    patches_list = []
                    patch_name_list = bank.find('PatchNameList')
                    if patch_name_list is not None:
                        for patch in patch_name_list.findall('Patch'):
                            patch_name = patch.get('Name', '')
                            patch_number = patch.get('Number', '')
                            
                            # Try to get ProgramChange from attribute first
                            program_change = patch.get('ProgramChange', '')
                            
                            # If not found, check for PatchMIDICommands/ProgramChange structure
                            if not program_change:
                                patch_midi_cmds = patch.find('PatchMIDICommands')
                                if patch_midi_cmds is not None:
                                    pc_elem = patch_midi_cmds.find('ProgramChange')
                                    if pc_elem is not None:
                                        program_change = pc_elem.get('Number', '')
                            
                            patches_list.append({
                                'name': patch_name,
                                'Number': patch_number,
                                'programChange': int(program_change) if program_change.isdigit() else 0,
                                'note_list_name': patch.find('UsesNoteNameList').get('Name') if patch.find('UsesNoteNameList') is not None else None
                            })
                    
                    patch_banks.append({
                        'name': bank_name,
                        'midi_commands': midi_commands,
                        'patches': patches_list
                    })
                
                device_details['channel_name_sets'].append({
                    'name': name_set_name,
                    'available_channels': available_channels,
                    'patch_banks': patch_banks
                })
            
            # Extract patch banks (flat list for backward compatibility)
            device_details['patch_banks'] = []
            for cns in device_details['channel_name_sets']:
                device_details['patch_banks'].extend(cns['patch_banks'])
            
            print(f"[reload_midnam] Successfully reloaded {file_path}")
            print(f"[reload_midnam] Found {len(device_details['channel_name_sets'])} channel name sets")
            print(f"[reload_midnam] Found {len(device_details['patch_banks'])} total patch banks")
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(device_details).encode())
            
        except ET.ParseError as e:
            print(f"[reload_midnam] XML Parse Error: {str(e)}")
            self.send_error(422, f"Invalid XML in file: {str(e)}")
        except Exception as e:
            print(f"[reload_midnam] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error reloading file: {str(e)}")
    
    def get_patch_files(self):
        """Get list of all patch files with their metadata"""
        patch_files = []
        
        # Build manufacturer ID lookup
        manufacturer_ids = self.build_manufacturer_id_lookup()
        
        # Find all .midnam files
        for root, dirs, files in os.walk('patchfiles'):
            for file in files:
                if file.endswith('.midnam'):
                    file_path = os.path.join(root, file)
                    relative_path = file_path.replace('\\', '/')
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        # Parse XML
                        import xml.etree.ElementTree as ET
                        root_elem = ET.fromstring(content)
                        
                        # Extract device information
                        device_info = self.extract_device_info(root_elem, relative_path)
                        if device_info:
                            # Look up manufacturer ID
                            manufacturer_id = manufacturer_ids.get(device_info['manufacturer'])
                            if manufacturer_id:
                                device_info['manufacturer_id'] = manufacturer_id
                            
                            # Get all models (handles files with multiple Model elements)
                            all_models = device_info.get('all_models', [device_info['model']])
                            
                            # Add an entry for EACH model
                            for model in all_models:
                                device_key = f"{device_info['manufacturer']}|{model}"
                                
                                patch_files.append({
                                    'id': device_key,
                                    'name': model,
                                    'manufacturer': device_info['manufacturer'],
                                    'type': device_info.get('type', 'Unknown'),
                                    'file_path': relative_path,
                                    'manufacturer_id': device_info.get('manufacturer_id'),
                                    'family_id': device_info.get('family_id'),
                                    'device_id': device_info.get('device_id')
                                })
                        else:
                            print(f"[get_patch_files] No device info extracted from {relative_path}")
                    except Exception as e:
                        print(f"[get_patch_files] Error processing {relative_path}: {e}")
                        continue
        
        return patch_files
    
    def indent_xml(self, elem, level=0):
        """Pretty-print XML by adding indentation"""
        i = "\n" + level * "  "
        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = i + "  "
            if not elem.tail or not elem.tail.strip():
                elem.tail = i
            for child in elem:
                self.indent_xml(child, level+1)
            if not child.tail or not child.tail.strip():
                child.tail = i
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = i
    
    def serve_patchfile(self):
        """Serve patchfiles from the patchfiles directory"""
        try:
            # Remove leading slash and serve from patchfiles directory
            file_path = self.path[1:]  # Remove leading slash
            
            if not os.path.exists(file_path):
                self.send_error(404, "File not found")
                return
            
            # Determine content type
            if file_path.endswith('.middev'):
                content_type = 'application/xml'
            elif file_path.endswith('.midnam'):
                content_type = 'application/xml'
            else:
                content_type = 'text/plain'
            
            with open(file_path, 'r') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(content.encode())
            
        except Exception as e:
            self.send_error(500, f"Error serving file: {str(e)}")
    
    def serve_manufacturers(self):
        """Serve manufacturer data from actual .midnam files"""
        try:
            # Build catalog by scanning all .midnam files
            manufacturers_dict = {}
            
            # First, build a manufacturer ID lookup from .middev files
            manufacturer_ids = self.build_manufacturer_id_lookup()
            
            # Find all .midnam files
            print("Scanning for .midnam files...")
            file_count = 0
            for root, dirs, files in os.walk('patchfiles'):
                for file in files:
                    if file.endswith('.midnam'):
                        file_count += 1
                        file_path = os.path.join(root, file)
                        relative_path = file_path.replace('\\', '/')  # Normalize path separators
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Parse XML
                            import xml.etree.ElementTree as ET
                            root_elem = ET.fromstring(content)
                            
                            # Extract device information
                            device_info = self.extract_device_info(root_elem, relative_path)
                            if device_info:
                                # Look up manufacturer ID from .middev files
                                manufacturer_id = manufacturer_ids.get(device_info['manufacturer'])
                                if manufacturer_id:
                                    device_info['manufacturer_id'] = manufacturer_id
                                
                                # Get all models (handles files with multiple Model elements)
                                all_models = device_info.get('all_models', [device_info['model']])
                                
                                if device_info['manufacturer'] not in manufacturers_dict:
                                    manufacturers_dict[device_info['manufacturer']] = []
                                
                                # Add an entry for EACH model
                                for model in all_models:
                                    device_key = f"{device_info['manufacturer']}|{model}"
                                    
                                    device_data = {
                                        'id': device_key,
                                        'name': model,
                                        'type': device_info.get('type', 'Unknown'),
                                        'file_path': relative_path,
                                        'manufacturer_id': device_info.get('manufacturer_id'),
                                        'family_id': device_info.get('family_id'),
                                        'device_id': device_info.get('device_id')
                                    }
                                    
                                    manufacturers_dict[device_info['manufacturer']].append(device_data)
                                
                        except Exception as e:
                            print(f"Error parsing {file_path}: {e}")
                            continue
            
            print(f"Scanned {file_count} .midnam files, found {len(manufacturers_dict)} manufacturers")
            
            # Also include devices and manufacturers from .middev files
            middev_data = self.get_devices_from_middev_files()
            
            # Add devices from .middev files
            # NOTE: We don't actually add these to the manufacturers list because
            # the /api/device/ endpoint can't serve .middev files (it needs .midnam files).
            # .middev files are only used to populate manufacturer IDs and metadata.
            # 
            # for device_key, device_info in middev_data['devices'].items():
            #     # Only add if not already in manufacturers_dict from .midnam files
            #     manufacturer = device_info['manufacturer']
            #     
            #     # Check if device already exists
            #     device_exists = False
            #     if manufacturer in manufacturers_dict:
            #         for existing_device in manufacturers_dict[manufacturer]:
            #             if existing_device['id'] == device_key:
            #                 device_exists = True
            #                 break
            #     
            #     if not device_exists:
            #         if manufacturer not in manufacturers_dict:
            #             manufacturers_dict[manufacturer] = []
            #         
            #         manufacturers_dict[manufacturer].append({
            #             'id': device_key,
            #             'name': device_info['model'],
            #             'type': device_info['type'],
            #             'file_path': device_info['file_path'],
            #             'manufacturer_id': device_info.get('manufacturer_id'),
            #             'family_id': device_info.get('family_id'),
            #             'device_id': device_info.get('device_id'),
            #             'source': 'middev'
            #         })
            
            # Add empty manufacturers (no devices yet)
            for manufacturer_name, file_path in middev_data['manufacturers'].items():
                if manufacturer_name not in manufacturers_dict:
                    manufacturers_dict[manufacturer_name] = []
                    print(f"Added empty manufacturer from .middev: {manufacturer_name}")
            
            print(f"Total manufacturers after including .middev: {len(manufacturers_dict)}")
            
            device_types = ["Synthesizer", "Drum Machine", "Sampler", "Controller", "Effects Unit", "Unknown"]
            
            response_data = {
                "manufacturers": manufacturers_dict,
                "deviceTypes": device_types
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_error(500, f"Error serving manufacturers: {str(e)}")

    def serve_device_details(self):
        """Serve detailed information about a specific device"""
        try:
            # Extract device ID and optional file parameter from URL
            import urllib.parse
            from urllib.parse import urlparse, parse_qs
            
            parsed_url = urlparse(self.path)
            device_id = parsed_url.path.replace('/api/device/', '')
            device_id = urllib.parse.unquote(device_id)  # Properly URL decode
            
            # Check for file parameter
            query_params = parse_qs(parsed_url.query)
            specific_file = query_params.get('file', [None])[0]
            if specific_file:
                specific_file = urllib.parse.unquote(specific_file)
            
            print(f"Requesting device details for: {device_id}" + (f" (file: {specific_file})" if specific_file else ""))
            
            # Find the device in our manufacturers data
            manufacturers_data = self.get_manufacturers_data()
            device_data = None
            
            # If a specific file is requested, find device with that file
            if specific_file:
                for manufacturer, devices in manufacturers_data.items():
                    for device in devices:
                        if device['id'] == device_id and device['file_path'] == specific_file:
                            device_data = device
                            break
                    if device_data:
                        break
            else:
                # Find first matching device
                for manufacturer, devices in manufacturers_data.items():
                    for device in devices:
                        if device['id'] == device_id:
                            device_data = device
                            break
                    if device_data:
                        break
            
            if not device_data:
                self.send_error(404, f"Device not found: {device_id}" + (f" with file {specific_file}" if specific_file else ""))
                return
            
            # Read the actual .midnam file
            file_path = device_data['file_path']
            if not os.path.exists(file_path):
                self.send_error(404, f"Device file not found: {file_path}")
                return
            
            with open(file_path, 'r', encoding='utf-8') as f:
                midnam_content = f.read()
            
            # Parse the XML to extract more details
            import xml.etree.ElementTree as ET
            root_elem = ET.fromstring(midnam_content)
            
            # Extract additional device information
            device_details = {
                'id': device_data['id'],
                'name': device_data['name'],
                'type': device_data['type'],
                'file_path': device_data['file_path'],
                'manufacturer_id': device_data.get('manufacturer_id'),
                'family_id': device_data.get('family_id'),
                'device_id': device_data.get('device_id'),
                'midnam_content': midnam_content,
                'raw_xml': midnam_content
            }
            
            # Extract CustomDeviceModes with full hierarchy
            note_lists = root_elem.findall('.//NoteNameList')
            patches = root_elem.findall('.//Patch')
            
            # Extract CustomDeviceModes (there can be multiple)
            device_details['custom_device_modes'] = []
            custom_modes = root_elem.findall('.//CustomDeviceMode')
            
            for mode in custom_modes:
                mode_name = mode.get('Name', 'Default Mode')
                
                # Extract ChannelNameSetAssignments for this mode
                channel_assignments = []
                for assignment in mode.findall('.//ChannelNameSetAssign'):
                    channel_assignments.append({
                        'channel': assignment.get('Channel', ''),
                        'name_set': assignment.get('NameSet', '')
                    })
                
                device_details['custom_device_modes'].append({
                    'name': mode_name,
                    'channel_assignments': channel_assignments
                })
            
            # If no CustomDeviceModes found, create a default one
            if not device_details['custom_device_modes']:
                device_details['custom_device_modes'].append({
                    'name': 'Default Mode',
                    'channel_assignments': []
                })
            
            # Extract SupportsStandardDeviceMode
            device_details['supportsStandardDeviceMode'] = False
            device_details['standardDeviceModeName'] = 'General MIDI'
            standard_mode_elem = root_elem.find('.//SupportsStandardDeviceMode')
            if standard_mode_elem is not None:
                device_details['supportsStandardDeviceMode'] = True
                mode_name = standard_mode_elem.get('Name')
                if mode_name:
                    device_details['standardDeviceModeName'] = mode_name
            
            # Extract ChannelNameSets with their PatchBanks
            # PatchBanks are now stored INSIDE ChannelNameSets (per DTD spec)
            device_details['channel_name_sets'] = []
            channel_name_sets = root_elem.findall('.//ChannelNameSet')
            
            for name_set in channel_name_sets:
                name_set_name = name_set.get('Name', 'Unnamed Name Set')
                
                # Extract available channels
                available_channels = []
                for channel in name_set.findall('.//AvailableChannel'):
                    channel_num = channel.get('Channel', '')
                    available = channel.get('Available', 'false')
                    available_channels.append({
                        'channel': channel_num,
                        'available': available.lower() == 'true'
                    })
                
                # Extract PatchBank elements from this ChannelNameSet (they should have full content)
                patch_banks = []
                for bank in name_set.findall('./PatchBank'):  # Use ./ to get direct children only
                    bank_name = bank.get('Name', 'Unnamed Bank')
                    
                    # Check if this is a full definition (has children) or an empty reference
                    if len(bank) == 0:
                        print(f"Warning: Empty PatchBank reference '{bank_name}' found in ChannelNameSet '{name_set_name}' - skipping")
                        continue
                    
                    bank_patches = bank.findall('.//Patch')
                    
                    # Extract MIDI commands for this bank
                    midi_commands = []
                    midi_commands_elem = bank.find('./MIDICommands')
                    if midi_commands_elem is not None:
                        for control_change in midi_commands_elem.findall('.//ControlChange'):
                            # Try both lowercase and capitalized (for compatibility)
                            control = control_change.get('control', control_change.get('Control', ''))
                            value = control_change.get('value', control_change.get('Value', ''))
                            midi_commands.append({
                                'type': 'ControlChange',
                                'control': control,
                                'value': value
                            })
                    
                    # Extract patches
                    patches_data = []
                    for patch in bank_patches:
                        patch_name = patch.get('Name', 'Unnamed')
                        patch_number = patch.get('Number', '0')
                        
                        # Try to get ProgramChange from attribute first
                        program_change = patch.get('ProgramChange', '0')
                        
                        # If not found, check for PatchMIDICommands/ProgramChange structure
                        if not program_change or program_change == '0':
                            patch_midi_cmds = patch.find('PatchMIDICommands')
                            if patch_midi_cmds is not None:
                                pc_elem = patch_midi_cmds.find('ProgramChange')
                                if pc_elem is not None:
                                    program_change = pc_elem.get('Number', '0')
                        
                        # Find the note name list used by this patch
                        uses_note_list = patch.find('.//UsesNoteNameList')
                        note_list_name = uses_note_list.get('Name', '') if uses_note_list is not None else ''
                        
                        patches_data.append({
                            'name': patch_name,
                            'Number': patch_number,
                            'programChange': program_change,
                            'note_list_name': note_list_name
                        })
                    
                    patch_banks.append({
                        'name': bank_name,
                        'patch_count': len(bank_patches),
                        'patches': patches_data,
                        'midi_commands': midi_commands
                    })
                
                device_details['channel_name_sets'].append({
                    'name': name_set_name,
                    'available_channels': available_channels,
                    'patch_banks': patch_banks
                })
            
            # Keep legacy flat patch_banks list for backward compatibility
            device_details['patch_banks'] = []
            for name_set in device_details['channel_name_sets']:
                device_details['patch_banks'].extend(name_set['patch_banks'])
            
            device_details['total_patches'] = len(patches)
            device_details['total_note_lists'] = len(note_lists)

            # Extract note lists (for patch editing context)
            device_details['note_lists'] = []
            for note_list in note_lists:
                note_list_name = note_list.get('Name', 'Unnamed Note List')
                note_list_id = note_list.get('ID', '')

                # Extract individual notes
                notes = []
                for note in note_list.findall('.//Note'):
                    note_number = note.get('Number', '')
                    note_name = note.get('Name', '')
                    notes.append({
                        'number': note_number,
                        'name': note_name
                    })

                device_details['note_lists'].append({
                    'name': note_list_name,
                    'id': note_list_id,
                    'notes': notes
                })
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(device_details).encode())
            
        except Exception as e:
            self.send_error(500, f"Error serving device details: {str(e)}")

    def get_manufacturers_data(self):
        """Get manufacturers data (cached version of serve_manufacturers logic)"""
        manufacturers_dict = {}
        
        # First, build a manufacturer ID lookup from .middev files
        manufacturer_ids = self.build_manufacturer_id_lookup()
        
        # Find all .midnam files
        for root, dirs, files in os.walk('patchfiles'):
            for file in files:
                if file.endswith('.midnam'):
                    file_path = os.path.join(root, file)
                    relative_path = file_path.replace('\\', '/')
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        import xml.etree.ElementTree as ET
                        root_elem = ET.fromstring(content)
                        
                        device_info = self.extract_device_info(root_elem, relative_path)
                        if device_info:
                            manufacturer_id = manufacturer_ids.get(device_info['manufacturer'])
                            if manufacturer_id:
                                device_info['manufacturer_id'] = manufacturer_id
                            
                            # Get all models (handles files with multiple Model elements)
                            all_models = device_info.get('all_models', [device_info['model']])
                            
                            if device_info['manufacturer'] not in manufacturers_dict:
                                manufacturers_dict[device_info['manufacturer']] = []
                            
                            # Create an entry for EACH model
                            for model in all_models:
                                device_key = f"{device_info['manufacturer']}|{model}"
                                
                                device_data = {
                                    'id': device_key,
                                    'name': model,
                                    'type': device_info.get('type', 'Unknown'),
                                    'file_path': relative_path,
                                    'manufacturer_id': device_info.get('manufacturer_id'),
                                    'family_id': device_info.get('family_id'),
                                    'device_id': device_info.get('device_id')
                                }
                                
                                manufacturers_dict[device_info['manufacturer']].append(device_data)
                            
                    except Exception as e:
                        continue
        
        return manufacturers_dict

    def build_manufacturer_id_lookup(self):
        """Build a lookup table of manufacturer names to IDs from .middev files"""
        manufacturer_ids = {}
        
        try:
            import xml.etree.ElementTree as ET
            
            # Find all .middev files
            for root, dirs, files in os.walk('patchfiles'):
                for file in files:
                    if file.endswith('.middev'):
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Parse XML
                            root_elem = ET.fromstring(content)
                            
                            # Find all MIDIDeviceType elements
                            for device_type in root_elem.findall('.//MIDIDeviceType'):
                                manufacturer_name = device_type.get('Manufacturer')
                                inquiry_response = device_type.find('InquiryResponse')
                                
                                if manufacturer_name and inquiry_response is not None:
                                    manufacturer_id = inquiry_response.get('Manufacturer')
                                    if manufacturer_id:
                                        # Convert hex to three-byte format (e.g., "06" -> "00 00 06")
                                        try:
                                            hex_val = int(manufacturer_id, 16)
                                            three_byte_id = f"00 00 {manufacturer_id.zfill(2).upper()}"
                                            manufacturer_ids[manufacturer_name] = three_byte_id
                                            # Found manufacturer ID: {manufacturer_name} = {three_byte_id}
                                        except ValueError:
                                            pass  # Invalid hex manufacturer ID
                            
                        except Exception as e:
                            print(f"Error parsing {file_path}: {e}")
                            continue
            
            print(f"Built manufacturer ID lookup with {len(manufacturer_ids)} entries")
            return manufacturer_ids
            
        except Exception as e:
            print(f"Error building manufacturer ID lookup: {e}")
            return {}
    
    def get_devices_from_middev_files(self):
        """Extract device information from .middev files
        Returns a dict with two keys:
        - 'devices': dict of device_key -> device_info
        - 'manufacturers': dict of manufacturer_name -> file_path (for empty manufacturers)
        """
        result = {
            'devices': {},
            'manufacturers': {}
        }
        
        try:
            import xml.etree.ElementTree as ET
            
            # Find all .middev files
            print("[get_devices_from_middev_files] Starting scan...")
            for root, dirs, files in os.walk('patchfiles'):
                for file in files:
                    if file.endswith('.middev'):
                        file_path = os.path.join(root, file)
                        relative_path = file_path.replace('\\', '/')
                        print(f"[get_devices_from_middev_files] Found .middev file: {relative_path}")
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Parse XML
                            root_elem = ET.fromstring(content)
                            
                            # Extract manufacturer name from filename if no devices
                            # e.g., "MyManufacturer.middev" -> "MyManufacturer"
                            filename_manufacturer = file.replace('.middev', '').replace('_', ' ')
                            
                            # Find all MIDIDeviceType elements
                            device_types = root_elem.findall('.//MIDIDeviceType')
                            
                            if len(device_types) == 0:
                                # Empty .middev file - just track the manufacturer
                                print(f"[get_devices_from_middev_files] Empty .middev file for manufacturer: {filename_manufacturer}")
                                result['manufacturers'][filename_manufacturer] = relative_path
                            
                            for device_type in device_types:
                                manufacturer = device_type.get('Manufacturer')
                                model = device_type.get('Model')
                                
                                if manufacturer and model:
                                    device_key = f"{manufacturer}|{model}"
                                    
                                    # Determine device type from attributes
                                    device_type_name = 'Unknown'
                                    if device_type.get('IsSampler') == 'true':
                                        device_type_name = 'Sampler'
                                    elif device_type.get('IsDrumMachine') == 'true':
                                        device_type_name = 'Drum Machine'
                                    elif device_type.get('IsMixer') == 'true':
                                        device_type_name = 'Mixer'
                                    elif device_type.get('IsEffectUnit') == 'true':
                                        device_type_name = 'Effects Unit'
                                    elif device_type.get('SupportsGeneralMIDI') == 'true':
                                        device_type_name = 'Synthesizer'
                                    
                                    inquiry_response = device_type.find('InquiryResponse')
                                    manufacturer_id = None
                                    family_id = None
                                    device_id = None
                                    
                                    if inquiry_response is not None:
                                        manufacturer_id = inquiry_response.get('Manufacturer')
                                        family_id = inquiry_response.get('Family')
                                        device_id = inquiry_response.get('Member')
                                    
                                    result['devices'][device_key] = {
                                        'manufacturer': manufacturer,
                                        'model': model,
                                        'type': device_type_name,
                                        'file_path': relative_path,
                                        'manufacturer_id': manufacturer_id,
                                        'family_id': family_id,
                                        'device_id': device_id,
                                        'source': 'middev'
                                    }
                                    print(f"[get_devices_from_middev_files] Extracted device: {manufacturer} | {model} ({device_type_name})")
                        
                        except Exception as e:
                            print(f"Error parsing {file_path}: {e}")
                            continue
            
            print(f"Found {len(result['devices'])} devices and {len(result['manufacturers'])} empty manufacturers in .middev files")
            return result
            
        except Exception as e:
            print(f"Error extracting devices from .middev files: {e}")
            return {'devices': {}, 'manufacturers': {}}

    def serve_midnam_catalog(self):
        """Build and serve a catalog of all .midnam files with device information"""
        try:
            import xml.etree.ElementTree as ET
            import time
            
            # Check if we have a cached catalog
            cache_file = 'midnam_catalog_cache.json'
            catalog = None
            cache_valid = False
            
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r') as f:
                        cache_data = json.load(f)
                        # Check if cache is less than 1 hour old
                        if time.time() - cache_data.get('timestamp', 0) < 3600:
                            catalog = cache_data.get('catalog', {})
                            cache_valid = True
                except:
                    pass
            
            if not cache_valid:
                # Build catalog by scanning all .midnam files
                catalog = {}
                
                # First, build a manufacturer ID lookup from .middev files
                manufacturer_ids = self.build_manufacturer_id_lookup()
                
                # Find all .midnam files
                print("Scanning for .midnam files...")
                file_count = 0
                for root, dirs, files in os.walk('patchfiles'):
                    for file in files:
                        if file.endswith('.midnam'):
                            file_count += 1
                            file_path = os.path.join(root, file)
                            relative_path = file_path.replace('\\', '/')  # Normalize path separators
                            print(f"Processing {relative_path}")
                            
                            try:
                                with open(file_path, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                
                                # Parse XML
                                root_elem = ET.fromstring(content)
                                
                                # Extract device information
                                device_info = self.extract_device_info(root_elem, relative_path)
                                if device_info:
                                    # Look up manufacturer ID from .middev files
                                    manufacturer_id = manufacturer_ids.get(device_info['manufacturer'])
                                    if manufacturer_id:
                                        device_info['manufacturer_id'] = manufacturer_id
                                    
                                    # Get all models (handles files with multiple Model elements)
                                    all_models = device_info.get('all_models', [device_info['model']])
                                    
                                    print(f"  Extracted: {device_info['manufacturer']} models: {', '.join(all_models)} (ID: {manufacturer_id or 'unknown'})")
                                    
                                    # Create catalog entry for EACH model
                                    for model in all_models:
                                        device_key = f"{device_info['manufacturer']}|{model}"
                                        
                                        if device_key not in catalog:
                                            catalog[device_key] = {
                                                'manufacturer': device_info['manufacturer'],
                                                'model': model,
                                                'manufacturer_id': device_info.get('manufacturer_id'),
                                                'family_id': device_info.get('family_id'),
                                                'device_id': device_info.get('device_id'),
                                                'type': device_info.get('type'),
                                                'files': []
                                            }
                                        
                                        catalog[device_key]['files'].append({
                                            'path': relative_path,
                                            'size': len(content),
                                            'modified': os.path.getmtime(file_path)
                                        })
                                else:
                                    print(f"  No device info extracted")
                                    
                            except Exception as e:
                                print(f"Error parsing {file_path}: {e}")
                                continue
                
                print(f"Scanned {file_count} .midnam files, found {len(catalog)} devices")
                
                # Also include devices and manufacturers from .middev files
                middev_data = self.get_devices_from_middev_files()
                
                # Add devices from .middev files
                # NOTE: We don't actually add these to the catalog because
                # the /api/device/ endpoint can't serve .middev files (it needs .midnam files).
                # .middev files are only used to populate manufacturer IDs and metadata.
                # 
                # for device_key, device_info in middev_data['devices'].items():
                #     # Only add if not already in catalog from .midnam files
                #     if device_key not in catalog:
                #         catalog[device_key] = {
                #             'manufacturer': device_info['manufacturer'],
                #             'model': device_info['model'],
                #             'manufacturer_id': device_info.get('manufacturer_id'),
                #             'family_id': device_info.get('family_id'),
                #             'device_id': device_info.get('device_id'),
                #             'type': device_info['type'],
                #             'files': [{
                #                 'path': device_info['file_path'],
                #                 'size': 0,
                #                 'modified': os.path.getmtime(device_info['file_path']) if os.path.exists(device_info['file_path']) else 0
                #             }],
                #             'source': 'middev'
                #         }
                #         print(f"  Added from .middev: {device_info['manufacturer']} {device_info['model']}")
                
                # For empty manufacturers, we don't add anything to catalog
                # (catalog is device-centric, but they'll appear in the manufacturers list)
                for manufacturer_name, file_path in middev_data['manufacturers'].items():
                    print(f"  Empty manufacturer found: {manufacturer_name} (no devices yet)")
                
                print(f"Total devices after including .middev: {len(catalog)}")
                
                # Cache the catalog
                try:
                    with open(cache_file, 'w') as f:
                        json.dump({
                            'timestamp': time.time(),
                            'catalog': catalog
                        }, f, indent=2)
                except:
                    pass
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(catalog).encode())
            
        except Exception as e:
            self.send_error(500, f"Error building midnam catalog: {str(e)}")

    def extract_device_info(self, root_elem, file_path):
        """Extract device information from MIDINameDocument"""
        try:
            # The root element should be MIDINameDocument
            if root_elem.tag != 'MIDINameDocument':
                print(f"[extract_device_info] {file_path}: Root element is '{root_elem.tag}', expected 'MIDINameDocument'")
                return None
            
            midnam_doc = root_elem
            
            # Try to find MasterDeviceNames first
            master_device = midnam_doc.find('.//MasterDeviceNames')
            if master_device is not None:
                # Extract manufacturer
                manufacturer_elem = master_device.find('Manufacturer')
                
                if manufacturer_elem is None:
                    print(f"[extract_device_info] {file_path}: Missing Manufacturer in MasterDeviceNames")
                    return None
                
                manufacturer = manufacturer_elem.text or ''
                
                # Get ALL Model elements (a file can support multiple models)
                model_elems = master_device.findall('Model')
                if not model_elems:
                    print(f"[extract_device_info] {file_path}: No Model elements in MasterDeviceNames")
                    return None
                
                # Use the first model as the primary model for backward compatibility
                model = model_elems[0].text or ''
                
                # Try to extract family and device IDs from DeviceID elements
                family_id = None
                device_id = None
                
                device_id_elem = master_device.find('DeviceID')
                if device_id_elem is not None:
                    family_id = device_id_elem.get('Family')
                    device_id = device_id_elem.get('Member')
                
                return {
                    'manufacturer': manufacturer.strip(),
                    'model': model.strip(),
                    'family_id': family_id,
                    'device_id': device_id,
                    'file_path': file_path,
                    'type': 'master',
                    'all_models': [m.text.strip() for m in model_elems if m.text]
                }
            
            # Try to find ExtendingDeviceNames
            extending_device = midnam_doc.find('.//ExtendingDeviceNames')
            if extending_device is not None:
                # Extract manufacturer
                manufacturer_elem = extending_device.find('Manufacturer')
                if manufacturer_elem is None:
                    print(f"[extract_device_info] {file_path}: Missing Manufacturer in ExtendingDeviceNames")
                    return None
                
                manufacturer = manufacturer_elem.text or ''
                
                # Get all models
                model_elems = extending_device.findall('Model')
                if not model_elems:
                    print(f"[extract_device_info] {file_path}: No Model elements in ExtendingDeviceNames")
                    return None
                
                # Use the first model as the primary model
                model = model_elems[0].text or ''
                
                return {
                    'manufacturer': manufacturer.strip(),
                    'model': model.strip(),
                    'family_id': None,
                    'device_id': None,
                    'file_path': file_path,
                    'type': 'extending',
                    'all_models': [m.text.strip() for m in model_elems if m.text]
                }
            
            print(f"[extract_device_info] {file_path}: No MasterDeviceNames or ExtendingDeviceNames found")
            return None
            
        except Exception as e:
            print(f"Error extracting device info from {file_path}: {e}")
            return None

    def analyze_midnam_file(self):
        """Analyze a .midnam file and return bank/patch counts"""
        try:
            import xml.etree.ElementTree as ET
            
            # Extract file path from URL
            file_path = self.path.replace('/analyze_file/', '')
            if not file_path.endswith('.midnam'):
                file_path += '.midnam'
            
            # Ensure the file exists
            if not os.path.exists(file_path):
                self.send_error(404, f"File not found: {file_path}")
                return
            
            # Read and parse the file
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            root = ET.fromstring(content)
            
            # Find MIDINameDocument
            midnam_doc = root.find('.//MIDINameDocument')
            if midnam_doc is None:
                midnam_doc = root
            
            # Count banks and patches
            banks = midnam_doc.findall('.//PatchBank')
            patches = midnam_doc.findall('.//Patch')
            note_lists = midnam_doc.findall('.//NoteNameList')
            
            # Get file info
            file_size = os.path.getsize(file_path)
            file_modified = os.path.getmtime(file_path)
            
            # Extract device info
            manufacturer = "Unknown"
            model = "Unknown"
            author = "Unknown"
            
            master_device = midnam_doc.find('.//MasterDeviceNames')
            if master_device is not None:
                manufacturer_elem = master_device.find('Manufacturer')
                model_elem = master_device.find('Model')
                if manufacturer_elem is not None:
                    manufacturer = manufacturer_elem.text or "Unknown"
                if model_elem is not None:
                    model = model_elem.text or "Unknown"
            
            # Extract Author information - try multiple approaches
            author = "Unknown"
            author_elem = midnam_doc.find('Author')
            if author_elem is not None and author_elem.text:
                author = author_elem.text.strip()
            else:
                # Try alternative approach - look for Author anywhere in the document
                author_elem = root.find('.//Author')
                if author_elem is not None and author_elem.text:
                    author = author_elem.text.strip()
            
            # Count patches per bank
            bank_patch_counts = []
            for bank in banks:
                bank_name = bank.get('Name', 'Unnamed Bank')
                bank_patches = bank.findall('.//Patch')
                bank_patch_counts.append({
                    'name': bank_name,
                    'patch_count': len(bank_patches)
                })
            
            analysis = {
                'file_path': file_path,
                'file_size': file_size,
                'file_modified': file_modified,
                'manufacturer': manufacturer,
                'model': model,
                'author': author,
                'total_banks': len(banks),
                'total_patches': len(patches),
                'total_note_lists': len(note_lists),
                'bank_details': bank_patch_counts
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(analysis).encode())
            
        except Exception as e:
            self.send_error(500, f"Error analyzing file: {str(e)}")

    def merge_midnam_files(self):
        """Merge multiple .midnam files into one"""
        try:
            import xml.etree.ElementTree as ET
            
            # Get POST data
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            source_files = data.get('source_files', [])
            output_file = data.get('output_file', '')
            
            if not source_files or not output_file:
                self.send_error(400, "Missing source_files or output_file")
                return
            
            # Read first file as base
            with open(source_files[0], 'r', encoding='utf-8') as f:
                base_content = f.read()
            
            base_root = ET.fromstring(base_content)
            base_midnam = base_root.find('.//MIDINameDocument')
            if base_midnam is None:
                base_midnam = base_root
            
            # Merge additional files
            for source_file in source_files[1:]:
                with open(source_file, 'r', encoding='utf-8') as f:
                    source_content = f.read()
                
                source_root = ET.fromstring(source_content)
                source_midnam = source_root.find('.//MIDINameDocument')
                if source_midnam is None:
                    source_midnam = source_root
                
                # Find ChannelNameSet in base
                base_channel_set = base_midnam.find('.//ChannelNameSet')
                source_channel_set = source_midnam.find('.//ChannelNameSet')
                
                if base_channel_set is not None and source_channel_set is not None:
                    # Merge PatchBanks
                    for bank in source_channel_set.findall('.//PatchBank'):
                        # Check if bank already exists
                        bank_name = bank.get('Name')
                        existing_bank = base_channel_set.find(f'.//PatchBank[@Name="{bank_name}"]')
                        
                        if existing_bank is None:
                            # Add new bank
                            base_channel_set.append(bank)
                        else:
                            # Merge patches from existing bank
                            for patch in bank.findall('.//Patch'):
                                patch_num = patch.get('Number')
                                existing_patch = existing_bank.find(f'.//Patch[@Number="{patch_num}"]')
                                if existing_patch is None:
                                    existing_bank.append(patch)
            
            # Write merged file
            merged_xml = ET.tostring(base_root, encoding='unicode')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(merged_xml)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': f'Merged {len(source_files)} files into {output_file}'}).encode())
            
        except Exception as e:
            self.send_error(500, f"Error merging files: {str(e)}")

    def delete_midnam_file(self):
        """Delete a .midnam file"""
        try:
            # Get POST data
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            file_path = data.get('file_path', '')
            
            if not file_path:
                self.send_error(400, "Missing file_path")
                return
            
            # Ensure file exists and is a .midnam file
            if not os.path.exists(file_path) or not file_path.endswith('.midnam'):
                self.send_error(404, f"File not found or not a .midnam file: {file_path}")
                return
            
            # Delete the file
            os.remove(file_path)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': f'Deleted {file_path}'}).encode())
            
        except Exception as e:
            self.send_error(500, f"Error deleting file: {str(e)}")

    def validate_midnam(self):
        """Validate a .midnam file against the DTD"""
        try:
            from lxml import etree
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            data = json.loads(post_data)
            
            file_path = data.get('file_path')
            if not file_path or not os.path.exists(file_path):
                self.send_error(400, "Invalid or missing file_path")
                return
            
            # Validate XML against DTD
            try:
                # Get the DTD path
                dtd_path = os.path.join(os.path.dirname(__file__), 'dtd', 'MIDINameDocument10.dtd')
                dtd_dir = os.path.join(os.path.dirname(__file__), 'dtd')
                
                # Change to dtd directory so relative DTD references work (MIDIEvents10.dtd)
                original_dir = os.getcwd()
                os.chdir(dtd_dir)
                
                try:
                    # Parse the DTD
                    with open(dtd_path, 'r', encoding='utf-8') as dtd_file:
                        dtd = etree.DTD(dtd_file)
                finally:
                    os.chdir(original_dir)
                
                # Parse XML file with a parser that loads DTD for validation
                parser = etree.XMLParser(
                    dtd_validation=False,  # We'll validate manually with the DTD object
                    load_dtd=False,
                    no_network=True,
                    resolve_entities=False
                )
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    xml_doc = etree.parse(f, parser)
                
                # Validate against DTD
                if not dtd.validate(xml_doc):
                    # Collect DTD validation errors
                    errors = []
                    for error in dtd.error_log:
                        errors.append({
                            'line': error.line,
                            'column': error.column,
                            'message': error.message,
                            'type': 'dtd_validation'
                        })
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'valid': False,
                        'message': 'DTD validation failed',
                        'errors': errors,
                        'file_path': file_path
                    }).encode())
                    return
                
                # Basic structure validation
                root = xml_doc.getroot()
                
                # Check if it's a MIDINameDocument
                if root.tag != 'MIDINameDocument':
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'valid': False,
                        'message': 'File validation failed',
                        'errors': [{
                            'line': 0,
                            'column': 0,
                            'message': f'Root element must be MIDINameDocument, found {root.tag}',
                            'type': 'structure'
                        }],
                        'file_path': file_path
                    }).encode())
                    return
                
                # Check for required Author element
                author = root.find('Author')
                if author is None:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'valid': False,
                        'message': 'File validation failed',
                        'errors': [{
                            'line': 0,
                            'column': 0,
                            'message': 'Missing required Author element',
                            'type': 'structure'
                        }],
                        'file_path': file_path
                    }).encode())
                    return
                
                # Check for at least one device definition
                master_devices = root.findall('MasterDeviceNames')
                extending_devices = root.findall('ExtendingDeviceNames')
                standard_modes = root.findall('StandardDeviceMode')
                
                if not (master_devices or extending_devices or standard_modes):
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'valid': False,
                        'message': 'File validation failed',
                        'errors': [{
                            'line': 0,
                            'column': 0,
                            'message': 'Missing device definition (MasterDeviceNames, ExtendingDeviceNames, or StandardDeviceMode)',
                            'type': 'structure'
                        }],
                        'file_path': file_path
                    }).encode())
                    return
                
                # If we get here, the file is valid
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'valid': True,
                    'message': 'File is well-formed and has valid basic structure',
                    'file_path': file_path
                }).encode())
                
            except etree.XMLSyntaxError as e:
                # XML parsing error
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'valid': False,
                    'message': 'XML syntax error',
                    'errors': [{
                        'line': e.lineno if hasattr(e, 'lineno') else 0,
                        'column': e.offset if hasattr(e, 'offset') else 0,
                        'message': str(e),
                        'type': 'syntax'
                    }],
                    'file_path': file_path
                }).encode())
                
        except ImportError:
            self.send_error(500, "lxml library not installed. Install with: pip install lxml")
        except Exception as e:
            self.send_error(500, f"Error validating file: {str(e)}")
    
    def create_middev_file(self):
        """Create a new .middev file for a manufacturer with a default device"""
        try:
            import xml.etree.ElementTree as ET
            from datetime import datetime
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            data = json.loads(post_data)
            
            manufacturer = data.get('manufacturer', '').strip()
            if not manufacturer:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Manufacturer name is required'
                }).encode())
                return
            
            # Generate filenames
            middev_filename = manufacturer.replace(' ', '_') + '.middev'
            middev_path = os.path.join('patchfiles', middev_filename)
            
            model_name = 'Default Device'
            midnam_filename = f"{manufacturer.replace(' ', '_')}_{model_name.replace(' ', '_')}.midnam"
            midnam_path = os.path.join('patchfiles', midnam_filename)
            
            # Check if files already exist
            if os.path.exists(middev_path):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': f'File already exists: {middev_filename}'
                }).encode())
                return
            
            # Create .middev file with default device
            middev_root = ET.Element('MIDIDeviceTypes')
            
            # Add Author element
            author = ET.SubElement(middev_root, 'Author')
            author.text = f'Created by Midnamaker on {datetime.now().strftime("%Y-%m-%d")}'
            
            # Add default device
            device_type = ET.SubElement(middev_root, 'MIDIDeviceType', {
                'Manufacturer': manufacturer,
                'Model': model_name,
                'SupportsGeneralMIDI': 'false',
                'SupportsMMC': 'false',
                'IsSampler': 'false',
                'IsDrumMachine': 'false',
                'IsMixer': 'false',
                'IsEffectUnit': 'false'
            })
            
            # Add default DeviceID element
            ET.SubElement(device_type, 'DeviceID', {
                'Min': '1',
                'Max': '16',
                'Default': '1',
                'Base': '1'
            })
            
            # Add default Receives element
            ET.SubElement(device_type, 'Receives', {
                'MaxChannels': '16',
                'MTC': 'false',
                'Clock': 'false',
                'Notes': 'true',
                'ProgramChanges': 'true',
                'BankSelectMSB': 'false',
                'BankSelectLSB': 'false',
                'PanDisruptsStereo': 'false'
            })
            
            # Add default Transmits element
            ET.SubElement(device_type, 'Transmits', {
                'MaxChannels': '1',
                'MTC': 'false',
                'Clock': 'false',
                'Notes': 'true',
                'ProgramChanges': 'true',
                'BankSelectMSB': 'false',
                'BankSelectLSB': 'false'
            })
            
            # Pretty print and save .middev file
            xml_str = ET.tostring(middev_root, encoding='unicode', method='xml')
            from xml.dom import minidom
            dom = minidom.parseString(xml_str)
            pretty_xml = dom.toprettyxml(indent='\t', encoding=None)
            lines = [line for line in pretty_xml.split('\n') if line.strip()]
            pretty_xml = '\n'.join(lines[1:])  # Skip the XML declaration from minidom
            
            xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
            middev_doctype = '<!DOCTYPE MIDIDeviceTypes PUBLIC "-//MIDI Manufacturers Association//DTD MIDIDeviceTypes 0.3//EN" "http://www.sonosphere.com/dtds/MIDIDeviceTypes.dtd">\n\n'
            full_middev_xml = xml_declaration + middev_doctype + pretty_xml
            
            with open(middev_path, 'w', encoding='utf-8') as f:
                f.write(full_middev_xml)
            
            print(f"[create_middev_file] Created new .middev file: {middev_path}")
            
            # Create corresponding .midnam file
            midnam_root = ET.Element('MIDINameDocument')
            
            # Add Author element
            midnam_author = ET.SubElement(midnam_root, 'Author')
            midnam_author.text = f'Created by Midnamaker on {datetime.now().strftime("%Y-%m-%d")}'
            
            # Add MasterDeviceNames
            master_device = ET.SubElement(midnam_root, 'MasterDeviceNames')
            
            # Add Manufacturer and Model
            mfr_elem = ET.SubElement(master_device, 'Manufacturer')
            mfr_elem.text = manufacturer
            model_elem = ET.SubElement(master_device, 'Model')
            model_elem.text = model_name
            
            # Add CustomDeviceMode with default ChannelNameSet
            custom_mode = ET.SubElement(master_device, 'CustomDeviceMode', {'Name': 'Default'})
            channel_name_set_assigns = ET.SubElement(custom_mode, 'ChannelNameSetAssignments')
            
            # Add a channel name set assign for channel 1
            channel_assign = ET.SubElement(channel_name_set_assigns, 'ChannelNameSetAssign', {
                'Channel': '1',
                'NameSet': 'Name Set 1'
            })
            
            # Add ChannelNameSet with default patch bank
            channel_name_set = ET.SubElement(master_device, 'ChannelNameSet', {'Name': 'Name Set 1'})
            available_for_channels = ET.SubElement(channel_name_set, 'AvailableForChannels')
            available_channel = ET.SubElement(available_for_channels, 'AvailableChannel', {
                'Channel': '1',
                'Available': 'true'
            })
            
            # Add PatchBank with one default patch
            patch_bank = ET.SubElement(channel_name_set, 'PatchBank', {'Name': 'Patches'})
            patch_list = ET.SubElement(patch_bank, 'PatchNameList')
            
            # Add one default patch
            patch = ET.SubElement(patch_list, 'Patch', {
                'Number': '0',
                'Name': 'Default Patch',
                'ProgramChange': '0'
            })
            
            # Pretty print and save .midnam file
            midnam_xml_str = ET.tostring(midnam_root, encoding='unicode', method='xml')
            midnam_dom = minidom.parseString(midnam_xml_str)
            midnam_pretty_xml = midnam_dom.toprettyxml(indent='\t', encoding=None)
            midnam_lines = [line for line in midnam_pretty_xml.split('\n') if line.strip()]
            midnam_pretty_xml = '\n'.join(midnam_lines[1:])  # Skip the XML declaration from minidom
            
            midnam_doctype = '<!DOCTYPE MIDINameDocument PUBLIC "-//MIDI Manufacturers Association//DTD MIDINameDocument 1.0//EN" "http://www.midi.org/dtds/MIDINameDocument10.dtd">\n\n'
            full_midnam_xml = xml_declaration + midnam_doctype + midnam_pretty_xml
            
            with open(midnam_path, 'w', encoding='utf-8') as f:
                f.write(full_midnam_xml)
            
            print(f"[create_middev_file] Created new .midnam file: {midnam_path}")
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'middev_path': middev_path,
                'midnam_path': midnam_path,
                'manufacturer': manufacturer,
                'model': model_name,
                'message': f'Created {middev_filename} and {midnam_filename}'
            }).encode())
            
        except Exception as e:
            print(f"[create_middev_file] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error creating manufacturer files: {str(e)}")
    
    def add_device_to_middev(self):
        """Add a new device to an existing .middev file and create corresponding .midnam file"""
        try:
            import xml.etree.ElementTree as ET
            from datetime import datetime
            from xml.dom import minidom
            import shutil
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            data = json.loads(post_data)
            
            manufacturer = data.get('manufacturer', '').strip()
            model = data.get('model', '').strip()
            
            if not manufacturer or not model:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Manufacturer and model are required'
                }).encode())
                return
            
            # Find the .middev file for this manufacturer
            filename = manufacturer.replace(' ', '_') + '.middev'
            file_path = os.path.join('patchfiles', filename)
            
            # If .middev file doesn't exist, create it
            if not os.path.exists(file_path):
                print(f"[add_device_to_middev] .middev file not found, creating: {file_path}")
                
                # Create new .middev file
                root = ET.Element('MIDIDeviceTypes')
                
                # Add Author element
                author = ET.SubElement(root, 'Author')
                author.text = f'Created by Midnamaker on {datetime.now().strftime("%Y-%m-%d")}'
                
                tree = ET.ElementTree(root)
            else:
                # Parse existing file
                tree = ET.parse(file_path)
                root = tree.getroot()
            
            # Check if device already exists
            device_already_exists = False
            backup_name = None
            for device_type in root.findall('MIDIDeviceType'):
                existing_model = device_type.get('Model', '')
                if existing_model == model:
                    device_already_exists = True
                    print(f"[add_device_to_middev] Device '{model}' already exists in {filename}, will create .midnam only")
                    break
            
            # Only add device to middev if it doesn't already exist
            if not device_already_exists:
                # Create new MIDIDeviceType element with default attributes
                device_type = ET.Element('MIDIDeviceType', {
                    'Manufacturer': manufacturer,
                    'Model': model,
                    'SupportsGeneralMIDI': 'false',
                    'SupportsMMC': 'false',
                    'IsSampler': 'false',
                    'IsDrumMachine': 'false',
                    'IsMixer': 'false',
                    'IsEffectUnit': 'false'
                })
                
                # Add default DeviceID element
                device_id = ET.SubElement(device_type, 'DeviceID', {
                    'Min': '1',
                    'Max': '16',
                    'Default': '1',
                    'Base': '1'
                })
                
                # Add default Receives element
                receives = ET.SubElement(device_type, 'Receives', {
                    'MaxChannels': '16',
                    'MTC': 'false',
                    'Clock': 'false',
                    'Notes': 'true',
                    'ProgramChanges': 'true',
                    'BankSelectMSB': 'false',
                    'BankSelectLSB': 'false',
                    'PanDisruptsStereo': 'false'
                })
                
                # Add default Transmits element
                transmits = ET.SubElement(device_type, 'Transmits', {
                    'MaxChannels': '1',
                    'MTC': 'false',
                    'Clock': 'false',
                    'Notes': 'true',
                    'ProgramChanges': 'true',
                    'BankSelectMSB': 'false',
                    'BankSelectLSB': 'false'
                })
                
                # Append new device to root
                root.append(device_type)
                
                # Create backup before modifying (only if file already existed)
                if os.path.exists(file_path):
                    backup_name = f'{file_path}.backup.{datetime.now().strftime("%Y-%m-%d-%H-%M-%S")}'
                    shutil.copy(file_path, backup_name)
                
                # Write updated XML
                xml_str = ET.tostring(root, encoding='unicode', method='xml')
                
                # Pretty print the XML
                dom = minidom.parseString(xml_str)
                pretty_xml = dom.toprettyxml(indent='\t', encoding=None)
                
                # Remove extra blank lines
                lines = [line for line in pretty_xml.split('\n') if line.strip()]
                pretty_xml = '\n'.join(lines[1:])  # Skip the XML declaration from minidom
                
                # Add proper declaration and doctype
                xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
                doctype = '<!DOCTYPE MIDIDeviceTypes PUBLIC "-//MIDI Manufacturers Association//DTD MIDIDeviceTypes 0.3//EN" "http://www.sonosphere.com/dtds/MIDIDeviceTypes.dtd">\n\n'
                full_xml = xml_declaration + doctype + pretty_xml
                
                # Write to file
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(full_xml)
                
                if backup_name:
                    print(f"[add_device_to_middev] Updated {file_path}, created backup: {backup_name}")
                else:
                    print(f"[add_device_to_middev] Created new .middev file: {file_path}")
                
                print(f"[add_device_to_middev] Added device '{model}' to {file_path}")
            
            # Create corresponding .midnam file
            midnam_filename = f"{manufacturer.replace(' ', '_')}_{model.replace(' ', '_')}.midnam"
            midnam_path = os.path.join('patchfiles', midnam_filename)
            
            # Check if .midnam file already exists
            if os.path.exists(midnam_path):
                print(f"[add_device_to_middev] .midnam file already exists: {midnam_path}")
            else:
                # Create .midnam file
                midnam_root = ET.Element('MIDINameDocument')
                
                # Add Author element
                midnam_author = ET.SubElement(midnam_root, 'Author')
                midnam_author.text = f'Created by Midnamaker on {datetime.now().strftime("%Y-%m-%d")}'
                
                # Add MasterDeviceNames
                master_device = ET.SubElement(midnam_root, 'MasterDeviceNames')
                
                # Add Manufacturer and Model
                mfr_elem = ET.SubElement(master_device, 'Manufacturer')
                mfr_elem.text = manufacturer
                model_elem = ET.SubElement(master_device, 'Model')
                model_elem.text = model
                
                # Add CustomDeviceMode with default ChannelNameSet
                # TODO: Mode Name -> Mode 1, once we support multiple modes
                custom_mode = ET.SubElement(master_device, 'CustomDeviceMode', {'Name': 'Default'})
                channel_name_set_assigns = ET.SubElement(custom_mode, 'ChannelNameSetAssignments')
                
                # Add channel name set assignments for all 16 channels
                for channel in range(1, 17):
                    channel_assign = ET.SubElement(channel_name_set_assigns, 'ChannelNameSetAssign', {
                        'Channel': str(channel),
                        'NameSet': 'Name Set 1'
                    })
                
                # Add ChannelNameSet with default patch bank
                channel_name_set = ET.SubElement(master_device, 'ChannelNameSet', {'Name': 'Name Set 1'})
                available_for_channels = ET.SubElement(channel_name_set, 'AvailableForChannels')
                
                # Add available channels for all 16 channels
                for channel in range(1, 17):
                    available_channel = ET.SubElement(available_for_channels, 'AvailableChannel', {
                        'Channel': str(channel),
                        'Available': 'true'
                    })
                
                # Add UsesControlNameList
                uses_control_name_list = ET.SubElement(channel_name_set, 'UsesControlNameList', {'Name': 'MIDI Continuous Controllers'})
                
                # Add PatchBank with MIDI commands and one default patch
                patch_bank = ET.SubElement(channel_name_set, 'PatchBank', {'Name': 'Patches'})
                
                # Add MIDICommands block with default ControlChange commands
                midi_commands = ET.SubElement(patch_bank, 'MIDICommands')
                ET.SubElement(midi_commands, 'ControlChange', {'Control': '0', 'Value': '0'})
                ET.SubElement(midi_commands, 'ControlChange', {'Control': '32', 'Value': '0'})
                
                patch_list = ET.SubElement(patch_bank, 'PatchNameList')
                
                # Add one default patch
                patch = ET.SubElement(patch_list, 'Patch', {
                    'Number': '0',
                    'Name': 'Default Patch',
                    'ProgramChange': '0'
                })
                
                # Add ControlNameList with MIDI Continuous Controllers
                control_name_list = ET.SubElement(master_device, 'ControlNameList', {'Name': 'MIDI Continuous Controllers'})
                
                # Add all standard MIDI Continuous Controllers (0-127)
                midi_controls = [
                    (1, "Modulation Wheel or Lever"),
                    (2, "Breath Controller"),
                    (3, "Undefined"),
                    (4, "Foot Controller"),
                    (5, "Portamento Time"),
                    (6, "Data Entry MSB"),
                    (7, "Channel Volume"),
                    (8, "Balance"),
                    (9, "Undefined"),
                    (10, "Pan"),
                    (11, "Expression Controller"),
                    (12, "Effect Control 1"),
                    (13, "Effect Control 2"),
                    (16, "General Purpose Controller 1"),
                    (17, "General Purpose Controller 2"),
                    (18, "General Purpose Controller 3"),
                    (19, "General Purpose Controller 4"),
                    (33, "LSB for Control 1 (Modulation Wheel or Lever) (Fine)"),
                    (34, "LSB for Control 2 (Breath Controller) (Fine)"),
                    (35, "LSB for Control 3 (Undefined) (Fine)"),
                    (36, "LSB for Control 4 (Foot Controller) (Fine)"),
                    (37, "LSB for Control 5 (Portamento Time) (Fine)"),
                    (38, "LSB for Control 6 (Data Entry) (Fine)"),
                    (39, "LSB for Control 7 (Channel Volume) (Fine)"),
                    (40, "LSB for Control 8 (Balance) (Fine)"),
                    (41, "LSB for Control 9 (Undefined) (Fine)"),
                    (42, "LSB for Control 10 (Pan) (Fine)"),
                    (43, "LSB for Control 11 (Expression Controller) (Fine)"),
                    (44, "LSB for Control 12 (Effect control 1) (Fine)"),
                    (45, "LSB for Control 13 (Effect control 2) (Fine)"),
                    (64, "Damper Pedal on/off (Sustain) ≤63 off, ≥64 on"),
                    (65, "Portamento On/Off ≤63 off, ≥64 on"),
                    (66, "Sostenuto On/Off ≤63 off, ≥64 on"),
                    (67, "Soft Pedal On/Off ≤63 off, ≥64 on"),
                    (68, "Legato Footswitch ≤63 Normal, ≥64 Legato"),
                    (69, "Hold 2 ≤63 off, ≥64 on"),
                    (70, "Sound Controller 1 (default: Sound Variation) (Fine)"),
                    (71, "Sound Controller 2 (default: Timbre/Harmonic Intens.) (Fine)"),
                    (72, "Sound Controller 3 (default: Release Time) (Fine)"),
                    (73, "Sound Controller 4 (default: Attack Time) (Fine)"),
                    (74, "Sound Controller 5 (default: Brightness) (Fine)"),
                    (75, "Sound Controller 6 (default: Decay Time) (Fine)"),
                    (76, "Sound Controller 7 (default: Vibrato Rate) (Fine)"),
                    (77, "Sound Controller 8 (default: Vibrato Depth) (Fine)"),
                    (78, "Sound Controller 9 (default: Vibrato Delay) (Fine)"),
                    (79, "Sound Controller 10 (default undefined) (Fine)"),
                    (80, "General Purpose Controller 5 (Fine)"),
                    (81, "General Purpose Controller 6 (Fine)"),
                    (82, "General Purpose Controller 7 (Fine)"),
                    (83, "General Purpose Controller 8 (Fine)"),
                    (84, "Portamento Control (Fine)"),
                    (88, "High Resolution Velocity Prefix (Velocity LSB)"),
                    (91, "Effects 1 Depth (default: Reverb Send Level)"),
                    (92, "Effects 2 Depth"),
                    (93, "Effects 3 Depth (default: Chorus Send Level)"),
                    (94, "Effects 4 Depth"),
                    (95, "Effects 5 Depth"),
                    (96, "Data Increment (Data Entry +1)"),
                    (97, "Data Decrement (Data Entry -1)"),
                ]
                
                for number, name in midi_controls:
                    ET.SubElement(control_name_list, 'Control', {
                        'Type': '7bit',
                        'Number': str(number),
                        'Name': name
                    })
                
                # Pretty print and save .midnam file
                midnam_xml_str = ET.tostring(midnam_root, encoding='unicode', method='xml')
                midnam_dom = minidom.parseString(midnam_xml_str)
                midnam_pretty_xml = midnam_dom.toprettyxml(indent='\t', encoding=None)
                midnam_lines = [line for line in midnam_pretty_xml.split('\n') if line.strip()]
                midnam_pretty_xml = '\n'.join(midnam_lines[1:])  # Skip the XML declaration from minidom
                
                midnam_xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
                midnam_doctype = '<!DOCTYPE MIDINameDocument PUBLIC "-//MIDI Manufacturers Association//DTD MIDINameDocument 1.0//EN" "http://www.midi.org/dtds/MIDINameDocument10.dtd">\n\n'
                full_midnam_xml = midnam_xml_declaration + midnam_doctype + midnam_pretty_xml
                
                with open(midnam_path, 'w', encoding='utf-8') as f:
                    f.write(full_midnam_xml)
                
                print(f"[add_device_to_middev] Created new .midnam file: {midnam_path}")
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Create appropriate message based on whether device was added or already existed
            if device_already_exists:
                message = f'Created MIDI Name Document for {model}'
            else:
                message = f'Added {model} to {manufacturer}'
            
            self.wfile.write(json.dumps({
                'success': True,
                'middev_path': file_path,
                'midnam_path': midnam_path,
                'manufacturer': manufacturer,
                'model': model,
                'backup': backup_name,
                'message': message,
                'device_already_existed': device_already_exists
            }).encode())
            
        except ET.ParseError as e:
            print(f"[add_device_to_middev] XML Parse Error: {str(e)}")
            self.send_error(422, f"Cannot modify invalid XML file: {str(e)}")
        except Exception as e:
            print(f"[add_device_to_middev] Error: {str(e)}")
            self.send_error(500, f"Error adding device: {str(e)}")
    
    def clear_cache(self):
        """Clear the midnam catalog cache"""
        try:
            cache_file = 'midnam_catalog_cache.json'
            if os.path.exists(cache_file):
                os.remove(cache_file)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"success": true, "message": "Cache cleared"}')
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"success": true, "message": "No cache to clear"}')
        except Exception as e:
            self.send_error(500, f"Error clearing cache: {str(e)}")
    
    def upload_files(self):
        """Handle file uploads for .midnam and .middev files"""
        try:
            import cgi
            import io
            
            # Parse multipart form data
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_error(400, "Content-Type must be multipart/form-data")
                return
            
            # Get boundary from content type
            boundary = content_type.split('boundary=')[1]
            content_length = int(self.headers['Content-Length'])
            
            # Read the multipart data
            body = self.rfile.read(content_length)
            
            # Parse multipart data manually
            uploaded_files = []
            errors = []
            
            # Split by boundary
            parts = body.split(f'--{boundary}'.encode())
            
            for part in parts:
                if not part or part == b'--\r\n' or part == b'--':
                    continue
                
                # Extract headers and content
                try:
                    header_end = part.find(b'\r\n\r\n')
                    if header_end == -1:
                        continue
                    
                    headers = part[:header_end].decode('utf-8', errors='ignore')
                    content = part[header_end + 4:]
                    
                    # Remove trailing CRLF
                    if content.endswith(b'\r\n'):
                        content = content[:-2]
                    
                    # Extract filename from headers
                    filename = None
                    for line in headers.split('\r\n'):
                        if 'filename=' in line:
                            # Extract filename
                            start = line.find('filename="') + 10
                            end = line.find('"', start)
                            filename = line[start:end]
                            break
                    
                    if not filename:
                        continue
                    
                    # Validate file type
                    if not (filename.endswith('.midnam') or filename.endswith('.middev')):
                        errors.append(f"Invalid file type: {filename} (only .midnam and .middev files are allowed)")
                        continue
                    
                    # Save file to patchfiles directory
                    file_path = os.path.join('patchfiles', filename)
                    
                    # Check if file already exists
                    file_existed = os.path.exists(file_path)
                    action = 'replaced' if file_existed else 'uploaded'
                    
                    # Write file (overwrites if exists)
                    with open(file_path, 'wb') as f:
                        f.write(content)
                    
                    # Extract manufacturer and model from MIDNAM files for auto-loading
                    manufacturer = None
                    model = None
                    if filename.endswith('.midnam'):
                        try:
                            import xml.etree.ElementTree as ET
                            root = ET.fromstring(content)
                            manufacturer_elem = root.find('.//Manufacturer')
                            model_elem = root.find('.//Model')
                            if manufacturer_elem is not None:
                                manufacturer = manufacturer_elem.text
                            if model_elem is not None:
                                model = model_elem.text
                        except Exception as parse_error:
                            print(f"[upload_files] Warning: Could not parse {filename}: {parse_error}")
                    
                    uploaded_files.append({
                        'filename': filename,
                        'path': file_path,
                        'size': len(content),
                        'action': action,
                        'manufacturer': manufacturer,
                        'model': model
                    })
                    
                    print(f"[upload_files] {action.capitalize()}: {file_path} ({len(content)} bytes)")
                    
                except Exception as e:
                    errors.append(f"Error processing file: {str(e)}")
                    continue
            
            # Clear cache after upload
            cache_file = 'midnam_catalog_cache.json'
            if os.path.exists(cache_file):
                os.remove(cache_file)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'uploaded_files': uploaded_files,
                'errors': errors,
                'message': f'Uploaded {len(uploaded_files)} file(s)' + (f' with {len(errors)} error(s)' if errors else '')
            }).encode())
            
        except Exception as e:
            print(f"[upload_files] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error uploading files: {str(e)}")
    
    def download_midnam(self):
        """Download a .midnam file for the current device"""
        try:
            import urllib.parse
            
            # Parse URL to separate path and query parameters
            parsed_url = urlparse(self.path)
            
            # Extract device ID from path (remove /api/download/midnam/ prefix)
            device_id = parsed_url.path.replace('/api/download/midnam/', '')
            device_id = urllib.parse.unquote(device_id)
            
            # Parse query parameters for file path
            query_params = parse_qs(parsed_url.query)
            file_path = query_params.get('file', [None])[0]
            
            if file_path:
                file_path = urllib.parse.unquote(file_path)
                print(f"[download_midnam] Device ID: {device_id}, File path from query: {file_path}")
            else:
                # Find file from device ID
                print(f"[download_midnam] No file parameter, looking up device: {device_id}")
                manufacturers_data = self.get_manufacturers_data()
                device_data = None
                
                for manufacturer, devices in manufacturers_data.items():
                    for device in devices:
                        if device['id'] == device_id:
                            device_data = device
                            file_path = device['file_path']
                            break
                    if device_data:
                        break
                
                if not file_path:
                    print(f"[download_midnam] Device not found: {device_id}")
                    self.send_error(404, f"Device not found: {device_id}")
                    return
            
            # Check if file exists
            if not os.path.exists(file_path):
                print(f"[download_midnam] File not found: {file_path}")
                self.send_error(404, f"File not found: {file_path}")
                return
            
            # Read file
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Get filename
            filename = os.path.basename(file_path)
            
            print(f"[download_midnam] Sending file: {filename} ({len(content)} bytes)")
            
            # Send file
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            
            print(f"[download_midnam] Successfully downloaded: {file_path}")
            
        except Exception as e:
            print(f"[download_midnam] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error downloading file: {str(e)}")
    
    def download_middev(self):
        """Download a .middev file for a manufacturer"""
        try:
            import urllib.parse
            
            # Extract manufacturer from URL
            manufacturer = self.path.replace('/api/download/middev/', '')
            manufacturer = urllib.parse.unquote(manufacturer)
            
            # Try multiple possible filenames and locations
            filename = manufacturer.replace(' ', '_') + '.middev'
            possible_paths = [
                os.path.join('patchfiles', filename),
                os.path.join('patchfiles', manufacturer + '.middev'),
            ]
            
            # Also search subdirectories
            for root, dirs, files in os.walk('patchfiles'):
                for file in files:
                    if file.lower() == filename.lower() or file.lower() == (manufacturer + '.middev').lower():
                        possible_paths.insert(0, os.path.join(root, file))
                        break
            
            file_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    file_path = path
                    break
            
            if not file_path:
                print(f"[download_middev] File not found for manufacturer: {manufacturer}")
                print(f"[download_middev] Searched: {possible_paths}")
                self.send_error(404, f"File not found: {filename}")
                return
            
            # Read file
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Use the actual filename from the found path (preserves spaces)
            actual_filename = os.path.basename(file_path)
            
            # Send file
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml')
            self.send_header('Content-Disposition', f'attachment; filename="{actual_filename}"')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            
            print(f"[download_middev] Downloaded: {file_path}")
            
        except Exception as e:
            print(f"[download_middev] Error: {str(e)}")
            self.send_error(500, f"Error downloading file: {str(e)}")
    
    def download_zip(self):
        """Download a zip file containing both .midnam and .middev files"""
        try:
            import urllib.parse
            import zipfile
            import io
            
            # Parse URL to separate path and query parameters
            parsed_url = urlparse(self.path)
            
            # Extract device ID from path (remove /api/download/zip/ prefix)
            device_id = parsed_url.path.replace('/api/download/zip/', '')
            device_id = urllib.parse.unquote(device_id)
            
            # Parse query parameters for file path
            query_params = parse_qs(parsed_url.query)
            midnam_file_path = query_params.get('file', [None])[0]
            
            if midnam_file_path:
                midnam_file_path = urllib.parse.unquote(midnam_file_path)
                print(f"[download_zip] Device ID: {device_id}, File path from query: {midnam_file_path}")
            else:
                # Find file from device ID
                print(f"[download_zip] No file parameter, looking up device: {device_id}")
                manufacturers_data = self.get_manufacturers_data()
                device_data = None
                
                for manufacturer, devices in manufacturers_data.items():
                    for device in devices:
                        if device['id'] == device_id:
                            device_data = device
                            midnam_file_path = device['file_path']
                            break
                    if device_data:
                        break
                
                if not midnam_file_path:
                    print(f"[download_zip] Device not found: {device_id}")
                    self.send_error(404, f"Device not found: {device_id}")
                    return
            
            # Check if midnam file exists
            if not os.path.exists(midnam_file_path):
                print(f"[download_zip] MIDNAM file not found: {midnam_file_path}")
                self.send_error(404, f"File not found: {midnam_file_path}")
                return
            
            # Extract manufacturer from device ID
            manufacturer = device_id.split('|')[0]
            
            # Try multiple filename variations (with and without space replacement)
            middev_filename_underscore = manufacturer.replace(' ', '_') + '.middev'
            middev_filename_spaces = manufacturer + '.middev'
            
            # Try multiple locations for .middev file
            middev_file_path = None
            possible_paths = [
                # Try with spaces first (this is the actual convention)
                os.path.join('patchfiles', middev_filename_spaces),
                os.path.join(os.path.dirname(midnam_file_path), middev_filename_spaces),
                # Then try with underscores
                os.path.join('patchfiles', middev_filename_underscore),
                os.path.join(os.path.dirname(midnam_file_path), middev_filename_underscore),
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    middev_file_path = path
                    print(f"[download_zip] Found middev file at: {path}")
                    break
            
            if not middev_file_path:
                print(f"[download_zip] WARNING: .middev file not found for manufacturer: {manufacturer}")
                print(f"[download_zip] Searched in: {possible_paths}")
            
            # Create zip file in memory
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                # Add .midnam file
                midnam_filename = os.path.basename(midnam_file_path)
                with open(midnam_file_path, 'rb') as f:
                    zip_file.writestr(midnam_filename, f.read())
                    print(f"[download_zip] Added to zip: {midnam_filename}")
                
                # Add .middev file if it exists
                if middev_file_path:
                    # Use the actual filename from the path (preserves spaces)
                    actual_middev_filename = os.path.basename(middev_file_path)
                    with open(middev_file_path, 'rb') as f:
                        zip_file.writestr(actual_middev_filename, f.read())
                        print(f"[download_zip] Added to zip: {actual_middev_filename}")
                else:
                    print(f"[download_zip] Skipping middev file (not found)")
            
            # Get zip content
            zip_content = zip_buffer.getvalue()
            
            # Generate zip filename
            device_name = device_id.split('|')[1] if '|' in device_id else 'device'
            safe_device_name = device_name.replace(' ', '_').replace('/', '_')
            zip_filename = f"{manufacturer.replace(' ', '_')}_{safe_device_name}.zip"
            
            # Send zip file
            print(f"[download_zip] Sending zip: {zip_filename} ({len(zip_content)} bytes)")
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Disposition', f'attachment; filename="{zip_filename}"')
            self.send_header('Content-Length', str(len(zip_content)))
            self.end_headers()
            self.wfile.write(zip_content)
            
            print(f"[download_zip] Successfully downloaded zip: {zip_filename}")
            
        except Exception as e:
            print(f"[download_zip] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_error(500, f"Error downloading zip: {str(e)}")

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 8000))
    
    with socketserver.TCPServer(("", PORT), MIDINameHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Open: http://localhost:{PORT}/index.html")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
