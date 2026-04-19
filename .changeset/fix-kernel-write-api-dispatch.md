---
'@lapidist/dsr': minor
---

feat(kernel): add write.* dispatch cases to KernelProcess#dispatch — all eight write-API methods (addToken, deprecateToken, removeToken, configureRule, registerComponent, loadPlugin, recordDeprecationEntry, updateEntropy) are now reachable over KWP; previously they fell through to UNKNOWN_METHOD
