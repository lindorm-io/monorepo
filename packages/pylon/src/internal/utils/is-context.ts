import type {
  PylonContext,
  PylonHttpContext,
  PylonSocketContext,
  PylonSocketHandshakeContext,
} from "../../types";

type AnyContext =
  | PylonContext
  | PylonHttpContext
  | PylonSocketContext
  | PylonSocketHandshakeContext;

export const isSocketHandshakeContext = (
  ctx: AnyContext,
): ctx is PylonSocketHandshakeContext =>
  "io" in ctx &&
  typeof (ctx as any).io === "object" &&
  (ctx as any).io?.socket != null &&
  "event" in ctx === false &&
  "request" in ctx === false;

export const isSocketEventContext = (ctx: AnyContext): ctx is PylonSocketContext =>
  "event" in ctx && "request" in ctx === false;

export const isSocketContext = (
  ctx: AnyContext,
): ctx is PylonSocketContext | PylonSocketHandshakeContext =>
  isSocketEventContext(ctx) || isSocketHandshakeContext(ctx);

export const isHttpContext = (ctx: AnyContext): ctx is PylonHttpContext =>
  "request" in ctx && "event" in ctx === false;
