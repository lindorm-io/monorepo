import { IAegis, VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { assertDpopHandshakeMatch } from "../dpop/assert-dpop-handshake-match";
import { createBearerRefreshHandler } from "../refresh/create-bearer-refresh-handler";
import { PylonSocket, PylonSocketAuth } from "../../../types";

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

  const verified = await aegis.verify(token, {
    tokenType: "access_token",
    ...verifyOptions,
    dpopProof,
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
