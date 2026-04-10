import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { PylonContext } from "../../types";
import { isHttpContext, isSocketContext } from "./is-context";

export type AccessTokenInput = {
  token: string;
  dpopProof: string | undefined;
};

export const extractAccessTokenInput = (ctx: PylonContext): AccessTokenInput => {
  if (isSocketContext(ctx)) {
    // TODO(dpop,socket-auth): sockets currently verify the token on every
    // event and never consume a DPoP proof. Two related decisions are
    // deferred until the socket auth model is revisited:
    //   1. Whether to verify the access token per-event or only at the
    //      handshake (leaning per-handshake + a disconnect timer on exp).
    //   2. Whether to accept DPoP-bound tokens on sockets at all, and if
    //      so, verify the proof once at the handshake against the upgrade
    //      URL and trust the binding for the connection lifetime.
    // For now: sockets are bearer-only; DPoP-bound tokens presented via a
    // socket are rejected by aegis since no dpopProof is supplied.
    const token = ctx.io.socket.handshake.auth.bearer;
    if (!isString(token)) {
      throw new ClientError("Token must be of type JWT", {
        status: ClientError.Status.Unauthorized,
      });
    }
    return { token, dpopProof: undefined };
  }

  if (!isHttpContext(ctx)) {
    throw new ClientError("Unsupported context for access token middleware", {
      status: ClientError.Status.Unauthorized,
    });
  }

  const auth = ctx.state.authorization;

  if (auth.type !== "bearer" && auth.type !== "dpop") {
    throw new ClientError("Invalid Authorization header", {
      details: "Authorization header must be of type Bearer or DPoP",
      debug: { state: auth },
      status: ClientError.Status.Unauthorized,
    });
  }

  if (!isString(auth.value)) {
    throw new ClientError("Token must be of type JWT", {
      status: ClientError.Status.Unauthorized,
    });
  }

  if (auth.type === "bearer") {
    return { token: auth.value, dpopProof: undefined };
  }

  const header = ctx.get("dpop");
  if (!isString(header) || header.length === 0) {
    throw new ClientError("Missing DPoP header", {
      details: "DPoP scheme requires a DPoP header on the request",
      status: ClientError.Status.Unauthorized,
    });
  }

  return { token: auth.value, dpopProof: header };
};
