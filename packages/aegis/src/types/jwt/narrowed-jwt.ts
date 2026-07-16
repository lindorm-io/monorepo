import type { Dict } from "@lindorm/types";
import type { ParsedJwt, ParsedJwtPayload } from "./jwt-parse.js";
import type { TokenProfile } from "./profile.js";

/**
 * The profile's `required` domain claims that are ALSO parsed-payload fields.
 * `Extract` intersects the profile's `required` tuple with the actual payload
 * keys, so required entries that are not payload fields (e.g. `clientId`,
 * `events`, `token_introspection`) are simply skipped — no error, no
 * over-narrowing.
 */
type GuaranteedKeys<P extends TokenProfile, C extends Dict> = Extract<
  P["required"][number],
  keyof ParsedJwtPayload<C>
>;

/**
 * Make the guaranteed claims PRESENT: strip both the optional modifier AND the
 * explicit `| undefined` from the value type. `ParsedJwtPayload` declares its
 * optional scalars two ways — `expiresAt?: Date` (optional modifier) and
 * `subject: string | undefined` (required-but-nullable) — so `Required` alone
 * would leave the latter unchanged; `Exclude<…, undefined>` handles both.
 */
type PresentClaims<C extends Dict, K extends keyof ParsedJwtPayload<C>> = {
  [P in K]-?: Exclude<ParsedJwtPayload<C>[P], undefined>;
};

/**
 * A {@link ParsedJwt} whose payload reflects a built-in profile's verify FLOOR:
 * the profile's `required` domain claims — which `enforceVerifyFloor` proves
 * present at runtime — are made NON-optional in the type, so callers stop
 * writing `payload.subject!` / `?? "unknown"`. Only the optional scalar/date
 * claims the payload actually carries (`subject`, `tokenId`, `expiresAt`,
 * `issuedAt`, …) get their `| undefined` stripped.
 */
export type NarrowedJwt<P extends TokenProfile, C extends Dict = Dict> = Omit<
  ParsedJwt<C>,
  "payload"
> & {
  payload: Omit<ParsedJwtPayload<C>, GuaranteedKeys<P, C>> &
    PresentClaims<C, GuaranteedKeys<P, C>>;
};
