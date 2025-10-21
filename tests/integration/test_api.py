"""
Integration Tests for API Endpoints
Tests the HTTP API endpoints and their interactions
"""

import pytest
import json
import tempfile
import os
from httpx import AsyncClient
from server import app


class TestAPIIntegration:
    """Test API endpoint integration"""
    
    @pytest.fixture
    async def client(self):
        """Create test client"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client
    
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
    
    async def test_get_midnam_catalog(self, client):
        """Test GET /midnam_catalog endpoint"""
        response = await client.get("/midnam_catalog")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        # Should contain manufacturer keys
    
    async def test_get_manufacturers(self, client):
        """Test GET /manufacturers endpoint"""
        response = await client.get("/manufacturers")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should contain manufacturer objects with id and name
    
    async def test_analyze_file_endpoint(self, client, sample_midnam_file):
        """Test POST /analyze_file/ endpoint"""
        with open(sample_midnam_file, 'rb') as f:
            files = {'file': ('test.midnam', f, 'application/xml')}
            response = await client.post("/analyze_file/", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] == True
        assert 'author' in data
        assert 'bank_details' in data
    
    async def test_analyze_file_invalid_xml(self, client):
        """Test POST /analyze_file/ with invalid XML"""
        invalid_content = "This is not valid XML"
        files = {'file': ('invalid.midnam', invalid_content, 'application/xml')}
        response = await client.post("/analyze_file/", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] == False
        assert len(data['errors']) > 0
    
    async def test_validate_file_endpoint(self, client, sample_midnam_file):
        """Test POST /validate_file/ endpoint"""
        with open(sample_midnam_file, 'rb') as f:
            files = {'file': ('test.midnam', f, 'application/xml')}
            response = await client.post("/validate_file/", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] == True
        assert data['errors'] == []
    
    async def test_save_file_endpoint(self, client):
        """Test POST /save_file/ endpoint"""
        content = """<?xml version="1.0" encoding="UTF-8"?>
        <MIDINameDocument>
            <Author>Test Author</Author>
            <MasterDeviceNames>
                <DeviceName Name="Test Device">
                    <ChannelNameSet Name="Channel 1">
                        <PatchBank Name="Bank 1">
                            <PatchNameList>
                                <Patch Number="0" Name="Patch 1"/>
                            </PatchNameList>
                        </PatchBank>
                    </ChannelNameSet>
                </DeviceName>
            </MasterDeviceNames>
        </MIDINameDocument>"""
        
        data = {
            'filename': 'test_save.midnam',
            'content': content
        }
        
        response = await client.post("/save_file/", json=data)
        
        assert response.status_code == 200
        result = response.json()
        assert result['success'] == True
        
        # Cleanup
        if os.path.exists('test_save.midnam'):
            os.unlink('test_save.midnam')
    
    async def test_merge_files_endpoint(self, client):
        """Test POST /merge_files endpoint"""
        data = {
            'files': [
                {
                    'filename': 'file1.midnam',
                    'content': '<?xml version="1.0"?><MIDINameDocument><Author>Author 1</Author></MIDINameDocument>'
                },
                {
                    'filename': 'file2.midnam', 
                    'content': '<?xml version="1.0"?><MIDINameDocument><Author>Author 2</Author></MIDINameDocument>'
                }
            ],
            'output_filename': 'merged.midnam'
        }
        
        response = await client.post("/merge_files", json=data)
        
        assert response.status_code == 200
        result = response.json()
        assert result['success'] == True
        assert 'merged_content' in result
    
    async def test_delete_file_endpoint(self, client):
        """Test DELETE /delete_file endpoint"""
        # First create a test file
        test_file = 'test_delete.midnam'
        with open(test_file, 'w') as f:
            f.write('test content')
        
        try:
            response = await client.delete(f"/delete_file?filename={test_file}")
            assert response.status_code == 200
            result = response.json()
            assert result['success'] == True
        finally:
            # Cleanup in case test fails
            if os.path.exists(test_file):
                os.unlink(test_file)
    
    async def test_clear_cache_endpoint(self, client):
        """Test POST /clear_cache endpoint"""
        response = await client.post("/clear_cache")
        
        assert response.status_code == 200
        result = response.json()
        assert result['success'] == True
    
    async def test_static_file_serving(self, client):
        """Test static file serving"""
        response = await client.get("/index.html")
        
        assert response.status_code == 200
        assert 'text/html' in response.headers['content-type']
    
    async def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = await client.options("/midnam_catalog")
        
        assert 'access-control-allow-origin' in response.headers
        assert 'access-control-allow-methods' in response.headers


class TestErrorHandling:
    """Test API error handling"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client
    
    async def test_analyze_file_missing_file(self, client):
        """Test analyze_file endpoint with missing file"""
        response = await client.post("/analyze_file/")
        
        assert response.status_code == 400
    
    async def test_save_file_missing_data(self, client):
        """Test save_file endpoint with missing data"""
        response = await client.post("/save_file/", json={})
        
        assert response.status_code == 400
    
    async def test_merge_files_invalid_data(self, client):
        """Test merge_files endpoint with invalid data"""
        response = await client.post("/merge_files", json={'invalid': 'data'})
        
        assert response.status_code == 400
    
    async def test_delete_nonexistent_file(self, client):
        """Test deleting a file that doesn't exist"""
        response = await client.delete("/delete_file?filename=nonexistent.midnam")
        
        assert response.status_code == 404


