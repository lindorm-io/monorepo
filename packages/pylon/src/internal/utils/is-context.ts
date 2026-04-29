import type {
  PylonHttpContext,
  PylonSocketContext,
  PylonSocketHandshakeContext,
} from "../../types/index.js";

export const isSocketHandshakeContext = (ctx: any): ctx is PylonSocketHandshakeContext =>
  "io" in ctx &&
  typeof ctx.io === "object" &&
  ctx.io?.socket != null &&
  "event" in ctx === false &&
  "request" in ctx === false;

export const isSocketEventContext = (ctx: any): ctx is PylonSocketContext =>
  "event" in ctx && "request" in ctx === false;

export const isSocketContext = (
  ctx: any,
): ctx is PylonSocketContext | PylonSocketHandshakeContext =>
  isSocketEventContext(ctx) || isSocketHandshakeContext(ctx);

export const isHttpContext = (ctx: any): ctx is PylonHttpContext =>
  "request" in ctx && "event" in ctx === false;
