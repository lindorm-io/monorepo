import type { Socket } from "socket.io-client";

const DEFAULT_SOCKET_IO_PATH = "/socket.io";

// engine.io-client (socket.js) normalizes the configured path by stripping
// any trailing slash, then (when addTrailingSlash is true, the default in
// socket.io v4) re-appending exactly one. The server receives the resulting
// path verbatim, and pylon's reconstructHandshakeHtu uses handshake.url as
// the path component of the htu. We must produce the same shape.
const normalizeSocketIoPath = (path: string): string => {
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return `${withLeading.replace(/\/$/, "")}/`;
};

const wsToHttpProtocol = (protocol: string): string => {
  const lower = protocol.toLowerCase();
  if (lower === "wss:") return "https:";
  if (lower === "ws:") return "http:";
  return lower;
};

const stripQuery = (value: string): string => {
  const q = value.indexOf("?");
  return q === -1 ? value : value.slice(0, q);
};

// Match pylon's server-side normalization:
//   normalizeHtu(origin, path) = `${url.protocol}//${url.host}${url.pathname}`
// (lowercases scheme/host, strips default port, strips query/fragment)
const normalize = (origin: string, path: string): string => {
  const url = new URL(`${origin}${path}`);
  return `${url.protocol}//${url.host}${url.pathname}`;
};

type ManagerLike = {
  uri?: string;
  opts?: { path?: string };
};

const readManager = (socket: Socket): ManagerLike =>
  (socket as unknown as { io: ManagerLike }).io;

export const resolveHandshakeHtu = (socket: Socket): string => {
  const manager = readManager(socket);
  const rawUri = manager.uri;

  if (typeof rawUri !== "string" || rawUri.length === 0) {
    throw new Error("Unable to resolve DPoP htu: socket.io manager has no uri");
  }

  const parsed = new URL(rawUri);
  const protocol = wsToHttpProtocol(parsed.protocol);
  const origin = `${protocol}//${parsed.host}`;

  const rawPath = manager.opts?.path ?? DEFAULT_SOCKET_IO_PATH;
  const path = normalizeSocketIoPath(stripQuery(rawPath));

  return normalize(origin, path);
};
