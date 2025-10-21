# Makefile for MIDI Name Editor Testing
# Provides convenient commands for running tests and development tasks

.PHONY: help install test test-unit test-integration test-e2e test-all test-coverage test-fast lint format clean

# Default target
help:
	@echo "MIDI Name Editor - Available Commands:"
	@echo ""
	@echo "Testing:"
	@echo "  make test          - Run all tests"
	@echo "  make test-unit     - Run unit tests only"
	@echo "  make test-integration - Run integration tests only"
	@echo "  make test-e2e      - Run end-to-end tests only"
	@echo "  make test-coverage - Run tests with coverage report"
	@echo "  make test-fast     - Run only fast tests (exclude slow tests)"
	@echo ""
	@echo "Development:"
	@echo "  make install       - Install test dependencies"
	@echo "  make lint          - Run code linting"
	@echo "  make format        - Format code with black"
	@echo "  make clean         - Clean up test artifacts"
	@echo ""
	@echo "Server:"
	@echo "  make server        - Start development server"
	@echo "  make server-test   - Start server for testing"

# Install dependencies
install:
	python3 -m pip install -r requirements-test.txt
	python3 -m playwright install

# Test commands
test: test-all

test-unit:
	python3 run_tests.py unit

test-integration:
	python3 run_tests.py integration

test-e2e:
	python3 run_tests.py e2e

test-all:
	python3 run_tests.py all

test-coverage:
	python3 run_tests.py coverage

test-fast:
	python3 run_tests.py fast

# Development commands
lint:
	python3 run_tests.py lint

format:
	python3 run_tests.py format

clean:
	rm -rf htmlcov/
	rm -rf .coverage
	rm -rf .pytest_cache/
	rm -rf __pycache__/
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete

# Server commands
server:
	python3 server.py

server-test:
	@echo "Starting server for testing..."
	@echo "Server will be available at http://localhost:8000"
	@echo "Press Ctrl+C to stop"
	python3 server.py

# CI/CD commands
ci-test: install test-coverage lint
	@echo "CI tests completed successfully"

# Quick development cycle
dev-setup: install
	@echo "Development environment setup complete"
	@echo "Run 'make server' to start the development server"
	@echo "Run 'make test' to run all tests"

# Help for specific test types
help-unit:
	@echo "Unit Tests:"
	@echo "  Tests individual functions and classes in isolation"
	@echo "  Located in: tests/unit/"
	@echo "  Run with: make test-unit"

help-integration:
	@echo "Integration Tests:"
	@echo "  Tests API endpoints and their interactions"
	@echo "  Located in: tests/integration/"
	@echo "  Run with: make test-integration"

help-e2e:
	@echo "End-to-End Tests:"
	@echo "  Tests complete user workflows in the browser"
	@echo "  Located in: tests/e2e/"
	@echo "  Run with: make test-e2e"
	@echo "  Requires: Server running (make server-test)"



