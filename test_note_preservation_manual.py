#!/usr/bin/env python3
"""
Simple test script to verify note name preservation.
This script opens the browser and provides step-by-step instructions.
"""

import webbrowser
import time
import subprocess
import sys

def main():
    print("=" * 60)
    print("NOTE NAME PRESERVATION TEST")
    print("=" * 60)
    print()
    print("This test will verify that note name changes are preserved")
    print("when switching tabs and clicking 'Edit Note Names'.")
    print()
    
    # Start the server if not running
    try:
        response = subprocess.run(['curl', '-s', 'http://localhost:8000'], 
                                capture_output=True, timeout=5)
        if response.returncode != 0:
            print("Starting server...")
            subprocess.Popen(['python3', 'server.py'], 
                           stdout=subprocess.DEVNULL, 
                           stderr=subprocess.DEVNULL)
            time.sleep(2)
    except:
        print("Starting server...")
        subprocess.Popen(['python3', 'server.py'], 
                       stdout=subprocess.DEVNULL, 
                       stderr=subprocess.DEVNULL)
        time.sleep(2)
    
    print("Opening browser...")
    webbrowser.open('http://localhost:8000/midi_name_editor.html')
    
    print()
    print("MANUAL TEST STEPS:")
    print("=" * 40)
    print()
    print("1. Load Alesis D4:")
    print("   - Click 'Manufacturer' tab")
    print("   - Type 'Alesis' in the search box")
    print("   - Click on 'Alesis' from the dropdown")
    print("   - Click on 'D4' device")
    print()
    print("2. Edit Note Names:")
    print("   - Switch to 'Device' tab")
    print("   - Click 'Edit Note Names' button for any patch")
    print("   - Find a note name input field")
    print("   - Change the note name to 'TestNote123'")
    print("   - Press Tab or Enter to commit the change")
    print()
    print("3. Test Preservation:")
    print("   - Switch to 'Device' tab")
    print("   - Switch to 'Patch' tab") 
    print("   - Click 'Edit Note Names' again")
    print("   - Check if 'TestNote123' is still there")
    print()
    print("EXPECTED RESULT:")
    print("The note name 'TestNote123' should be preserved.")
    print("You should see a green 'Unsaved changes preserved' message.")
    print()
    print("If the note name is lost, the fix didn't work.")
    print("If the note name is preserved, the fix is working!")
    print()
    
    input("Press Enter when you've completed the test...")
    
    print()
    print("Test completed. Check the browser to see if the fix worked.")

if __name__ == "__main__":
    main()




