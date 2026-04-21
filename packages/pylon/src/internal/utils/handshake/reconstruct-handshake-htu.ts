import type { Socket } from "socket.io";
import { reconstructHandshakeOrigin } from "../cors/reconstruct-handshake-origin";
import { normalizeHtu } from "../normalize-htu";

type Handshake = Socket["handshake"];

export type HandshakeHtu = {
  origin: string;
  path: string;
};

const stripQuery = (url: string): string => {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
};

export const reconstructHandshakeHtu = (
  handshake: Pick<Handshake, "secure" | "headers" | "url">,
): HandshakeHtu | undefined => {
  const origin = reconstructHandshakeOrigin(handshake);
  if (!origin) return undefined;

  const rawUrl = handshake.url ?? "/";
  const path = stripQuery(rawUrl) || "/";

  // Normalize through normalizeHtu to apply the RFC 3986 §6.2.2 subset
  // (lowercase scheme/host, default port stripping). We strip the normalized
  // result back into components so callers can pass them to assertDpopMatch.
  const normalized = normalizeHtu(origin, path);
  const parsed = new URL(normalized);

  return {
    origin: `${parsed.protocol}//${parsed.host}`,
    path: parsed.pathname,
  };
};
