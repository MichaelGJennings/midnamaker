"""Shared utilities for Vercel API functions"""
import os
import xml.etree.ElementTree as ET
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.parent

def get_patchfiles_dir():
    """Get the patchfiles directory path"""
    return PROJECT_ROOT / 'patchfiles'

def get_dtd_dir():
    """Get the DTD directory path"""
    return PROJECT_ROOT / 'dtd'

def extract_device_info(midnam_file):
    """Extract device information from a MIDNAM file"""
    try:
        tree = ET.parse(midnam_file)
        root = tree.getroot()
        
        devices = []
        
        # Find all MasterDeviceNames elements
        for master in root.findall('.//MasterDeviceNames'):
            manufacturer = master.find('Manufacturer')
            model_list = master.find('Model')
            
            if manufacturer is not None and model_list is not None:
                manufacturer_name = manufacturer.text
                model_name = model_list.text
                
                if manufacturer_name and model_name:
                    device_id = f"{manufacturer_name}|{model_name}"
                    devices.append({
                        'id': device_id,
                        'manufacturer': manufacturer_name,
                        'model': model_name,
                        'file_path': str(midnam_file)
                    })
        
        return devices
    except Exception as e:
        print(f"Error extracting device info from {midnam_file}: {e}")
        return []

def get_manufacturers_data():
    """Scan patchfiles and build manufacturers/devices data structure"""
    patchfiles_dir = get_patchfiles_dir()
    manufacturers = {}
    
    # Scan for .midnam files
    for midnam_file in patchfiles_dir.glob('*.midnam'):
        devices = extract_device_info(midnam_file)
        
        for device in devices:
            manufacturer = device['manufacturer']
            if manufacturer not in manufacturers:
                manufacturers[manufacturer] = []
            
            manufacturers[manufacturer].append({
                'id': device['id'],
                'model': device['model'],
                'file_path': device['file_path']
            })
    
    # Sort manufacturers and their devices
    result = {}
    for manufacturer in sorted(manufacturers.keys()):
        result[manufacturer] = sorted(
            manufacturers[manufacturer],
            key=lambda x: x['model']
        )
    
    return result

def get_catalog_data():
    """Build catalog in the format expected by the frontend"""
    patchfiles_dir = get_patchfiles_dir()
    catalog = {}
    
    # Scan for .midnam files
    for midnam_file in patchfiles_dir.glob('*.midnam'):
        devices = extract_device_info(midnam_file)
        
        for device in devices:
            device_key = device['id']  # Already in "Manufacturer|Model" format
            
            if device_key not in catalog:
                catalog[device_key] = {
                    'manufacturer': device['manufacturer'],
                    'model': device['model'],
                    'type': 'Synth',  # Default type
                    'files': []
                }
            
            catalog[device_key]['files'].append({
                'path': device['file_path']
            })
    
    return catalog

def cors_headers():
    """Standard CORS headers for API responses"""
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }


