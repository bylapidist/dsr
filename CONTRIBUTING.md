# Contributing to @lapidist/dsr

Thank you for your interest in contributing! Please:

1. Read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
2. Fork the repository and create your branch from `main`.
3. Run `pnpm test` to ensure all tests pass.
4. Use `pnpm run lint` and `pnpm run format` before submitting.
5. Submit a pull request with a clear description of your changes.

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/).
Use `type(scope): description` in your commit messages, for example
`feat(kernel): add snapshot export` or `fix(dsql): correct token ranking`.

Every functional change should also include a [changeset](./.changeset/README.md)
to help generate the changelog and version bump. Create one manually under
`.changeset/` — do not run the Changesets CLI.

By contributing you agree that your contributions will be licensed under the MIT License.
