"""
DTD Validation Tests
Tests that all MIDNAM files can be loaded, serialized, and validated against the DTD.

Run with: pytest tests/integration/test_dtd_validation.py -v -m dtd
Or run all slow tests: pytest -m dtd
"""

import pytest
import os
import json
import subprocess
import time
import requests
from lxml import etree
from pathlib import Path


@pytest.mark.dtd
class TestDTDValidation:
    """Comprehensive DTD validation tests"""
    
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
    
    @pytest.fixture(scope="class")
    def dtd(self):
        """Load the DTD once for the entire test class"""
        # The DTD references MIDIEvents10.dtd, so we need to parse it in the context
        # of the dtd directory
        dtd_path = Path(__file__).parent.parent.parent / 'dtd' / 'MIDINameDocument10.dtd'
        
        # Change to dtd directory so relative DTD references work
        import os
        original_dir = os.getcwd()
        dtd_dir = dtd_path.parent
        os.chdir(dtd_dir)
        
        try:
            with open(dtd_path, 'r', encoding='utf-8') as dtd_file:
                dtd_obj = etree.DTD(dtd_file)
            return dtd_obj
        finally:
            os.chdir(original_dir)
    
    @pytest.fixture(scope="class")
    def all_midnam_files(self):
        """Get all .midnam files in the patchfiles directory"""
        patchfiles_dir = Path(__file__).parent.parent.parent / 'patchfiles'
        return list(patchfiles_dir.glob('*.midnam'))
    
    def test_all_midnam_files_are_well_formed(self, all_midnam_files):
        """Test that all MIDNAM files are well-formed XML"""
        parser = etree.XMLParser(
            dtd_validation=False,
            load_dtd=False,
            no_network=True,
            resolve_entities=False
        )
        
        failed_files = []
        
        for midnam_file in all_midnam_files:
            try:
                with open(midnam_file, 'r', encoding='utf-8') as f:
                    etree.parse(f, parser)
            except etree.XMLSyntaxError as e:
                failed_files.append({
                    'file': midnam_file.name,
                    'error': str(e)
                })
        
        if failed_files:
            print(f"\n{len(failed_files)} files failed XML parsing:")
            for failure in failed_files:
                print(f"  - {failure['file']}: {failure['error']}")
        
        assert len(failed_files) == 0, f"{len(failed_files)} files are not well-formed XML"
    
    def test_all_midnam_files_validate_against_dtd(self, all_midnam_files, dtd):
        """Test that all MIDNAM files validate against the DTD"""
        parser = etree.XMLParser(
            dtd_validation=False,
            load_dtd=False,
            no_network=True,
            resolve_entities=False
        )
        
        failed_files = []
        
        for midnam_file in all_midnam_files:
            try:
                with open(midnam_file, 'r', encoding='utf-8') as f:
                    xml_doc = etree.parse(f, parser)
                
                if not dtd.validate(xml_doc):
                    errors = [f"Line {e.line}: {e.message}" for e in dtd.error_log]
                    failed_files.append({
                        'file': midnam_file.name,
                        'errors': errors
                    })
            except Exception as e:
                failed_files.append({
                    'file': midnam_file.name,
                    'errors': [str(e)]
                })
        
        if failed_files:
            print(f"\n{len(failed_files)} files failed DTD validation:")
            for failure in failed_files:
                print(f"\n  {failure['file']}:")
                for error in failure['errors'][:5]:  # Show first 5 errors
                    print(f"    - {error}")
                if len(failure['errors']) > 5:
                    print(f"    ... and {len(failure['errors']) - 5} more errors")
        
        assert len(failed_files) == 0, f"{len(failed_files)} files failed DTD validation"
    
    def test_load_serialize_validate_roundtrip(self, all_midnam_files, dtd, client):
        """
        Test loading each MIDNAM file through the API, serializing the response,
        and validating the serialized output against the DTD.
        
        This tests the complete round-trip: load -> parse -> API response -> serialize -> validate
        """
        failed_files = []
        skipped_files = []
        
        # Get list of devices from API
        manufacturers_response = client.get("http://localhost:8000/api/manufacturers")
        manufacturers_data = manufacturers_response.json()
        
        # Build a map of file paths to device IDs
        file_to_device = {}
        for manufacturer, devices in manufacturers_data['manufacturers'].items():
            for device in devices:
                file_path = device.get('file_path', '')
                if file_path:
                    # Normalize path
                    file_path = file_path.replace('\\', '/')
                    file_name = file_path.split('/')[-1]
                    file_to_device[file_name] = device['id']
        
        for midnam_file in all_midnam_files:
            file_name = midnam_file.name
            device_id = file_to_device.get(file_name)
            
            if not device_id:
                skipped_files.append({
                    'file': file_name,
                    'reason': 'Not in manufacturers catalog'
                })
                continue
            
            try:
                # Load device details through API
                from urllib.parse import quote
                encoded_device_id = quote(device_id, safe='')
                response = client.get(f"http://localhost:8000/api/device/{encoded_device_id}")
                
                if response.status_code != 200:
                    skipped_files.append({
                        'file': file_name,
                        'reason': f'API returned {response.status_code}'
                    })
                    continue
                
                device_data = response.json()
                
                # Get the raw XML from the response
                raw_xml = device_data.get('raw_xml') or device_data.get('midnam_content')
                
                if not raw_xml:
                    skipped_files.append({
                        'file': file_name,
                        'reason': 'No XML content in API response'
                    })
                    continue
                
                # Parse and validate the XML
                parser = etree.XMLParser(
                    dtd_validation=False,
                    load_dtd=False,
                    no_network=True,
                    resolve_entities=False
                )
                
                xml_doc = etree.fromstring(raw_xml.encode('utf-8'), parser)
                
                # Validate against DTD
                if not dtd.validate(xml_doc):
                    errors = [f"Line {e.line}: {e.message}" for e in dtd.error_log]
                    failed_files.append({
                        'file': file_name,
                        'device_id': device_id,
                        'errors': errors
                    })
                
            except Exception as e:
                failed_files.append({
                    'file': file_name,
                    'device_id': device_id,
                    'errors': [f"Exception: {str(e)}"]
                })
        
        # Print summary
        print(f"\n\nRound-trip validation summary:")
        print(f"  Total files: {len(all_midnam_files)}")
        print(f"  Validated: {len(all_midnam_files) - len(failed_files) - len(skipped_files)}")
        print(f"  Failed: {len(failed_files)}")
        print(f"  Skipped: {len(skipped_files)}")
        
        if skipped_files:
            print(f"\nSkipped files:")
            for skipped in skipped_files[:10]:  # Show first 10
                print(f"  - {skipped['file']}: {skipped['reason']}")
            if len(skipped_files) > 10:
                print(f"  ... and {len(skipped_files) - 10} more")
        
        if failed_files:
            print(f"\nFailed files:")
            for failure in failed_files[:5]:  # Show first 5 failures
                print(f"\n  {failure['file']} ({failure['device_id']}):")
                for error in failure['errors'][:3]:  # Show first 3 errors per file
                    print(f"    - {error}")
                if len(failure['errors']) > 3:
                    print(f"    ... and {len(failure['errors']) - 3} more errors")
        
        assert len(failed_files) == 0, f"{len(failed_files)} files failed round-trip DTD validation"
    
    def test_validate_endpoint(self, client):
        """Test the /api/validate endpoint with DTD validation enabled"""
        # Get a device to test
        manufacturers_response = client.get("http://localhost:8000/api/manufacturers")
        manufacturers_data = manufacturers_response.json()
        
        # Find a device with a known good file
        test_device = None
        for manufacturer, devices in manufacturers_data['manufacturers'].items():
            if devices:
                test_device = devices[0]
                break
        
        if not test_device:
            pytest.skip("No devices available for testing")
        
        # Get the file path
        file_path = test_device.get('file_path')
        
        if not file_path:
            pytest.skip(f"No file path for device {test_device['name']}")
        
        # Call the validate endpoint
        response = client.post(
            "http://localhost:8000/api/validate",
            json={'file_path': file_path}
        )
        
        assert response.status_code == 200
        
        validation_result = response.json()
        
        # The result should have a 'valid' field
        assert 'valid' in validation_result
        
        # If not valid, print errors for debugging
        if not validation_result['valid']:
            print(f"\nValidation errors for {test_device['name']}:")
            for error in validation_result.get('errors', [])[:5]:
                print(f"  - {error}")

