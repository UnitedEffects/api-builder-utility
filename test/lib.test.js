const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const lib = require('../lib');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'proj');

function collectRefs(obj, acc = []) {
    if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
            if (k === '$ref' && typeof v === 'string') acc.push(v);
            collectRefs(v, acc);
        }
    }
    return acc;
}

function captureWarns(fn) {
    const warns = [];
    const orig = console.warn;
    console.warn = (...a) => warns.push(a.join(' '));
    return Promise.resolve()
        .then(fn)
        .then((result) => ({ result, warns }))
        .finally(() => { console.warn = orig; });
}

describe('fixture project', () => {
    before(() => process.chdir(FIXTURE));
    after(() => process.chdir(ROOT));

    it('parseEntities transforms all refs to component refs', async () => {
        const schemas = await lib.parseEntities();

        // commons, writes (including .yaml), and full objects all present
        for (const key of ['general', 'address', 'label', 'labelText', 'writeToken',
            'writeUser', 'writeProfile', 'writeLegacy', 'userObject', 'tagObject']) {
            assert.ok(schemas[key] !== undefined, `missing schema: ${key}`);
        }

        // empty entity file is skipped, not emitted as null
        assert.ok(!('emptyObject' in schemas), 'empty entity should be skipped');

        const user = schemas.writeUser;
        // local ref inside a write entity resolves to the write schema
        assert.equal(user.properties.profile.$ref, '#/components/schemas/writeProfile');
        // ../ ref from a write entity resolves to the full object schema
        assert.equal(user.properties.tag.$ref, '#/components/schemas/tagObject');
        // common ref resolves
        assert.equal(user.properties.address.$ref, '#/components/schemas/address');
        // null values survive traversal without crashing or being dropped
        assert.equal(user.properties.name.default, null);

        // common definitions can reference each other
        assert.equal(schemas.label.properties.text.$ref, '#/components/schemas/labelText');

        // nothing filesystem-shaped left anywhere
        for (const ref of collectRefs(schemas)) {
            assert.ok(ref.startsWith('#/components/schemas/'), `untransformed ref: ${ref}`);
        }
    });

    it('buildSwag merges paths, warns on duplicates, ignores metadata paths', async () => {
        const { result: swag, warns } = await captureWarns(() => lib.buildSwag());

        assert.equal(swag.openapi, '3.0.0');
        assert.equal(swag.info.title, 'Fixture API');
        assert.ok(swag.components.securitySchemes.bearer);
        assert.ok(swag.components.schemas.userObject);

        // both *Paths.yml files merged, other files ignored
        assert.ok(swag.paths['/health']);
        assert.ok(!swag.paths['/ignored']);

        // duplicate /user warned; later file (userPaths.yml) wins
        assert.ok(swag.paths['/user'].get, '/user should come from userPaths.yml');
        assert.ok(warns.some((w) => w.includes('/user')), 'expected duplicate path warning');

        // paths key in _metadata.yml warned and did not clobber merged paths
        assert.notEqual(swag.paths['/user'], 'SHOULD_NOT_CLOBBER');
        assert.ok(warns.some((w) => w.includes('_metadata')), 'expected metadata paths warning');
    });
});
