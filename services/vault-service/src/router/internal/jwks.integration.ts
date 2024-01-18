import MockDate from "mockdate";
import request from "supertest";
import { getTestClientCredentials, setupIntegration } from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

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
          crv: "P-521",
          d: "AftXcyqeRTv8CEk2iDxwr9cmSzGZdKOgQF4DComwunvIhSPVuGCK2WEyJxw6agP8DXe-uF4pFlrHvY0UcCi2MtNi",
          exp: 4070908800,
          expires_in: 2461420800,
          iat: 1577174400,
          jku: "https://example.com/jwks.json",
          key_ops: ["sign", "verify"],
          kid: "971c8839-af23-545f-8e2b-2f31d3e3af11",
          kty: "EC",
          nbf: 1577836800,
          owner_id: "2ce9eb4b-1088-577e-a065-c3383e7c821f",
          uat: 1577520000,
          use: "sig",
          x: "AXLDVJ0QoP1LPZeiN-OoI9WiKWrlhJmMsGZm1cbbHrJ1FRbdD8gvuR8S0rJwnjbP1SE_hp16_KY0FDgnTb9jH-Oz",
          y: "AZwox6nbyvzbmRQTrgtuxRzxvj-mAocRfZtH2fVXDm4lFYS08pUFd5X12TQPUj_X-INglGRzc7BnX4xhY3fWLmu2",
        },
      ],
    });
  });
});
