import type { VerifiedToken } from "@lindorm/aegis";
import { isString } from "@lindorm/is";
import type {
  AuthorizationState,
  PylonCommonContext,
  PylonState,
} from "../../types/index.js";

export type ActorResolver = (ctx: PylonCommonContext) => string;

const nonEmptyString = (value: unknown): string | undefined =>
  isString(value) && value.length > 0 ? value : undefined;

/**
 * ⚠ The subject claim is `subject`, NOT `sub`. Aegis returns DOMAIN-keyed claims
 * (`StdClaims`), so neither a `VerifiedToken` nor a `PylonResolvedAccess` ever
 * carries `.sub` — reading it resolved every authenticated request to "unknown"
 * with nothing to show for it. The typed context is what keeps that honest here:
 * the old `as any` on `ctx.state.tokens` is gone precisely so the next claim
 * rename fails the build instead of failing silently.
 */
const tokenSubject = (token: VerifiedToken | undefined): string | undefined =>
  nonEmptyString(token?.claims?.subject);

const basicUsername = (
  authorization: AuthorizationState | undefined,
): string | undefined => {
  if (authorization?.type !== "basic") return undefined;

  try {
    const [username] = Buffer.from(authorization.value, "base64")
      .toString("utf-8")
      .split(":");

    return nonEmptyString(username);
  } catch {
    // Malformed credentials name no actor — and are not this function's error
    // to raise; the authenticating middleware already rejected or allowed them.
    return undefined;
  }
};

const defaultActorResolver: ActorResolver = (ctx) => {
  const state = ctx.state as PylonState | undefined;

  return (
    // The RESOLVED access credential FIRST. It is the one shape both credential
    // paths produce, and the introspected path deliberately leaves
    // `tokens.accessToken` unset (there is no VerifiedToken to put there), so
    // without this an introspection-authenticated request has no resolvable
    // actor at all: it audits as "unknown" and can never key a `private`
    // response-cache entry.
    nonEmptyString(state?.access?.claims?.subject) ??
    // `createTokenMiddleware` populates `tokens` without touching `access`, so
    // the session's token set stays a fallback rather than being subsumed.
    tokenSubject(state?.tokens?.accessToken) ??
    tokenSubject(state?.tokens?.idToken) ??
    basicUsername(state?.authorization) ??
    "unknown"
  );
};

/**
 * Resolves the actor for the current request, memoising on `ctx.state.actor`.
 * The initial state is `"unknown"` (set by the state-init middleware). A
 * non-"unknown" cached value short-circuits; a cached `"unknown"` is treated
 * as "not yet resolved" and re-runs the resolver — cheap and idempotent
 * because tokens/basic-auth may only populate later in the request lifecycle.
 */
export const resolveActor = (
  ctx: PylonCommonContext,
  configured?: ActorResolver,
): string => {
  const state = ctx.state as PylonState | undefined;
  if (state?.actor && state.actor !== "unknown") return state.actor;

  const resolver = configured ?? defaultActorResolver;
  const resolved = resolver(ctx);

  if (state) {
    state.actor = resolved;
  }

  return resolved;
};
