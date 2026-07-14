// Encryption key selection — end to end through a real ProteusSource, a real
// sqlite database and a REAL Amphora (a mocked `find` is exactly why this class
// of bug survives).
//
// The vault mirrors a pylon deployment: TWO internal encryption keys, where the
// wrong one — the yearly-rotated `dir` cookie key — is the NEWER of the two.
// Amphora sorts newest-first, so an unscoped lookup lands on the cookie key and
// the database gets encrypted with the cookie-signing key. Every test below
// turns on that fact; the ciphertext's own kid is read straight out of the
// column to prove which key actually did the work.

import { parseAes } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Constructor } from "@lindorm/types";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { Encrypted } from "../../decorators/Encrypted.js";
import { Entity } from "../../decorators/Entity.js";
import { Field } from "../../decorators/Field.js";
import { Generated } from "../../decorators/Generated.js";
import { PrimaryKeyField } from "../../decorators/PrimaryKeyField.js";
import { ProteusError } from "../../errors/index.js";
import type { IEntity } from "../../interfaces/index.js";
import type { SqliteQueryClient } from "../drivers/sqlite/types/sqlite-query-client.js";
import type { ProteusEncryptionKey } from "../../types/encryption.js";
import { afterEach, describe, expect, test } from "vitest";

const ISSUER = "https://test.proteus/";

/** Minted once, at scaffold. */
const KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: ISSUER,
  purpose: "pylon:kek",
});

/** Rotated yearly — so it is the NEWER key, and an unscoped lookup prefers it. */
const COOKIE_KEY = KryptosKit.generate.enc.oct({
  algorithm: "dir",
  encryption: "A256GCM",
  issuer: ISSUER,
  purpose: "cookie",
});

/** A KEK imported from the environment. Deliberately never added to the vault. */
const ENV_KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  issuer: ISSUER,
  purpose: "env:kek",
});

const SIG_KEY = KryptosKit.generate.sig.oct({ algorithm: "HS256", issuer: ISSUER });

@Entity({ name: "bare_encrypted" })
class BareEncrypted implements IEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted()
  @Field("string")
  secret!: string;
}

@Entity({ name: "scoped_encrypted" })
class ScopedEncrypted implements IEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted({ predicate: { purpose: "pylon:kek" } })
  @Field("string")
  secret!: string;
}

@Entity({ name: "injected_encrypted" })
class InjectedEncrypted implements IEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted({ kryptos: ENV_KEK })
  @Field("string")
  secret!: string;
}

@Entity({ name: "sig_key_encrypted" })
class SigKeyEncrypted implements IEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Encrypted({ kryptos: SIG_KEY })
  @Field("string")
  secret!: string;
}

/** The pylon vault: the KEK, plus the newer cookie key. */
const createVault = (): IAmphora => {
  const vault = new Amphora({ logger: createMockLogger() });
  vault.add(KEK);
  vault.add(COOKIE_KEY);
  return vault;
};

let amphora: IAmphora;
let source: ProteusSource | undefined;

const createSource = async (
  entities: Array<Constructor<IEntity>>,
  encryption?: ProteusEncryptionKey,
): Promise<ProteusSource> => {
  amphora = createVault();

  source = new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities,
    logger: createMockLogger(),
    synchronize: true,
    amphora,
    encryption,
  });

  await source.connect();
  await source.setup();

  return source;
};

/** The ciphertext as it sits in the column, before hydration decrypts it. */
const storedCipher = async (
  src: ProteusSource,
  table: string,
  id: string,
): Promise<string> => {
  const client = await src.client<SqliteQueryClient>();
  const row = client.get(`SELECT secret FROM "${table}" WHERE id = ?`, [id]);
  return row?.secret as string;
};

afterEach(async () => {
  await source?.disconnect();
  source = undefined;
});

