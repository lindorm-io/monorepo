import type { IAesKit } from "@lindorm/aes";
import type { IAegis } from "../interfaces/index.js";
import type {
  DecryptedEncryptedToken,
  EncryptedToken,
  SignedToken,
  VerifiedStructuredToken,
  VerifiedUnstructuredToken,
  WireHeaderBuckets,
} from "../types/index.js";

/**
 * The mock is returned AS `IAegis` with no widening cast, so the compiler refuses
 * a member the interface declares and the factory omits — the completeness check
 * `create-mock-aegis.test.ts` then repeats at runtime for "is it a mock function".
 */
export const _createMockAegis = (mockFn: () => any, aesKit: IAesKit): IAegis => {
  const impl = (fn: (...args: Array<any>) => any): any => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const resolves = <T>(value: T): any => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };
  const returns = <T>(value: T): any => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };

  const buckets: WireHeaderBuckets = {
    protectedHeader: { alg: "HS256" },
    unprotectedHeader: {},
    unknown: { protected: {}, unprotected: {} },
  };

  const signed = (format: SignedToken["format"]): SignedToken => ({
    expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    expiresIn: 999,
    expiresOn: 9999,
    format,
    objectId: "mocked_object_id",
    token: "mocked_token",
    tokenId: "mocked_token_id",
  });

  return {
    issuer: "https://test.lindorm.io/",

    aes: {
      encrypt: impl((data: any, mode?: string) =>
        Promise.resolve(aesKit.encrypt(data, mode as any)),
      ),
      decrypt: impl((data: any) => Promise.resolve(aesKit.decrypt(data))),
    },

    cwe: {
      encrypt: resolves<EncryptedToken>({ format: "cwe", token: "mocked_token" }),
      decrypt: resolves<DecryptedEncryptedToken>({
        ...buckets,
        payload: Buffer.from("mocked_payload"),
        token: Buffer.from("mocked_token"),
      }),
    },
    cwm: {
      sign: resolves(signed("cwm")),
      verify: resolves<VerifiedStructuredToken>({
        ...buckets,
        payload: { sub: "verified_subject" },
        token: Buffer.from("mocked_token"),
      }),
    },
    cws: {
      sign: resolves(signed("cws")),
      verify: resolves<VerifiedUnstructuredToken>({
        ...buckets,
        payload: Buffer.from("verified_payload"),
        token: Buffer.from("mocked_token"),
      }),
    },
    cwt: {
      sign: resolves(signed("cwt")),
      verify: resolves<VerifiedStructuredToken>({
        ...buckets,
        payload: { sub: "verified_subject" },
        token: Buffer.from("mocked_token"),
      }),
    },

    // ⚠⚠ THE SIX JOSE ARMS BELOW TEACH A DIFFERENT RESULT SHAPE FROM THEIR COSE
    // TWINS, and the divergence is stale rather than intended. The COSE arms above
    // resolve the real kit shape — the two wire header buckets plus a WIRE-keyed
    // `payload` (`VerifiedStructuredToken`) — while these resolve `{ decoded,
    // header, payload }` with `payload.subject` DOMAIN-keyed. `decoded` is not a
    // member of any current result type, and `jwt.verify`'s real payload is
    // wire-keyed (`sub`), so a consumer that reads the mock to learn the contract
    // learns two contradictory ones for the same operation.
    //
    // ⛔ NOT CORRECTED HERE, and NOT because pylon pins them — measured, it does
    // not: `verified_payload` and `mocked_object_id` appear ZERO times in
    // `pylon/src/**/*.snap` (the one pylon snapshot of this factory is the DOMAIN
    // `verify` default noted below, which is why that one carries a constraint and
    // these do not). What blocks it is that `resolves<T>` returns `any`, so the
    // `IAegis` return type checks member PRESENCE and never member SHAPE — only
    // the arms that annotate (`resolves<SignedToken>(…)`) are held to a contract,
    // and correcting these six needs that annotation plus a test asserting a
    // resolved shape, which `create-mock-aegis.test.ts` does not yet do.
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

    registerProfile: mockFn(),

    sign: resolves(signed("jwt")),

    encrypt: resolves<EncryptedToken>({ format: "jwe", token: "mocked_token" }),

    decrypt: resolves({
      format: "jwe",
      header: {},
      payload: "mocked_payload",
      token: "mocked_token",
    }),

    mint: resolves(signed("jwt")),

    // The domain-result members state `header: {}` rather than a full
    // `DomainTokenHeader`. pylon snapshots this verify default verbatim
    // (pylon/src/middleware/common/__snapshots__/create-token-middleware.test.ts.snap),
    // so widening it is a cross-package break.
    verify: resolves({
      format: "jwt",
      header: {},
      claims: { subject: "verified_subject" },
      custom: {},
      token: "mocked_token",
    }),

    // parse is a SYNCHRONOUS keyless read — a plain mockReturnValue, not resolves.
    parse: returns({
      format: "jwt",
      header: {},
      claims: {},
      custom: {},
      token: "mocked_token",
    }),
  };
};
