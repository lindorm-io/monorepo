import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import type { TokenProfileInput } from "../../types/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

/**
 * THE DIRECTION A PROFILE IS DECLARED FOR, on the READ side.
 *
 * A profile states `use` once instead of marking every policy field with the
 * direction it applies in. `"both"` is the default and is what every existing
 * profile keeps; only a deliberate narrowing changes anything. The verify-only
 * half of the rule — a profile that refuses to MINT — is stated in the
 * conformance table against `external_access_token`, a real built-in.
 *
 * ⚠ THIS half cannot be a row: no built-in profile is mint-only, so stating it
 * needs `registerProfile`, and the scenario table has no step for registering a
 * profile — the deployments it describes are built from settings and a vault.
 * Beside `verify-token.ts`, which raises the refusal, is where it belongs.
 */
const MINT_ONLY: TokenProfileInput = {
  name: "mint_only_test_profile",
  use: "mint",
  typ: { presence: "none" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["subject", "audience", "expiresAt"],
    },
  ],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: "1h",
  encryptable: false,
};

const CONTENT = { subject: "user-1", audience: [RESOURCE], expires: "1h" as const };

describe("a profile declared for minting only", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);

    aegis.registerProfile(MINT_ONLY);
  });

  // The control. Without it every refusal below would hold just as well over a
  // profile that could not be used in either direction.
  test("mints", async () => {
    await expect(aegis.mint("mint_only_test_profile", CONTENT)).resolves.toMatchObject({
      format: "jwt",
    });
  });

  /**
   * A profile used in a direction it was not written for applies rules chosen
   * for the other one. Here that means enforcing a MINT-side policy against a
   * token that arrived — which either refuses conformant tokens or, worse,
   * accepts on the strength of a rule that was only ever about our own output.
   * The refusal names the profile and its declared direction, so an operator
   * reading the error learns which of the two to change.
   */
  test.each(["jwt", "cwt"] as const)(
    "is refused by a profiled verify on the %s wire",
    async (format) => {
      const { token } = await aegis.mint("mint_only_test_profile", CONTENT, { format });

      await expect(
        aegis.verify("mint_only_test_profile", token, undefined, {
          audience: RESOURCE,
        }),
      ).rejects.toMatchObject({
        code: "profile_not_verifiable",
        data: { profile: "mint_only_test_profile", use: "mint" },
      });
    },
  );

  // The DEFAULT is what keeps every other profile — built-in and
  // consumer-registered — usable in both directions. A narrowing that leaked
  // into the default would break every deployment that never stated one.
  test("a profile registered without a direction defaults to both", async () => {
    const { name: _name, use: _use, ...rest } = MINT_ONLY;

    aegis.registerProfile({ ...rest, name: "unmarked_test_profile" });

    const { token } = await aegis.mint("unmarked_test_profile", CONTENT);

    await expect(
      aegis.verify("unmarked_test_profile", token, undefined, { audience: RESOURCE }),
    ).resolves.toMatchObject({ claims: { subject: "user-1" } });
  });
});
