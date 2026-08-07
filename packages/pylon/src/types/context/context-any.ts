import type { PylonContext, PylonMiddleware } from "./context-common.js";
import type {
  PylonConnectionMiddleware,
  PylonSocketHandshakeContext,
} from "./context-socket-handshake.js";

/**
 * Every context a TRANSPORT-AGNOSTIC middleware can be handed.
 *
 * ⚠ `PylonHttpContext` and `PylonSocketContext` are deliberately absent: both
 * are assignable to `PylonContext`, so naming them would narrow nothing and
 * would make the guards produce needless intersections. The handshake context
 * is here because it is NOT a `PylonContext` — it has no `data` and no `params`,
 * because nothing has been dispatched yet.
 */
export type PylonAnyContext = PylonContext | PylonSocketHandshakeContext;

/**
 * A middleware mountable on ANY pylon surface — an http router, a socket
 * listener, and `socket.connectionMiddleware`.
 *
 * ⚠ It is an INTERSECTION, not a union, and that is what makes one mount fit
 * all three arrays: a value of type `A & B` is assignable wherever `A` is
 * accepted and wherever `B` is. A union would be assignable to neither.
 */
export type PylonAnyMiddleware = PylonMiddleware & PylonConnectionMiddleware;
