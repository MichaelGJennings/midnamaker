"""
Integration Tests for API Endpoints
Tests the HTTP API endpoints and their interactions
"""

import pytest
import json
import tempfile
import os
import subprocess
import time
import requests
from threading import Thread


class TestAPIIntegration:
    """Test API endpoint integration"""
    
    @pytest.fixture(scope="class")
    def server_process(self):
        """Start the server for testing"""
        # Start server in background
        process = subprocess.Popen(['python3', 'server.py'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        
        # Wait for server to start
        time.sleep(2)
        
        yield process
        
        # Cleanup
        process.terminate()
        process.wait()
    
    @pytest.fixture
    def client(self, server_process):
        """Create test client"""
        return requests.Session()
    
    @pytest.fixture
    def sample_midnam_file(self):
        """Create a temporary MIDNAM file for testing"""
        content = """<?xml version="1.0" encoding="UTF-8"?>
        <MIDINameDocument>
            <Author>Test Author</Author>
            <MasterDeviceNames>
                <DeviceName Name="Test Device">
                    <ChannelNameSet Name="Channel 1">
                        <PatchBank Name="Bank 1">
                            <PatchNameList>
                                <Patch Number="0" Name="Patch 1"/>
                                <Patch Number="1" Name="Patch 2"/>
                            </PatchNameList>
                        </PatchBank>
                    </ChannelNameSet>
                </DeviceName>
            </MasterDeviceNames>
        </MIDINameDocument>"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.midnam', delete=False) as f:
            f.write(content)
            temp_path = f.name
        
        yield temp_path
        
        # Cleanup
        os.unlink(temp_path)
    
    def test_get_manufacturers(self, client):
        """Test GET /api/manufacturers endpoint"""
        response = client.get("http://localhost:8000/api/manufacturers")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert 'manufacturers' in data
        assert 'deviceTypes' in data
    
    def test_get_device_details(self, client):
        """Test GET /api/device/{deviceId} endpoint"""
        # First get manufacturers to find a device
        manufacturers_response = client.get("http://localhost:8000/api/manufacturers")
        manufacturers_data = manufacturers_response.json()
        
        # Find first available device
        device_id = None
        for manufacturer, devices in manufacturers_data['manufacturers'].items():
            if devices:
                device_id = devices[0]['id']
                break
        
        if device_id:
            response = client.get(f"http://localhost:8000/api/device/{device_id}")
            assert response.status_code == 200
            data = response.json()
            assert 'id' in data
            assert 'name' in data
            assert 'patch_banks' in data
    
    def test_static_file_serving(self, client):
        """Test static file serving"""
        response = client.get("http://localhost:8000/midnamaker.html")
        
        assert response.status_code == 200
        assert 'text/html' in response.headers['content-type']
    
    def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = client.options("http://localhost:8000/api/manufacturers")
        
        assert 'access-control-allow-origin' in response.headers
        assert 'access-control-allow-methods' in response.headers


class TestErrorHandling:
    """Test API error handling"""
    
    @pytest.fixture(scope="class")
    def server_process(self):
        """Start the server for testing"""
        process = subprocess.Popen(['python3', 'server.py'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        time.sleep(2)
        yield process
        process.terminate()
        process.wait()
    
    @pytest.fixture
    def client(self, server_process):
        """Create test client"""
        return requests.Session()
    
    def test_nonexistent_device(self, client):
        """Test requesting a device that doesn't exist"""
        response = client.get("http://localhost:8000/api/device/Nonexistent|Device")
        
        assert response.status_code == 404
    
    def test_invalid_endpoint(self, client):
        """Test requesting an invalid endpoint"""
        response = client.get("http://localhost:8000/api/invalid")
        
        assert response.status_code == 404


@pytest.mark.integration
class TestDataConsistency:
    """Test data consistency across API endpoints"""
    
    @pytest.fixture(scope="class")
    def server_process(self):
        """Start the server for testing"""
        process = subprocess.Popen(['python3', 'server.py'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        time.sleep(2)
        yield process
        process.terminate()
        process.wait()
    
    @pytest.fixture
    def client(self, server_process):
        """Create test client"""
        return requests.Session()
    
    def test_manufacturers_device_consistency(self, client):
        """Test that manufacturers and device endpoints return consistent data"""
        manufacturers_response = client.get("http://localhost:8000/api/manufacturers")
        manufacturers_data = manufacturers_response.json()
        
        # Test that we can get details for devices listed in manufacturers
        for manufacturer, devices in manufacturers_data['manufacturers'].items():
            for device in devices[:2]:  # Test first 2 devices to avoid too many requests
                device_response = client.get(f"http://localhost:8000/api/device/{device['id']}")
                assert device_response.status_code == 200
                
                device_data = device_response.json()
                assert device_data['id'] == device['id']
                assert device_data['name'] == device['name']
    
    def test_device_patch_banks_structure(self, client):
        """Test that device details have proper patch bank structure"""
        manufacturers_response = client.get("http://localhost:8000/api/manufacturers")
        manufacturers_data = manufacturers_response.json()
        
        # Find a device with patch banks
        device_id = None
        for manufacturer, devices in manufacturers_data['manufacturers'].items():
            for device in devices:
                device_response = client.get(f"http://localhost:8000/api/device/{device['id']}")
                if device_response.status_code == 200:
                    device_data = device_response.json()
                    if device_data.get('patch_banks'):
                        device_id = device['id']
                        break
            if device_id:
                break
        
        if device_id:
            response = client.get(f"http://localhost:8000/api/device/{device_id}")
            device_data = response.json()
            
            assert 'patch_banks' in device_data
            assert isinstance(device_data['patch_banks'], list)
            
            for bank in device_data['patch_banks']:
                assert 'name' in bank
                assert 'patch_count' in bank
                assert 'patches' in bank
                assert isinstance(bank['patches'], list)