import MockDate from "mockdate";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../test/data";
import { koa } from "../server/koa";
import { randomUUID } from "crypto";
import {
  getAxiosResponse,
  getTestAccessToken,
  setAxiosResponse,
  setupIntegration,
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

describe("/userinfo", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const identityId = randomUUID();
    const accessToken = await getTestAccessToken({
      subject: identityId,
    });

    setAxiosResponse("get", "identityClient", "/internal/userinfo/:id", TEST_GET_USERINFO_RESPONSE);

    const response = await request(koa.callback())
      .get("/userinfo")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      address: {
        care_of: "careOf",
        country: "country",
        formatted: "streetAddress1\nstreetAddress2\npostalCode locality\nregion\ncountry",
        locality: "locality",
        postal_code: "postalCode",
        region: "region",
        street_address: "streetAddress1\nstreetAddress2",
      },
      birth_date: "2000-01-01",
      display_name: "displayName#8441",
      email: "test@lindorm.io",
      email_verified: true,
      family_name: "familyName",
      gender: "gender",
      given_name: "givenName",
      gravatar_uri: "https://gravatar.url/",
      locale: "sv-SE",
      middle_name: "middleName",
      name: "givenName familyName",
      nickname: "nickname",
      phone_number: "+46705498721",
      phone_number_verified: true,
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "username",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_number: "198056702895",
      sub: "d821cde6-250f-4918-ad55-877a7abf0271",
      updated_at: 1609488000,
      username: "identityUsername",
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });
});
