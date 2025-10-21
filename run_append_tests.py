#!/usr/bin/env python3
"""
Test runner for append/save regression tests
Run this script to test the append/save functionality
"""

import subprocess
import sys
import os

def run_tests():
    """Run the append/save regression tests"""
    
    # Change to the project directory
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)
    
    print("🧪 Running append/save regression tests...")
    print("=" * 50)
    
    # Run the specific regression test
    test_files = [
        "tests/e2e/test_aggressive_regression.py",
        "tests/e2e/test_append_save_regression.py"
    ]
    
    for test_file in test_files:
        print(f"\n📋 Running {test_file}...")
        print("-" * 30)
        
        try:
            # Run pytest with verbose output and asyncio mode
            result = subprocess.run([
                sys.executable, "-m", "pytest", 
                test_file,
                "-v",  # verbose
                "--tb=short",  # short traceback
                "--asyncio-mode=auto"  # enable asyncio support
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✅ {test_file} PASSED")
            else:
                print(f"❌ {test_file} FAILED")
                print("STDOUT:", result.stdout)
                print("STDERR:", result.stderr)
                return False
                
        except Exception as e:
            print(f"❌ Error running {test_file}: {e}")
            return False
    
    print("\n" + "=" * 50)
    print("🎉 All append/save regression tests PASSED!")
    return True

def run_specific_test(test_name):
    """Run a specific test by name"""
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)
    
    print(f"🧪 Running specific test: {test_name}")
    print("=" * 50)
    
    try:
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            f"tests/e2e/test_aggressive_regression.py::TestAppendSaveRegression::{test_name}",
            "-v",
            "--tb=short",
            "--asyncio-mode=auto"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ {test_name} PASSED")
            return True
        else:
            print(f"❌ {test_name} FAILED")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error running {test_name}: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Run specific test
        test_name = sys.argv[1]
        success = run_specific_test(test_name)
    else:
        # Run all tests
        success = run_tests()
    
    sys.exit(0 if success else 1)
