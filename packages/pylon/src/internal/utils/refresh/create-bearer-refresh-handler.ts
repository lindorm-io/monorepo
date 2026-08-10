import { ClientError } from "@lindorm/errors";
import { isNumber, isObject, isString } from "@lindorm/is";
import type {
  AccessTokenMatchers,
  PylonAuthCacheEntry,
  PylonSocket,
  PylonSocketHandshakeContext,
} from "../../../types/index.js";
import { assertResolvedAccess } from "../access-token/assert-resolved-access.js";
import { resolveAccess } from "../access-token/resolve-access.js";
import { assertJktUnchanged } from "./assert-jkt-unchanged.js";
import { assertSubjectUnchanged } from "./assert-subject-unchanged.js";

type CreateBearerRefreshHandlerOptions = {
  /** The mount's introspection-cache carve-out, carried forward for the opaque arm. */
  cache: PylonAuthCacheEntry | undefined;
  capturedJkt?: string;
  /** The handshake context the connection was established on — see below. */
  ctx: PylonSocketHandshakeContext;
  /** The issuer the handshake pinned — the refreshed token answers to the same one. */
  issuer: string;
  /** The mount's claim matchers, re-applied so a refresh cannot widen the grant. */
  matchers: AccessTokenMatchers;
  socket: PylonSocket;
  subject: string | undefined;
};

/**
 * Swap the credential a live socket runs on.
 *
 * ⚠ It goes through the SAME `resolveAccess` the handshake ran, so a connection
 * established with an OPAQUE credential can refresh onto another one. It used to
 * call the structured verify directly, which meant the one credential kind that
 * cannot be re-verified locally was also the one kind that could never be
 * refreshed — a socket that authenticated fine at handshake time was dropped the
 * moment its token rotated.
 *
 * The handshake CONTEXT is captured rather than just `ctx.aegis`, because the
 * opaque arm needs the auth driver and the resolved app config to introspect
 * with. That is the same context the connection's own auth state was established
 * on; a refresh is a continuation of that handshake, not a new request.
 *
 * DPoP is propagated, not re-proved: refresh events carry no proof, so
 * `resolveAccess` trusts the handshake's binding and `assertJktUnchanged`
 * compares the new credential's `cnf.jkt` against the captured one — which now
 * covers an introspected credential too, since the thumbprint travels with the
 * resolution (RFC 9449 §6.2) rather than with a locally verified artifact.
 */
export const createBearerRefreshHandler = ({
  cache,
  capturedJkt,
  ctx,
  issuer,
  matchers,
  socket,
  subject,
}: CreateBearerRefreshHandlerOptions) => {
  return async (payload: unknown): Promise<void> => {
    if (
      !isObject(payload) ||
      !isString((payload as any).bearer) ||
      !isNumber((payload as any).expiresIn) ||
      (payload as any).expiresIn <= 0
    ) {
      throw new ClientError("Invalid refresh payload", {
        code: "invalid_refresh_payload",
        title: "Invalid Refresh Payload",
        type: "urn:lindorm:pylon:error:invalid_refresh_payload",
        details:
          "Expected { bearer: string, expiresIn: number } with a positive expiresIn",
        status: ClientError.Status.BadRequest,
      });
    }

    const token = (payload as any).bearer as string;
    const expiresIn = (payload as any).expiresIn as number;

    const { access, verified } = await resolveAccess(ctx, token, {
      audience: matchers.audience,
      cache,
      // ⚠ `undefined`, for the same reason the handshake states it: a refresh is
      // a socket EVENT carrying `{ bearer, expiresIn }` — there is no
      // `Authorization` header on it and never was one on the handshake it
      // continues, so there is no RFC 6749 §7.1 scheme for an introspection
      // answer's `token_type` to contradict. The binding is carried forward by
      // `assertJktUnchanged` below, which is this transport's equivalent.
      scheme: undefined,
    });

    assertResolvedAccess(access, { issuer, matchers });

    assertSubjectUnchanged(subject, access.claims.subject);

    assertJktUnchanged(capturedJkt, access.claims.confirmation?.thumbprint);

    // CLEARED, not left alone, for an opaque credential: there is no
    // VerifiedToken behind an introspection answer, and a socket that refreshed
    // from a structured token onto an opaque one would otherwise keep publishing
    // the replaced token's claims at `ctx.state.tokens.accessToken` beside a
    // fresh `ctx.state.access`. The connection's own record is `pylon.access`,
    // which both arms produce.
    if (verified) {
      socket.data.tokens.bearer = verified;
    } else {
      delete socket.data.tokens.bearer;
    }

    socket.data.pylon.access = access;

    const auth = socket.data.pylon.auth;
    if (auth) {
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      auth.getExpiresAt = () => expiresAt;
      auth.authExpiredEmittedAt = null;
    }
  };
};
