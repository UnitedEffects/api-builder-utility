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

All models should be created under the ./entities/ folder. The general approach is that an input version of the object is created under ./entities/writes/ to represent the properties required to write the data object, followed by a full object version of the same model under ./entities/ which references the input object to create a complete model.
As an example:
* ./entities/writes/region.yml, is a JSON schema representation of what would be necessary to define a Region.
* If you then look at ./entities/regions.yml, you will see that it consists of all properties from ./entities/common.yml and ./entities/writes/region.yml.
* This concatenation of properties allows for a full definition of the Region Object while ensuring that some properties of that definition are user defined while others are derived from the underlying system.

## JSON Schema and Open API

All definitions should be written in JSON Schema and all efforts should be made to ensure the definitions are compatible with the OpenAPI 3.0 specification. You can read more about JSON Schema and OpenAPI here:

* https://json-schema.org/
* https://www.openapis.org/

## Generate Specs

The project allows you to combine the defined entities under an openApi specification's component.schema definition. To do this, you must define the openApiPath.yml file manually and make references to the appropriate #components/schemas. Specifically, you must account for the fact that the objects under the ./entities/ directory use filesystem references to create "$ref" pointer references while the openApi specification paths will require you to use $refs that point to the components.schemas section.
Here's how to do it:

1. Run "yarn schemas" to create a compiled definition of all entities that have NOT been combined with the openApiPaths.yml document. The name of the file will be openApiSchemas.yml.
2. Review the object in openApiSchemas.yml to see how the references ($ref) have been updated. Make sure to use these new references when updating openApiPaths.yml.
3. When ready, run "yarn generate" to combine openApiSchemas and openApiPaths to create a full openApi.yml specification
4. You can copy this file into the development project or even paste it into swagger.editor.io to see the Swagger UI render
    * Alternatively, you can use the Swagger UI server in this project

Here are some examples of the pattern to guide you. Note that common is a little different than the other object under ./entities/:

* "../common.yml#/definitions/address" --> "#/components/schemas/address"
* "common.yml#/definitions/general" --> "#/components/schemas/general"
* When referencing an object under ./entities/writes:
    * "writes/property.yml" --> "#/components/schemas/writeProperty"
    * "writes/unit.yml" --> "#/components/schemas/writeUnit"
* When referencing an object under ./entities:
    * "properties.yml" --> "#/components/schemas/propertiesObject"
    * "units.yml" --> "#/components/schemas/unitsObject"

### Just the Specification

* yarn schemas

### Full openApi Spec

* yarn generate

## Show Merged to Debug

At times, it's helpful to see a fully merged version of an object where all references have been combined.

* yarn show ./entities/YOUROBJECT.yml

or

* yarn show ./entities/writes/YOUROBJECT.yml

## High-Level Path Breakdown
To change paths, update the openApiPaths.yml file.
To see details including supported methods, do one of the following:

1. Open openApiPaths.yml; or
2. Generate the full openApi.yml spec using "yarn generate"; or
3. Serve the OpenAPI Swagger UI and ReDoc and explore using "yarn start"