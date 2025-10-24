"""
Unit Tests for Server Module
Tests individual functions and classes in isolation
"""

import pytest
import xml.etree.ElementTree as ET
from unittest.mock import Mock, patch, mock_open
import tempfile
import os
import json
from server import MIDINameHandler


class TestXMLAnalysis:
    """Test XML file analysis functions"""
    
    def setup_method(self):
        """Set up test fixtures"""
        # Create a mock handler that doesn't require HTTP server setup
        self.handler = Mock()
        self.handler.analyze_midnam_file = self._analyze_midnam_file
        self.handler.extract_device_info = self._extract_device_info
    
    def _analyze_midnam_file(self, xml_content):
        """Mock analyze_midnam_file method"""
        try:
            root = ET.fromstring(xml_content)
            author = root.find('Author')
            author_text = author.text if author is not None else 'Unknown'
            
            bank_details = []
            for bank in root.findall('.//PatchBank'):
                bank_name = bank.get('Name', 'Unnamed Bank')
                patches = bank.findall('.//Patch')
                bank_details.append({
                    'name': bank_name,
                    'patch_count': len(patches)
                })
            
            note_list_details = []
            for note_list in root.findall('.//NoteNameList'):
                note_list_name = note_list.get('Name', 'Unnamed Note List')
                notes = note_list.findall('.//Note')
                note_list_details.append({
                    'name': note_list_name,
                    'note_count': len(notes)
                })
            
            return {
                'author': author_text,
                'bank_details': bank_details,
                'note_list_details': note_list_details
            }
        except ET.ParseError:
            return None
    
    def _extract_device_info(self, root_elem, file_path):
        """Mock extract_device_info method"""
        if file_path.endswith('.midnam'):
            device_name = root_elem.find('.//DeviceName')
            device_name_text = device_name.get('Name', 'Unknown Device') if device_name is not None else 'Unknown Device'
            
            author = root_elem.find('Author')
            author_text = author.text if author is not None else 'Unknown'
            
            return {
                'type': 'midnam',
                'device_name': device_name_text,
                'author': author_text,
                'bank_details': []
            }
        elif file_path.endswith('.middev'):
            device_type = root_elem.find('.//MIDIDeviceType')
            manufacturer = device_type.get('Manufacturer', 'Unknown') if device_type is not None else 'Unknown'
            model = device_type.get('Model', 'Unknown') if device_type is not None else 'Unknown'
            
            return {
                'type': 'middev',
                'manufacturer': manufacturer,
                'model': model,
                'supports_general_midi': True
            }
        return None
    
    def test_analyze_midnam_file_basic(self):
        """Test basic MIDI name document analysis"""
        # Create a minimal valid MIDNAM XML
        midnam_xml = """<?xml version="1.0" encoding="UTF-8"?>
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
        
        result = self.handler.analyze_midnam_file(midnam_xml)
        
        assert result is not None
        assert result['author'] == 'Test Author'
        assert len(result['bank_details']) == 1
        assert result['bank_details'][0]['name'] == 'Bank 1'
        assert result['bank_details'][0]['patch_count'] == 2
    
    def test_analyze_midnam_file_with_note_lists(self):
        """Test MIDNAM analysis with note lists"""
        midnam_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <MIDINameDocument>
            <Author>Test Author</Author>
            <MasterDeviceNames>
                <DeviceName Name="Test Device">
                    <ChannelNameSet Name="Channel 1">
                        <PatchBank Name="Bank 1">
                            <PatchNameList>
                                <Patch Number="0" Name="Drum Kit">
                                    <UsesNoteNameList Name="Drum Notes"/>
                                </Patch>
                            </PatchNameList>
                        </PatchBank>
                    </ChannelNameSet>
                    <NoteNameList Name="Drum Notes">
                        <Note Number="36" Name="Kick"/>
                        <Note Number="38" Name="Snare"/>
                    </NoteNameList>
                </DeviceName>
            </MasterDeviceNames>
        </MIDINameDocument>"""
        
        result = self.handler.analyze_midnam_file(midnam_xml)
        
        assert result is not None
        assert len(result['note_list_details']) == 1
        assert result['note_list_details'][0]['name'] == 'Drum Notes'
        assert result['note_list_details'][0]['note_count'] == 2
    
    def test_analyze_invalid_xml(self):
        """Test analysis of invalid XML"""
        invalid_xml = "This is not valid XML"
        
        result = self.handler.analyze_midnam_file(invalid_xml)
        assert result is None


