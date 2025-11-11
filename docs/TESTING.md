# Testing Framework for MIDI Name Editor

This document describes the comprehensive testing framework implemented for the MIDI Name Editor application.

## Overview

The testing framework uses modern best practices with:
- **pytest** for Python backend testing
- **Playwright** for end-to-end browser testing
- **httpx** for HTTP API testing
- **Comprehensive fixtures** for test data management

## Test Structure

```
tests/
├── unit/                 # Unit tests for individual functions/classes
│   └── test_server.py    # Server module unit tests
├── integration/          # Integration tests for API endpoints
│   └── test_api.py      # API endpoint integration tests
├── e2e/                  # End-to-end tests using Playwright
│   └── test_application.py # Complete user workflow tests
└── fixtures/             # Test data and fixtures
    ├── test_data.py      # Reusable test fixtures
    └── sample.midnam     # Sample MIDNAM file for testing
```

## Test Types

### 1. Unit Tests (`tests/unit/`)
- Test individual functions and classes in isolation
- Use mocks to isolate dependencies
- Fast execution, no external dependencies
- Examples: XML parsing, data validation, utility functions

### 2. Integration Tests (`tests/integration/`)
- Test API endpoints and their interactions
- Use real HTTP requests to the server
- Test data flow between components
- Examples: File upload/download, catalog building, error handling

### 3. End-to-End Tests (`tests/e2e/`)
- Test complete user workflows in the browser
- Use Playwright to automate browser interactions
- Test UI functionality and user experience
- Examples: Manufacturer selection, device configuration, MIDI functionality

## Running Tests

### Quick Start
```bash
# Install dependencies
make install

# Run all tests
make test

# Run specific test types
make test-unit
make test-integration
make test-e2e
```

### Using the Test Runner
```bash
# Run all tests
python3 run_tests.py all

# Run with coverage
python3 run_tests.py coverage

# Run only fast tests
python3 run_tests.py fast

# Run specific test file
python3 run_tests.py specific --test-path tests/unit/test_server.py
```

### Using pytest directly
```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/unit/test_server.py

# Run tests with coverage
pytest --cov=server --cov-report=html

# Run only unit tests
pytest tests/unit/

# Run tests matching pattern
pytest -k "test_analyze"
```

## Test Configuration

### pytest.ini
- Configures test discovery and execution
- Sets up coverage reporting
- Defines test markers for categorization
- Configures async test support

### conftest.py
- Provides shared fixtures for all tests
- Configures Playwright browser instances
- Sets up test data and utilities
- Handles test environment setup

## Test Markers

Tests are categorized using pytest markers:

- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests  
- `@pytest.mark.e2e` - End-to-end tests
- `@pytest.mark.slow` - Tests that take >5 seconds
- `@pytest.mark.midi` - Tests requiring MIDI hardware
- `@pytest.mark.network` - Tests requiring network access
- `@pytest.mark.file_io` - Tests that read/write files

## Fixtures and Test Data

### Sample Data Fixtures
- `sample_midnam_content` - Valid MIDNAM XML
- `sample_middev_content` - Valid MIDDEV XML
- `sample_catalog_data` - Catalog structure
- `sample_device_analysis` - Device analysis result

### Test Files
- `sample.midnam` - Real MIDNAM file for testing
- Temporary files created/destroyed automatically

### Mock Objects
- `mock_midi_device` - Mock MIDI device for testing
- `mock_patchfiles_directory` - Temporary directory structure

## Browser Testing with Playwright

### Configuration
- Headless mode by default (set `headless: false` for debugging)
- Chromium browser (can be changed to Firefox/Safari)
- Viewport: 1280x720
- Automatic screenshot capture on failure

### Test Helpers
- `TestHelpers.click_tab()` - Navigate between tabs
- `TestHelpers.fill_manufacturer_search()` - Search manufacturers
- `TestHelpers.enable_midi()` - Enable MIDI functionality
- `TestHelpers.select_midi_device()` - Select MIDI device

### Debugging E2E Tests
```bash
# Run with visible browser
pytest tests/e2e/ --headed

# Run with slow motion
pytest tests/e2e/ --slow-mo=1000

# Run specific E2E test
pytest tests/e2e/test_application.py::TestApplicationWorkflow::test_application_loads
```

## Coverage Reporting

### HTML Coverage Report
```bash
make test-coverage
# Opens htmlcov/index.html in browser
```

### Coverage Thresholds
- Minimum 80% coverage required
- HTML and XML reports generated
- Terminal output shows missing lines

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - run: make install
      - run: make ci-test
```

### Local CI Simulation
```bash
make ci-test  # Runs install, test-coverage, and lint
```

## Performance Testing

### Timing Tests
- Catalog loading performance
- Search response times
- File processing speed

### Memory Usage
- Monitor memory consumption during tests
- Detect memory leaks in long-running operations

## Error Handling Tests

### API Error Scenarios
- Invalid XML files
- Missing required fields
- Network timeouts
- File system errors

### UI Error Scenarios
- WebMIDI not supported
- Device connection failures
- Invalid user input

## Best Practices

### Writing Tests
1. **Arrange-Act-Assert** pattern
2. **Descriptive test names** that explain the scenario
3. **One assertion per test** when possible
4. **Use fixtures** for common setup
5. **Mock external dependencies**

### Test Data
1. **Use realistic data** that matches production
2. **Create data factories** for complex objects
3. **Clean up resources** in teardown
4. **Use temporary files** for file operations

### Maintenance
1. **Keep tests fast** - use markers for slow tests
2. **Update tests** when features change
3. **Review coverage reports** regularly
4. **Refactor tests** to reduce duplication

## Troubleshooting

### Common Issues

**Tests fail with "Module not found"**
```bash
# Install dependencies
make install
```

**E2E tests fail with "Browser not found"**
```bash
# Install Playwright browsers
python3 -m playwright install
```

**Tests timeout**
```bash
# Increase timeout in pytest.ini
timeout = 600
```

**Coverage report not generated**
```bash
# Check that coverage is installed
pip install coverage
```

### Debug Mode
```bash
# Run with maximum verbosity
pytest -vvv --tb=long

# Run single test with debugging
pytest tests/unit/test_server.py::TestXMLAnalysis::test_analyze_midnam_file_basic -vvv
```

## Future Enhancements

- [ ] Visual regression testing with Playwright
- [ ] Load testing for API endpoints
- [ ] Accessibility testing automation
- [ ] Cross-browser testing matrix
- [ ] Performance benchmarking
- [ ] Test data generation from real MIDI files



