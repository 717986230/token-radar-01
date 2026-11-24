# 717986230/token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/717986230/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/717986230/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-2): ranks the 198 pre-token protocols in DefiLlama's sealed snapshot by implied launch value. The value follows from the snapshot's own figures through a size curve fitted at runtime from launched comparables (log10(mcap) = 4.173 + 0.393 · log10(TVL), n = 53), shrunk category multipliers, and damped growth/maturity priors — never from a hand-kept list of names. Every row carries a costed 7-step farm plan. Leave-one-out median miss 2.46× (within 3×: 58.5%), against 4.02× / 45.3% for the starter's flat 0.25× multiple on the same comparables. The dashboard is a sortable, filterable board with a per-protocol detail view (value breakdown + farm plan), a live-token view kept apart from the ranking, and a model page stating the formula, the fitted numbers and the honest weaknesses. See METHODOLOGY.md for the full derivation and validation.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=d5a50dzy&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
