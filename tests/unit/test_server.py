"""
Unit Tests for Server Module
Tests individual functions and classes in isolation
"""

import pytest
import xml.etree.ElementTree as ET
from unittest.mock import Mock, patch, mock_open
import tempfile
import os
from server import MIDINameHandler


class TestXMLAnalysis:
    """Test XML file analysis functions"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.handler = MIDINameHandler(Mock(), Mock(), Mock())
    
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
    
    def test_analyze_middev_file(self):
        """Test MIDI device type file analysis"""
        middev_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <MIDIDeviceTypes>
            <Author>Test Author</Author>
            <MIDIDeviceType Manufacturer="Test Manufacturer" Model="Test Model" 
                          SupportsGeneralMIDI="true" IsSampler="false">
                <InquiryResponse>F0 7E 00 06 02 00 00 18 00 00 00 00 00 00 00 00 F7</InquiryResponse>
            </MIDIDeviceType>
        </MIDIDeviceTypes>"""
        
        result = analyze_middev_file(middev_xml)
        
        assert result is not None
        assert result['manufacturer'] == 'Test Manufacturer'
        assert result['model'] == 'Test Model'
        assert result['supports_general_midi'] == True
        assert result['is_sampler'] == False
    
    def test_analyze_invalid_xml(self):
        """Test analysis of invalid XML"""
        invalid_xml = "This is not valid XML"
        
        with pytest.raises(ET.ParseError):
            self.handler.analyze_midnam_file(invalid_xml)


class TestCatalogBuilding:
    """Test catalog building functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.handler = MIDINameHandler(Mock(), Mock(), Mock())
    
    @patch('os.listdir')
    @patch('os.path.isdir')
    @patch('builtins.open', new_callable=mock_open)
    def test_build_midnam_catalog(self, mock_file, mock_isdir, mock_listdir):
        """Test building MIDI name catalog from patchfiles directory"""
        # Mock directory structure
        mock_listdir.return_value = ['Alesis', 'Yamaha']
        mock_isdir.return_value = True
        
        # Mock file reading
        mock_file.return_value.read.return_value = """<?xml version="1.0"?>
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
        
        catalog = self.handler.serve_midnam_catalog()
        
        assert catalog is not None
        assert len(catalog) > 0
        # Verify that devices are properly categorized by manufacturer
    
    @patch('os.listdir')
    def test_build_catalog_empty_directory(self, mock_listdir):
        """Test catalog building with empty directory"""
        mock_listdir.return_value = []
        
        catalog = self.handler.serve_midnam_catalog()
        
        assert catalog == {}


class TestValidation:
    """Test XML validation functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.handler = MIDINameHandler(Mock(), Mock(), Mock())
    
    def test_validate_xml_file_valid(self):
        """Test validation of valid XML file"""
        valid_xml = """<?xml version="1.0" encoding="UTF-8"?>
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
        
        result = self.handler.validate_xml(valid_xml)
        assert result['valid'] == True
        assert result['errors'] == []
    
    def test_validate_xml_file_invalid(self):
        """Test validation of invalid XML file"""
        invalid_xml = "This is not valid XML"
        
        result = self.handler.validate_xml(invalid_xml)
        assert result['valid'] == False
        assert len(result['errors']) > 0


class TestDeviceInfoExtraction:
    """Test device information extraction"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.handler = MIDINameHandler(Mock(), Mock(), Mock())
    
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
    # This is a parametrized test that runs for both file types
    handler = MIDINameHandler(Mock(), Mock(), Mock())
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
