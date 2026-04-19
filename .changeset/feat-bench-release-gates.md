---
'@lapidist/dsr': patch
---

test(bench): add benchmark suite asserting ROADMAP release gate time bounds

Add tests/bench.test.ts with programmatic assertions for kernel cold start
(< 500ms) and snapshot restore (< 50ms). Tests fail when the implementation
regresses past the required threshold.
