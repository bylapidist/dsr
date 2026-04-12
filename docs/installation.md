# Installation

## Requirements

- Node.js ≥ 22
- pnpm ≥ 10 (npm and yarn also work)

## Install the package

```bash
pnpm add @lapidist/dsr
```

DSR requires `@lapidist/dtif-parser` as a peer dependency. If your project doesn't
already have it, install it alongside DSR:

```bash
pnpm add @lapidist/dsr @lapidist/dtif-parser
```

## TypeScript

DSR ships full TypeScript definitions. No `@types` package is needed. Ensure your
`tsconfig.json` sets `moduleResolution` to `"NodeNext"` or `"Bundler"` to resolve the
package exports correctly:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

## Import paths

DSR uses package export conditions. Import from the correct sub-path for your use case:

| Sub-path | Contents |
|----------|----------|
| `@lapidist/dsr` | All public types and re-exports |
| `@lapidist/dsr/environments/node` | `NodeEnvironment` |
| `@lapidist/dsr/environments/browser` | `BrowserEnvironment` |
| `@lapidist/dsr/environments/edge` | `EdgeEnvironment` |
| `@lapidist/dsr/dsql` | `DSQLClient` |
