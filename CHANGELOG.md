# @lapidist/dsr

## 0.2.0

### Minor Changes

- 64c3887: feat(kernel): add write.\* dispatch cases to KernelProcess#dispatch — all eight write-API methods (addToken, deprecateToken, removeToken, configureRule, registerComponent, loadPlugin, recordDeprecationEntry, updateEntropy) are now reachable over KWP; previously they fell through to UNKNOWN_METHOD

### Patch Changes

- 64c3887: docs(installation): correct dtif-parser dependency description — it is a direct dependency installed automatically, not a peer dependency

## 0.1.1

### Patch Changes

- c435f75: test(environments): add tests for EdgeEnvironment and NodeEnvironment adapters
- 19afd90: test(kernel): add comprehensive tests for KernelProcess lifecycle, mutations, KWP dispatch, and snapshot export
- f1a3e8b: test(transport): add comprehensive tests for UnixSocketTransport and HttpTransport
- e26744d: test(write-api): add tests for KernelWriteAPI covering all mutation methods

## 0.1.0

### Minor Changes

- Initial release: DSR kernel process, KWP transport (Unix socket + HTTP), DSQL query interface, three environments (Node, Browser, Edge), binary snapshot format, and write API.
