import { isString } from "@lindorm/is";
import type { Socket } from "socket.io";

type Handshake = Socket["handshake"];

const firstHeader = (value: string | Array<string> | undefined): string | undefined => {
  if (!value) return undefined;
  if (isString(value)) return value.split(",")[0]?.trim();
  return value[0]?.trim();
};

export const reconstructHandshakeOrigin = (
  handshake: Pick<Handshake, "secure" | "headers">,
): string | undefined => {
  const headers = handshake.headers ?? {};

  const forwardedProto = firstHeader(headers["x-forwarded-proto"]);
  const forwardedHost = firstHeader(headers["x-forwarded-host"]);

  const protocol = forwardedProto ?? (handshake.secure ? "https" : "http");
  const host = forwardedHost ?? firstHeader(headers.host);

  if (!host) return undefined;

  return `${protocol}://${host}`.toLowerCase();
};
