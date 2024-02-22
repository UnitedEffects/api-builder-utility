const fs = require('fs');
const yml = require('js-yaml');
const Ref = require("@apidevtools/json-schema-ref-parser");
const merge = require('json-schema-resolve-allof');
let parser = new Ref();

const factory = {
    async parseEntities() {
        let schemas = {};
        // Start with Common
        const data = await fs.promises.readFile('./entities/common.yml');
        const obj = yml.load(data);
        Object.assign(schemas, obj.definitions);
        // Get all writes
        const writes = await fs.promises.readdir('./entities/writes');
        await Promise.all(writes.map(async (w) => {
            // ignore everything but yaml
            if(w.includes('.yml')) {
                const data = await fs.promises.readFile(`./entities/writes/${w}`);
                const name = `write${w.charAt(0).toUpperCase()}${w.slice(1).replace('.yml', '')}`;
                let obj = {};
                obj[name] = yml.load(data);
                if(obj[name] !== null) {
                    // Fix common references
                    obj = JSON.parse(JSON.stringify(obj).replace(/\.\.\/common\.yml#\/definitions/g, '#/components/schemas'));
                    obj = await fixRefs(obj, true);
                    Object.assign(schemas, obj)
                }
            }
        }))
        // Get all Objects
        const objs = await fs.promises.readdir('./entities');
        await Promise.all(objs.map(async (w) => {
            // ignore everything but yaml and skip common
            if(w.includes('.yml') && w !== 'common.yml') {
                const data = await fs.promises.readFile(`./entities/${w}`);
                const name = `${w.replace('.yml', '')}Object`;
                let obj = {};
                obj[name] = yml.load(data);
                if(obj[name] === null) console.info(name);
                obj = JSON.parse(JSON.stringify(obj).replace(/common\.yml#\/definitions/g, '#/components/schemas'));
                obj = await fixRefs(obj);
                Object.assign(schemas, obj)
            }
        }))
        return schemas;
    },
    async genSchema() {
        const schemas = await this.parseEntities();
        if(fs.existsSync('./openApiSchemas.yml')) {
            await fs.promises.unlink('./openApiSchemas.yml');
        }
        await fs.promises.writeFile('./openApiSchemas.yml', yml.dump(schemas));
    },
    async buildSwag() {
        const swag = yml.load(await fs.promises.readFile('./openApiPaths.yml'));
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
        const swag = await this.buildSwag();
        if(fs.existsSync('./openApi.yml')) {
            await fs.promises.unlink('./openApi.yml');
        }
        await fs.promises.writeFile('./openApi.yml', yml.dump(swag));
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