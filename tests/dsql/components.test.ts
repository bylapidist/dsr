import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DSQLComponentQuery } from '../../src/dsql/components.js';
import type { ComponentRegistry, ComponentDefinition } from '../../src/types.js';

function makeComponent(
  name: string,
  pkg: string,
  opts: Partial<ComponentDefinition> = {},
): ComponentDefinition {
  return { name, package: pkg, ...opts };
}

function makeRegistry(components: ComponentDefinition[]): ComponentRegistry {
  return { components: new Map(components.map((c) => [c.name, c])) };
}

describe('DSQLComponentQuery.all', () => {
  it('returns all components', async () => {
    const registry = makeRegistry([
      makeComponent('Button', '@acme/ui'),
      makeComponent('Input', '@acme/ui'),
    ]);
    const query = new DSQLComponentQuery(registry);
    const result = await query.all();
    assert.equal(result.length, 2);
  });

  it('returns empty array for empty registry', async () => {
    const query = new DSQLComponentQuery(makeRegistry([]));
    const result = await query.all();
    assert.equal(result.length, 0);
  });
});

describe('DSQLComponentQuery.byName', () => {
  it('returns the component for a known name', async () => {
    const button = makeComponent('Button', '@acme/ui');
    const query = new DSQLComponentQuery(makeRegistry([button]));
    const result = await query.byName('Button');
    assert.deepEqual(result, button);
  });

  it('returns null for an unknown name', async () => {
    const query = new DSQLComponentQuery(makeRegistry([]));
    const result = await query.byName('Unknown');
    assert.equal(result, null);
  });
});

describe('DSQLComponentQuery.byPackage', () => {
  it('returns components from the given package', async () => {
    const registry = makeRegistry([
      makeComponent('Button', '@acme/ui'),
      makeComponent('Icon', '@acme/icons'),
      makeComponent('Input', '@acme/ui'),
    ]);
    const query = new DSQLComponentQuery(registry);
    const result = await query.byPackage('@acme/ui');
    assert.equal(result.length, 2);
    assert.ok(result.every((c) => c.package === '@acme/ui'));
  });

  it('returns empty array when no components match the package', async () => {
    const query = new DSQLComponentQuery(makeRegistry([makeComponent('Button', '@acme/ui')]));
    const result = await query.byPackage('@other/pkg');
    assert.equal(result.length, 0);
  });
});

describe('DSQLComponentQuery.deprecated', () => {
  it('returns only deprecated components', async () => {
    const registry = makeRegistry([
      makeComponent('OldButton', '@acme/ui', { deprecated: true, replacedBy: 'Button' }),
      makeComponent('Button', '@acme/ui'),
    ]);
    const query = new DSQLComponentQuery(registry);
    const result = await query.deprecated();
    assert.equal(result.length, 1);
    assert.equal(result[0]?.name, 'OldButton');
  });

  it('returns empty array when no deprecated components exist', async () => {
    const query = new DSQLComponentQuery(makeRegistry([makeComponent('Button', '@acme/ui')]));
    const result = await query.deprecated();
    assert.equal(result.length, 0);
  });
});

describe('DSQLComponentQuery.replacements', () => {
  it('returns a map from deprecated component to its replacement', async () => {
    const oldButton = makeComponent('OldButton', '@acme/ui', {
      deprecated: true,
      replacedBy: 'Button',
    });
    const newButton = makeComponent('Button', '@acme/ui');
    const registry = makeRegistry([oldButton, newButton]);
    const query = new DSQLComponentQuery(registry);
    const result = await query.replacements();
    assert.equal(result.size, 1);
    assert.deepEqual(result.get('OldButton'), newButton);
  });

  it('omits entries where the replacement component does not exist in registry', async () => {
    const oldButton = makeComponent('OldButton', '@acme/ui', {
      deprecated: true,
      replacedBy: 'NewButton',
    });
    const query = new DSQLComponentQuery(makeRegistry([oldButton]));
    const result = await query.replacements();
    assert.equal(result.size, 0);
  });

  it('returns empty map when no components have replacedBy set', async () => {
    const query = new DSQLComponentQuery(makeRegistry([makeComponent('Button', '@acme/ui')]));
    const result = await query.replacements();
    assert.equal(result.size, 0);
  });
});
