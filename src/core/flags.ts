/**
 * Experiment switches for A/B live tests. Defaults are the shipped behaviour; a build can override them with
 * PKBOT_FLAGS='{"jointOrder":false}' (see scripts/build.mjs).
 */
declare const __PKBOT_FLAGS__: Partial<typeof DEFAULT_FLAGS> | undefined;

// Defaults = best measured live configuration ("A", docs/STRATEGY.md). The others were not better in live A/B.
const DEFAULT_FLAGS = {
  /** search alternative battle orders together with the route */
  jointOrder: false,
  /** trade members that fell far behind */
  trade: false,
  /** core strength = top-3 average level (else team average) */
  top3: false,
  /** route value P × F(level) instead of the additive form */
  multiplicative: false,
};

export const FLAGS: typeof DEFAULT_FLAGS = {
  ...DEFAULT_FLAGS,
  ...(typeof __PKBOT_FLAGS__ !== 'undefined' && __PKBOT_FLAGS__ ? __PKBOT_FLAGS__ : {}),
};
