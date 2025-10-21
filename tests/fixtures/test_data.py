"""
Test Fixtures and Sample Data
Provides reusable test data and fixtures for all test types
"""

import pytest
import tempfile
import os
from typing import Dict, Any


@pytest.fixture
def sample_midnam_content():
    """Sample MIDNAM XML content for testing"""
    return """<?xml version="1.0" encoding="UTF-8"?>
<MIDINameDocument>
    <Author>Test Author</Author>
    <MasterDeviceNames>
        <DeviceName Name="Test Drum Machine">
            <ChannelNameSet Name="Channel 1">
                <PatchBank Name="Factory Drumsets" ROM="false">
                    <PatchNameList>
                        <Patch Number="0" Name="Standard Kit">
                            <UsesNoteNameList Name="Standard Kit Notes"/>
                        </Patch>
                        <Patch Number="1" Name="Rock Kit">
                            <UsesNoteNameList Name="Rock Kit Notes"/>
                        </Patch>
                        <Patch Number="2" Name="Jazz Kit">
                            <UsesNoteNameList Name="Jazz Kit Notes"/>
                        </Patch>
                    </PatchNameList>
                </PatchBank>
                <PatchBank Name="User Drumsets" ROM="false">
                    <PatchNameList>
                        <Patch Number="0" Name="Custom Kit 1"/>
                        <Patch Number="1" Name="Custom Kit 2"/>
                    </PatchNameList>
                </PatchBank>
            </ChannelNameSet>
            <NoteNameList Name="Standard Kit Notes">
                <Note Number="36" Name="Kick"/>
                <Note Number="38" Name="Snare"/>
                <Note Number="42" Name="Hi-Hat Closed"/>
                <Note Number="46" Name="Hi-Hat Open"/>
                <Note Number="49" Name="Crash"/>
                <Note Number="51" Name="Ride"/>
            </NoteNameList>
            <NoteNameList Name="Rock Kit Notes">
                <Note Number="36" Name="Kick"/>
                <Note Number="38" Name="Snare"/>
                <Note Number="42" Name="Hi-Hat Closed"/>
                <Note Number="46" Name="Hi-Hat Open"/>
                <Note Number="49" Name="Crash"/>
                <Note Number="51" Name="Ride"/>
            </NoteNameList>
            <NoteNameList Name="Jazz Kit Notes">
                <Note Number="36" Name="Kick"/>
                <Note Number="38" Name="Snare"/>
                <Note Number="42" Name="Hi-Hat Closed"/>
                <Note Number="46" Name="Hi-Hat Open"/>
                <Note Number="49" Name="Crash"/>
                <Note Number="51" Name="Ride"/>
            </NoteNameList>
        </DeviceName>
    </MasterDeviceNames>
</MIDINameDocument>"""


@pytest.fixture
def sample_middev_content():
    """Sample MIDDEV XML content for testing"""
    return """<?xml version="1.0" encoding="UTF-8"?>
<MIDIDeviceTypes>
    <Author>Test Author</Author>
    <MIDIDeviceType Manufacturer="Test Manufacturer" Model="Test Drum Machine" 
                    SupportsGeneralMIDI="false" IsSampler="false" IsDrumMachine="true">
        <InquiryResponse>F0 7E 00 06 02 00 00 18 00 00 00 00 00 00 00 00 F7</InquiryResponse>
        <DeviceID>
            <Channel Channel="1" Device="0"/>
        </DeviceID>
        <Receives>
            <ProgramChange Channel="1"/>
            <ControlChange Channel="1"/>
            <NoteOn Channel="1"/>
            <NoteOff Channel="1"/>
        </Receives>
        <Transmits>
            <ProgramChange Channel="1"/>
            <ControlChange Channel="1"/>
            <NoteOn Channel="1"/>
            <NoteOff Channel="1"/>
        </Transmits>
    </MIDIDeviceType>
</MIDIDeviceTypes>"""


