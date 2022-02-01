import MockDate from "mockdate";
import request from "supertest";
import { ConnectSession, Email } from "../entity";
import { IdentifierType } from "../common";
import { getTestConnectSession, getTestEmail, getTestIdentity } from "../test/entity";
import { koa } from "../server/koa";
import { randomUUID } from "crypto";
import {
  TEST_CONNECT_SESSION_CACHE,
  TEST_EMAIL_REPOSITORY,
  setupIntegration,
  TEST_IDENTITY_REPOSITORY,
  setAxiosResponse,
  getTestAccessToken,
  getAxiosResponse,
} from "../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/axios", () => ({
  ...(jest.requireActual("@lindorm-io/axios") as Record<string, any>),
  Axios: class Axios {
    private readonly name: string;
    public constructor(opts: any) {
      this.name = opts.name;
    }
    public async get(path: string, args: any): Promise<any> {
      return getAxiosResponse("GET", this.name, path, args);
    }
    public async post(path: string, args: any): Promise<any> {
      return getAxiosResponse("POST", this.name, path, args);
    }
  },
}));

describe("/identifiers", () => {
  beforeAll(setupIntegration);

  test("POST /connect", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      getTestIdentity({
        id: randomUUID(),
      }),
    );

    setAxiosResponse("POST", "communicationClient", "/internal/connect-email", {});

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(koa.callback())
      .post(`/identifiers/connect`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: "new-identity-email@lindorm.io",
        identityId: identity.id,
        type: IdentifierType.EMAIL,
      })
      .expect(200);

    await expect(
      TEST_EMAIL_REPOSITORY.find({ email: "new-identity-email@lindorm.io" }),
    ).resolves.toStrictEqual(expect.any(Email));

    await expect(TEST_CONNECT_SESSION_CACHE.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([expect.any(ConnectSession)]),
    );
  });

  test("POST /connect/:id/verify", async () => {
    const email = await TEST_EMAIL_REPOSITORY.create(
      getTestEmail({
        verified: false,
      }),
    );
    const session = await TEST_CONNECT_SESSION_CACHE.create(
      await getTestConnectSession({
        identifier: email.email,
        identityId: email.identityId,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: email.identityId,
    });

    await request(koa.callback())
      .post(`/identifiers/connect/${session.id}/verify`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "secret",
      })
      .expect(200);
  });
});
