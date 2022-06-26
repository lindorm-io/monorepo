import MockDate from "mockdate";
import { JWT } from "@lindorm-io/jwt";
import { Metric } from "@lindorm-io/koa";
import { ServerError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { jwtMiddleware } from "./jwt-middleware";
import {
  Algorithm,
  KeyPair,
  KeyType,
  Keystore,
  KeystoreError,
  NamedCurve,
  createTestKeystore,
} from "@lindorm-io/key-pair";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("jwtMiddleware", () => {
  let ctx: any;
  let options: any;

  const logger = createMockLogger();

  beforeEach(() => {
    options = {
      issuer: "issuer",
    };

    ctx = {
      keystore: createTestKeystore(),
      metrics: {},
      logger,
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set issuer on context", async () => {
    await expect(jwtMiddleware(options)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.jwt).toStrictEqual(expect.any(JWT));
    expect(ctx.metrics.jwt).toStrictEqual(expect.any(Number));
  });

  test("should throw InvalidKeystoreError", async () => {
    ctx.keystore = undefined;

    await expect(jwtMiddleware(options)(ctx, next)).rejects.toThrow(ServerError);
  });

  test("should throw EmptyKeystoreError", async () => {
    ctx.keystore = new Keystore({
      keys: [
        new KeyPair({
          id: "59c9f0ac-115a-47b1-b635-a85f88729fc7",
          algorithms: [Algorithm.ES512],
          expires: new Date("1980-01-01T00:00:00.000Z"),
          namedCurve: NamedCurve.P521,
          privateKey: "privateKey",
          publicKey: "publicKey",
          type: KeyType.EC,
        }),
      ],
    });

    await expect(jwtMiddleware(options)(ctx, next)).rejects.toThrow(KeystoreError);
  });
});