@pytest.fixture
def sample_midnam_file(sample_midnam_content):
    """Create a temporary MIDNAM file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.midnam', delete=False) as f:
        f.write(sample_midnam_content)
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)


@pytest.fixture
def sample_middev_file(sample_middev_content):
    """Create a temporary MIDDEV file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.middev', delete=False) as f:
        f.write(sample_middev_content)
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)


@pytest.fixture
def sample_catalog_data():
    """Sample catalog data structure for testing"""
    return {
        "Alesis": {
            "id": "00 00 18",
            "devices": [
                {
                    "name": "D4",
                    "files": [
                        {
                            "path": "patchfiles/Alesis/D4.midnam",
                            "type": "midnam"
                        }
                    ]
                },
                {
                    "name": "SR-16",
                    "files": [
                        {
                            "path": "patchfiles/Alesis/SR-16.midnam",
                            "type": "midnam"
                        }
                    ]
                }
            ]
        },
        "Yamaha": {
            "id": "00 00 43",
            "devices": [
                {
                    "name": "TG500",
                    "files": [
                        {
                            "path": "patchfiles/Yamaha/TG500.midnam",
                            "type": "midnam"
                        }
                    ]
                }
            ]
        }
    }


@pytest.fixture
def sample_device_analysis():
    """Sample device analysis result for testing"""
    return {
        "valid": True,
        "type": "midnam",
        "author": "Test Author",
        "device_name": "Test Drum Machine",
        "bank_details": [
            {
                "name": "Factory Drumsets",
                "patch_count": 3,
                "rom": False,
                "patches": [
                    {
                        "number": 0,
                        "name": "Standard Kit",
                        "midi_commands": []
                    },
                    {
                        "number": 1,
                        "name": "Rock Kit",
                        "midi_commands": []
                    },
                    {
                        "number": 2,
                        "name": "Jazz Kit",
                        "midi_commands": []
                    }
                ],
                "midi_commands": [],
                "note_lists": [
                    {
                        "name": "Standard Kit Notes",
                        "note_count": 6,
                        "notes": [
                            {"number": "36", "name": "Kick"},
                            {"number": "38", "name": "Snare"},
                            {"number": "42", "name": "Hi-Hat Closed"},
                            {"number": "46", "name": "Hi-Hat Open"},
                            {"number": "49", "name": "Crash"},
                            {"number": "51", "name": "Ride"}
                        ]
                    }
                ]
            }
        ],
        "note_list_details": [
            {
                "name": "Standard Kit Notes",
                "note_count": 6,
                "notes": [
                    {"number": "36", "name": "Kick"},
                    {"number": "38", "name": "Snare"},
                    {"number": "42", "name": "Hi-Hat Closed"},
                    {"number": "46", "name": "Hi-Hat Open"},
                    {"number": "49", "name": "Crash"},
                    {"number": "51", "name": "Ride"}
                ]
            }
        ],
        "errors": []
    }


@pytest.fixture
def sample_manufacturers_data():
    """Sample manufacturers data for testing"""
    return [
        {
            "id": "00 00 18",
            "name": "Alesis"
        },
        {
            "id": "00 00 43", 
            "name": "Yamaha"
        },
        {
            "id": "00 00 42",
            "name": "Korg"
        },
        {
            "id": "unknown",
            "name": "Access"
        }
    ]


