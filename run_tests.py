#!/usr/bin/env python3
"""
Test Runner Script for MIDI Name Editor
Provides convenient commands for running different types of tests
"""

import subprocess
import sys
import os
import argparse
from pathlib import Path


def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=False)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with exit code {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"❌ Command not found: {cmd[0]}")
        print("Make sure pytest and playwright are installed:")
        print("  pip install -r requirements-test.txt")
        print("  playwright install")
        return False


def install_dependencies():
    """Install test dependencies"""
    print("Installing test dependencies...")
    
    # Install Python dependencies
    if not run_command([sys.executable, "-m", "pip", "install", "-r", "requirements-test.txt"], 
                      "Installing Python test dependencies"):
        return False
    
    # Install Playwright browsers
    if not run_command([sys.executable, "-m", "playwright", "install"], 
                      "Installing Playwright browsers"):
        return False
    
    return True


def run_unit_tests():
    """Run unit tests"""
    cmd = [sys.executable, "-m", "pytest", "tests/unit/", "-v", "--tb=short"]
    return run_command(cmd, "Unit Tests")


def run_integration_tests():
    """Run integration tests"""
    cmd = [sys.executable, "-m", "pytest", "tests/integration/", "-v", "--tb=short"]
    return run_command(cmd, "Integration Tests")


def run_e2e_tests():
    """Run end-to-end tests"""
    cmd = [sys.executable, "-m", "pytest", "tests/e2e/", "-v", "--tb=short"]
    return run_command(cmd, "End-to-End Tests")


def run_all_tests():
    """Run all tests"""
    cmd = [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"]
    return run_command(cmd, "All Tests")


def run_tests_with_coverage():
    """Run tests with coverage reporting"""
    cmd = [sys.executable, "-m", "pytest", "tests/", "--cov=server", 
           "--cov-report=html", "--cov-report=term-missing", "-v"]
    return run_command(cmd, "Tests with Coverage")


def run_specific_test(test_path):
    """Run a specific test file or test function"""
    cmd = [sys.executable, "-m", "pytest", test_path, "-v", "--tb=short"]
    return run_command(cmd, f"Specific Test: {test_path}")


def run_fast_tests():
    """Run only fast tests (exclude slow tests)"""
    cmd = [sys.executable, "-m", "pytest", "tests/", "-v", "-m", "not slow"]
    return run_command(cmd, "Fast Tests Only")


def lint_code():
    """Run code linting"""
    print("Running code linting...")
    
    # Check if files exist
    files_to_lint = ["server.py"]
    existing_files = [f for f in files_to_lint if os.path.exists(f)]
    
    if not existing_files:
        print("No Python files found to lint")
        return True
    
    # Run flake8
    cmd = ["flake8"] + existing_files
    return run_command(cmd, "Code Linting (flake8)")


def format_code():
    """Format code with black"""
    print("Formatting code...")
    
    files_to_format = ["server.py", "tests/"]
    existing_files = []
    
    for f in files_to_format:
        if os.path.exists(f):
            existing_files.append(f)
    
    if not existing_files:
        print("No Python files found to format")
        return True
    
    cmd = ["black"] + existing_files
    return run_command(cmd, "Code Formatting (black)")


def main():
    """Main test runner"""
    parser = argparse.ArgumentParser(description="MIDI Name Editor Test Runner")
    parser.add_argument("command", nargs="?", default="all", 
                       choices=["install", "unit", "integration", "e2e", "all", 
                               "coverage", "fast", "lint", "format", "specific"],
                       help="Test command to run")
    parser.add_argument("--test-path", help="Path to specific test file or function")
    parser.add_argument("--no-install", action="store_true", 
                       help="Skip dependency installation")
    
    args = parser.parse_args()
    
    # Change to project directory
    project_dir = Path(__file__).parent
    os.chdir(project_dir)
    
    print("🎵 MIDI Name Editor Test Runner")
    print(f"Working directory: {os.getcwd()}")
    
    success = True
    
    # Install dependencies if needed
    if args.command == "install":
        success = install_dependencies()
    elif not args.no_install and args.command != "lint" and args.command != "format":
        # Check if dependencies are installed
        try:
            import pytest
            import playwright
        except ImportError:
            print("⚠️  Test dependencies not found. Installing...")
            success = install_dependencies()
            if not success:
                return 1
    
    if not success:
        return 1
    
    # Run the requested command
    if args.command == "unit":
        success = run_unit_tests()
    elif args.command == "integration":
        success = run_integration_tests()
    elif args.command == "e2e":
        success = run_e2e_tests()
    elif args.command == "all":
        success = run_all_tests()
    elif args.command == "coverage":
        success = run_tests_with_coverage()
    elif args.command == "fast":
        success = run_fast_tests()
    elif args.command == "lint":
        success = lint_code()
    elif args.command == "format":
        success = format_code()
    elif args.command == "specific":
        if not args.test_path:
            print("❌ --test-path is required for specific test command")
            return 1
        success = run_specific_test(args.test_path)
    
    if success:
        print(f"\n🎉 All {args.command} tests completed successfully!")
        return 0
    else:
        print(f"\n💥 {args.command} tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())



