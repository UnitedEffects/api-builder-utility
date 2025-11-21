# API Builder
This repository can be used as a template to generate domain objects and OpenAPI contracts for any given REST API.

1. Generate OpenAPI specifications from these definitions.
2. Serve a swagger UI on localhost:3000 with the specification (NOT A MOCK SERVER)
3. Serve a ReDoc version of the specification on localhost:3000/doc

## Serving Swagger UI and ReDoc

This process will create an in-memory version of the OpenApi specification and serve it on localhost:3000 using Swagger UI or localhost:3000/doc using ReDoc so you can review. This will NOT write the openApi.yml or openApiSchemas.yml file.

* clone project
* yarn
* yarn start
* navigate to localhost:3000 or localhost:3000/doc

NOTE: "Try it out" will not work here as there is no underlying mock server. This is just to display the openApi specification as swagger ui or redoc.

## Project Structure

### Entities
All models should be created under the ./entities/ folder. The general approach is that an input version of the object is created under ./entities/writes/ to represent the properties required to write the data object, followed by a full object version of the same model under ./entities/ which references the input object to create a complete model.
As an example:
* ./entities/writes/user.yml, is a JSON schema representation of what would be necessary to define a User.
* If you then look at ./entities/user.yml, you will see that it consists of all properties from ./entities/common.yml and ./entities/writes/user.yml.
* This concatenation of properties allows for a full definition of the User Object while ensuring that some properties of that definition are user defined while others are derived from the underlying system.

### Paths
API paths are defined in the ./paths/ directory. Each file should follow the naming convention *Paths.yml (e.g., userPaths.yml, permissionPaths.yml).
* Each path file contains only the path definitions - no metadata, info, or tags
* Use the _metadata.yml file in the paths directory to define top-level OpenAPI properties (info, tags, servers, security)
* All path files are automatically merged during generation
* Files not ending in Paths.yml (like _metadata.yml) are ignored

## Grouping Common Objects

You can create as many groupings of common objects as you like and they will be blended into the spec for reference. Common groupings take multiple object definitions and put them into a single yaml file. You must use the syntax "[name]Common.yaml" where "name" is whatever you'd like to call the group. There can only one "common.yml". Examples:
* userCommon.yml
* accessCommon.yml
* common.yml (only one common.yml is allowed)

**NOTE:** This approach merges all common objects into the OpenAPI schema components section. You must avoid duplicate naming even across different grouping files.
See the example common.yml for syntax.

## JSON Schema and Open API

All definitions should be written in JSON Schema and all efforts should be made to ensure the definitions are compatible with the OpenAPI 3.0 specification. You can read more about JSON Schema and OpenAPI here:

* https://json-schema.org/
* https://www.openapis.org/

## Generate Specs

The project allows you to combine the defined entities under an openApi specification's component.schema definition. Entity files use filesystem references while the final OpenAPI specification requires component schema references.
Here's how to do it:

1. Run "yarn docs" to generate API_REFERENCE.md showing all available schema names and how to reference them
2. Create path files in ./paths/ directory (following *Paths.yml naming convention) using the component references from the docs
3. Run "yarn schemas" to create openApiSchemas.yml - a compiled definition of all entities (useful for debugging)
4. Run "yarn generate" to combine all paths from ./paths/ with schemas to create the full openApi.yml specification
5. You can copy this file into the development project or paste it into swagger.editor.io to see the Swagger UI render
    * Alternatively, you can use the Swagger UI server in this project

Here are some examples of the pattern to guide you. Note that common is a little different than the other object under ./entities/:

* "../common.yml#/definitions/address" --> "#/components/schemas/address"
* "common.yml#/definitions/general" --> "#/components/schemas/general"
* "userCommon.yml#/definitions/name" --> "#/components/schemas/name"
* When referencing an object under ./entities/writes:
    * "writes/user.yml" --> "#/components/schemas/writeUser"
    * "writes/permission.yml" --> "#/components/schemas/writePermission"
* When referencing an object under ./entities:
    * "access.yml" --> "#/components/schemas/accessObject"
    * "tenantPermission.yml" --> "#/components/schemas/tenantPermissionObject"

**TIP:** Run `yarn docs` to generate a complete reference of all available schemas and their component names.

### Generate Documentation

* yarn docs

Creates API_REFERENCE.md with all available schemas and their component names.

### Just the Schemas

* yarn schemas

Creates openApiSchemas.yml with all entity schemas (useful for debugging).

### Full openApi Spec

* yarn generate

Combines all paths from ./paths/ with schemas to create complete openApi.yml.

## Show Merged to Debug

At times, it's helpful to see a fully merged version of an object where all references have been combined.

* yarn show ./entities/YOUROBJECT.yml

or

* yarn show ./entities/writes/YOUROBJECT.yml

## High-Level Path Breakdown
To change paths, update the appropriate *Paths.yml file in the ./paths/ directory, or create a new one.
To see details including supported methods, do one of the following:

1. Open the relevant *Paths.yml file in ./paths/; or
2. Generate the full openApi.yml spec using "yarn generate"; or
3. Serve the OpenAPI Swagger UI and ReDoc and explore using "yarn start"

## Path Organization
Organize your paths into logical files:
* userPaths.yml - All user-related endpoints
* permissionPaths.yml - All permission-related endpoints
* systemPaths.yml - Health checks and system endpoints
* _metadata.yml - Top-level API info, tags, servers, and security

Each *Paths.yml file should contain only path definitions. The generation process automatically merges all files.