@pytest.mark.integration
class TestDataConsistency:
    """Test data consistency across API endpoints"""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client
    
    async def test_catalog_manufacturer_consistency(self, client):
        """Test that catalog and manufacturers endpoints return consistent data"""
        catalog_response = await client.get("/midnam_catalog")
        manufacturers_response = await client.get("/manufacturers")
        
        catalog_data = catalog_response.json()
        manufacturers_data = manufacturers_response.json()
        
        # Extract manufacturer names from catalog
        catalog_manufacturers = set(catalog_data.keys())
        
        # Extract manufacturer names from manufacturers endpoint
        manufacturers_names = set(m['name'] for m in manufacturers_data)
        
        # Should have significant overlap (some manufacturers might be in catalog but not official MIDI list)
        overlap = catalog_manufacturers.intersection(manufacturers_names)
        assert len(overlap) > 0, "No overlap between catalog and manufacturers"
    
    async def test_analyze_save_roundtrip(self, client):
        """Test that analyzing and saving a file produces consistent results"""
        original_content = """<?xml version="1.0" encoding="UTF-8"?>
        <MIDINameDocument>
            <Author>Test Author</Author>
            <MasterDeviceNames>
                <DeviceName Name="Test Device">
                    <ChannelNameSet Name="Channel 1">
                        <PatchBank Name="Bank 1">
                            <PatchNameList>
                                <Patch Number="0" Name="Patch 1"/>
                            </PatchNameList>
                        </PatchBank>
                    </ChannelNameSet>
                </DeviceName>
            </MasterDeviceNames>
        </MIDINameDocument>"""
        
        # Analyze original file
        files = {'file': ('original.midnam', original_content, 'application/xml')}
        analyze_response = await client.post("/analyze_file/", files=files)
        original_analysis = analyze_response.json()
        
        # Save file
        save_data = {
            'filename': 'roundtrip_test.midnam',
            'content': original_content
        }
        save_response = await client.post("/save_file/", json=save_data)
        assert save_response.status_code == 200
        
        try:
            # Analyze saved file
            with open('roundtrip_test.midnam', 'rb') as f:
                saved_files = {'file': ('saved.midnam', f, 'application/xml')}
                saved_analyze_response = await client.post("/analyze_file/", files=saved_files)
            
            saved_analysis = saved_analyze_response.json()
            
            # Analysis should be identical
            assert original_analysis['author'] == saved_analysis['author']
            assert original_analysis['bank_details'] == saved_analysis['bank_details']
            
        finally:
            # Cleanup
            if os.path.exists('roundtrip_test.midnam'):
                os.unlink('roundtrip_test.midnam')

