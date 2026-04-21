import {
  Aegis,
  type IAegis,
  type ParsedJwt,
  type VerifyJwtOptions,
} from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { assertDpopHandshakeMatch } from "../dpop/assert-dpop-handshake-match.js";
import { createBearerRefreshHandler } from "../refresh/create-bearer-refresh-handler.js";
import type { PylonSocket, PylonSocketAuth } from "../../../types/index.js";

export type HandshakeDpopMode = "required" | "optional" | "disabled";

type RegisterBearerHandshakeAuthOptions = {
  aegis: IAegis;
  dpopMode: HandshakeDpopMode;
  dpopProof: string | undefined;
  socket: PylonSocket;
  token: string;
  verifyOptions: VerifyJwtOptions;
};

export const registerBearerHandshakeAuth = async ({
  aegis,
  dpopMode,
  dpopProof,
  socket,
  token,
  verifyOptions,
}: RegisterBearerHandshakeAuthOptions): Promise<void> => {
  if (dpopMode === "required" && !dpopProof) {
    throw new ClientError("Missing DPoP proof", {
      details: "DPoP is required on this handshake but no DPoP header was sent",
      status: ClientError.Status.Unauthorized,
    });
  }

  // Preflight parse the token so we can tell whether it carries a cnf.jkt
  // binding BEFORE handing it to aegis.verify. aegis.verify refuses to
  // process a bound token without a proof (and vice versa), so we only pass
  // `dpopProof` to the full verify when the token is actually DPoP-bound.
  // In "optional" mode a bearer-only token may still arrive alongside a
  // DPoP header (the client signed preemptively) — we accept the token as
  // a plain bearer and ignore the proof.
  const preflight = Aegis.parse<ParsedJwt<any>>(token);
  const preflightJkt = (preflight.payload as any).confirmation?.thumbprint as
    | string
    | undefined;

  const passDpopProof = preflightJkt && dpopMode !== "disabled" ? dpopProof : undefined;

  const verified = await aegis.verify(token, {
    tokenType: "access_token",
    ...verifyOptions,
    dpopProof: passDpopProof,
  });

  const confirmedJkt = (verified.payload as any).confirmation?.thumbprint as
    | string
    | undefined;

  if (dpopMode === "required" && !confirmedJkt) {
    throw new ClientError("Missing DPoP binding", {
      details: "DPoP is required but the access token has no cnf.jkt",
      status: ClientError.Status.Unauthorized,
    });
  }

  let capturedJkt: string | undefined;
  let dpopValidated = false;

  if (dpopMode !== "disabled" && confirmedJkt) {
    if (!dpopProof) {
      throw new ClientError("Missing DPoP proof", {
        details: "Access token is DPoP-bound but handshake did not present a DPoP header",
        status: ClientError.Status.Unauthorized,
      });
    }
    if (!verified.dpop) {
      throw new ClientError("Invalid DPoP proof", {
        details: "DPoP proof could not be verified",
        status: ClientError.Status.Unauthorized,
      });
    }
    assertDpopHandshakeMatch(socket.handshake, verified.dpop);
    capturedJkt = confirmedJkt;
    dpopValidated = true;
  }

  socket.data.tokens.bearer = verified;

  const auth: PylonSocketAuth = {
    strategy: dpopValidated ? "dpop-bearer" : "bearer",
    getExpiresAt: () => verified.payload.expiresAt ?? new Date(0),
    refresh: async () => {},
    authExpiredEmittedAt: null,
  };
  auth.refresh = createBearerRefreshHandler({
    aegis,
    capturedJkt,
    socket,
    subject: verified.payload.subject,
    verifyOptions: { tokenType: "access_token", ...verifyOptions },
  });
  socket.data.pylon.auth = auth;
};
