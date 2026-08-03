// The mocks encrypt for REAL — there is no plaintext shortcut — so a mock with
// no vault cannot serve an @Encrypted entity at all. These tests pin both halves
// of that: the minted default makes an encrypted entity work untouched, and a
// caller-supplied amphora keeps its own key policy, failures included.

import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test, vi } from "vitest";
import { Encrypted } from "../decorators/Encrypted.js";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { Generated } from "../decorators/Generated.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import type { IEntity } from "../interfaces/index.js";
import { createMockProteusVault, MOCK_KEK_PURPOSE } from "./create-mock-proteus-vault.js";
import {
  createMockProteusSession,
  createMockProteusSource,
  createMockRepository,
} from "./vitest.js";

const OWN_KEK_PURPOSE = "test:own:kek";

// Bare @Encrypted — it names no key itself, so it leans entirely on the
// source-level default. The tyr shape (`Client.secretEncrypted`).
@Entity({ name: "MockVaultSecret" })
class Secret implements IEntity {
  @PrimaryKeyField() @Generated("string") id!: string;

  @Encrypted() @Field("string") secret!: string;
}

const createOwnVault = () => {
  const amphora = new Amphora({ logger: createMockLogger() });

  amphora.add(
    KryptosKit.generate.enc.oct({
      algorithm: "A256KW",
      issuer: "https://test.proteus/",
      purpose: OWN_KEK_PURPOSE,
    }),
  );

  return amphora;
};

describe("createMockProteusVault", () => {
  test("should mint a KEK the default selector finds", () => {
    const { amphora, encryption } = createMockProteusVault(createMockLogger());
    const kryptos = amphora.findSync({ purpose: MOCK_KEK_PURPOSE, publish: false });

    expect(encryption).toEqual({ condition: { purpose: MOCK_KEK_PURPOSE } });

    // The encryption floor: an at-rest key must seal AND unseal, and be usable now.
    expect(kryptos.use).toBe("enc");
    expect(kryptos.hasPrivateKey).toBe(true);
    expect(kryptos.isActive).toBe(true);
    // A KEK never belongs in a published JWKS.
    expect(kryptos.publish).toBe(false);
  });
});

describe("mock encryption", () => {
  describe("default vault", () => {
    test("should round-trip an @Encrypted field through a mock repository", async () => {
      const repo = await createMockRepository(Secret);
      const inserted = await repo.insert({ secret: "s3cr3t" } as any);

      expect(await repo.findOneOrFail({ id: inserted.id } as any)).toMatchObject({
        secret: "s3cr3t",
      });
    });

    test("should round-trip an @Encrypted field through a mock session", async () => {
      const session = await createMockProteusSession({ entities: [Secret] });
      const repo = session.repository(Secret);
      const inserted = await repo.insert({ secret: "session-secret" } as any);

      expect(await repo.findOneOrFail({ id: inserted.id } as any)).toMatchObject({
        secret: "session-secret",
      });
    });

    test("should round-trip an entity the session never registered", async () => {
      // The consumer shape that broke: a framework-provided session (pylon's
      // `ctx.db`) is built with NO `entities`, and the test reaches for a
      // repository directly. The encryption default is applied when metadata
      // RESOLVES, not only at setup, so a lazily-used entity still gets a key.
      const session = await createMockProteusSession();
      const repo = session.repository(Secret);
      const inserted = await repo.insert({ secret: "lazy-secret" } as any);

      expect(await repo.findOneOrFail({ id: inserted.id } as any)).toMatchObject({
        secret: "lazy-secret",
      });
    });

    test("should round-trip an @Encrypted field through a mock source", async () => {
      const source = await createMockProteusSource({ entities: [Secret] });
      const repo = source.repository(Secret);
      const inserted = await repo.insert({ secret: "source-secret" } as any);

      expect(await repo.findOneOrFail({ id: inserted.id } as any)).toMatchObject({
        secret: "source-secret",
      });
    });
  });

  describe("caller-supplied vault", () => {
    test("should seal with the caller's key, not a minted default", async () => {
      const amphora = createOwnVault();
      const findSpy = vi.spyOn(amphora, "findSync");

      const repo = await createMockRepository(Secret, {
        amphora,
        encryption: { condition: { purpose: OWN_KEK_PURPOSE } },
      });

      const inserted = await repo.insert({ secret: "own-key" } as any);

      // The vault the source actually encrypted through — a round-trip alone
      // cannot tell whose key did the work, the resolved kid can.
      const selected = findSpy.mock.results
        .filter((result) => result.type === "return")
        .map((result) => (result.value as { purpose: string | null }).purpose);

      expect(selected.length).toBeGreaterThan(0);
      for (const purpose of selected) {
        expect(purpose).toBe(OWN_KEK_PURPOSE);
      }

      expect(await repo.findOneOrFail({ id: inserted.id } as any)).toMatchObject({
        secret: "own-key",
      });

      findSpy.mockRestore();
    });

    test("should keep the source-load failure when the caller names no key", async () => {
      // The default `encryption` rides with the MINTED vault only. Bring your own
      // amphora and an unnamed @Encrypted field fails exactly as in production —
      // the mock does not paper over a missing key policy.
      await expect(
        createMockRepository(Secret, { amphora: createOwnVault() }),
      ).rejects.toThrow(/MockVaultSecret.*"secret".*names no encryption key/);
    });
  });
});
