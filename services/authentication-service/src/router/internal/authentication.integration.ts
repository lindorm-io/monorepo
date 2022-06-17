import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { getTestData } from "../../fixtures/data";
import { server } from "../../server/server";
import { getTestClientCredentials, setupIntegration } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/authentication", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  test("POST /", async () => {
    const { codeChallengeMethod, codeChallenge, nonce } = getTestData();

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authentication")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        client_id: "64d26e49-c9b2-42a7-86c3-1c0fb045e658",
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        country: "en",
        identity_id: "4c875493-575a-4660-94d6-432787597ea2",
        level_of_assurance: 3,
        login_hint: ["test@lindorm.io", "+46701234567"],
        methods: ["email_otp", "phone_otp", "device_challenge"],
        nonce: nonce,
        redirect_uri: "https://request.redirect.uri/path",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
    });
  });
});
