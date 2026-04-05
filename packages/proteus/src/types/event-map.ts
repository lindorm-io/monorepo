import type { StateChangeEvent } from "@lindorm/breaker";
import type {
  DestroyEvent,
  InsertEvent,
  LoadEvent,
  RestoreEvent,
  SoftDestroyEvent,
  UpdateEvent,
} from "../interfaces/EntityEvent";

// ─── Connection ──────────────────────────────────────────────────────────

export type ProteusConnectionState = "connected" | "disconnected";

// ─── Event Map ───────────────────────────────────────────────────────────

export type ProteusSourceEventMap<C = unknown> = {
  "connection:state": { state: ProteusConnectionState };
  "breaker:state": StateChangeEvent;
  "entity:before-insert": InsertEvent<any, C>;
  "entity:after-insert": InsertEvent<any, C>;
  "entity:before-update": UpdateEvent<any, C>;
  "entity:after-update": UpdateEvent<any, C>;
  "entity:before-destroy": DestroyEvent<any, C>;
  "entity:after-destroy": DestroyEvent<any, C>;
  "entity:before-soft-destroy": SoftDestroyEvent<any, C>;
  "entity:after-soft-destroy": SoftDestroyEvent<any, C>;
  "entity:before-restore": RestoreEvent<any, C>;
  "entity:after-restore": RestoreEvent<any, C>;
  "entity:after-load": LoadEvent<any, C>;
};

// ─── Emit function threaded to drivers/repos ─────────────────────────────

/**
 * Async emit function passed from ProteusSource to drivers and repositories.
 * Listeners are awaited sequentially; errors propagate to the caller.
 */
export type EntityEmitFn = (event: string, payload: unknown) => Promise<void>;
