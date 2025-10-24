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
        if self.path.startswith('/patchfiles/'):
            self.serve_patchfile()
        elif self.path == '/manufacturers' or self.path == '/api/manufacturers':
            self.serve_manufacturers()
        elif self.path.startswith('/api/device/'):
            self.serve_device_details()
        elif self.path == '/midnam_catalog':
            self.serve_midnam_catalog()
        elif self.path.startswith('/analyze_file/'):
            self.analyze_midnam_file()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/save_file':
            self.save_file()
        elif self.path == '/api/patch/save':
            self.save_patch()
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
            
            if not device_file or not os.path.exists(device_file):
                self.send_error(404, "Device file not found")
                return
            
            # Parse XML and update patch notes
            import xml.etree.ElementTree as ET
            tree = ET.parse(device_file)
            root = tree.getroot()
            
            # Find the patch and update its note list
            for bank in root.findall('.//PatchBank'):
                if bank.get('Name') == patch_bank:
                    for patch_elem in bank.findall('.//Patch'):
                        if patch_elem.get('Name') == patch_name_to_find:
                            # Update patch name and number
                            if patch.get('name'):
                                patch_elem.set('Name', patch.get('name'))
                            if patch.get('number'):
                                patch_elem.set('UserID', patch.get('number'))
                            
                            # Update note list
                            note_list_name = None
                            uses_note_list = patch_elem.find('UsesNoteNameList')
                            if uses_note_list is not None:
                                note_list_name = uses_note_list.get('Name')
                            
                            if note_list_name:
                                # Find and update the note list
                                for note_list in root.findall('.//NoteNameList'):
                                    if note_list.get('Name') == note_list_name:
                                        # Clear existing notes
                                        for note in note_list.findall('Note'):
                                            note_list.remove(note)
                                        
                                        # Add updated notes
                                        for note_data in notes:
                                            note_elem = ET.SubElement(note_list, 'Note')
                                            note_elem.set('Number', str(note_data.get('number', '')))
                                            note_elem.set('Name', note_data.get('name', ''))
                                        
                                        break
                            break
                    break
            
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
                    except Exception as e:
                        print(f"Error processing {file_path}: {e}")
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
                    
                    # Find the note name list used by this patch
                    uses_note_list = patch.find('.//UsesNoteNameList')
                    note_list_name = uses_note_list.get('Name', '') if uses_note_list is not None else ''
                    
                    patches_data.append({
                        'name': patch_name,
                        'number': patch_number,
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
                return None
            
            midnam_doc = root_elem
            
            # Try to find MasterDeviceNames first
            master_device = midnam_doc.find('.//MasterDeviceNames')
            if master_device is not None:
                # Extract manufacturer and model
                manufacturer_elem = master_device.find('Manufacturer')
                model_elem = master_device.find('Model')
                
                if manufacturer_elem is None or model_elem is None:
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
                    return None
                
                manufacturer = manufacturer_elem.text or ''
                
                # Get all models
                model_elems = extending_device.findall('Model')
                if not model_elems:
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
