import type { IProteusSession, IProteusSource } from "@lindorm/proteus";
import { omitUndefined } from "@lindorm/utils";
import type { IPylonSession } from "../../interfaces/index.js";
import type { IPylonSessionStore } from "../../interfaces/PylonSessionStore.js";
import type { PylonCommonContext, PylonSessionSettings } from "../../types/index.js";
import { buildHookMeta } from "./build-hook-meta.js";
import { resolveActor } from "./resolve-actor.js";
import { sessionRecordKit } from "./session/session-record-key.js";

/**
 * Everything the row does NOT carry in the clear, sealed as one blob.
 *
 * ⚠ `id` is the row this ciphertext was sealed FOR, asserted equal to `row.id` on
 * open. `AesKit`'s caller `aad` is a silent no-op in cbor mode — verified: a value
 * sealed WITH an `aad` decrypts with none, and with a DIFFERENT one — so the
 * ciphertext↔row binding cannot ride on it and is stated in the plaintext instead.
 * Without it, a kv writer could move one session's blob onto another's row and the
 * decrypt would succeed for whichever holder presented the matching secret.
 */
type SealedSessionPayload = {
  id: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  scope: Array<string>;
};

/**
 * The store takes the `kv` SOURCE, not `ctx.kv`.
 *
 * ⚠ It has to. The session middleware runs BEFORE the dependencies middleware
 * that installs `ctx.kv` — and the socket handshake chain never runs that
 * middleware at all — so `ctx.kv` is undefined on exactly the paths that read
 * the session. The store therefore opens its own request-scoped session,
 * carrying this request's logger and hook meta.
 */
const openSession = (ctx: PylonCommonContext, kv: IProteusSource): IProteusSession =>
  kv.session({ logger: ctx.logger, meta: buildHookMeta(ctx, resolveActor(ctx)) });

let cachedSession: typeof import("../../entities/Session.js").Session | undefined;
const getSessionEntity = async (): Promise<
  typeof import("../../entities/Session.js").Session
> => {
  if (!cachedSession) {
    cachedSession = (await import("../../entities/Session.js")).Session;
  }
  return cachedSession;
};

export const createSessionStore = (
  kv: IProteusSource | undefined,
  options?: PylonSessionSettings,
): IPylonSessionStore | undefined => {
  // No `kv` configured ⇒ NO store, and the session is cookie-only: the caller
  // puts the whole session object in the cookie and reads it back out. A store
  // that exists but has nowhere to write is worse than none — `set` would write
  // a row nothing addresses and `get` would answer null for it, so the session
  // would be write-only.
  if (!options?.enabled || !kv) return;

  // Captured as a `const` so the closures below see the narrowed source rather
  // than the optional parameter.
  const source = kv;

  // The `Session` entity lives in the AUTHORITATIVE `kv` source and nowhere
  // else — evicting a session logs the user out.
  return {
    set: async (ctx, handle, session): Promise<void> => {
      // A NEW object, never the caller's. `set` is handed `ctx.state.session` —
      // the live session for this request — and sealing in place made
      // `ctx.auth.introspect()` / `.userinfo()` read the ciphertext and present
      // it upstream as a bearer token.
      const payload: SealedSessionPayload = omitUndefined({
        id: handle.id,
        accessToken: session.accessToken,
        idToken: session.idToken,
        refreshToken: session.refreshToken,
        scope: session.scope,
      });

      // No key is resolved from the vault and none is configured: the key IS the
      // holder's secret, HKDF-derived per session. There is nothing here for an
      // operator to rotate, lose, or fail to resolve.
      const payloadEncrypted = sessionRecordKit(handle.sec).encrypt(payload);

      const proteus = openSession(ctx, source);
      const Session = await getSessionEntity();

      await proteus.repository(Session).upsert({
        id: handle.id,
        payloadEncrypted,
        subject: session.subject,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
      });
    },

    get: async (ctx, handle): Promise<IPylonSession | null> => {
      const proteus = openSession(ctx, source);
      const Session = await getSessionEntity();

      const row = await proteus.repository(Session).findOne({ id: handle.id });

      if (!row) return null;

      let payload: SealedSessionPayload;

      try {
        // THE DECRYPT IS THE AUTHENTICATION. No digest is stored and none is
        // compared — a wrong `sec` derives a wrong key and the AES-GCM tag
        // refuses it. A holder-key failure is a CLIENT fact, so it is a `null`
        // and a warning, never a 500: the row is left alone and reaped on its
        // own expiry, because a snapshot/restore skew must not let a stale
        // cookie destroy a live session.
        payload = sessionRecordKit(handle.sec).decrypt<SealedSessionPayload>(
          row.payloadEncrypted,
        );
      } catch (error) {
        ctx.logger.warn("Stored session did not open with the presented key", {
          error,
          sessionId: handle.id,
        });
        return null;
      }

      if (payload.id !== row.id) {
        ctx.logger.warn("Stored session payload names a different record", {
          sessionId: row.id,
          payloadId: payload.id,
        });
        return null;
      }

      return omitUndefined<IPylonSession>({
        id: row.id,
        accessToken: payload.accessToken,
        expiresAt: row.expiresAt,
        idToken: payload.idToken,
        issuedAt: row.issuedAt,
        refreshToken: payload.refreshToken,
        scope: payload.scope,
        subject: row.subject,
      });
    },

    del: async (ctx, id): Promise<void> => {
      const proteus = openSession(ctx, source);

      const Session = await getSessionEntity();
      await proteus.repository(Session).delete({ id });
    },

    logout: async (ctx, subject): Promise<void> => {
      const proteus = openSession(ctx, source);

      const Session = await getSessionEntity();
      await proteus.repository(Session).delete({ subject });
    },
  };
};