@pytest.fixture
def mock_patchfiles_directory():
    """Create a mock patchfiles directory structure for testing"""
    with tempfile.TemporaryDirectory() as temp_dir:
        patchfiles_dir = os.path.join(temp_dir, "patchfiles")
        os.makedirs(patchfiles_dir)
        
        # Create manufacturer directories
        alesis_dir = os.path.join(patchfiles_dir, "Alesis")
        yamaha_dir = os.path.join(patchfiles_dir, "Yamaha")
        os.makedirs(alesis_dir)
        os.makedirs(yamaha_dir)
        
        # Create sample files
        with open(os.path.join(alesis_dir, "D4.midnam"), "w") as f:
            f.write("""<?xml version="1.0"?>
<MIDINameDocument>
    <Author>Alesis</Author>
    <MasterDeviceNames>
        <DeviceName Name="D4">
            <ChannelNameSet Name="Channel 1">
                <PatchBank Name="Factory Drumsets">
                    <PatchNameList>
                        <Patch Number="0" Name="Standard Kit"/>
                    </PatchNameList>
                </PatchBank>
            </ChannelNameSet>
        </DeviceName>
    </MasterDeviceNames>
</MIDINameDocument>""")
        
        with open(os.path.join(yamaha_dir, "TG500.midnam"), "w") as f:
            f.write("""<?xml version="1.0"?>
<MIDINameDocument>
    <Author>Yamaha</Author>
    <MasterDeviceNames>
        <DeviceName Name="TG500">
            <ChannelNameSet Name="Channel 1">
                <PatchBank Name="Factory Patches">
                    <PatchNameList>
                        <Patch Number="0" Name="Piano 1"/>
                    </PatchNameList>
                </PatchBank>
            </ChannelNameSet>
        </DeviceName>
    </MasterDeviceNames>
</MIDINameDocument>""")
        
        yield patchfiles_dir


class TestDataFactory:
    """Factory class for creating test data"""
    
    @staticmethod
    def create_midnam_xml(manufacturer: str = "Test Manufacturer", 
                         model: str = "Test Model",
                         author: str = "Test Author",
                         patch_count: int = 1) -> str:
        """Create MIDNAM XML with specified parameters"""
        patches = ""
        for i in range(patch_count):
            patches += f'<Patch Number="{i}" Name="Patch {i+1}"/>'
        
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<MIDINameDocument>
    <Author>{author}</Author>
    <MasterDeviceNames>
        <DeviceName Name="{model}">
            <ChannelNameSet Name="Channel 1">
                <PatchBank Name="Bank 1">
                    <PatchNameList>
                        {patches}
                    </PatchNameList>
                </PatchBank>
            </ChannelNameSet>
        </DeviceName>
    </MasterDeviceNames>
</MIDINameDocument>"""
    
    @staticmethod
    def create_middev_xml(manufacturer: str = "Test Manufacturer",
                         model: str = "Test Model",
                         supports_gm: bool = True,
                         is_sampler: bool = False) -> str:
        """Create MIDDEV XML with specified parameters"""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<MIDIDeviceTypes>
    <Author>Test Author</Author>
    <MIDIDeviceType Manufacturer="{manufacturer}" Model="{model}" 
                    SupportsGeneralMIDI="{str(supports_gm).lower()}" 
                    IsSampler="{str(is_sampler).lower()}">
    </MIDIDeviceType>
</MIDIDeviceTypes>"""
    
    @staticmethod
    def create_invalid_xml() -> str:
        """Create invalid XML for testing error handling"""
        return "This is not valid XML content"
    
    @staticmethod
    def create_malformed_xml() -> str:
        """Create malformed XML for testing error handling"""
        return """<?xml version="1.0"?>
<MIDINameDocument>
    <Author>Test Author</Author>
    <MasterDeviceNames>
        <DeviceName Name="Test Device">
            <!-- Missing closing tag -->
        </DeviceName>
    <!-- Missing closing MasterDeviceNames -->
</MIDINameDocument>"""


@pytest.fixture
def test_data_factory():
    """Provide access to TestDataFactory"""
    return TestDataFactory


# Performance testing utilities
@pytest.fixture
def performance_timer():
    """Timer fixture for performance testing"""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            self.start_time = time.time()
        
        def stop(self):
            self.end_time = time.time()
        
        @property
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()


# Mock MIDI device for testing
@pytest.fixture
def mock_midi_device():
    """Mock MIDI device for testing"""
    class MockMIDIDevice:
        def __init__(self, name: str = "Test MIDI Device", id: str = "test-device-1"):
            self.name = name
            self.id = id
            self.state = "connected"
            self.type = "output"
        
        def send(self, data):
            """Mock send method"""
            print(f"Mock MIDI send: {data}")
    
    return MockMIDIDevice()



