import { isString } from "@lindorm/is";
import { IPylonSession } from "../../../interfaces";
import { PylonSocket } from "../../../types";

export type HandshakeTokenSource =
  | { kind: "bearer"; token: string; dpopProof: undefined }
  | { kind: "dpop"; token: string; dpopProof: string }
  | { kind: "session"; session: IPylonSession }
  | { kind: "none" };

export const resolveHandshakeTokenSource = (
  socket: PylonSocket,
): HandshakeTokenSource => {
  const bearer = socket.handshake?.auth?.bearer;
  const dpopHeaderRaw = socket.handshake?.headers?.dpop;
  const dpopHeader = Array.isArray(dpopHeaderRaw) ? dpopHeaderRaw[0] : dpopHeaderRaw;
  const dpopProof =
    isString(dpopHeader) && dpopHeader.length > 0 ? dpopHeader : undefined;

  if (isString(bearer) && bearer.length > 0) {
    if (dpopProof) {
      return { kind: "dpop", token: bearer, dpopProof };
    }
    return { kind: "bearer", token: bearer, dpopProof: undefined };
  }

  const session = socket.data?.session;
  if (session && isString(session.accessToken) && session.accessToken.length > 0) {
    return { kind: "session", session };
  }

  return { kind: "none" };
};
