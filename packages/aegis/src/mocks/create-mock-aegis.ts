import type { IAesKit } from "@lindorm/aes";
import type {
  IAegis,
  IAegisAes,
  IAegisCwe,
  IAegisCwm,
  IAegisCws,
  IAegisCwt,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
} from "../interfaces/index.js";
import type {
  CoseHeaderBuckets,
  DomainTokenHeader,
  JoseHeaderBuckets,
  SignedToken,
} from "../types/index.js";
import { assertClaims } from "../utils/assert-claims.js";
import { claimsMatch } from "../utils/claims-match.js";

/** Any member of `IAegis` or of one of its namespaces. */
type AegisArm = (...args: Array<any>) => any;

/**
 * Every arm is typed by the interface member it stands in for, so a default that
 * drifts from `IAegis` is a compile error: `resolves<IAegisJwe["encrypt"]>` takes
 * an `EncryptedToken` and nothing else. The `IAegis` return type adds the
 * completeness half — a member the interface declares and the factory omits is
 * refused — and `create-mock-aegis.test.ts` repeats both at runtime, for "is it a
 * mock function" and "what does it resolve".
 *
 * ⚠ EVERY DEFAULT BELOW IS SNAPSHOTTED, and `verify`'s across a package boundary:
 * `create-mock-aegis.test.ts`, plus
 * `pylon/src/middleware/common/__snapshots__/create-token-middleware.test.ts.snap`.
 */
export const _createMockAegis = (mockFn: () => any, aesKit: IAesKit): IAegis => {
  /**
   * ⚠ `fn` is NOT typed by `F`, and cannot be: the aes arms forward to a real
   * `IAesKit` and `IAegisAes.encrypt` declares four overloads, so no single
   * signature is assignable to the member. `F` types the ARM, which is what a
   * caller sees.
   */
  const impl = <F extends AegisArm>(fn: AegisArm): F => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  /**
   * ⚠ A GENERIC ARM RESOLVES ITS TYPE PARAMETER TO THE CONSTRAINT, not to the
   * declaration's default: `IAegisJwe["decrypt"]` asks for `payload: TokenContent`
   * rather than `payload: Buffer`, so one default serves every instantiation.
   */
  const resolves = <F extends AegisArm>(value: Awaited<ReturnType<F>>): F => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };
  const returns = <F extends AegisArm>(value: ReturnType<F>): F => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };

  const joseBuckets: JoseHeaderBuckets = {
    header: { alg: "HS256" },
    custom: { header: {} },
  };

  const coseBuckets: CoseHeaderBuckets = {
    protectedHeader: { alg: "HS256" },
    unprotectedHeader: {},
    custom: { protected: {}, unprotected: {} },
  };

  const domainHeader: DomainTokenHeader = { algorithm: "HS256", critical: [] };

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
      encrypt: impl<IAegisAes["encrypt"]>((data: any, mode?: string) =>
        Promise.resolve(aesKit.encrypt(data, mode as any)),
      ),
      decrypt: impl<IAegisAes["decrypt"]>((data: any) =>
        Promise.resolve(aesKit.decrypt(data)),
      ),
    },

    cwe: {
      encrypt: resolves<IAegisCwe["encrypt"]>({ format: "cwe", token: "mocked_token" }),
      decrypt: resolves<IAegisCwe["decrypt"]>({
        ...coseBuckets,
        payload: Buffer.from("mocked_payload"),
        token: Buffer.from("mocked_token"),
      }),
    },
    cwm: {
      sign: resolves<IAegisCwm["sign"]>(signed("cwm")),
      verify: resolves<IAegisCwm["verify"]>({
        ...coseBuckets,
        payload: { sub: "verified_subject" },
        token: Buffer.from("mocked_token"),
      }),
    },
    cws: {
      sign: resolves<IAegisCws["sign"]>(signed("cws")),
      verify: resolves<IAegisCws["verify"]>({
        ...coseBuckets,
        payload: Buffer.from("verified_payload"),
        token: Buffer.from("mocked_token"),
      }),
    },
    cwt: {
      sign: resolves<IAegisCwt["sign"]>(signed("cwt")),
      verify: resolves<IAegisCwt["verify"]>({
        ...coseBuckets,
        payload: { sub: "verified_subject" },
        token: Buffer.from("mocked_token"),
      }),
    },

    jwe: {
      encrypt: resolves<IAegisJwe["encrypt"]>({ format: "jwe", token: "mocked_token" }),
      decrypt: resolves<IAegisJwe["decrypt"]>({
        ...joseBuckets,
        payload: Buffer.from("mocked_payload"),
        token: "mocked_token",
      }),
    },
    jws: {
      sign: resolves<IAegisJws["sign"]>(signed("jws")),
      verify: resolves<IAegisJws["verify"]>({
        ...joseBuckets,
        payload: Buffer.from("verified_payload"),
        token: "mocked_token",
      }),
    },
    jwt: {
      sign: resolves<IAegisJwt["sign"]>(signed("jwt")),
      verify: resolves<IAegisJwt["verify"]>({
        ...joseBuckets,
        payload: { sub: "verified_subject" },
        token: "mocked_token",
      }),
    },

    registerProfile: returns<IAegis["registerProfile"]>(undefined),

    sign: resolves<IAegis["sign"]>(signed("jwt")),

    encrypt: resolves<IAegis["encrypt"]>({ format: "jwe", token: "mocked_token" }),

    decrypt: resolves<IAegis["decrypt"]>({
      format: "jwe",
      header: domainHeader,
      payload: "mocked_payload",
      token: "mocked_token",
    }),

    mint: resolves<IAegis["mint"]>(signed("jwt")),

    verify: resolves<IAegis["verify"]>({
      format: "jwt",
      header: domainHeader,
      claims: { subject: "verified_subject" },
      custom: {},
      token: "mocked_token",
    }),

    // parse is a SYNCHRONOUS keyless read — a plain mockReturnValue, not resolves.
    parse: returns<IAegis["parse"]>({
      format: "jwt",
      header: domainHeader,
      claims: {},
      custom: {},
      token: "mocked_token",
    }),

    // The claim check FORWARDS to the real one, as the aes arms do: a consumer's
    // gate test must refuse what the gate refuses, and a canned `undefined` /
    // `true` would pass every claim set. A mock has no deployment, so the window
    // allows no clock tolerance unless the call states one.
    assert: impl<IAegis["assert"]>(assertClaims),
    matches: impl<IAegis["matches"]>(claimsMatch),
  };
};
