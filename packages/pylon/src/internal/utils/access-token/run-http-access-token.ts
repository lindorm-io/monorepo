import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type { PylonAuthCacheEntry, PylonHttpContext } from "../../../types/index.js";
import { assertDpopBinding } from "../dpop/assert-dpop-binding.js";
import { extractTokenFromSession } from "../tokens/extract-token-from-session.js";
import { resolveHttpTokenSource } from "../tokens/resolve-http-token-source.js";
import { sessionResolvedAccess } from "../tokens/session-resolved-access.js";
import { assertResolvedAccess } from "./assert-resolved-access.js";
import { resolveAccess } from "./resolve-access.js";

type Options = {
  cache: PylonAuthCacheEntry | undefined;
  matchers: DomainAssert;
  verifyOptions: VerifyOptions;
};

export const runHttpAccessToken = async (
  ctx: PylonHttpContext,
  options: Options,
): Promise<void> => {
  const source = resolveHttpTokenSource(ctx);

  if (source.kind === "bearer" || source.kind === "dpop") {
    const dpopProof =
      source.kind === "dpop"
        ? ((ctx.get("dpop") as string | undefined) ?? undefined)
        : undefined;

    if (source.kind === "dpop" && (!dpopProof || dpopProof.length === 0)) {
      throw new ClientError("Missing DPoP header", {
        details: "DPoP scheme requires a DPoP header on the request",
        status: ClientError.Status.Unauthorized,
        code: "missing_dpop_header",
        type: "urn:lindorm:pylon:error:missing_dpop_header",
        title: "Missing DPoP Header",
        data: { scheme: "dpop" },
      });
    }

    const { access, issuer, verified } = await resolveAccess(ctx, source.token, {
      cache: options.cache,
      verifyOptions: options.verifyOptions,
    });

    assertResolvedAccess(access, { issuer, matchers: options.matchers });

    // `ctx.state.tokens.accessToken` is left UNSET on the introspected arm:
    // there is no VerifiedToken, and synthesising one would erase the very
    // provenance distinction `ctx.state.access` exists to preserve.
    if (verified) ctx.state.tokens.accessToken = verified;
    ctx.state.access = access;

    assertDpopBinding(access, {
      htm: ctx.method,
      htu: { origin: ctx.origin, path: ctx.path },
      proof: dpopProof,
      scheme: source.kind === "dpop",
    });
    return;
  }

  if (source.kind === "session") {
    const parsed = await extractTokenFromSession(ctx.aegis, source.session);
    if (!parsed) {
      throw new ClientError("Invalid session access token", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_session_access_token",
        type: "urn:lindorm:pylon:error:invalid_session_access_token",
        title: "Invalid Session Access Token",
        details: "No access token could be extracted from the session",
        debug: { sessionId: source.session.id },
      });
    }

    ctx.state.tokens.accessToken = parsed;
    // A cookie-session credential is presented by the browser, not by a DPoP
    // client — there is no proof to bind it to, so no binding check runs (the
    // pre-existing behaviour: the session path never passed a proof to aegis).
    //
    // ⚠ It does not run the shared assert either, and that is a KNOWN gap rather
    // than a decision: `extractTokenFromSession` verifies with no issuer matcher
    // and no mount matchers at all, so making it answer to them is a change of
    // its own (a deployment that settled no issuer but serves cookie sessions
    // would start failing here). It is left exactly as it was.
    ctx.state.access = sessionResolvedAccess(source.session.accessToken, parsed);
    return;
  }

  throw new ClientError("Invalid credentials", {
    details: "No authorization header or session available",
    status: ClientError.Status.Unauthorized,
    code: "missing_credentials",
    type: "urn:lindorm:pylon:error:missing_credentials",
    title: "Missing Credentials",
    data: { source: source.kind },
  });
};
