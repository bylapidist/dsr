---
'@lapidist/dsr': minor
---

feat(kernel): auto-compute entropy score after every write mutation

Add kernel/entropy.ts with computeEntropyScore() — derives EntropyScore
from live KernelState (tokenCoverageRatio, violationRecurrenceRate via
deprecation ledger, agentAttributionRatio, rateOfChange from history,
violationConcentration via HHI). Score is recomputed after addToken,
deprecateToken, removeToken, and recordDeprecationEntry so the kernel
is always the authoritative entropy source.

Also add dsql.tokens.all dispatch case so remote clients can fetch the
complete token graph.
