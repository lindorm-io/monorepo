/**
 * What "the claim is not there" means for every presence rule — ONE definition,
 * so a claim cannot count as present at mint and absent at verify.
 *
 * `null` and `""` count as absent alongside `undefined`. A token whose `sub` is
 * an empty string identifies nobody, so admitting it as a satisfied requirement
 * is a fail-open; the verify floor has always read it this way and the mint side
 * (which checked `=== undefined` alone) now agrees with it rather than the other
 * way round.
 */
export const isClaimAbsent = (value: unknown): boolean =>
  value === undefined || value === null || value === "";
