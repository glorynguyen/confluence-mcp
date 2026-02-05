# [1.1.0](https://github.com/glorynguyen/confluence-mcp/compare/v1.0.0...v1.1.0) (2026-02-05)


### Features

* **page:** Add tool to get page with children ([933efe0](https://github.com/glorynguyen/confluence-mcp/commit/933efe0e05565669375f30c7b12ad1bedd787bdc))

# 1.0.0 (2026-02-05)


### chore

* **deps:** upgrade semantic-release and core dependencies ([9001041](https://github.com/glorynguyen/confluence-mcp/commit/9001041e8739838bc63956e222a3501483200de7))


### Features

* add Confluence MCP server with full API integration ([533d1e2](https://github.com/glorynguyen/confluence-mcp/commit/533d1e28de10cd90088f689484e577dcd61b4a60))
* **confluence:** add page hierarchy, auto-update, and label tools ([d3d38e4](https://github.com/glorynguyen/confluence-mcp/commit/d3d38e40c576f33c4ee40a4094740631c8f050b3))
* **release:** configure automated releases ([1483288](https://github.com/glorynguyen/confluence-mcp/commit/1483288a0fd254cb287929d6a07308881917305d))


### BREAKING CHANGES

* **deps:** Upgraded semantic-release from v15 to v25,
@semantic-release/changelog from v5 to v6, @semantic-release/git from v7 to v10,
and express-rate-limit from v7 to v8. These major version bumps may introduce
breaking changes in their APIs, configurations, or behaviors.
* **release:** The package name has been changed from 'confluence-mcp' to '@vinhnguyen/confluence-mcp'. Consumers must update their dependencies.
