import MockDate from "mockdate";
import request from "supertest";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/.well-known", () => {
  beforeAll(setupIntegration);

  test("GET /jwks.json", async () => {
    const response = await request(server.callback()).get("/.well-known/jwks.json").expect(200);

    expect(response.body).toStrictEqual({
      keys: [
        {
          alg: "ES512",
          allowed_from: 1577865600,
          created_at: 1577865600,
          crv: "P-521",
          expires_at: 1861948800,
          key_ops: ["verify"],
          kid: expect.any(String),
          kty: "EC",
          use: "sig",
          x: "AHxwF8PAKLjUbiRVbhXdjzqcgwwLKljN87yBiOlLT3WXGQyChNFLcszWnrkpB/AGiWtYh1Wtts4gsBJ/Tp9CwfDm",
          y: "AS3iydW4wE74tLql6xf28DxBPUuNfvlerYiectjVVOh42bGS4z6gNmCoc5jDN9SG77NloDkC4SSo+LjtMD2IJJhV",
        },
      ],
    });
  });
});
