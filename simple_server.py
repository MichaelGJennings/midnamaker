#!/usr/bin/env python3
"""
Simple HTTP server for the D4 Editor
"""

import http.server
import socketserver
import os
import json
from urllib.parse import unquote
from datetime import datetime

class D4Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/load_d4.php':
            self.serve_xml()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/save_d4.php':
            self.save_xml()
        elif self.path == '/validate_d4.php':
            self.validate_xml()
        else:
            self.send_error(404)
    
    def serve_xml(self):
        try:
            with open('Alesis/D4.midnam', 'r', encoding='utf-8') as f:
                xml_content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml; charset=utf-8')
            self.end_headers()
            self.wfile.write(xml_content.encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error reading XML: {str(e)}")
    
    def save_xml(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            # Parse form data
            if 'xml=' in post_data:
                xml_data = unquote(post_data.split('xml=')[1])
            else:
                raise ValueError("No XML data in request")
            
            # Create backup
            backup_name = f'Alesis/D4.midnam.backup.{datetime.now().strftime("%Y-%m-%d-%H-%M-%S")}'
            if os.path.exists('Alesis/D4.midnam'):
                import shutil
                shutil.copy('Alesis/D4.midnam', backup_name)
            
            # Save new content
            with open('Alesis/D4.midnam', 'w', encoding='utf-8') as f:
                f.write(xml_data)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = json.dumps({'success': True, 'backup': backup_name})
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Error saving XML: {str(e)}")
    
    def validate_xml(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            if 'xml=' in post_data:
                xml_data = unquote(post_data.split('xml=')[1])
            else:
                raise ValueError("No XML data in request")
            
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
            response = json.dumps(result)
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Error validating XML: {str(e)}")

if __name__ == "__main__":
    PORT = 8000
    
    if not os.path.exists('Alesis/D4.midnam'):
        print("Error: Alesis/D4.midnam not found!")
        exit(1)
    
    with socketserver.TCPServer(("", PORT), D4Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Open: http://localhost:{PORT}/d4_editor.html")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
