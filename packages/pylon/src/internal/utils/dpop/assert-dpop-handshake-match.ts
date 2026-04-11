import { ClientError } from "@lindorm/errors";
import { Handshake } from "socket.io/dist/socket-types";
import { reconstructHandshakeHtu } from "../handshake/reconstruct-handshake-htu";
import { assertDpopMatch, DpopProofClaims } from "./assert-dpop-match";

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
