"""API endpoint: /api/device/* - Get device details"""
from http.server import BaseHTTPRequestHandler
import json
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
from ._utils import get_manufacturers_data, get_patchfiles_dir, cors_headers

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET request for device details"""
        try:
            # Parse URL to get device ID
            parsed_url = urlparse(self.path)
            
            # Extract device ID from path (everything after /api/device/)
            path_parts = parsed_url.path.split('/api/device/')
            if len(path_parts) < 2 or not path_parts[1]:
                raise ValueError("Device ID required")
            
            device_id = unquote(path_parts[1])
            
            # Check for file parameter
            query_params = parse_qs(parsed_url.query)
            specific_file = query_params.get('file', [None])[0]
            if specific_file:
                specific_file = unquote(specific_file)
                # Normalize Vercel paths - remove /var/task/ prefix if present
                if specific_file.startswith('/var/task/'):
                    specific_file = specific_file.replace('/var/task/', '')
            
            # Find the device in manufacturers data
            manufacturers_data = get_manufacturers_data()
            device_data = None
            
            # If a specific file is requested, find device with that file
            if specific_file:
                for manufacturer, devices in manufacturers_data.items():
                    for device in devices:
                        if device['id'] == device_id:
                            # Normalize device path for comparison
                            device_file_path = str(device['file_path'])
                            if device_file_path.startswith('/var/task/'):
                                device_file_path = device_file_path.replace('/var/task/', '')
                            
                            # Check if file path matches
                            file_path = Path(device_file_path)
                            if (str(file_path) == specific_file or 
                                file_path.name == Path(specific_file).name or
                                device_file_path.endswith(specific_file) or
                                specific_file.endswith(device_file_path)):
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
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                for key, value in cors_headers().items():
                    self.send_header(key, value)
                self.end_headers()
                
                self.wfile.write(json.dumps({
                    'error': f'Device not found: {device_id}'
                }).encode())
                return
            
            # Read and parse the MIDNAM file
            file_path = Path(device_data['file_path'])
            
            with open(file_path, 'r', encoding='utf-8') as f:
                midnam_content = f.read()
            
            # Parse XML to extract device details
            root_elem = ET.fromstring(midnam_content)
            
            # Extract basic info
            manufacturer_elem = root_elem.find('.//Manufacturer')
            model_elem = root_elem.find('.//Model')
            author_elem = root_elem.find('.//Author')
            
            manufacturer = manufacturer_elem.text if manufacturer_elem is not None else 'Unknown'
            model = model_elem.text if model_elem is not None else 'Unknown'
            author = author_elem.text if author_elem is not None else 'Unknown'
            
            # Build device details response
            device_details = {
                'id': device_id,
                'Manufacturer': manufacturer,
                'Model': model,
                'Author': author,
                'file_path': str(file_path),
                'raw_xml': midnam_content,
                'note_lists': [],
                'patch_banks': [],
                'channel_name_sets': [],
                'custom_device_modes': []
            }
            
            # Extract NoteNameLists
            for note_list in root_elem.findall('.//NoteNameList'):
                name_attr = note_list.get('Name')
                if name_attr:
                    notes = []
                    for note in note_list.findall('.//Note'):
                        number = note.get('Number')
                        name = note.get('Name')
                        if number is not None and name is not None:
                            notes.append({
                                'number': int(number),
                                'name': name
                            })
                    
                    device_details['note_lists'].append({
                        'name': name_attr,
                        'notes': notes
                    })
            
            # Extract PatchBanks (collect by name for lookup and also build flat list)
            patch_banks_by_name = {}
            for patch_bank in root_elem.findall('.//PatchBank'):
                bank_name = patch_bank.get('Name')
                if bank_name:
                    patches = []
                    for patch in patch_bank.findall('.//Patch'):
                        patch_number = patch.get('Number')
                        patch_name = patch.get('Name')
                        program_change = patch.get('ProgramChange')
                        
                        # Also check for ProgramChange in PatchMIDICommands (e.g., Alesis D4)
                        if not program_change:
                            patch_midi_commands = patch.find('.//PatchMIDICommands')
                            if patch_midi_commands is not None:
                                program_change_elem = patch_midi_commands.find('.//ProgramChange')
                                if program_change_elem is not None:
                                    program_change = program_change_elem.get('Number')
                        
                        uses_note_list = patch.find('.//UsesNoteNameList')
                        
                        patch_data = {
                            'number': patch_number,
                            'name': patch_name,
                            'Number': patch_number
                        }
                        
                        if program_change:
                            try:
                                patch_data['programChange'] = int(program_change)
                            except (ValueError, TypeError):
                                # If conversion fails, try to use patch number as fallback
                                try:
                                    patch_data['programChange'] = int(patch_number) if patch_number else 0
                                except (ValueError, TypeError):
                                    patch_data['programChange'] = 0
                        
                        if uses_note_list is not None:
                            patch_data['note_list_name'] = uses_note_list.get('Name')
                        
                        patches.append(patch_data)
                    
                    # Store MIDI commands if present
                    midi_commands = []
                    for midi_cmd in patch_bank.findall('.//MIDICommands/*'):
                        cmd = {
                            'type': midi_cmd.tag
                        }
                        for attr, value in midi_cmd.attrib.items():
                            cmd[attr.lower()] = value
                        midi_commands.append(cmd)
                    
                    bank_obj = {
                        'name': bank_name,
                        'patches': patches,
                        'midi_commands': midi_commands
                    }
                    patch_banks_by_name[bank_name] = bank_obj
                    # Also add to flat list for backward compatibility
                    device_details['patch_banks'].append(bank_obj)
            
            # Extract ChannelNameSets with full patch bank objects
            for channel_name_set in root_elem.findall('.//ChannelNameSet'):
                set_name = channel_name_set.get('Name')
                if set_name:
                    available_channels = []
                    for avail_channel in channel_name_set.findall('.//AvailableChannel'):
                        channel = avail_channel.get('Channel')
                        available = avail_channel.get('Available')
                        if channel:
                            available_channels.append({
                                'channel': int(channel),
                                'available': available == 'true'
                            })
                    
                    # Get full patch bank objects referenced by this channel name set
                    patch_banks = []
                    for pb_ref in channel_name_set.findall('.//PatchBank'):
                        pb_name = pb_ref.get('Name')
                        if pb_name and pb_name in patch_banks_by_name:
                            patch_banks.append(patch_banks_by_name[pb_name])
                    
                    device_details['channel_name_sets'].append({
                        'name': set_name,
                        'available_channels': available_channels,
                        'patch_banks': patch_banks
                    })
            
            # Extract CustomDeviceModes
            for mode in root_elem.findall('.//CustomDeviceMode'):
                mode_name = mode.get('Name')
                if mode_name:
                    channel_name_sets = []
                    for cns in mode.findall('.//ChannelNameSetAssign'):
                        channel = cns.get('Channel')
                        name_set = cns.get('NameSet')
                        if channel and name_set:
                            channel_name_sets.append({
                                'channel': int(channel),
                                'name_set': name_set
                            })
                    
                    device_details['custom_device_modes'].append({
                        'name': mode_name,
                        'channel_name_set_assigns': channel_name_sets
                    })
            
            # Send successful response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            for key, value in cors_headers().items():
                self.send_header(key, value)
            self.end_headers()
            
            self.wfile.write(json.dumps(device_details).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            for key, value in cors_headers().items():
                self.send_header(key, value)
            self.end_headers()
            
            self.wfile.write(json.dumps({
                'error': str(e)
            }).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS request for CORS"""
        self.send_response(200)
        for key, value in cors_headers().items():
            self.send_header(key, value)
        self.end_headers()
