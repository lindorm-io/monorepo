import { KryptosKit } from "@lindorm/kryptos";
import MockDate from "mockdate";
import { conduitSignedRequestMiddleware } from "./conduit-signed-request-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("conduitSignedRequestMiddleware", () => {
  let ctx: any;
  let kryptos: any;

  beforeEach(() => {
    kryptos = KryptosKit.from.b64({
      id: "5d17c551-7b6f-474a-8679-dba9bbfa06a2",
      algorithm: "ES256",
      curve: "P-256",
      privateKey:
        "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcyOxjn7CekTvSkiQvqx5JhFOmwPYFVFHmLKfio6aJ1uhRANCAAQfFaJkGZMxDn656YiDrSJ5sLRwip-y3a0VzC4cUPxxAJzuRBRtVqM3GitfTQEiUrzF2pcmMZbteAOhIqLlU_f6",
      publicKey:
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxWiZBmTMQ5-uemIg60iebC0cIqfst2tFcwuHFD8cQCc7kQUbVajNxorX00BIlK8xdqXJjGW7XgDoSKi5VP3-g",
      purpose: "token",
      type: "EC",
      use: "sig",
    });

    ctx = {
      req: {
        body: {
          foo: "bar",
          baz: 42,
          random: "l9065hpUGzFsspO1",
        },
        headers: {
          date: new Date().toUTCString(),
          "x-test-one": "one",
          "x-test-two": "two",
          "x-test-three": "three",
        },
      },
    };
  });

  test("should add digest and signature headers to the request", async () => {
    await expect(
      conduitSignedRequestMiddleware({ kryptos })(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers.digest).toMatch(
      /^algorithm="SHA256"; encoding="base64url"; hash="[a-zA-Z0-9_-]+"/,
    );
    expect(ctx.req.headers.signature).toMatch(
      /^encoding="base64url"; headers="date,x-test-one,x-test-two,x-test-three,digest"; key="5d17c551-7b6f-474a-8679-dba9bbfa06a2"; hash="[a-zA-Z0-9_-]+"$/,
    );
  });
});
