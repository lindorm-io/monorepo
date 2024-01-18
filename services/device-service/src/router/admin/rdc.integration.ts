import { RdcSessionMode } from "@lindorm-io/common-enums";
import { createShaHash } from "@lindorm-io/crypto";
import { randomHex } from "@lindorm-io/random";
import { RsaAlgorithm, RsaFormat, createRsaSignature } from "@lindorm-io/rsa";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestClient, createTestDeviceLink, createTestPublicKey } from "../../fixtures/entity";
import {
  TEST_CLIENT_REPOSITORY,
  TEST_DEVICE_LINK_REPOSITORY,
  TEST_PUBLIC_KEY_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { RSA_KEY_SET } from "../../fixtures/integration/rsa-keys.fixture";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/rdc", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, {
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/admin/socket/emit")
    .times(999)
    .reply(200, {});

  test("should initialise rdc session", async () => {
    const publicKey = await TEST_PUBLIC_KEY_REPOSITORY.create(createTestPublicKey());

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        publicKeyId: publicKey.id,
      }),
    );

    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(await createTestDeviceLink());

    await TEST_DEVICE_LINK_REPOSITORY.create(
      await createTestDeviceLink({
        identityId: deviceLink.identityId,
        metadata: {
          ...deviceLink.metadata,
          macAddress: "E1:9A:09:75:46:93",
        },
        name: "My Xperia 7",
      }),
    );

    const clientCredentials = getTestClientCredentials({
      subject: client.id,
    });

    const body = {
      audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902", "d7cce9c2-0e6e-448b-a65f-f120cd2ffd32"],
      confirm_payload: { confirm: true },
      confirm_uri: "https://callback.uri/confirm",
      identity_id: deviceLink.identityId,
      mode: RdcSessionMode.PUSH_NOTIFICATION,
      nonce: randomHex(16),
      reject_payload: { reject: true },
      reject_uri: "https://callback.uri/reject",
      scopes: ["scope"],
      template_name: "rdcSession_template",
      template_parameters: { template: true },
      token_payload: { token: true },
    };

    const bodyHash = createShaHash({
      algorithm: "SHA512",
      data: JSON.stringify(body),
      format: "base64",
    });

    const requestId = randomUUID();

    const digest = [`algorithm="SHA512"`, `format="base64"`, `hash="${bodyHash}"`].join(",");

    const headers = {
      date: new Date().toUTCString(),
      digest,
      "x-request-id": requestId,
    };

    const headersHash = createRsaSignature({
      algorithm: RsaAlgorithm.RSA_SHA512,
      data: JSON.stringify(headers),
      format: RsaFormat.BASE64,
      keySet: RSA_KEY_SET,
    });

    const signature = [
      `algorithm="RSA-SHA512"`,
      `format="base64"`,
      `hash="${headersHash}"`,
      `headers="${Object.keys(headers).join(" ")}"`,
      `key="${publicKey.id}"`,
    ].join(",");

    const response = await request(server.callback())
      .post("/admin/rdc")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .set("Date", headers.date)
      .set("Digest", digest)
      .set("Signature", signature)
      .set("X-Request-ID", requestId)
      .send(body)
      .expect(202);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      expires: "2021-01-01T08:15:00.000Z",
    });
  });
});
