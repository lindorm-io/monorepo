import MockDate from "mockdate";
import request from "supertest";
import { Identity } from "../../entity";
import { randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import {
  TEST_IDENTITY_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identity", () => {
  beforeAll(setupIntegration);

  test("PATCH /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(new Identity({}));

    const username = randomString(16);

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .patch("/identity")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        birth_date: "2010-01-01",
        family_name: "new_familyName",
        gender: "new_gender",
        given_name: "new_givenName",
        locale: "en-GB",
        middle_name: "new_middleName",
        nickname: "new_nickname",
        picture: "https://picture.url/new/",
        profile: "https://profile.url/new/",
        username,
        website: "https://website.url/new/",
        zone_info: "Europe/Berlin",
      })
      .expect(204);
  });
});