describe("encryption key selection", () => {
  test("should sort the cookie key ahead of the KEK — the hazard these tests defend", () => {
    expect(COOKIE_KEY.createdAt.getTime()).toBeGreaterThanOrEqual(
      KEK.createdAt.getTime(),
    );
  });

  test("should throw at source load when a bare @Encrypted names no key", async () => {
    await expect(createSource([BareEncrypted])).rejects.toThrow(ProteusError);
    await expect(createSource([BareEncrypted])).rejects.toThrow(
      /bare_encrypted.*"secret".*names no encryption key/,
    );
  });

  test("should select the key the decorator names, not the newer cookie key", async () => {
    const src = await createSource([ScopedEncrypted]);
    const repository = src.repository(ScopedEncrypted);

    const created = await repository.insert(
      repository.create({ secret: "at rest" }) as ScopedEncrypted,
    );

    const cipher = await storedCipher(src, "scoped_encrypted", created.id);
    expect(parseAes(cipher).keyId).toBe(KEK.id);
    expect(parseAes(cipher).keyId).not.toBe(COOKIE_KEY.id);

    const found = await repository.findOne({ id: created.id });
    expect(found?.secret).toBe("at rest");
  });

  test("should use the source-level default when the decorator is bare", async () => {
    const src = await createSource([BareEncrypted], {
      predicate: { purpose: "pylon:kek" },
    });
    const repository = src.repository(BareEncrypted);

    const created = await repository.insert(
      repository.create({ secret: "defaulted" }) as BareEncrypted,
    );

    const cipher = await storedCipher(src, "bare_encrypted", created.id);
    expect(parseAes(cipher).keyId).toBe(KEK.id);

    const found = await repository.findOne({ id: created.id });
    expect(found?.secret).toBe("defaulted");
  });

  test("should let a decorator descriptor override the source-level default", async () => {
    const src = await createSource([ScopedEncrypted], {
      predicate: { purpose: "cookie" },
    });
    const repository = src.repository(ScopedEncrypted);

    const created = await repository.insert(
      repository.create({ secret: "scoped" }) as ScopedEncrypted,
    );

    const cipher = await storedCipher(src, "scoped_encrypted", created.id);
    expect(parseAes(cipher).keyId).toBe(KEK.id);
    expect(parseAes(cipher).keyId).not.toBe(COOKIE_KEY.id);
  });

  test("should use the source-level kryptos when the decorator is bare", async () => {
    const src = await createSource([BareEncrypted], { kryptos: ENV_KEK });
    const repository = src.repository(BareEncrypted);

    const created = await repository.insert(
      repository.create({ secret: "env" }) as BareEncrypted,
    );

    const cipher = await storedCipher(src, "bare_encrypted", created.id);
    expect(parseAes(cipher).keyId).toBe(ENV_KEK.id);

    const found = await repository.findOne({ id: created.id });
    expect(found?.secret).toBe("env");
  });

  // The sharp edge: ENV_KEK is NOT a vault resident. It must encrypt AND decrypt.
  test("should encrypt and decrypt with an injected key that is absent from the vault", async () => {
    const src = await createSource([InjectedEncrypted]);
    const repository = src.repository(InjectedEncrypted);

    const created = await repository.insert(
      repository.create({ secret: "injected" }) as InjectedEncrypted,
    );

    const cipher = await storedCipher(src, "injected_encrypted", created.id);
    expect(parseAes(cipher).keyId).toBe(ENV_KEK.id);
    expect(() => amphora.findByIdSync(ENV_KEK.id)).toThrow();

    const found = await repository.findOne({ id: created.id });
    expect(found?.secret).toBe("injected");
  });

  test("should throw when an injected key violates the encryption floor", async () => {
    const src = await createSource([SigKeyEncrypted]);
    const repository = src.repository(SigKeyEncrypted);

    await expect(
      repository.insert(repository.create({ secret: "nope" }) as SigKeyEncrypted),
    ).rejects.toThrow(/violates the encryption floor/);
  });
});
