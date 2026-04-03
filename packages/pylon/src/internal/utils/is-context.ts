import type { PylonContext, PylonHttpContext, PylonSocketContext } from "../../types";

export const isSocketContext = (ctx: PylonContext): ctx is PylonSocketContext =>
  "socket" in ctx && "request" in ctx === false;

export const isHttpContext = (ctx: PylonContext): ctx is PylonHttpContext =>
  "request" in ctx && "socket" in ctx === false;
