import { IAegis } from "../interfaces";

export const createMockAegis = (): IAegis => ({
  issuer: "https://test.lindorm.io/",

  jwe: {
    encrypt: jest.fn().mockResolvedValue({ token: "mocked_token" }),
    decrypt: jest.fn().mockResolvedValue({
      decoded: {},
      header: {},
      payload: "mocked_payload",
    }),
  },
  jws: {
    sign: jest.fn().mockResolvedValue({
      objectId: "mocked_object_id",
      token: "mocked_token",
    }),
    verify: jest.fn().mockResolvedValue({
      decoded: {},
      header: {},
      payload: "mocked_payload",
    }),
  },
  jwt: {
    sign: jest.fn().mockResolvedValue({
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
      expiresIn: 999,
      expiresOn: 9999,
      objectId: "mocked_object_id",
      token: "mocked_token",
      tokenId: "mocked_token_id",
    }),
    verify: jest.fn().mockResolvedValue({
      decoded: {},
      header: {},
      payload: { subject: "mocked_subject" },
    }),
  },

  decode: jest.fn(),
  verify: jest.fn().mockResolvedValue({
    decoded: {},
    header: {},
    payload: { subject: "mocked_subject" },
  }),
});
