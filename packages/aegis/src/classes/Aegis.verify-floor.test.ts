import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { JwtError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { beforeEach, describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

describe("Aegis profiled verify floor (§4.4)", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  const mintAccessToken = () =>
    aegis.mint("access_token", {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
    });

  test("accepts a token whose aud contains the verifier identity", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, { audience: RESOURCE }),
    ).resolves.toMatchObject({
      payload: { subject: "user-1" },
    });
  });

  test("rejects when aud does not contain the verifier identity", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, { audience: "https://wrong-rs" }),
    ).rejects.toThrow(JwtError);
  });

  test("rejects a wrong issuer", async () => {
    const { token } = await mintAccessToken();

    await expect(
      aegis.verify("access_token", token, {
        audience: RESOURCE,
        issuer: "https://not-the-issuer/",
      }),
    ).rejects.toThrow(JwtError);
  });

  test("rejects a typ mismatch (id_token verified as access_token)", async () => {
    const { token } = await aegis.mint("id_token", {
      subject: "user-1",
      audience: [RESOURCE],
    });

    await expect(
      aegis.verify("access_token", token, { audience: RESOURCE }),
    ).rejects.toThrow(JwtError);
  });
});
