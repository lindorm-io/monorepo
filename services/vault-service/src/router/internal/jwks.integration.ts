import MockDate from "mockdate";
import request from "supertest";
import { getTestClientCredentials, setupIntegration } from "../../test/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/internal/jwks", () => {
  beforeAll(setupIntegration);

  test("GET /internal/jwks", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get("/internal/jwks")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      keys: [
        {
          alg: "ES512",
          allowed_from: 1577869200,
          created_at: 1577865600,
          crv: "P-521",
          expires_at: 1641024000,
          key_ops: ["sign", "verify"],
          kid: expect.any(String),
          kty: "EC",
          use: "sig",
          x: "AHxwF8PAKLjUbiRVbhXdjzqcgwwLKljN87yBiOlLT3WXGQyChNFLcszWnrkpB/AGiWtYh1Wtts4gsBJ/Tp9CwfDm",
          y: "AS3iydW4wE74tLql6xf28DxBPUuNfvlerYiectjVVOh42bGS4z6gNmCoc5jDN9SG77NloDkC4SSo+LjtMD2IJJhV",
        },
      ],
    });
  });

  test("GET /internal/jwks/private", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get("/internal/jwks/private")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      keys: [
        {
          alg: "ES512",
          allowed_from: 1577869200,
          created_at: 1577865600,
          crv: "P-521",
          expires_at: 1641024000,
          key_ops: ["sign", "verify"],
          kid: expect.any(String),
          kty: "EC",
          use: "sig",
          d: "ARpmu8RmaWgJ4BV395iRdyMWXw6SPusFOeuCvnnocV9dOL+nWXrY0nzMdK77GF/7OnDtj9xhO0feVcVhJPn+BF9K",
          x: "AHxwF8PAKLjUbiRVbhXdjzqcgwwLKljN87yBiOlLT3WXGQyChNFLcszWnrkpB/AGiWtYh1Wtts4gsBJ/Tp9CwfDm",
          y: "AS3iydW4wE74tLql6xf28DxBPUuNfvlerYiectjVVOh42bGS4z6gNmCoc5jDN9SG77NloDkC4SSo+LjtMD2IJJhV",
        },
      ],
    });
  });
});
