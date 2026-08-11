import { AesKit } from "@lindorm/aes";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { IPylonSession, PylonSessionHandle } from "../../interfaces/index.js";
import type { PylonSessionSettings } from "../../types/index.js";
import { createSessionStore } from "./create-session-store.js";

// The store reads only `enabled` — the at-rest seal is the holder's key, derived
// per session — but `encryption` is required on the settings because it seals the
// COOKIE. Declared once here so the fixtures state it without repeating it.
const SESSION: PylonSessionSettings = {
  enabled: true,
  encryption: { condition: { purpose: "session", publish: false } },
};
import { createSessionSecret } from "./session/create-session-secret.js";
import { sessionRecordKit } from "./session/session-record-key.js";

/** The row as the store actually hands it to the repository. */
type StoredRow = {
  id: string;
  payloadEncrypted: string;
  subject: string;
  issuedAt: Date;
  expiresAt: Date | null;
};

describe("createSessionStore", () => {
  let ctx: any;
  let kv: Awaited<ReturnType<typeof createMockProteusSource>>;
  let session: IPylonSession;
  let handle: PylonSessionHandle;
  let mockRepo: Awaited<ReturnType<typeof createMockRepository>>;
  let stored: Record<string, StoredRow>;

  beforeEach(async () => {
    mockRepo = await createMockRepository();

    // The store opens its OWN request-scoped session off the source — `ctx.kv`
    // does not exist yet on the paths that read the session (the session
    // middleware runs before the dependencies middleware; the socket handshake
    // chain never runs it at all).
    kv = await createMockProteusSource();
    kv.session.mockReturnValue({
      repository: vi.fn().mockReturnValue(mockRepo),
    } as any);

    ctx = {
      logger: createMockLogger(),
      state: { metadata: { correlationId: "test-correlation-id" } },
    };

    session = {
      id: "ses_00000000000000000001",
      accessToken: "access-token",
      expiresAt: new Date("2024-06-01T00:00:00.000Z"),
      idToken: "id-token",
      issuedAt: new Date("2024-01-01T00:00:00.000Z"),
      refreshToken: "refresh-token",
      scope: ["openid", "profile", "email", "offline_access"],
      subject: "usr_00000000000000000001",
    };

    handle = { id: session.id, sec: createSessionSecret() };

    // The repository actually STORES, so `get` reads back what `set` wrote
    // instead of a fixture. The read side clones, the way a real driver hydrates
    // a fresh entity per read.
    stored = {};

    (mockRepo.upsert as Mock).mockImplementation(async (entity: StoredRow) => {
      stored[entity.id] = entity;
      return entity;
    });

    (mockRepo.findOne as Mock).mockImplementation(async ({ id }: { id: string }) =>
      stored[id] ? structuredClone(stored[id]) : null,
    );

    (mockRepo.delete as Mock).mockResolvedValue(undefined);
  });

  /** The row `set` actually handed the repository. */
  const upsertedRow = (): StoredRow =>
    ((mockRepo.upsert as Mock).mock.calls.at(-1) as [StoredRow])[0];

  test("should resolve undefined when no options", () => {
    expect(createSessionStore(kv)).toBeUndefined();
  });

  /**
   * NO store when there is no `kv` source — that is what makes the session
   * cookie-only. A store that exists with nowhere to write would be write-only:
   * the caller would put a handle in the cookie and never read a session back.
   * `undefined` is what tells the session middleware to put the whole session
   * object in the cookie instead.
   */
  test("should resolve undefined when no kv source is configured", () => {
    expect(createSessionStore(undefined, SESSION)).toBeUndefined();
  });

  describe("at rest", () => {
    /**
     * ⚠ The point of the whole design. A kv dump must yield an id, a subject, two
     * timestamps and an opaque blob — nothing else. Asserted on the ROW the store
     * handed the repository, not on what `get` answers, because `get` is the one
     * thing that is supposed to see plaintext.
     */
    test("stores no token material and no scope", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      const row = upsertedRow();

      expect(Object.keys(row).sort()).toEqual([
        "expiresAt",
        "id",
        "issuedAt",
        "payloadEncrypted",
        "subject",
      ]);

      // The blob is opaque: no token, no scope value, survives anywhere in it.
      for (const secret of [
        "access-token",
        "id-token",
        "refresh-token",
        "openid",
        "offline_access",
      ]) {
        expect(row.payloadEncrypted).not.toContain(secret);
      }

      expect(AesKit.isAesString(row.payloadEncrypted)).toBe(true);
    });

    test("keeps the four holder-less columns readable", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      const row = upsertedRow();

      expect(row.id).toBe(session.id);
      expect(row.subject).toBe(session.subject);
      expect(row.issuedAt).toEqual(session.issuedAt);
      expect(row.expiresAt).toEqual(session.expiresAt);
    });

    /**
     * ⚠ `set` seals into a NEW record and never writes to its argument.
     *
     * It is handed `ctx.state.session` — the live session for the request — and
     * `ctx.auth.introspect()` / `.userinfo()` read `ctx.state.session.accessToken`
     * lazily, in the handler that runs after it. Sealing in place made those
     * reads answer with the ciphertext, which pylon then presented to the
     * provider as a bearer credential.
     */
    test("leaves the caller's session object untouched", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      expect(session.accessToken).toBe("access-token");
      expect(session.idToken).toBe("id-token");
      expect(session.refreshToken).toBe("refresh-token");
      expect(session.scope).toEqual(["openid", "profile", "email", "offline_access"]);

      expect(upsertedRow()).not.toBe(session);
    });

    // The secret is NOT stored, in any form: no copy, no digest. That is what
    // makes the dump inert — there is nothing to grind offline.
    test("stores nothing derived from the handle secret", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      expect(JSON.stringify(upsertedRow())).not.toContain(handle.sec);
    });
  });

  describe("round trip", () => {
    test("reads back exactly what was written", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      await expect(store!.get(ctx, handle)).resolves.toEqual(session);
    });

    // No id token, no refresh token — the two optional members must come back
    // ABSENT, not as `undefined` keys standing beside a session that has none.
    test("omits the optional tokens the session never had", async () => {
      const store = createSessionStore(kv, SESSION);

      const minimal: IPylonSession = {
        id: "ses_00000000000000000002",
        accessToken: "access-token",
        expiresAt: null,
        issuedAt: new Date("2024-01-01T00:00:00.000Z"),
        scope: [],
        subject: "usr_00000000000000000002",
      };
      const minimalHandle = { id: minimal.id, sec: createSessionSecret() };

      await store!.set(ctx, minimalHandle, minimal);

      const read = await store!.get(ctx, minimalHandle);

      expect(read).toEqual(minimal);
      expect(read).not.toHaveProperty("idToken");
      expect(read).not.toHaveProperty("refreshToken");
    });

    // A second `get` in another process re-derives the SAME key from the SAME
    // secret. The kid is deterministic only because the derivation names a path.
    test("re-derives the key from the secret alone", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      const row = upsertedRow();
      const reopened = sessionRecordKit(handle.sec).decrypt<any>(row.payloadEncrypted);

      expect(reopened.accessToken).toBe("access-token");
      expect(AesKit.parse(row.payloadEncrypted).keyId).toBe(
        sessionRecordKit(handle.sec).kryptos.id,
      );
    });

    test("answers null for a row that is not there", async () => {
      const store = createSessionStore(kv, SESSION);

      await expect(store!.get(ctx, handle)).resolves.toBeNull();
    });
  });

  describe("the decrypt IS the authentication", () => {
    /**
     * ⚠ No digest is stored and none is compared. A wrong `sec` derives a wrong
     * key and the AES-GCM tag refuses it — and the outcome is `null`, not a
     * throw: a holder-key failure is a CLIENT fact, so the middleware clears the
     * cookie and the request proceeds unauthenticated.
     */
    test("answers null — never a throw, never a partial read — for a wrong secret", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      const wrong = { id: handle.id, sec: createSessionSecret() };

      await expect(store!.get(ctx, wrong)).resolves.toBeNull();
    });

    // It is the AEAD TAG that refuses it, not a key lookup, a kid comparison or a
    // shape check — `decryptAes` never inspects the ciphertext's kid, so the only
    // thing standing between a wrong secret and the plaintext is the GCM tag.
    test("refuses it on the GCM tag", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      await store!.get(ctx, { id: handle.id, sec: createSessionSecret() });

      const [message, data] = (ctx.logger.warn as Mock).mock.calls[0];

      expect(message).toBe("Stored session did not open with the presented key");
      expect(data.error.name).toBe("AesError");
      expect(data.error.code).toBe("decryption_failed");
      expect(data.error.errors).toEqual([
        "Error: Unsupported state or unable to authenticate data",
      ]);
    });

    // The same tag refuses a tampered blob under the RIGHT secret.
    test("answers null for a tampered ciphertext", async () => {
      const store = createSessionStore(kv, SESSION);

      await store!.set(ctx, handle, session);

      const row = stored[handle.id]!;
      const bytes = Buffer.from(row.payloadEncrypted.slice(4), "base64url");
      bytes[bytes.length - 5] ^= 0xff;
      row.payloadEncrypted = `aes:${bytes.toString("base64url")}`;

      await expect(store!.get(ctx, handle)).resolves.toBeNull();
    });

    /**
     * ⚠ The ciphertext↔row binding, and the reason it is stated in the PLAINTEXT
     * rather than passed as an `aad`: `AesKit`'s caller `aad` is a silent no-op in
     * cbor mode (verified — a value sealed WITH an `aad` decrypts with none, and
     * with a different one), so an `aad` would look like a binding and be none.
     *
     * Two rows sealed under the SAME secret, blobs swapped. The decrypt succeeds —
     * only the `payload.id === row.id` assert can refuse this.
     */
    test("answers null when the payload names a different row", async () => {
      const store = createSessionStore(kv, SESSION);

      const sec = createSessionSecret();
      const first = { id: "ses_first", sec };
      const second = { id: "ses_second", sec };

      await store!.set(ctx, first, { ...session, id: first.id });
      await store!.set(ctx, second, { ...session, id: second.id });

      // The blob from the SECOND row, moved onto the FIRST.
      stored[first.id]!.payloadEncrypted = stored[second.id]!.payloadEncrypted;

      // The decrypt itself succeeds — proving the assert, not the tag, refuses it.
      expect(
        sessionRecordKit(sec).decrypt<any>(stored[first.id]!.payloadEncrypted).id,
      ).toBe(second.id);

      await expect(store!.get(ctx, first)).resolves.toBeNull();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        "Stored session payload names a different record",
        { sessionId: first.id, payloadId: second.id },
      );
    });
  });

  describe("destructive writes need no holder", () => {
    // `ctx.session.del()` deletes by id. Destroying a session must not require
    // opening it.
    test("deletes by id", async () => {
      const store = createSessionStore(kv, SESSION);

      await expect(store!.del(ctx, session.id)).resolves.toBeUndefined();

      expect(mockRepo.delete).toHaveBeenCalledWith({ id: session.id });
    });

    // Back-channel logout is server-to-server with NO cookie in hand at all, so
    // `subject` is the one column that cannot be sealed.
    test("logs out by subject", async () => {
      const store = createSessionStore(kv, SESSION);

      await expect(store!.logout(ctx, session.subject)).resolves.toBeUndefined();

      expect(mockRepo.delete).toHaveBeenCalledWith({ subject: session.subject });
    });
  });
});
