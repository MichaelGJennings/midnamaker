# MIDNAMaker Documentation

This folder contains technical documentation for MIDNAMaker.

## API Documentation

### [API Specification (OpenAPI/Swagger)](api-spec.yaml)

Complete REST API reference with all endpoints, request/response schemas, and examples.

**Viewing the API Specification:**

You can view and interact with the API specification using:

1. **Swagger Editor** (online):
   - Visit https://editor.swagger.io
   - Copy the contents of `api-spec.yaml` and paste it into the editor

2. **Swagger UI** (Docker):
   ```bash
   docker run -p 8080:8080 -e SWAGGER_JSON=/api-spec.yaml \
     -v $(pwd)/api-spec.yaml:/api-spec.yaml \
     swaggerapi/swagger-ui
   ```
   Then open http://localhost:8080

3. **VS Code Extension**:
   - Install "OpenAPI (Swagger) Editor" or "Swagger Viewer" extension
   - Open `api-spec.yaml` in VS Code

4. **Postman**:
   - Import the `api-spec.yaml` file into Postman
   - Generate a collection from the OpenAPI spec

## API Endpoint Categories

### Manufacturers & Devices
- Get manufacturer list
- Get device details
- Download device files
- Analyze device configurations

### MIDNAM File Operations
- Save MIDNAM structures
- Reload files from disk
- Validate files against DTD
- Merge multiple files
- Upload new files

### MIDDEV File Operations
- Create new manufacturer files
- Add devices to manufacturer files
- Download device type definitions

### Testing & Utilities
- Reload endpoint for verifying saves
- Cache management
- File analysis tools

## Testing Examples

See the main repository for test examples:
- `test_reload_example.py` - Example using the reload API
- `tests/e2e/` - End-to-end Playwright tests

## Base URL

Default local server: `http://localhost:8000`

## Authentication

Currently, no authentication is required as this is a local development tool.

