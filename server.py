#!/usr/bin/env python3
"""
Simple HTTP server for the MIDI Name Editor
Run with: python3 server.py
Then open: http://localhost:8000/midi_name_editor.html
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
    
    def do_GET(self):
        # Strip query parameters for path matching
        path_without_query = self.path.split('?')[0]
        
        if path_without_query.startswith('/patchfiles/'):
            self.serve_patchfile()
        elif path_without_query == '/manufacturers' or path_without_query == '/api/manufacturers':
            self.serve_manufacturers()
        elif path_without_query.startswith('/api/device/'):
            self.serve_device_details()
        elif path_without_query == '/midnam_catalog':
            self.serve_midnam_catalog()
        elif path_without_query.startswith('/analyze_file/'):
            self.analyze_midnam_file()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/save_file':
            self.save_file()
        elif self.path == '/api/patch/save':
            self.save_patch()
        elif self.path == '/api/midnam/save':
            self.save_midnam_structure()
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
            # Find all patch banks and update patch lists
            for master_device in root.findall('.//MasterDeviceNames'):
                for channel_name_set in master_device.findall('.//ChannelNameSet'):
                    patch_banks = channel_name_set.findall('.//PatchBank')
                    
                    # Match banks by index position (order matters)
                    if 'patchList' in midnam:
                        # Remove banks that no longer exist in frontend
                        if len(midnam['patchList']) < len(patch_banks):
                            # Remove extra banks from the end
                            for bank_index in range(len(midnam['patchList']), len(patch_banks)):
                                bank_to_remove = patch_banks[bank_index]
                                bank_name = bank_to_remove.get('Name', f'Bank {bank_index + 1}')
                                channel_name_set.remove(bank_to_remove)
                                print(f"[save_midnam_structure] Removed bank: {bank_name}")
                            
                            # Refresh the list after removal
                            patch_banks = channel_name_set.findall('.//PatchBank')
                        
                        # Update existing banks
                        for bank_index, patch_bank in enumerate(patch_banks):
                            if bank_index < len(midnam['patchList']):
                                midnam_bank = midnam['patchList'][bank_index]
                                
                                # Update bank name if it has changed
                                if 'name' in midnam_bank:
                                    patch_bank.set('Name', midnam_bank['name'])
                                
                                # Update patches in this bank
                                if 'patch' in midnam_bank:
                                    patch_name_list = patch_bank.find('PatchNameList')
                                    if patch_name_list is not None:
                                        # Clear existing patches
                                        patch_name_list.clear()
                                        
                                        # Add updated patches
                                        for patch_data in midnam_bank['patch']:
                                            patch_elem = ET.SubElement(patch_name_list, 'Patch')
                                            patch_elem.set('Name', patch_data.get('name', ''))
                                            patch_elem.set('Number', str(patch_data.get('Number', '')))
                                            patch_elem.set('ProgramChange', str(patch_data.get('programChange', '')))
                        
                        # Add new banks if frontend has more than XML
                        if len(midnam['patchList']) > len(patch_banks):
                            for bank_index in range(len(patch_banks), len(midnam['patchList'])):
                                midnam_bank = midnam['patchList'][bank_index]
                                
                                # Create new PatchBank element
                                new_patch_bank = ET.SubElement(channel_name_set, 'PatchBank')
                                new_patch_bank.set('Name', midnam_bank.get('name', f'New Bank {bank_index + 1}'))
                                
                                # Add PatchNameList
                                patch_name_list = ET.SubElement(new_patch_bank, 'PatchNameList')
                                
                                # Add patches
                                if 'patch' in midnam_bank:
                                    for patch_data in midnam_bank['patch']:
                                        patch_elem = ET.SubElement(patch_name_list, 'Patch')
                                        patch_elem.set('Name', patch_data.get('name', ''))
                                        patch_elem.set('Number', str(patch_data.get('Number', '')))
                                        patch_elem.set('ProgramChange', str(patch_data.get('programChange', '')))
                                
                                print(f"[save_midnam_structure] Created new bank: {midnam_bank.get('name', f'New Bank {bank_index + 1}')}")
            
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
                            
                            # Create device key
                            device_key = f"{device_info['manufacturer']}|{device_info['model']}"
                            
                            patch_files.append({
                                'id': device_key,
                                'name': device_info['model'],
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
                                
                                # Create device key from manufacturer + model
                                device_key = f"{device_info['manufacturer']}|{device_info['model']}"
                                
                                if device_info['manufacturer'] not in manufacturers_dict:
                                    manufacturers_dict[device_info['manufacturer']] = []
                                
                                # Add device to manufacturer's list
                                device_data = {
                                    'id': device_key,
                                    'name': device_info['model'],
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
            for device_key, device_info in middev_data['devices'].items():
                # Only add if not already in manufacturers_dict from .midnam files
                manufacturer = device_info['manufacturer']
                
                # Check if device already exists
                device_exists = False
                if manufacturer in manufacturers_dict:
                    for existing_device in manufacturers_dict[manufacturer]:
                        if existing_device['id'] == device_key:
                            device_exists = True
                            break
                
                if not device_exists:
                    if manufacturer not in manufacturers_dict:
                        manufacturers_dict[manufacturer] = []
                    
                    manufacturers_dict[manufacturer].append({
                        'id': device_key,
                        'name': device_info['model'],
                        'type': device_info['type'],
                        'file_path': device_info['file_path'],
                        'manufacturer_id': device_info.get('manufacturer_id'),
                        'family_id': device_info.get('family_id'),
                        'device_id': device_info.get('device_id'),
                        'source': 'middev'
                    })
            
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
            
            # Try to extract patch banks and patches
            banks = root_elem.findall('.//PatchBank')
            patches = root_elem.findall('.//Patch')
            note_lists = root_elem.findall('.//NoteNameList')
            
            device_details['patch_banks'] = []
            for bank in banks:
                bank_name = bank.get('Name', 'Unnamed Bank')
                bank_patches = bank.findall('.//Patch')
                
                # Extract MIDI commands for this bank
                midi_commands = []
                midi_commands_elem = bank.find('.//MIDICommands')
                if midi_commands_elem is not None:
                    for control_change in midi_commands_elem.findall('.//ControlChange'):
                        control = control_change.get('Control', '')
                        value = control_change.get('Value', '')
                        midi_commands.append({
                            'type': 'ControlChange',
                            'control': control,
                            'value': value
                        })
                
                patches_data = []
                for patch in bank_patches:
                    patch_name = patch.get('Name', 'Unnamed')
                    patch_number = patch.get('Number', '0')
                    program_change = patch.get('ProgramChange', '0')
                    
                    # Find the note name list used by this patch
                    uses_note_list = patch.find('.//UsesNoteNameList')
                    note_list_name = uses_note_list.get('Name', '') if uses_note_list is not None else ''
                    
                    patches_data.append({
                        'name': patch_name,
                        'Number': patch_number,
                        'programChange': program_change,
                        'note_list_name': note_list_name
                    })
                
                device_details['patch_banks'].append({
                    'name': bank_name,
                    'patch_count': len(bank_patches),
                    'patches': patches_data,
                    'midi_commands': midi_commands
                })
            
            device_details['total_patches'] = len(patches)
            device_details['total_note_lists'] = len(note_lists)
            
            # Extract ChannelNameSetAssignments (channel assignments)
            device_details['channel_name_set_assignments'] = []
            channel_assignments = root_elem.findall('.//ChannelNameSetAssign')
            for assignment in channel_assignments:
                channel = assignment.get('Channel', '')
                name_set = assignment.get('NameSet', '')
                device_details['channel_name_set_assignments'].append({
                    'channel': channel,
                    'name_set': name_set
                })

            # Extract ChannelNameSets (the actual name sets)
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
                
                device_details['channel_name_sets'].append({
                    'name': name_set_name,
                    'available_channels': available_channels
                })

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
                            
                            device_key = f"{device_info['manufacturer']}|{device_info['model']}"
                            
                            if device_info['manufacturer'] not in manufacturers_dict:
                                manufacturers_dict[device_info['manufacturer']] = []
                            
                            device_data = {
                                'id': device_key,
                                'name': device_info['model'],
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
                                    
                                    print(f"  Extracted: {device_info['manufacturer']} {device_info['model']} (ID: {manufacturer_id or 'unknown'})")
                                    # Create device key from manufacturer + model
                                    device_key = f"{device_info['manufacturer']}|{device_info['model']}"
                                    
                                    if device_key not in catalog:
                                        catalog[device_key] = {
                                            'manufacturer': device_info['manufacturer'],
                                            'model': device_info['model'],
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
                for device_key, device_info in middev_data['devices'].items():
                    # Only add if not already in catalog from .midnam files
                    if device_key not in catalog:
                        catalog[device_key] = {
                            'manufacturer': device_info['manufacturer'],
                            'model': device_info['model'],
                            'manufacturer_id': device_info.get('manufacturer_id'),
                            'family_id': device_info.get('family_id'),
                            'device_id': device_info.get('device_id'),
                            'type': device_info['type'],
                            'files': [{
                                'path': device_info['file_path'],
                                'size': 0,
                                'modified': os.path.getmtime(device_info['file_path']) if os.path.exists(device_info['file_path']) else 0
                            }],
                            'source': 'middev'
                        }
                        print(f"  Added from .middev: {device_info['manufacturer']} {device_info['model']}")
                
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
                # Extract manufacturer and model
                manufacturer_elem = master_device.find('Manufacturer')
                model_elem = master_device.find('Model')
                
                if manufacturer_elem is None or model_elem is None:
                    print(f"[extract_device_info] {file_path}: Missing Manufacturer or Model in MasterDeviceNames")
                    return None
                
                manufacturer = manufacturer_elem.text or ''
                model = model_elem.text or ''
                
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
                    'type': 'master'
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
            
            # For now, just validate that the XML is well-formed
            # DTD validation is disabled because MIDIEvents10.dtd is missing
            try:
                # Parse XML file with a parser that doesn't load external entities
                parser = etree.XMLParser(
                    dtd_validation=False,
                    load_dtd=False,
                    no_network=True,
                    resolve_entities=False
                )
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    xml_doc = etree.parse(f, parser)
                
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
                'NameSet': 'Default Patches'
            })
            
            # Add ChannelNameSet with default patch bank
            channel_name_set = ET.SubElement(master_device, 'ChannelNameSet', {'Name': 'Default Patches'})
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
            for device_type in root.findall('MIDIDeviceType'):
                existing_model = device_type.get('Model', '')
                if existing_model == model:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'error': f'Device "{model}" already exists in {filename}'
                    }).encode())
                    return
            
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
            backup_name = None
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
                custom_mode = ET.SubElement(master_device, 'CustomDeviceMode', {'Name': 'Default'})
                channel_name_set_assigns = ET.SubElement(custom_mode, 'ChannelNameSetAssignments')
                
                # Add a channel name set assign for channel 1
                channel_assign = ET.SubElement(channel_name_set_assigns, 'ChannelNameSetAssign', {
                    'Channel': '1',
                    'NameSet': 'Default Patches'
                })
                
                # Add ChannelNameSet with default patch bank
                channel_name_set = ET.SubElement(master_device, 'ChannelNameSet', {'Name': 'Default Patches'})
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
                
                midnam_xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
                midnam_doctype = '<!DOCTYPE MIDINameDocument PUBLIC "-//MIDI Manufacturers Association//DTD MIDINameDocument 1.0//EN" "http://www.midi.org/dtds/MIDINameDocument10.dtd">\n\n'
                full_midnam_xml = midnam_xml_declaration + midnam_doctype + midnam_pretty_xml
                
                with open(midnam_path, 'w', encoding='utf-8') as f:
                    f.write(full_midnam_xml)
                
                print(f"[add_device_to_middev] Created new .midnam file: {midnam_path}")
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'middev_path': file_path,
                'midnam_path': midnam_path,
                'manufacturer': manufacturer,
                'model': model,
                'backup': backup_name,
                'message': f'Added {model} to {manufacturer}'
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

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 8000))
    
    with socketserver.TCPServer(("", PORT), MIDINameHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Open: http://localhost:{PORT}/midi_name_editor.html")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
