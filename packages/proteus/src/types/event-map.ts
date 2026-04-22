import type { StateChangeEvent } from "@lindorm/breaker";
import type {
  DestroyEvent,
  InsertEvent,
  LoadEvent,
  RestoreEvent,
  SoftDestroyEvent,
  UpdateEvent,
} from "../interfaces/EntityEvent.js";

// ─── Connection ──────────────────────────────────────────────────────────

export type ProteusConnectionState = "connected" | "disconnected";

// ─── Event Map ───────────────────────────────────────────────────────────

export type ProteusSourceEventMap = {
  "connection:state": { state: ProteusConnectionState };
  "breaker:state": StateChangeEvent;
  "entity:before-insert": InsertEvent;
  "entity:after-insert": InsertEvent;
  "entity:before-update": UpdateEvent;
  "entity:after-update": UpdateEvent;
  "entity:before-destroy": DestroyEvent;
  "entity:after-destroy": DestroyEvent;
  "entity:before-soft-destroy": SoftDestroyEvent;
  "entity:after-soft-destroy": SoftDestroyEvent;
  "entity:before-restore": RestoreEvent;
  "entity:after-restore": RestoreEvent;
  "entity:after-load": LoadEvent;
};

// ─── Emit function threaded to drivers/repos ─────────────────────────────

/**
 * Async emit function passed from ProteusSource to drivers and repositories.
 * Listeners are awaited sequentially; errors propagate to the caller.
 */
export type EntityEmitFn = (event: string, payload: unknown) => Promise<void>;
