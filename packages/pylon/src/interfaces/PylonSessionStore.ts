import type { PylonCommonContext } from "../types/index.js";
import type { IPylonSession } from "./PylonSession.js";

/**
 * The two halves of a session cookie: the row's NAME and the key that OPENS it.
 *
 * They are INDEPENDENT — the id is not derived from the secret. Deriving it would
 * mean a rotated secret rotates the id, breaking `metadata.sessionId` correlation,
 * the audit log's `sessionId`, and the id a live socket captured at handshake.
 *
 * The secret does NOT rotate on write. It is minted when the id is — on a fresh
 * login — and reused for every update of that session. Rotating per write would
 * re-seal the row under a key the deployment's other tabs do not hold, turning
 * every concurrent refresh into a hard logout race with no grace window.
 */
export type PylonSessionHandle = {
  id: string;
  sec: string;
};

export interface IPylonSessionStore<C extends PylonCommonContext = PylonCommonContext> {
  /**
   * Seals the payload under `handle.sec` and upserts the row named by `handle.id`.
   *
   * Returns nothing: the caller minted the handle and already knows the id, so a
   * returned id would be a second answer to a settled question.
   *
   * ⚠ Does NOT mutate `session`. It is handed `ctx.state.session` — the live session
   * for the request — and `ctx.auth.introspect()` / `.userinfo()` resolve their
   * credential off `ctx.state.session.accessToken` lazily, in the handler that runs
   * afterwards.
   */
  set: (ctx: C, handle: PylonSessionHandle, session: IPylonSession) => Promise<void>;

  /**
   * Null when the row is gone OR the handle's secret does not open it. THE DECRYPT IS
   * THE AUTHENTICATION — no digest is stored and none is compared; a wrong `sec`
   * derives a wrong key and the AES-GCM tag fails. Throws only on a storage failure.
   */
  get: (ctx: C, handle: PylonSessionHandle) => Promise<IPylonSession | null>;

  /** Cleartext-keyed, deliberately: destroying a session must not require the holder. */
  del: (ctx: C, id: string) => Promise<void>;

  /**
   * Cleartext-keyed for the same reason, and one harder: back-channel logout is a
   * server-to-server call with no cookie in hand at all.
   */
  logout: (ctx: C, subject: string) => Promise<void>;
}
