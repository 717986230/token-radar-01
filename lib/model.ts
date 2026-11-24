// Token Radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every protocol that passes the strict pre-token rule (the house watchlist's
// rule with the floor lowered from $50M to $5M): 198 rows on the sealed snapshot, watchlist
// included. A protocol is pre-token when its record carries no token (no market cap, no
// CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown as the
// market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, through a size curve fitted at
// runtime from the snapshot itself:
//
//   base         = 10^( a + b * log10(tvl_usd) )        # OLS on launched comparables, §3.2
//   catMult      = shrunk category multiplier, 1.0 when unknown
//   growthMult   = 1 + clamp(change_7d, -60, +120)/100 * 0.25
//   maturityMult = 0.70 + min(age_days, 1095)/1095 * 0.30   # age unknown -> 365 days
//   implied      = max(1, round( base * catMult * growthMult * maturityMult ))
//
// The curve is fitted on launched comparables in watchlist categories with mcap >= $1M
// (n = 53 on the sealed snapshot: a = 4.173, b = 0.393). If that set is too small it falls
// back to all categories, then to the hard-coded sealed coefficients. Category multipliers
// are median log-residuals shrunk by n/(n+5) and clipped to [0.5, 2.0]; categories with
// fewer than 5 comparables get 1.0. Growth and maturity are damped priors, not fitted: the
// data do not support fitting them (their coefficients flip sign between samples).
//
// No protocol name is ever special-cased: the same function scores every row. Everything is
// deterministic: fixed iteration order, age against the snapshot's as_of, no clock, no
// randomness, so two runs on the same bytes write byte-identical output.
//
// Validation (leave-one-out, computed at runtime on the snapshot the program reads):
// median miss 2.47x, within-3x 58.5%, against the starter flat 0.25x model's 4.02x / 45.3%
// on the same 53 comparables. A ranking device, not a valuation oracle: R^2 is about 0.2,
// and most of market cap is unexplained by any snapshot field.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants: damped priors the dashboard states and the page recomputes with. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.25,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The hard-coded fallback curve (the sealed snapshot's restricted fit) when a fit set is too small. */
export const FALLBACK_CURVE = { a: 4.173, b: 0.393 };

/** A fitted size curve: log10(mcap) = a + b * log10(tvl). */
export interface SizeCurve {
  a: number;
  b: number;
  n: number;
  r2: number;
  /** Where the fit came from: the restricted set, all categories, or the hard-coded fallback. */
  source: 'restricted' | 'all' | 'fallback';
}

/** One category's shrunk multiplier, with the comparable count behind it. */
export interface CategoryMultiplier {
  n: number;
  mult: number;
}

/** The fitted model the board was scored with, for the dashboard's model page. */
export interface FittedModel {
  curve: SizeCurve;
  cat_mults: Record<string, CategoryMultiplier>;
}

/** Leave-one-out validation, computed at runtime on the snapshot the program reads. */
export interface LooValidation {
  n: number;
  median_miss: number;
  p75_miss: number;
  p90_miss: number;
  within_2x_pct: number;
  within_3x_pct: number;
  starter_median_miss: number;
  starter_within_3x_pct: number;
}

/** The time-split check, measured offline on the 2026-11-24 DefiLlama pull (the program has no
 *  network, so it cannot re-measure it): the sealed fit scored against market caps ten days
 *  later. Stated here so the dashboard can show it with its provenance, not as a live number. */
