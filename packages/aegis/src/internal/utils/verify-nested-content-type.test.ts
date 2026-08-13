import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * The NESTED CONTENT-TYPE check in `verify-token.ts` beside this file.
 *
 * RFC 7519 §5.2 makes `cty` a DECLARATION about an encrypted token's plaintext,
 * and a caller routes on it — verify locally, or hand off, or introspect. A
 * declaration that names a nested claims token must therefore be TRUE: an
 * envelope saying "claims inside" whose plaintext is an opaque signature verifies
 * to an EMPTY domain, which a caller routing on the declaration reads as an
 * authenticated credential that happens to assert nothing.
 *
 * ⚠ Not conformance rows, and structurally so: stating this needs TWO artifacts —
 * a signed token, then an encryption AROUND that token with a hand-chosen `cty`.
 * A scenario row builds exactly one artifact (the `Given` tuple enforces it), so
 * there is no way to express "seal this previously-produced token" there.
 *
 * The COSE half of the same lie is refused structurally rather than by this
 * check, so both cases here are JOSE.
 */
describe("the nested content-type declaration on an encrypted token", () => {
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_EC_KEY_ENC);
  });

  const opaqueInner = async (): Promise<string> =>
    (await aegis.jws.sign(Buffer.from("opaque-handle"))).token;

  test("refuses an envelope declaring a nested claims token over an opaque signature", async () => {
    const { token } = await aegis.jwe.encrypt(await opaqueInner(), {
      header: { cty: "JWT" },
    });

    await expect(aegis.verify(token)).rejects.toMatchObject({
      code: "verify_inner_type_mismatch",
    });
  });

  // The honest nesting must keep working, or the check above would be satisfied
  // just as well by refusing every encrypted token with a signed inner — which
  // would break sign-then-encrypt entirely while looking like a security win.
  test("delivers an HONESTLY declared opaque inner", async () => {
    const { token } = await aegis.jwe.encrypt(await opaqueInner(), {
      header: { cty: "text/plain" },
    });

    const verified = await aegis.verify(token);

    expect(verified.format).toBe("jwe");
    expect(verified.inner).toBe("jws");
    expect(verified.claims).toEqual({});
  });
});
