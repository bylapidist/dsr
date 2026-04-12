# AGENTS

This repository requires Node.js >= 22 and follows strict [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/) (Angular style) for commit messages.

## Before committing

1. Ensure dependencies are installed with `pnpm install` if needed.
2. Run **and pass** the following commands:
   - `pnpm run lint`
   - `pnpm run format:check`
   - `pnpm test`
   - If Markdown files were modified, run `pnpm run lint:md`
3. Run `pnpm run build` when modifying source files to ensure the TypeScript build succeeds.

## Changesets and releases

- For any new feature or bug fix, manually create a changeset file under `.changeset` to generate the changelog and version bump.
  - Use a descriptive kebab-case filename related to the change.
  - Do **not** run the Changesets CLI.
- Each changeset file must follow this format:

  ```md
  ---
  '@lapidist/dsr': patch
  ---

  fix snapshot restore to handle corrupt magic bytes
  ```

  Replace `patch` and the description with the appropriate semver bump and summary of your change.

## Commit guidelines

- Use Angular/Conventional Commit format: `type(scope): description`.
- Keep commits focused and explanatory.

## Additional notes

- Use `pnpm run format` to automatically format files when needed.
- Do not use `eslint ignore` or disable rules with `eslint-disable` comments; all code must satisfy ESLint rules without overrides.
- Use clean TypeScript types and avoid type casting or assertions such as `as any`.
- The `assertionStyle: 'never'` rule is enforced — use type guards or overloads instead of `as T`.
