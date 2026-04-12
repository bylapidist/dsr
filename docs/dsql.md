# DSQL — Design System Query Language

DSQL is a fluent, typed query API for the design system graph. The same API works whether
the executor is running in-process (local `DSQLExecutor`) or dispatching over the Kernel
Wire Protocol (remote `DSQLClient`).

## Tokens

### `dsql.tokens(type?)`

Returns a token query scoped to the optional token type.

```ts
const query = env.dsql.tokens();          // all types
const colors = env.dsql.tokens('color');  // color tokens only
```

#### `.closest(rawValue, property): Promise<RankedToken[]>`

Returns up to 10 tokens ranked by closeness to `rawValue` for the given CSS property.
Uses colour ΔE for colour properties, numeric proximity for numeric values, and exact
matching otherwise. Excludes deprecated tokens.

```ts
const matches = await env.dsql.tokens('color').closest('#3B82F6', 'color');
// [{ token, confidence: 1, distanceMetric: 'exact' }, ...]
```

#### `.forProperty(cssProperty): Promise<DtifFlattenedToken[]>`

Returns all non-deprecated tokens applicable to a CSS property. Maps CSS properties to
known DTIF token types (e.g. `color` → `color`, `font-size` → `fontSizes`, `dimension`).

```ts
const tokens = await env.dsql.tokens().forProperty('font-size');
```

#### `.byPointer(pointer): Promise<DtifFlattenedToken | null>`

Returns the token at an exact JSON pointer, or `null` if not found.

```ts
const token = await env.dsql.tokens().byPointer('#/color/primary');
```

#### `.deprecated(): Promise<DeprecatedToken[]>`

Returns all deprecated tokens with their deprecation entries.

```ts
const deprecated = await env.dsql.tokens().deprecated();
// [{ token, entry: { pointer, replacement?, since?, reason? } }, ...]
```

#### `.withReplacement(pointer): Promise<string | null>`

Returns the replacement pointer for a deprecated token, or `null` if none is set.

```ts
const replacement = await env.dsql.tokens().withReplacement('#/color/old');
```

## Rules

### `dsql.rules(category?)`

Returns a rule query optionally scoped to a category.

```ts
const query = env.dsql.rules();           // all categories
const tokens = env.dsql.rules('tokens'); // tokens category only
```

#### `.all(): Promise<RuleDefinition[]>`

Returns all rules in the registry (or category).

#### `.enabled(): Promise<RuleDefinition[]>`

Returns all enabled rules.

#### `.byId(ruleId): Promise<RuleDefinition | null>`

Returns the rule for a given ID, or `null` if not found.

#### `.categories(): Promise<string[]>`

Returns the sorted list of unique rule categories.

#### `.fixable(): Promise<RuleDefinition[]>`

Returns all enabled, fixable rules.

## Components

### `dsql.components()`

#### `.all(): Promise<ComponentDefinition[]>`

Returns all registered component definitions.

#### `.byName(name): Promise<ComponentDefinition | null>`

Returns the component with the given name, or `null`.

#### `.byPackage(packageName): Promise<ComponentDefinition[]>`

Returns all components from the given npm package.

#### `.deprecated(): Promise<ComponentDefinition[]>`

Returns all deprecated component definitions.

#### `.replacements(): Promise<Map<string, ComponentDefinition>>`

Returns a map from each deprecated component name to its replacement `ComponentDefinition`
(only where the replacement is also present in the registry).

## Entropy

### `dsql.entropy()`

Returns the current `EntropyState` synchronously.

```ts
const state = env.dsql.entropy();
console.log('Health score:', state.current.overall); // 0–100
```

The `EntropyState` contains:

| Field | Description |
|-------|-------------|
| `current` | The most recent `EntropyScore` |
| `baseline` | Optional baseline score for drift detection |
| `history` | Up to 100 previous scores, newest last |

## RankedToken

```ts
interface RankedToken {
  readonly token: DtifFlattenedToken;
  /** 0–1; higher is closer */
  readonly confidence: number;
  readonly distanceMetric: 'colour-delta-e' | 'numeric-proximity' | 'exact';
}
```
