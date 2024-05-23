import { IAegis } from "../types";

export const createMockAegis = (): IAegis => ({
  jwe: {
    encrypt: jest.fn().mockResolvedValue({ token: "mocked_token" }),
    decrypt: jest.fn().mockResolvedValue({
      __jwe: {},
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
      __jws: {},
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
      __jwt: {},
      header: {},
      payload: { subject: "mocked_subject" },
    }),
  },
});
