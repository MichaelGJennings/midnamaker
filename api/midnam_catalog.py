"""API endpoint: /api/midnam_catalog - Get full catalog of MIDNAM files"""
from http.server import BaseHTTPRequestHandler
import json
from api._utils import get_patchfiles_dir, cors_headers
import xml.etree.ElementTree as ET

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET request for MIDNAM catalog"""
        try:
            patchfiles_dir = get_patchfiles_dir()
            catalog = []
            
            for midnam_file in sorted(patchfiles_dir.glob('*.midnam')):
                try:
                    tree = ET.parse(midnam_file)
                    root = tree.getroot()
                    
                    # Extract basic info
                    author_elem = root.find('.//Author')
                    author = author_elem.text if author_elem is not None else 'Unknown'
                    
                    # Count devices
                    device_count = len(root.findall('.//MasterDeviceNames'))
                    
                    catalog.append({
                        'filename': midnam_file.name,
                        'author': author,
                        'device_count': device_count,
                        'path': str(midnam_file.relative_to(patchfiles_dir.parent))
                    })
                    
                except Exception as e:
                    print(f"Error processing {midnam_file}: {e}")
                    continue
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            for key, value in cors_headers().items():
                self.send_header(key, value)
            self.end_headers()
            
            self.wfile.write(json.dumps(catalog).encode())
            
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


