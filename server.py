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
        if self.path == '/load_d4.php':
            self.serve_xml()
        elif self.path.startswith('/patchfiles/'):
            self.serve_patchfile()
        elif self.path == '/manufacturers':
            self.serve_manufacturers()
        elif self.path == '/midnam_catalog':
            self.serve_midnam_catalog()
        elif self.path.startswith('/analyze_file/'):
            self.analyze_midnam_file()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/save_d4.php':
            self.save_xml()
        elif self.path == '/save_file':
            self.save_file()
        elif self.path == '/validate_d4.php':
            self.validate_xml()
        elif self.path == '/clear_cache':
            self.clear_cache()
        elif self.path == '/merge_files':
            self.merge_midnam_files()
        elif self.path == '/delete_file':
            self.delete_midnam_file()
        else:
            self.send_error(404)
    
    def serve_xml(self):
        try:
            with open('Alesis/D4.midnam', 'r') as f:
                xml_content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml')
            self.end_headers()
            self.wfile.write(xml_content.encode())
        except Exception as e:
            self.send_error(500, f"Error reading XML: {str(e)}")
    
    def save_xml(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            
            # Parse form data
            from urllib.parse import unquote
            xml_data = unquote(post_data.split('xml=')[1])
            
            # Create backup
            import shutil
            from datetime import datetime
            backup_name = f'Alesis/D4.midnam.backup.{datetime.now().strftime("%Y-%m-%d-%H-%M-%S")}'
            shutil.copy('Alesis/D4.midnam', backup_name)
            
            # Save new content
            with open('Alesis/D4.midnam', 'w') as f:
                f.write(xml_data)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true, "backup": "' + backup_name.encode() + b'"}')
            
        except Exception as e:
            self.send_error(500, f"Error saving XML: {str(e)}")
    
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
    
    def validate_xml(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            
            from urllib.parse import unquote
            xml_data = unquote(post_data.split('xml=')[1])
            
            # Simple XML validation
            import xml.etree.ElementTree as ET
            try:
                root = ET.fromstring(xml_data)
                errors = []
                
                # Check for duplicate note numbers within each drumset
                for note_list in root.findall('.//NoteNameList'):
                    numbers = []
                    for note in note_list.findall('Note'):
                        num = note.get('Number')
                        name = note.get('Name')
                        
                        if not num or not name:
                            errors.append(f"Missing number or name in {note_list.get('Name')}")
                        
                        if num in numbers:
                            errors.append(f"Duplicate note number {num} in {note_list.get('Name')}")
                        numbers.append(num)
                
                if errors:
                    result = {"valid": False, "errors": errors}
                else:
                    result = {"valid": True, "errors": []}
                    
            except ET.ParseError as e:
                result = {"valid": False, "errors": [f"XML Parse Error: {str(e)}"]}
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            import json
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error(500, f"Error validating XML: {str(e)}")
    
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
        """Serve manufacturer data"""
        try:
            # For now, return a static list of manufacturers
            # In a real implementation, this would fetch from the npm package
            manufacturers = [
                {"name": "Alesis Studio Electronics", "id": "00 00 0E"},
                {"name": "Yamaha Corporation", "id": "43"},
                {"name": "Roland Corporation", "id": "41"},
                {"name": "Korg Inc", "id": "42"},
                {"name": "Kawai Musical Instruments", "id": "40"},
                {"name": "Casio Computer Co Ltd", "id": "44"},
                {"name": "Akai Electric Co Ltd", "id": "47"},
                {"name": "Sony Corporation", "id": "4C"},
                {"name": "Behringer GmbH", "id": "00 20 32"},
                {"name": "Arturia", "id": "00 20 6B"},
                {"name": "Novation", "id": "00 20 29"},
                {"name": "M-Audio", "id": "00 20 0D"}
            ]
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(manufacturers).encode())
            
        except Exception as e:
            self.send_error(500, f"Error serving manufacturers: {str(e)}")

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
                                            print(f"Found manufacturer ID: {manufacturer_name} = {three_byte_id}")
                                        except ValueError:
                                            print(f"Invalid hex manufacturer ID: {manufacturer_id}")
                            
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
    PORT = 8000
    
    with socketserver.TCPServer(("", PORT), MIDINameHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Open: http://localhost:{PORT}/midi_name_editor.html")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
