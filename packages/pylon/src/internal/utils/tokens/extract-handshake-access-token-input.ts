import { ClientError } from "@lindorm/errors";
import type { PylonSocket } from "../../../types/index.js";
import {
  type HandshakeTokenSource,
  resolveHandshakeTokenSource,
} from "./resolve-handshake-token-source.js";

export type HandshakeAccessTokenInput = {
  token: string;
  dpopProof: string | undefined;
};

export const extractHandshakeAccessTokenInput = (
  socket: PylonSocket,
): HandshakeAccessTokenInput => {
  const source: HandshakeTokenSource = resolveHandshakeTokenSource(socket);

  if (source.kind === "bearer") {
    return { token: source.token, dpopProof: undefined };
  }

  if (source.kind === "dpop") {
    return { token: source.token, dpopProof: source.dpopProof };
  }

  throw new ClientError("Missing handshake bearer token", {
    status: ClientError.Status.Unauthorized,
  });
};
