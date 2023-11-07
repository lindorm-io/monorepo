import MockDate from "mockdate";
import request from "supertest";
import { server } from "../server/server";
import { setupIntegration } from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/providers", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const response = await request(server.callback())
      .get("/providers")
      .send({
        callback_uri: "https://test.lindorm.io/callback",
        provider: "microsoft",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      providers: ["apple", "google", "microsoft"],
    });
  });
});
