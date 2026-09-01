import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import { Pylon } from "./Pylon.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("Pylon jwks", () => {
  let key: IKryptos;
  let pylon: Pylon;

  beforeAll(async () => {
    const logger = createMockLogger();

    const amphora: IAmphora = new Amphora({
      internal: { issuer: "http://test.lindorm.io" },
      logger,
    });

    key = KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      certificate: { mode: "self-signed" },
      publish: true,
      purpose: "token",
    });

    amphora.add(key);

    pylon = new Pylon({
      amphora,
      logger,
      environment: "test",
      name: "@lindorm/pylon",
      version: "0.0.1",
    });

    await pylon.setup();
  });

  test("the published jwk carries x5t#S256 verbatim", async () => {
    const response = await loopback
      .request(pylon.callback)
      .get("/.well-known/jwks.json")
      .expect(200);

    expect(response.body.keys).toHaveLength(1);
    expect(response.body.keys[0]["x5t#S256"]).toBe(key.certificateThumbprint);
    expect(response.body.keys[0].x5c).toEqual([expect.any(String)]);
    expect(Object.keys(response.body.keys[0])).not.toContain("x5t_s256");
  });
});
