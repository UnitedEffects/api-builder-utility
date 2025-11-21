# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

API Builder (v2.0.0) is a template for generating REST API domain objects and OpenAPI contracts. It transforms JSON Schema entity definitions into OpenAPI 3.0 specifications, serving them via Swagger UI and ReDoc for visualization (not mocking).

**Version 2.0 changes:** Paths are now organized in `./paths/` directory with separate `*Paths.yml` files instead of a single `openApiPaths.yml`. Added `yarn docs` command to generate schema reference documentation.

## Development Commands

### Serve Swagger UI/ReDoc
```bash
yarn start
```
Starts nodemon server on localhost:3000 (Swagger UI) and localhost:3000/doc (ReDoc). Generates OpenAPI spec in-memory only. "Try it out" won't work - this is for visualization only.

### Generate Documentation
```bash
yarn docs
```
Generates `API_REFERENCE.md` showing all available schema names and their component references. **Run this first** when creating new entities to see how to reference them in path definitions.

### Generate Schema Components
```bash
yarn schemas
```
Generates `openApiSchemas.yml` containing all entity definitions with updated $ref pointers. Useful for debugging schema transformations.

### Generate Full OpenAPI Spec
```bash
yarn generate
```
Merges all `*Paths.yml` files from `./paths/` directory with entity schemas to create complete `openApi.yml` specification file.

### Debug Entity Merging
```bash
yarn show ./entities/YOUROBJECT.yml
# or
yarn show ./entities/writes/YOUROBJECT.yml
```
Displays fully merged entity with all references resolved.

## Core Architecture

### Entity Definition Pattern

The codebase uses a two-tier entity system:

1. **Write entities** (`./entities/writes/*.yml`): Define input properties for creating/updating objects
2. **Full entities** (`./entities/*.yml`): Extend write entities with system-generated properties using `allOf`

Example flow:
- `entities/writes/user.yml` defines user-provided fields
- `entities/user.yml` combines `common.yml#/definitions/general`, `writes/user.yml`, and `access.yml` via `allOf`

### Path Organization (New Architecture)

Paths are now split into multiple files in the `./paths/` directory:

- **`*Paths.yml` files**: Contain path definitions only (e.g., `userPaths.yml`, `permissionPaths.yml`, `systemPaths.yml`)
- **`_metadata.yml`**: Top-level OpenAPI metadata (info, tags, servers, security, openapi version)
- All `*Paths.yml` files are automatically merged during `yarn generate`
- Files not ending in `Paths.yml` are ignored (except `_metadata.yml` which is handled specially)

**Key difference from old architecture**: No more single `openApiPaths.yml` file. Everything is split into logical path groupings.

### Common Object Groupings

- **`common.yml`**: Single file containing shared schema definitions (general, address, phone, name, social, error, jsonPatch)
- **`[name]Common.yml`**: Multiple grouping files allowed (e.g., `userCommon.yml`, `accessCommon.yml`)
- All definitions merge into OpenAPI `components.schemas` section
- **CRITICAL**: Avoid duplicate names across all grouping files

### Reference Transformation System (`lib.js`)

The `lib.js` module transforms filesystem-based $ref pointers to OpenAPI component references:

**File references → Component references:**
- `common.yml#/definitions/address` → `#/components/schemas/address`
- `[name]Common.yml#/definitions/foo` → `#/components/schemas/foo`
- `writes/user.yml` → `#/components/schemas/writeUser`
- `user.yml` → `#/components/schemas/userObject`

**Processing order in `parseEntities()`:**
1. Common groupings (`*Common.yml` files)
2. Write entities (prefixed with `write` + capitalized name)
3. Full entities (suffixed with `Object`)

**Path merging in `buildSwag()` (lib.js:106-141):**
1. Reads all `*Paths.yml` files from `./paths/` directory
2. Merges them into single `paths` object using `Object.assign()`
3. Loads `_metadata.yml` separately and merges into root OpenAPI object
4. Combines with entity schemas to create complete spec

### Key Files

- **`lib.js`**: Core factory containing entity parsing, $ref transformation, path merging, and spec generation logic
- **`index.js`**: HTTP server serving Swagger UI, ReDoc, and in-memory OpenAPI JSON
- **`generate.js`**: CLI wrapper for `lib.genSpec()` to write `openApi.yml`
- **`schemas.js`**: CLI wrapper for `lib.genSchema()` to write `openApiSchemas.yml`
- **`docs.js`**: Generates API_REFERENCE.md with all schema names and component references
- **`showObject.js`**: CLI tool to dereference and merge entity for debugging
- **`./paths/` directory**: Contains all path definitions split by logical groupings

## Working with Entities and Paths

### Creating New Entities

1. Define input schema in `./entities/writes/newEntity.yml`
2. Create full entity in `./entities/newEntity.yml` using `allOf` to combine:
   - `common.yml#/definitions/general` (system fields)
   - `writes/newEntity.yml` (user fields)
   - Any other relevant schemas
3. Run `yarn docs` to generate API_REFERENCE.md showing available schema names
4. Create or update path file in `./paths/newEntityPaths.yml` with paths referencing:
   - `#/components/schemas/writeNewEntity` (request bodies)
   - `#/components/schemas/newEntityObject` (responses)

### Creating/Updating Path Files

Path files in `./paths/` should:
- Follow naming convention `*Paths.yml` (e.g., `userPaths.yml`, `permissionPaths.yml`)
- Contain ONLY path definitions (no metadata, info, tags, or openapi version)
- Use component schema references: `$ref: '#/components/schemas/schemaName'`

Example path file structure (`./paths/userPaths.yml`):
```yaml
/user:
  post:
    tags:
      - Users
    summary: Create a user
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/writeUser'
    responses:
      '201':
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/userObject'
```

### Updating Metadata

Edit `./paths/_metadata.yml` to change:
- API info (version, title, description, logo)
- Global tags
- Security schemes (default: bearer)
- Server URLs
- OpenAPI version

### Reference Pattern Rules

When writing `./paths/*Paths.yml` files:
- Write entity refs: `#/components/schemas/write[Name]` (capitalized, no .yml)
- Full entity refs: `#/components/schemas/[name]Object`
- Common refs: `#/components/schemas/[definitionName]`

In entity `.yml` files, use filesystem refs:
- Common: `common.yml#/definitions/[name]` or `../common.yml#/definitions/[name]`
- Write entities: `writes/user.yml` or `../writes/user.yml`
- Other entities: `user.yml` (same directory)

## Security Schemes

Default security schemes auto-added to specs (in `lib.js:buildSwag()`):
- bearer (HTTP bearer tokens)
- basicAuth (HTTP basic authentication)
- openId (OpenID Connect)
- OAuth2 (authorization code flow)

Customize by modifying `./paths/_metadata.yml` security section or updating the `buildSwag()` function in `lib.js`.
