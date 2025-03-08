import { Aegis } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { KryptosAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import { PylonSession } from "../../types";
import { decodeCookieValue, encodeCookieValue } from "./cookie";

describe("cookie", () => {
  let ctx: any;

  beforeAll(() => {
    const amphora = new Amphora({
      issuer: "issuer",
      logger: createMockLogger(),
    });

    amphora.add(KryptosKit.make.auto({ algorithm: "A128KW", issuer: "issuer" }));

    const aegis = new Aegis({
      amphora,
      logger: createMockLogger(),
    });

    ctx = {
      amphora,
      aegis,
    };
  });

  test("should encode cookie value", async () => {
    const cookie = await encodeCookieValue(ctx, "test");

    expect(B64.decode(cookie)).toEqual("test");
  });

  test("should encode encrypted cookie value", async () => {
    const cookie = await encodeCookieValue(ctx, "test", { encrypted: true });

    expect(Aegis.isJwe(cookie)).toEqual(true);

    const [kryptos] = await ctx.amphora.filter({ algorithm: "A128KW" });

    expect(Aegis.header(cookie)).toEqual({
      alg: "A128KW",
      crit: ["alg", "enc", "hkdf_salt"],
      cty: "text/plain",
      enc: "A256GCM",
      hkdf_salt: expect.any(String),
      kid: kryptos.id,
      oid: expect.any(String),
      typ: "JWE",
    });
  });

  test("should decode cookie value", async () => {
    await expect(decodeCookieValue(ctx, "dGVzdA")).resolves.toEqual("test");
  });

  test("should decode cookie value as array", async () => {
    await expect(decodeCookieValue(ctx, "WyJoZWxsbyJd")).resolves.toEqual(["hello"]);
  });

  test("should decode cookie value as record", async () => {
    await expect(decodeCookieValue(ctx, "eyJoZWxsbyI6ImhlbGxvIn0")).resolves.toEqual({
      hello: "hello",
    });
  });

  test("should decode encrypted cookie value", async () => {
    const cookie = await encodeCookieValue(ctx, "test", { encrypted: true });

    await expect(decodeCookieValue(ctx, cookie)).resolves.toEqual("test");
  });

  describe("session algorithms", () => {
    const algorithms: Array<KryptosAlgorithm> = [
      "A128GCMKW",
      "A128KW",
      "A192GCMKW",
      "A192KW",
      "A256GCMKW",
      "A256KW",
      "dir",
      "ECDH-ES",
      "ECDH-ES+A128GCMKW",
      "ECDH-ES+A128KW",
      "ECDH-ES+A192GCMKW",
      "ECDH-ES+A192KW",
      "ECDH-ES+A256GCMKW",
      "ECDH-ES+A256KW",
      "PBES2-HS256+A128KW",
      "PBES2-HS384+A192KW",
      "PBES2-HS512+A256KW",
      "RSA-OAEP-256",
      "RSA-OAEP-384",
      "RSA-OAEP-512",
      "RSA-OAEP",
    ];

    test.each(algorithms)(
      "should encrypt and decrypt data using %s",
      async (algorithm) => {
        const amphora = new Amphora({
          issuer: "issuer",
          logger: createMockLogger(),
        });

        amphora.add(KryptosKit.make.auto({ algorithm, issuer: "issuer" }));

        const aegis = new Aegis({
          amphora,
          logger: createMockLogger(),
        });

        ctx = {
          amphora,
          aegis,
        };

        const session: PylonSession = {
          id: "4648186c-147a-5201-a0f7-1f377ad72862",
          accessToken: "access_token",
          idToken: "id_token",
          refreshToken: "refresh_token",
        };

        const cookie = await encodeCookieValue(ctx, session, { encrypted: true });

        await expect(decodeCookieValue(ctx, cookie)).resolves.toEqual(session);
      },
    );
  });
});
