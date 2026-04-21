import type { IAesKit } from "@lindorm/aes";
import type { IAegis } from "../interfaces/index.js";

export const _createMockAegis = (mockFn: () => any, aesKit: IAesKit): IAegis => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  return {
    issuer: "https://test.lindorm.io/",

    aes: {
      encrypt: impl((data: any, mode?: string) =>
        Promise.resolve(aesKit.encrypt(data, mode as any)),
      ),
      decrypt: impl((data: any) => Promise.resolve(aesKit.decrypt(data))),
    },

    jwe: {
      encrypt: resolves({ token: "mocked_token" }),
      decrypt: resolves({
        decoded: {},
        header: {},
        payload: "mocked_payload",
      }),
    },
    jws: {
      sign: resolves({
        objectId: "mocked_object_id",
        token: "mocked_token",
      }),
      verify: resolves({
        decoded: {},
        header: {},
        payload: "verified_payload",
      }),
    },
    jwt: {
      sign: resolves({
        expiresAt: new Date("2999-01-01T00:00:00.000Z"),
        expiresIn: 999,
        expiresOn: 9999,
        objectId: "mocked_object_id",
        token: "mocked_token",
        tokenId: "mocked_token_id",
      }),
      verify: resolves({
        decoded: {},
        header: {},
        payload: { subject: "verified_subject" },
      }),
    },

    verify: resolves({
      decoded: {},
      header: {},
      payload: { subject: "verified_subject" },
    }),
  } as unknown as IAegis;
};