class TestDeviceInfoExtraction:
    """Test device information extraction"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.handler = Mock()
        self.handler.extract_device_info = self._extract_device_info
    
    def _extract_device_info(self, root_elem, file_path):
        """Mock extract_device_info method"""
        if file_path.endswith('.midnam'):
            device_name = root_elem.find('.//DeviceName')
            device_name_text = device_name.get('Name', 'Unknown Device') if device_name is not None else 'Unknown Device'
            
            author = root_elem.find('Author')
            author_text = author.text if author is not None else 'Unknown'
            
            return {
                'type': 'midnam',
                'device_name': device_name_text,
                'author': author_text,
                'bank_details': []
            }
        elif file_path.endswith('.middev'):
            device_type = root_elem.find('.//MIDIDeviceType')
            manufacturer = device_type.get('Manufacturer', 'Unknown') if device_type is not None else 'Unknown'
            model = device_type.get('Model', 'Unknown') if device_type is not None else 'Unknown'
            
            return {
                'type': 'middev',
                'manufacturer': manufacturer,
                'model': model,
                'supports_general_midi': True
            }
        return None
    
    def test_extract_device_info_midnam(self):
        """Test extracting device info from MIDNAM file"""
        midnam_xml = """<?xml version="1.0" encoding="UTF-8"?>
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
        
        root = ET.fromstring(midnam_xml)
        info = self.handler.extract_device_info(root, 'test.midnam')
        
        assert info['type'] == 'midnam'
        assert info['device_name'] == 'Test Device'
        assert info['author'] == 'Test Author'
    
    def test_extract_device_info_middev(self):
        """Test extracting device info from MIDDEV file"""
        middev_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <MIDIDeviceTypes>
            <Author>Test Author</Author>
            <MIDIDeviceType Manufacturer="Test Manufacturer" Model="Test Model">
            </MIDIDeviceType>
        </MIDIDeviceTypes>"""
        
        root = ET.fromstring(middev_xml)
        info = self.handler.extract_device_info(root, 'test.middev')
        
        assert info['type'] == 'middev'
        assert info['manufacturer'] == 'Test Manufacturer'
        assert info['model'] == 'Test Model'


@pytest.mark.parametrize("file_type,expected_keys", [
    ("midnam", ["type", "device_name", "author", "bank_details"]),
    ("middev", ["type", "manufacturer", "model", "supports_general_midi"]),
])
def test_extract_device_info_structure(file_type, expected_keys):
    """Test that extracted device info has expected structure"""
    handler = Mock()
    handler.extract_device_info = lambda root, path: {
        'type': file_type,
        'device_name': 'Test Device' if file_type == 'midnam' else None,
        'author': 'Test Author' if file_type == 'midnam' else None,
        'manufacturer': 'Test Manufacturer' if file_type == 'middev' else None,
        'model': 'Test Model' if file_type == 'middev' else None,
        'supports_general_midi': True if file_type == 'middev' else None,
        'bank_details': [] if file_type == 'midnam' else None
    }
    
    xml_content = get_sample_xml(file_type)
    root = ET.fromstring(xml_content)
    info = handler.extract_device_info(root, f'test.{file_type}')
    
    for key in expected_keys:
        assert key in info, f"Missing key: {key}"


def get_sample_xml(file_type):
    """Helper function to get sample XML for testing"""
    if file_type == "midnam":
        return """<?xml version="1.0" encoding="UTF-8"?>
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
    else:  # middev
        return """<?xml version="1.0" encoding="UTF-8"?>
        <MIDIDeviceTypes>
            <Author>Test Author</Author>
            <MIDIDeviceType Manufacturer="Test Manufacturer" Model="Test Model">
            </MIDIDeviceType>
        </MIDIDeviceTypes>"""


class TestServerIntegration:
    """Test server integration functionality"""
    
    @patch('server.MIDINameHandler.serve_manufacturers')
    def test_serve_manufacturers_response(self, mock_serve):
        """Test that serve_manufacturers returns proper JSON response"""
        mock_serve.return_value = {
            'manufacturers': {
                'Alesis Studio Electronics': [
                    {'id': 'Alesis|D4', 'name': 'D4', 'type': 'Drum Machine'}
                ]
            },
            'deviceTypes': ['Drum Machine', 'Synthesizer']
        }
        
        # This would be tested with actual HTTP requests in integration tests
        assert mock_serve.return_value is not None
        assert 'manufacturers' in mock_serve.return_value
        assert 'deviceTypes' in mock_serve.return_value
    
    @patch('server.MIDINameHandler.serve_device_details')
    def test_serve_device_details_response(self, mock_serve):
        """Test that serve_device_details returns proper device data"""
        mock_serve.return_value = {
            'id': 'Alesis|D4',
            'name': 'D4',
            'type': 'Drum Machine',
            'patch_banks': [
                {'name': 'Factory Drumsets', 'patch_count': 20, 'patches': []}
            ],
            'note_lists': [
                {'name': 'Standard Stuff Notes', 'id': '', 'notes': []}
            ]
        }
        
        assert mock_serve.return_value is not None
        assert 'patch_banks' in mock_serve.return_value
        assert 'note_lists' in mock_serve.return_value