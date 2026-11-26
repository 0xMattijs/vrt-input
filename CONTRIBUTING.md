# Contributing

Thanks for helping improve vrt-input. This guide explains how to report problems and send changes.

## Report a bug or request a feature

Open an [issue](https://github.com/0xMattijs/vrt-input/issues). For a wrong name or priority, include:

- The VRT ID.
- What you got and what you expected.
- The VRT release that shows the expected value.

To report a security vulnerability, don't open a public issue. Follow the
[security policy](SECURITY.md) instead.

## Send a change

All changes go through a pull request. For a large change, open an issue first so we can agree on the
approach.

1. Fork the repository and create a branch from `master`.
2. Install dependencies with `npm ci`. You need Node 22 or later.
3. Make your change and add or update tests.
4. Run the checks:

   ```sh
   npm run typecheck
   npm test
   npm run build
   ```

5. Add a line to `CHANGELOG.md` under `## [Unreleased]`, in the matching section, such as `### Added`
   or `### Fixed`. Skip this step for changes that users don't notice, such as test or CI changes.
6. Open a pull request against `master`.

CI runs the same checks on Node 22 and 24 with React 18 and 19. Before the pull request can merge, all
four jobs must pass and the repository owner must approve it.

To try the component in a browser, run `npm run dev` to start the demo page.

## Guidelines

- **Taxonomy data.** Don't edit `src/core/data/vrt.ts` by hand. To move to a new VRT release, run
  `node scripts/fetch-vrt.mjs vX.Y.Z`, update the release in `NOTICE` and the README, and say in the
  pull request what changed in the taxonomy.
- **User-facing text.** Every text the component shows comes from a message catalog. When you add or
  change a text, update both the English catalog in `src/core/messages.ts` and the Dutch catalog in
  `src/core/locales/nl.ts`. If you don't speak Dutch, say so in the pull request, and the maintainer
  will translate it.
- **Accessibility.** The component meets WCAG contrast and keyboard requirements. `test/a11y.test.tsx`
  and `test/contrast.test.ts` check this; extend them when you add a new state or color.
- **Commit messages.** Write a short summary in the imperative mood, such as
  `Fix filtering on accented names`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