export const TIME_SPLIT = {
  n: 51,
  median_miss: 2.36,
  within_3x_pct: 58.8,
  starter_median_miss: 3.46,
  starter_within_3x_pct: 47.1,
  measured: '2026-11-24',
  note: 'Sealed fit (2026-11-14) scored against market caps in the 2026-11-24 DefiLlama pull.',
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_value_usd: number;
    category_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the numbers its detail view needs. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_value_usd: number;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  /** True when the row is on the snapshot's watchlist. */
  wl: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the fitted model and its validation. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  fit: FittedModel;
  validation: { loo: LooValidation; time_split: typeof TIME_SPLIT };
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Ordinary least squares on log10(mcap) ~ log10(tvl), in the rows' given order. */
export function olsFit(rows: SnapshotProtocol[]): SizeCurve {
  const n = rows.length;
  let sx = 0, sy = 0;
  for (const p of rows) { sx += Math.log10(p.tvl_usd); sy += Math.log10(p.mcap_usd!); }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, sst = 0;
  for (const p of rows) {
    const dx = Math.log10(p.tvl_usd) - mx, dy = Math.log10(p.mcap_usd!) - my;
    sxx += dx * dx; sxy += dx * dy; sst += dy * dy;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let sse = 0;
  for (const p of rows) {
    const r = Math.log10(p.mcap_usd!) - (a + b * Math.log10(p.tvl_usd));
    sse += r * r;
  }
  return { a, b, n, r2: sst === 0 ? 0 : 1 - sse / sst, source: 'restricted' };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Median of a sorted-ascending array of numbers. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/**
 * Category multipliers from a fitted curve: the median log-residual per category, shrunk
 * toward 1 by n/(n+5) and clipped to [0.5, 2.0]. Categories with fewer than 5 comparables
 * get 1.0: the model says nothing category-specific about them.
 */
export function categoryMultipliers(curve: SizeCurve, rows: SnapshotProtocol[]): Record<string, CategoryMultiplier> {
  const byCat = new Map<string, number[]>();
  for (const p of rows) {
    const resid = Math.log10(p.mcap_usd!) - (curve.a + curve.b * Math.log10(p.tvl_usd));
    const key = p.category ?? 'Other';
    const list = byCat.get(key);
    if (list) list.push(resid); else byCat.set(key, [resid]);
  }
  const out: Record<string, CategoryMultiplier> = {};
  for (const key of [...byCat.keys()].sort()) {
    const rs = byCat.get(key)!.slice().sort((x, y) => x - y);
    const n = rs.length;
    const mult = n < 5 ? 1.0 : Math.min(2.0, Math.max(0.5, Math.pow(10, median(rs) * (n / (n + 5)))));
    out[key] = { n, mult: round4(mult) };
  }
  return out;
}

/**
 * Fit the size curve from the snapshot itself. The restricted set is launched comparables
 * in watchlist categories with mcap >= $1M; too small, and it falls back to all categories,
 * then to the hard-coded sealed coefficients.
 */
export function fitModel(snapshot: Snapshot): FittedModel {
  const watchCats = new Set<string>();
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    const p = bySlug.get(slug);
    if (p && p.category !== null) watchCats.add(p.category);
  }
  const restricted = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd >= 1_000_000 && p.tvl_usd > 0 && p.category !== null && watchCats.has(p.category),
  );
  if (restricted.length >= 20) {
    const curve = olsFit(restricted);
    return { curve, cat_mults: categoryMultipliers(curve, restricted) };
  }
  const all = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX');
  if (all.length >= 20) {
    const curve = olsFit(all);
    curve.source = 'all';
    return { curve, cat_mults: categoryMultipliers(curve, all) };
  }
  return {
    curve: { a: FALLBACK_CURVE.a, b: FALLBACK_CURVE.b, n: 0, r2: 0, source: 'fallback' },
    cat_mults: {},
  };
}

/** The base value off the fitted curve, before the category, growth and maturity multipliers. */
export function baseValue(tvlUsd: number, curve: SizeCurve): number {
  return Math.pow(10, curve.a + curve.b * Math.log10(tvlUsd));
}

/** The multipliers and the implied value one protocol gets under a fitted model. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fitted: FittedModel,
  model: ModelConstants = MODEL,
): { implied: number; base: number; catMult: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = baseValue(protocol.tvl_usd, fitted.curve);
  const catMult = fitted.cat_mults[protocol.category ?? 'Other']?.mult ?? 1.0;
  const implied = Math.max(1, Math.round(base * catMult * growthMult * maturityMult));
  return { implied, base, catMult, growthPct, growthMult, maturityMult, age };
}

/** The starter flat model's value, for the validation comparison on the same comparables. */
function starterValue(protocol: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, protocol.listed_at) ?? 365;
  const growthPct = Math.min(120, Math.max(-60, finite(protocol.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * 0.5;
  const maturityMult = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
  return Math.max(1, Math.round(protocol.tvl_usd * 0.25 * growthMult * maturityMult));
}

function missStats(misses: number[]): { median: number; p75: number; p90: number; within2: number; within3: number } {
  const s = misses.slice().sort((a, b) => a - b);
  const n = s.length;
  const at = (f: number): number => s[Math.min(n - 1, Math.floor(f * n))]!;
  return {
    median: round4(median(s)),
    p75: round4(at(0.75)),
    p90: round4(at(0.9)),
    within2: Math.round((s.filter((m) => m <= 2).length / n) * 1000) / 10,
    within3: Math.round((s.filter((m) => m <= 3).length / n) * 1000) / 10,
  };
}

/**
 * Leave-one-out validation on the restricted comparable set: each fold refits the curve and
 * the multipliers without the held-out protocol, then scores it. Miss is
 * max(predicted/actual, actual/predicted) on market cap.
 */
export function looValidation(snapshot: Snapshot): LooValidation {
  // Rebuild the restricted set exactly as fitModel does, so the folds match the fit.
  const watchCats = new Set<string>();
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    const p = bySlug.get(slug);
    if (p && p.category !== null) watchCats.add(p.category);
  }
  const restricted = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd >= 1_000_000 && p.tvl_usd > 0 && p.category !== null && watchCats.has(p.category),
  );
  const set = restricted.length >= 20 ? restricted : [];
  const misses: number[] = [];
  const starterMisses: number[] = [];
  for (let i = 0; i < set.length; i++) {
    const train = set.filter((_, j) => j !== i);
    const curve = olsFit(train);
    const mults = categoryMultipliers(curve, train);
    const fold: FittedModel = { curve, cat_mults: mults };
    const held = set[i]!;
    const { implied } = impliedValue(held, snapshot.as_of, fold);
    misses.push(Math.max(implied / held.mcap_usd!, held.mcap_usd! / implied));
    const flat = starterValue(held, snapshot.as_of);
    starterMisses.push(Math.max(flat / held.mcap_usd!, held.mcap_usd! / flat));
  }
  const stats = missStats(misses);
  const starterStats = missStats(starterMisses);
  return {
    n: set.length,
    median_miss: stats.median,
    p75_miss: stats.p75,
    p90_miss: stats.p90,
    within_2x_pct: stats.within2,
    within_3x_pct: stats.within3,
    starter_median_miss: starterStats.median,
    starter_within_3x_pct: starterStats.within3,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped / staked / staking anywhere in the name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name must not begin with. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Categories the strict rule keeps off the board. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: the strict pre-token rule. */
export function isStrict(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGES.some((e) => p.name.startsWith(e))
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fitted: FittedModel, model: ModelConstants = MODEL): BoardRow[] {
  const strict = snapshot.protocols.filter(isStrict).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const scored = strict.map((p) => {
    const { implied, base, catMult, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, fitted, model);
    return { p, implied, base, catMult, growthPct, growthMult, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_value_usd: Math.round(s.base),
      category_multiplier: round4(s.catMult),
      growth_pct: round4(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('cdp')) return `Mint $${capital} against collateral on ${name} on ${chain} and keep the position open.`;
  if (c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('restak')) return `Restake $${capital} through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('staking') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator')) return `Deposit $${capital} into a ${name} curator vault on ${chain} and keep the shares.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into the ${name} CeDeFi vault on ${chain} and keep the position open.`;
  if (c.includes('onchain') || c.includes('allocator')) return `Deposit $${capital} into a ${name} allocator vault on ${chain} and keep the shares.`;
  if (c.includes('basis')) return `Deposit $${capital} into the ${name} basis vault on ${chain} and keep the position open.`;
  if (c.includes('payment')) return `Route a $${capital} payment through ${name} on ${chain} and keep using it weekly.`;
  if (c.includes('governance')) return `Lock $${capital} with ${name} on ${chain} and vote on its proposals.`;
  if (c.includes('stablecoin') || c.includes('wrapper')) return `Wrap or mint $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c === 'chain') return `Bridge $${capital} to ${chain} through ${name} and use its app.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Track the protocol's own points or rewards page and its announcement channel every week, and claim only from a link it publishes: never pay to claim.`,
      cost: 'nothing to check',
      time: '10 minutes a week',
    },
    {
      text: `Before you withdraw, check the points page and any snapshot or eligibility dates.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_value_usd: row.model.base_value_usd,
    category_multiplier: row.model.category_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    wl: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const fitted = fitModel(snapshot);
  const board = buildBoard(snapshot, fitted, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watchlistSet = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    fit: fitted,
    validation: { loo: looValidation(snapshot), time_split: TIME_SPLIT },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watchlistSet.has(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
