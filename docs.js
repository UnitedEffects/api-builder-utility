const lib = require('./lib');
const fs = require('fs');

(async() => {
    try {
        const schemas = await lib.parseEntities();

        let markdown = '# API Reference\n\n';
        markdown += 'This reference shows all available schemas and their component names for use in path definitions.\n\n';

        // Separate schemas by type
        const writeSchemas = [];
        const objectSchemas = [];
        const commonSchemas = [];

        Object.keys(schemas).forEach(key => {
            if (key.startsWith('write')) {
                writeSchemas.push(key);
            } else if (key.endsWith('Object')) {
                objectSchemas.push(key);
            } else {
                commonSchemas.push(key);
            }
        });

        // Write Schemas Section
        markdown += '## Write Schemas (Input Objects)\n\n';
        markdown += 'These schemas define the input structure for creating/updating resources.\n\n';
        markdown += '| Schema Name | Referenced As |\n';
        markdown += '|-------------|---------------|\n';
        writeSchemas.sort().forEach(schema => {
            markdown += `| ${schema} | #/components/schemas/${schema} |\n`;
        });
        markdown += '\n';

        // Full Object Schemas Section
        markdown += '## Full Object Schemas\n\n';
        markdown += 'These schemas define complete resource objects including system-generated properties.\n\n';
        markdown += '| Schema Name | Referenced As |\n';
        markdown += '|-------------|---------------|\n';
        objectSchemas.sort().forEach(schema => {
            markdown += `| ${schema} | #/components/schemas/${schema} |\n`;
        });
        markdown += '\n';

        // Common Schemas Section
        markdown += '## Common Schemas\n\n';
        markdown += 'These are reusable schema components defined in common.yml files.\n\n';
        markdown += '| Schema Name | Referenced As |\n';
        markdown += '|-------------|---------------|\n';
        commonSchemas.sort().forEach(schema => {
            markdown += `| ${schema} | #/components/schemas/${schema} |\n`;
        });
        markdown += '\n';

        // Quick Reference Section
        markdown += '## Quick Reference Rules\n\n';
        markdown += '### File to Schema Name Transformations\n\n';
        markdown += '**Write Entities:**\n';
        markdown += '- File: `entities/writes/[name].yml`\n';
        markdown += '- Schema: `write[Name]` (capitalized)\n';
        markdown += '- Example: `entities/writes/user.yml` → `writeUser`\n\n';

        markdown += '**Full Entities:**\n';
        markdown += '- File: `entities/[name].yml`\n';
        markdown += '- Schema: `[name]Object`\n';
        markdown += '- Example: `entities/user.yml` → `userObject`\n\n';

        markdown += '**Common Definitions:**\n';
        markdown += '- File: `entities/common.yml#/definitions/[name]`\n';
        markdown += '- Schema: `[name]`\n';
        markdown += '- Example: `common.yml#/definitions/address` → `address`\n\n';

        markdown += '### Using in Path Definitions\n\n';
        markdown += 'In your `paths/*Paths.yml` files, always reference schemas with:\n';
        markdown += '```yaml\n';
        markdown += '$ref: \'#/components/schemas/[schemaName]\'\n';
        markdown += '```\n\n';

        markdown += 'Example:\n';
        markdown += '```yaml\n';
        markdown += 'responses:\n';
        markdown += '  \'200\':\n';
        markdown += '    description: successful operation\n';
        markdown += '    content:\n';
        markdown += '      application/json:\n';
        markdown += '        schema:\n';
        markdown += '          $ref: \'#/components/schemas/userObject\'\n';
        markdown += '```\n';

        // Write to file
        await fs.promises.writeFile('./API_REFERENCE.md', markdown);
        console.log('✓ API reference generated: API_REFERENCE.md');

    } catch (error) {
        console.error('Error generating documentation:', error.message);
        process.exit(1);
    }
})()
