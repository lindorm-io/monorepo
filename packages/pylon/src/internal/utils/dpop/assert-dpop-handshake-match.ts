import { ClientError } from "@lindorm/errors";
import type { Socket } from "socket.io";
import { reconstructHandshakeHtu } from "../handshake/reconstruct-handshake-htu.js";
import { assertDpopMatch, type DpopProofClaims } from "./assert-dpop-match.js";

type Handshake = Socket["handshake"];

export const assertDpopHandshakeMatch = (
  handshake: Pick<Handshake, "secure" | "headers" | "url">,
  proof: DpopProofClaims,
): void => {
  const htu = reconstructHandshakeHtu(handshake);
  if (!htu) {
    throw new ClientError("Invalid DPoP proof", {
      details: "Unable to reconstruct handshake htu — missing host header",
      status: ClientError.Status.Unauthorized,
    });
  }

  assertDpopMatch({ method: "GET", origin: htu.origin, path: htu.path }, proof);
};
