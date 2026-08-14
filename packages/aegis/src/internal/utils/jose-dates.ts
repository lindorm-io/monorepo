import type { Dict } from "@lindorm/types";

/**
 * Convert a JOSE wire payload's NumericDate temporal claims to `Date`s for the
 * temporal/identity matchers. The COSE claim codec already decodes them inside
 * the kit, so this is what puts both wires in the same shape before the shared
 * matcher pass — and it is deliberately NOT applied to the payload a result
 * reports, which stays exactly as the wire carried it.
 *
 * A claim that is absent — or a falsy `0`, which is not a date any token means —
 * lifts to `undefined`, so the matchers see "not present" rather than the epoch.
 */
export const withJoseDates = (payload: Dict): Dict => ({
  ...payload,
  exp: payload.exp ? new Date((payload.exp as number) * 1000) : undefined,
  iat: payload.iat ? new Date((payload.iat as number) * 1000) : undefined,
  nbf: payload.nbf ? new Date((payload.nbf as number) * 1000) : undefined,
  auth_time: payload.auth_time
    ? new Date((payload.auth_time as number) * 1000)
    : undefined,
});
