const fs = require('fs');
const yml = require('js-yaml');
const Ref = require("@apidevtools/json-schema-ref-parser");
const merge = require('json-schema-resolve-allof');
let parser = new Ref();

const YAML_EXT = /\.ya?ml$/i;
const baseName = (file) => file.replace(YAML_EXT, '');

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
            if(/common\.ya?ml$/i.test(w)) {
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
                let objDefs = JSON.parse(JSON.stringify(obj.definitions).replace(/[a-z]*common\.ya?ml#\/definitions/gi, '#/components/schemas'));
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
            if(YAML_EXT.test(w)) {
                let data, obj;
                const base = baseName(w);
                const name = `write${base.charAt(0).toUpperCase()}${base.slice(1)}`;
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
                    obj = JSON.parse(JSON.stringify(obj).replace(/\.\.\/[a-z]*common\.ya?ml#\/definitions/gi, '#/components/schemas'));
                    obj = await fixRefs(obj, true);
                    Object.assign(schemas, obj)
                }
            }
        }))
        // Get all Objects
        await Promise.all(objs.map(async (w) => {
            // ignore everything but yaml and skip common
            if(YAML_EXT.test(w) && !/common\.ya?ml$/i.test(w)) {
                let data, obj;
                const name = `${baseName(w)}Object`;
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
                if(obj[name] === null || obj[name] === undefined) {
                    console.warn(`Skipping empty entity file 'entities/${w}'`);
                    return;
                }
                obj = JSON.parse(JSON.stringify(obj).replace(/[a-z]*common\.ya?ml#\/definitions/gi, '#/components/schemas'));
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
            const pathFiles = (await fs.promises.readdir('./paths')).filter(f => /Paths\.ya?ml$/.test(f));
            const pathObjects = await Promise.all(pathFiles.map(async (f) => {
                try {
                    const data = await fs.promises.readFile(`./paths/${f}`);
                    return yml.load(data) || {};
                } catch (error) {
                    throw new Error(`Failed to load paths file 'paths/${f}': ${error.message}`);
                }
            }));

            swag.paths = {};
            pathObjects.forEach((pObj, i) => {
                Object.keys(pObj).forEach((p) => {
                    if (swag.paths[p]) console.warn(`Warning: duplicate path '${p}' in 'paths/${pathFiles[i]}' overrides an earlier definition`);
                    swag.paths[p] = pObj[p];
                });
            });

            // Load metadata if it exists
            const metaFile = ['./paths/_metadata.yml', './paths/_metadata.yaml'].find(f => fs.existsSync(f));
            if (metaFile) {
                try {
                    const metaData = await fs.promises.readFile(metaFile);
                    const metadata = yml.load(metaData) || {};
                    if (metadata.paths) {
                        console.warn(`Warning: 'paths' in '_metadata.yml' is ignored; define paths in *Paths.yml files`);
                        delete metadata.paths;
                    }
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
        const obj = baseName(ref.split('/').pop());
        return `#/components/schemas/write${obj.charAt(0).toUpperCase()}${obj.slice(1)}`
    }
    return ref;
}

function fixObj(ref, writeLocal = false) {
    if(typeof ref === 'string') {
        const obj = baseName(ref.split('/').pop());
        if(writeLocal === true) {
            return `#/components/schemas/write${obj.charAt(0).toUpperCase()}${obj.slice(1)}`
        }
        return `#/components/schemas/${obj}Object`
    }
    return ref;
}

async function fixRefs(obj, localToWrites = false) {
    if (obj === null || typeof obj !== 'object') return obj;
    const out = JSON.parse(JSON.stringify(obj));
    await Promise.all(Object.keys(obj).map(async (key) => {
        if(key === '$ref' && typeof obj[key] === 'string' && YAML_EXT.test(obj[key])) {
            if(obj[key].includes('writes/')) {
                // e.g. writes/user.yml or ../writes/user.yml -> writeUser
                out[key] = fixWrite(obj[key]);
            } else if(!obj[key].includes('/')) {
                // e.g. user.yml -> userObject, or writeUser when inside ./entities/writes
                out[key] = fixObj(obj[key], localToWrites);
            } else if(obj[key].startsWith('../')) {
                // e.g. ../user.yml from a write entity -> userObject
                out[key] = fixObj(obj[key], false);
            }
        }
        if(obj[key] !== null && typeof obj[key] === 'object') {
            if(Array.isArray(obj[key])) {
                await Promise.all(obj[key].map(async (o, i) => {
                    out[key][i] = await fixRefs(o, localToWrites);
                }))
            } else {
                out[key] = await fixRefs(obj[key], localToWrites);
            }
        }
    }));
    return out;
}

module.exports = factory;