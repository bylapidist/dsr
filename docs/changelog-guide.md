# Changelog guide

DSR uses [Changesets](https://github.com/changesets/changesets) for versioning and
changelog generation.

## Writing a changeset

Write changeset files by hand — **do not run `pnpm changeset`**. Create a file under
`.changeset/` with a descriptive kebab-case name:

```text
.changeset/add-rgb-color-matching.md
```

Format:

```md
---
'@lapidist/dsr': minor
---

Add RGB color parsing to DSQLTokenQuery.closest colour-delta-e scoring.
```

Valid bump levels:

| Level | When to use |
|-------|-------------|
| `patch` | Bug fixes, documentation updates, internal refactors with no API change |
| `minor` | New features that are backwards compatible |
| `major` | Breaking changes to public API or snapshot format |

## Snapshot format changes

The binary snapshot format is versioned. Bumping the `version` field in `SnapshotPayload`
from `1` to `2` requires a **major** changeset and a migration guide in this documentation.

## Commit style

All commits use Conventional Commits (Angular style):

```text
type(scope): description
```

Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `perf`.
