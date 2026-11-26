# Security policy

## Supported versions

Security fixes go into the latest release only. Update to the latest version of
`@alcyonsecurity/vrt-input` before you report a problem.

## Report a vulnerability

Don't open a public issue. Report the vulnerability privately through
[GitHub private vulnerability reporting](https://github.com/0xMattijs/vrt-input/security/advisories/new).

Include:

- The affected version.
- A description of the problem and its impact.
- Steps or a minimal input that reproduce it, such as a VRT ID, a custom taxonomy, or component props.

The maintainer will confirm the report, work on a fix, and publish a security advisory with the fixed
version. Please keep the details private until the advisory is published.

## Scope

The package parses untrusted VRT IDs, and renders taxonomy names that may come from a custom taxonomy.
Examples of problems in scope:

- Input that makes validation or filtering hang or use excessive memory, despite the `maxLength` limit.
- An ID, a taxonomy name, or a filter query that the component renders as HTML or script instead of text.
- An input that the core reports as valid although it doesn't name an entry in the taxonomy.

Wrong names or priorities in the bundled VRT data are ordinary bugs. Report them as
[issues](https://github.com/0xMattijs/vrt-input/issues).
