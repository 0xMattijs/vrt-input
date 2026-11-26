# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/).

Each release needs a dated entry, such as `## [0.2.0] - 2026-12-01`, before you tag it: the release
workflow checks the entry and uses it as the GitHub release notes. Collect changes under
`## [Unreleased]` until then.

## [Unreleased]

## [0.1.0] - 2026-11-26

### Added

- `VrtInput`: a React component for choosing a VRT entry, as a hierarchical menu with a filter
  (`mode="menu"`, the default) or as three linked dropdowns (`mode="dropdowns"`).
- `evaluate`, `search`, and `createTaxonomy` in a core without React (`@alcyonsecurity/vrt-input/core`).
- The VRT 1.19.1 taxonomy and its deprecated-ID mapping, bundled.
- English and Dutch catalogs.
