import { IAegis } from "../interfaces";

export const createMockAegis = (): IAegis => ({
  issuer: "https://test.lindorm.io/",

  aes: {
    encrypt: jest.fn().mockResolvedValue("mocked_encryption"),
    decrypt: jest.fn().mockResolvedValue("mocked_decryption"),
  },

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
      payload: "verified_payload",
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
      payload: { subject: "verified_subject" },
    }),
  },

  cwe: {
    encrypt: jest
      .fn()
      .mockResolvedValue({ buffer: Buffer.alloc(0), token: "mocked_token" }),
    decrypt: jest.fn().mockResolvedValue({
      decoded: {},
      header: {},
      payload: "mocked_payload",
    }),
  },
  cwt: {
    sign: jest.fn().mockResolvedValue({
      buffer: Buffer.alloc(0),
      objectId: "mocked_object_id",
      token: "mocked_token",
    }),
    verify: jest.fn().mockResolvedValue({
      decoded: {},
      header: {},
      payload: "verified_payload",
    }),
  },
  cws: {
    sign: jest.fn().mockResolvedValue({
      buffer: Buffer.alloc(0),
      objectId: "mocked_object_id",
      token: "mocked_token",
    }),
    verify: jest.fn().mockResolvedValue({
      decoded: {},
      header: {},
      payload: "verified_payload",
    }),
  },

  // decode: jest.fn(),
  verify: jest.fn().mockResolvedValue({
    decoded: {},
    header: {},
    payload: { subject: "verified_subject" },
  }),
});
