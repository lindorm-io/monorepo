import MockDate from "mockdate";
import request from "supertest";
import { RdcSessionMode } from "../../common";
import { getRandomString } from "@lindorm-io/core";
import { getTestDeviceLink } from "../../test/entity";
import { koa } from "../../server/koa";
import {
  TEST_DEVICE_REPOSITORY,
  clearAxios,
  getAxiosResponse,
  getTestClientCredentials,
  setAxiosResponse,
  setupIntegration,
} from "../../test/integration";

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

describe("/internal/rdc", () => {
  beforeAll(setupIntegration);
  afterEach(clearAxios);

  test("POST /", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(await getTestDeviceLink());

    await TEST_DEVICE_REPOSITORY.create(
      await getTestDeviceLink({
        identityId: deviceLink.identityId,
        deviceMetadata: {
          ...deviceLink.deviceMetadata,
          macAddress: "E1:9A:09:75:46:93",
        },
        name: "My Xperia 7",
      }),
    );

    const clientCredentials = getTestClientCredentials();

    setAxiosResponse("POST", "communicationClient", "/internal/socket/emit", {});

    const response = await request(koa.callback())
      .post("/internal/rdc")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        client_id: "7bb4396b-5bad-4e6e-8edb-4f0f3c20e902",
        confirm_payload: { confirm: true },
        confirm_uri: "https://callback.uri/confirm",
        identity_id: deviceLink.identityId,
        mode: RdcSessionMode.PUSH_NOTIFICATION,
        nonce: getRandomString(16),
        reject_payload: { reject: true },
        reject_uri: "https://callback.uri/reject",
        scopes: ["scope"],
        template_name: "rdcSession_template",
        template_parameters: { template: true },
        token_payload: { token: true },
      })
      .expect(202);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      expires_in: 900,
    });
  });
});
