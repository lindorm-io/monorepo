import type { DomainAssert, IAegis, VerifyOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isNumber, isObject, isString } from "@lindorm/is";
import type { PylonSocket } from "../../../types/index.js";
import { assertResolvedAccess } from "../access-token/assert-resolved-access.js";
import { verifyAccessToken } from "../access-token/verify-access-token.js";
import { assertJktUnchanged } from "./assert-jkt-unchanged.js";
import { assertSubjectUnchanged } from "./assert-subject-unchanged.js";

type CreateBearerRefreshHandlerOptions = {
  aegis: IAegis;
  capturedJkt?: string;
  /** The issuer the handshake pinned — the refreshed token answers to the same one. */
  issuer: string | null;
  /** The mount's claim matchers, re-applied so a refresh cannot widen the grant. */
  matchers: DomainAssert;
  socket: PylonSocket;
  subject: string | undefined;
  verifyOptions: VerifyOptions;
};

export const createBearerRefreshHandler = ({
  aegis,
  capturedJkt,
  issuer,
  matchers,
  socket,
  subject,
  verifyOptions,
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

    // The DPoP binding is established once at handshake time; refresh events do
    // not re-present a DPoP proof. Tell aegis to trust the existing jkt binding
    // for this verify call, then compare the new token's cnf.jkt against the
    // captured one below.
    //
    // ⚠ Refresh stays STRUCTURED-only: it re-verifies locally rather than going
    // through `resolveAccess`, so a socket that handshook with an opaque
    // credential cannot swap in a new one mid-connection. Introspecting on a
    // refresh event would need the caching policy the connection never carried.
    const verified = await verifyAccessToken(aegis, token, {
      ...verifyOptions,
      trustBoundThumbprint: capturedJkt !== undefined,
    });

    const access = {
      provenance: "verified" as const,
      claims: verified.claims,
      custom: verified.custom,
      token,
    };

    assertResolvedAccess(access, { issuer, matchers });

    assertSubjectUnchanged(subject, verified.claims.subject);

    assertJktUnchanged(capturedJkt, verified.claims.confirmation?.thumbprint);

    socket.data.tokens.bearer = verified;
    socket.data.pylon.access = access;

    const auth = socket.data.pylon.auth;
    if (auth) {
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      auth.getExpiresAt = () => expiresAt;
      auth.authExpiredEmittedAt = null;
    }
  };
};
