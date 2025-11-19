"""API endpoint: /api/manufacturers - Get list of manufacturers and devices"""
from http.server import BaseHTTPRequestHandler
import json
from api._utils import get_manufacturers_data, cors_headers

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET request for manufacturers list"""
        try:
            manufacturers = get_manufacturers_data()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            for key, value in cors_headers().items():
                self.send_header(key, value)
            self.end_headers()
            
            self.wfile.write(json.dumps(manufacturers).encode())
            
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


