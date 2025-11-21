const fs = require('fs');
const yml = require('js-yaml');
const Ref = require("@apidevtools/json-schema-ref-parser");
const merge = require('json-schema-resolve-allof');
let parser = new Ref();

const factory = {
    async parseEntities() {
        let schemas = {};
        let objs;

        try {
            objs = await fs.promises.readdir('./entities');
        } catch (error) {
            throw new Error(`Failed to read entities directory: ${error.message}`);
        }

        // Start with Common(s)
        await Promise.all(objs.map(async (w) => {
            // ignore everything but yaml and skip common
            if(w.toLowerCase().includes('common.yml')) {
                let data, obj;
                try {
                    data = await fs.promises.readFile(`./entities/${w}`);
                } catch (error) {
                    throw new Error(`Failed to read file 'entities/${w}': ${error.message}`);
                }
                try {
                    obj = yml.load(data);
                } catch (error) {
                    throw new Error(`Invalid YAML syntax in 'entities/${w}': ${error.message}`);
                }
                let objDefs = JSON.parse(JSON.stringify(obj.definitions).replace(/[a-z]*common\.yml#\/definitions/gi, '#/components/schemas'));
                objDefs = await fixRefs(objDefs);
                Object.assign(schemas, objDefs);
            }
        }))

        // Get all writes
        let writes;
        try {
            writes = await fs.promises.readdir('./entities/writes');
        } catch (error) {
            throw new Error(`Failed to read entities/writes directory: ${error.message}`);
        }
        await Promise.all(writes.map(async (w) => {
            // ignore everything but yaml
            if(w.includes('.yml')) {
                let data, obj;
                const name = `write${w.charAt(0).toUpperCase()}${w.slice(1).replace('.yml', '')}`;
                try {
                    data = await fs.promises.readFile(`./entities/writes/${w}`);
                } catch (error) {
                    throw new Error(`Failed to read file 'entities/writes/${w}': ${error.message}`);
                }
                try {
                    obj = {};
                    obj[name] = yml.load(data);
                } catch (error) {
                    throw new Error(`Invalid YAML syntax in 'entities/writes/${w}': ${error.message}`);
                }
                if(obj[name] !== null) {
                    // Fix common references
                    obj = JSON.parse(JSON.stringify(obj).replace(/\.\.\/[a-z]*common\.yml#\/definitions/gi, '#/components/schemas'));
                    obj = await fixRefs(obj, true);
                    Object.assign(schemas, obj)
                }
            }
        }))
        // Get all Objects
        await Promise.all(objs.map(async (w) => {
            // ignore everything but yaml and skip common
            if(w.toLowerCase().includes('.yml') && !w.toLowerCase().includes('common.yml')) {
                let data, obj;
                const name = `${w.replace('.yml', '')}Object`;
                try {
                    data = await fs.promises.readFile(`./entities/${w}`);
                } catch (error) {
                    throw new Error(`Failed to read file 'entities/${w}': ${error.message}`);
                }
                try {
                    obj = {};
                    obj[name] = yml.load(data);
                } catch (error) {
                    throw new Error(`Invalid YAML syntax in 'entities/${w}': ${error.message}`);
                }
                if(obj[name] === null) console.info('obj[name] was null: ', name);
                obj = JSON.parse(JSON.stringify(obj).replace(/[a-z]*common\.yml#\/definitions/gi, '#/components/schemas'));
                obj = await fixRefs(obj);
                Object.assign(schemas, obj)
            }
        }))
        return schemas;
    },
    async genSchema() {
        try {
            const schemas = await this.parseEntities();
            if(fs.existsSync('./openApiSchemas.yml')) {
                await fs.promises.unlink('./openApiSchemas.yml');
            }
            await fs.promises.writeFile('./openApiSchemas.yml', yml.dump(schemas));
        } catch (error) {
            throw new Error(`Schema generation failed: ${error.message}`);
        }
    },
    async buildSwag() {
        let swag = {};

        // Load paths from paths/ directory
        try {
            const pathFiles = await fs.promises.readdir('./paths');
            const pathPromises = pathFiles
                .filter(f => f.endsWith('Paths.yml'))
                .map(async (f) => {
                    try {
                        const data = await fs.promises.readFile(`./paths/${f}`);
                        return yml.load(data);
                    } catch (error) {
                        throw new Error(`Failed to load paths file 'paths/${f}': ${error.message}`);
                    }
                });

            const pathObjects = await Promise.all(pathPromises);
            swag.paths = Object.assign({}, ...pathObjects);

            // Load metadata if it exists
            if (fs.existsSync('./paths/_metadata.yml')) {
                try {
                    const metaData = await fs.promises.readFile('./paths/_metadata.yml');
                    const metadata = yml.load(metaData);
                    Object.assign(swag, metadata);
                } catch (error) {
                    throw new Error(`Failed to load metadata file 'paths/_metadata.yml': ${error.message}`);
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Paths directory './paths' not found. Please create it and add *Paths.yml files.`);
            }
            throw error;
        }

        const schemas = await this.parseEntities();
        // setup swagger spec component section if it's not there...
        if(!swag.components) swag.components = {
            securitySchemes: {
                "bearer": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Bearer based tokens, simply enter the token (prefixing with \"bearer\" is not required)."
                },
                "basicAuth": {
                    "type": "http",
                    "scheme": "basic"
                },
                "openId": {
                    "type": "openIdConnect",
                    "openIdConnectUrl": "https://example.com/.well-known/openid-configuration"
                },
                "OAuth2": {
                    "type": "oauth2",
                    "flows": {
                        "authorizationCode": {
                            "authorizationUrl": "https://example.com/oauth/authorize",
                            "tokenUrl": "https://example.com/oauth/token",
                            "scopes": {
                                "read": "Grants read access",
                                "write": "Grants write access",
                                "admin": "Grants access to admin operations"
                            }
                        }
                    }
                }
            },
            schemas: {}
        }
        swag.components.schemas = schemas;
        return swag;

    },
    async genSpec() {
        try {
            const swag = await this.buildSwag();
            if(fs.existsSync('./openApi.yml')) {
                await fs.promises.unlink('./openApi.yml');
            }
            await fs.promises.writeFile('./openApi.yml', yml.dump(swag));
        } catch (error) {
            throw new Error(`Spec generation failed: ${error.message}`);
        }
    },
    async showObject(path) {
        try {
            let schema = await merge(await parser.dereference(path));
            console.info(JSON.stringify(schema, null, 2));
        } catch (error) {
            console.info(error.toJSON());
        }
    }
}

function fixWrite(ref) {
    if(typeof ref === 'string') {
        const parts = ref.split('/');
        const obj = parts[parts.length-1];
        return `#/components/schemas/write${obj.charAt(0).toUpperCase()}${obj.slice(1).replace('.yml', '')}`
    }
    return ref;
}

function fixObj(ref, writeLocal = false) {
    if(typeof ref === 'string') {
        if(writeLocal === true) {
            return `#/components/schemas/write${ref.charAt(0).toUpperCase()}${ref.slice(1).replace('.yml', '')}`
        }
        return `#/components/schemas/${ref.replace('.yml', '')}Object`
    }
    return ref;
}

async function fixRefs(obj, localToWrites = false) {
    const out = JSON.parse(JSON.stringify(obj));
    await Promise.allSettled(Object.keys(obj).map(async (key) => {
        if(key === '$ref') {
            if(obj[key].includes('writes/')) {
                out[key] = fixWrite(obj[key]);
            }
            if(!obj[key].includes('/') && obj[key].includes('.yml')) {
                out[key] = fixObj(obj[key], localToWrites);
            }
        }
        if(typeof obj[key] === 'object') {
            if(Array.isArray(obj[key])) {
                await Promise.allSettled(obj[key].map(async (o, i) => {
                    out[key][i] = await fixRefs(o);
                    return o;
                }))
            } else {
                out[key] = await fixRefs(obj[key]);
            }
        }
        return key;
    }));
    return out;
}

module.exports = factory;