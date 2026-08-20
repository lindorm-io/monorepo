import { describe, expect, test } from "vitest";
import type { IAegis } from "../../interfaces/index.js";
import type {
  CoseSignStructuredTokenOptions,
  CoseVerifiedStructuredToken,
  JoseSignStructuredTokenOptions,
  JoseVerifiedStructuredToken,
} from "../kit/structured.js";

/**
 * The envelope split, asserted at the TYPE level — the half of this design a
 * runtime test cannot reach.
 *
 * ⚠ `@ts-expect-error` IS THE ASSERTION, and it only bites under `tsc`: vitest
 * strips types without checking them, so these rows are proved by
 * `npm run typecheck` (this package's `tsconfig.json` includes `src/**` with no
 * exclude, so a `.test.ts` beside its source is checked). `tsconfig.build.json`
 * excludes tests, so `npm run build` does not see them. A directive that stops
 * being needed fails the typecheck as an UNUSED `@ts-expect-error`, which is what
 * makes each row falsifiable in both directions.
 *
 * ⚠ THE POSITIVE LINE BESIDE EACH REFUSAL is what stops the row passing for the
 * wrong reason: an `@ts-expect-error` is satisfied by ANY error on the line, so a
 * row asserting only the refusal would stay green if `custom` vanished entirely.
 */
describe("the wire envelope split", () => {
  test("each wire's custom bag takes ITS OWN buckets and no other wire's", () => {
    // The positive half: `custom.header` IS expressible on a JOSE envelope — one
    // bucket, because compact JWS/JWE carry one header and it is protected.
    const carried: JoseSignStructuredTokenOptions = {
      custom: { header: { "x-hint": "value" } },
    };

    const refusedUnprotected: JoseSignStructuredTokenOptions = {
      custom: {
        // @ts-expect-error a JOSE kit has no unprotected bucket to place a param in
        unprotected: { "x-hint": "value" },
      },
    };

    const refusedProtected: JoseSignStructuredTokenOptions = {
      custom: {
        // @ts-expect-error a JOSE kit spells its one bucket `header`, not `protected`
        protected: { "x-hint": "value" },
      },
    };

    // COSE is the wire that branches: both buckets, because no registry row can
    // decide the placement of a parameter it does not answer for.
    const cose: CoseSignStructuredTokenOptions = {
      custom: { protected: { "x-hint": "a" }, unprotected: { "x-other": "b" } },
    };

    const coseRefused: CoseSignStructuredTokenOptions = {
      custom: {
        // @ts-expect-error the COSE buckets are named for their integrity, not `header`
        header: { "x-hint": "value" },
      },
    };

    expect([
      carried,
      refusedUnprotected,
      refusedProtected,
      cose,
      coseRefused,
    ]).toHaveLength(5);
  });

  test("a typo'd REGISTERED name in `header` is still a compile error", () => {
    // The claim the open set cost nothing: `header` stays CLOSED, so the safety
    // net the registered bag provides is unchanged by `custom` existing.
    const correct: JoseSignStructuredTokenOptions = {
      header: { x5u: "https://certs.lindorm.io/leaf.pem" },
    };

    const typo: JoseSignStructuredTokenOptions = {
      // @ts-expect-error `x5U` is not a registered header parameter
      header: { x5U: "https://certs.lindorm.io/leaf.pem" },
    };

    expect([correct, typo]).toHaveLength(2);
  });

  test("the DOMAIN doors express neither a custom nor an unprotected parameter", () => {
    // ⛔ LAX ON KITS, STRICT ON DOMAIN. `aegis.sign`/`aegis.mint` take
    // `DomainTokenEnvelope`, whose header bag is domain-named and registered —
    // there is no wire vocabulary at this tier for an unregistered parameter to
    // be spelled in.
    const check = (aegis: IAegis): unknown => [
      aegis.sign({
        payload: {},
        // @ts-expect-error the domain sign envelope has no custom bag
        custom: { protected: { "x-hint": "value" } },
      }),
      aegis.sign({
        payload: {},
        // @ts-expect-error the domain sign envelope has no unprotected bag
        unprotected: { cty: "application/json" },
      }),
      aegis.encrypt("data", {
        // @ts-expect-error the domain encrypt envelope has no custom bag
        custom: { protected: { "x-hint": "value" } },
      }),
      aegis.mint("access_token", {} as never, {
        encrypt: {
          // @ts-expect-error the profiled mint's encrypt envelope has no custom bag
          custom: { protected: { "x-hint": "value" } },
        },
      }),
      aegis.mint("access_token", {} as never, {
        encrypt: {
          // @ts-expect-error the profiled mint's encrypt envelope has no custom bag
          custom: { unprotected: { "x-hint": "value" } },
        },
      }),
      // The positive half: the domain doors DO take a domain-named header bag,
      // and the mint's encrypt envelope DOES take its own wire header bag — so
      // the refusals above are about `custom`/`unprotected`, not about the
      // argument shape.
      aegis.sign({ payload: {}, header: { objectId: "1.2.3.4" } }),
      aegis.mint("access_token", {} as never, {
        encrypt: { header: { oid: "1.2.3.4" }, proprietary: true },
      }),
    ];

    expect(check).toBeInstanceOf(Function);
  });
});

/**
 * The READ half of the same split, asserted at the TYPE level. Same discipline as
 * the write half above — the directives are proved by `npm run typecheck`, an
 * unused one fails it, and every refusal is paired with a POSITIVE line so a row
 * cannot pass by the field vanishing entirely.
 */
describe("the wire result split", () => {
  const JOSE: JoseVerifiedStructuredToken = {
    header: { alg: "ES512" },
    custom: { header: { "x-hint": "value" } },
    payload: {},
    token: "header.payload.signature",
  };

  const COSE: CoseVerifiedStructuredToken = {
    protectedHeader: { alg: "ES512" },
    unprotectedHeader: { kid: "key-1" },
    custom: { protected: { "x-hint": "a" }, unprotected: { "x-other": "b" } },
    payload: {},
    token: Buffer.from("cose-token"),
  };

  test("a COSE-shaped result is not a JOSE result, and its twin", () => {
    // @ts-expect-error a COSE result reports two buckets and a Buffer token
    const coseAsJose: JoseVerifiedStructuredToken = COSE;

    // @ts-expect-error a JOSE result reports ONE header and a compact string token
    const joseAsCose: CoseVerifiedStructuredToken = JOSE;

    // The positive half is `JOSE` and `COSE` themselves: each compiles against
    // its own wire's type, so the two refusals are about the CROSSING and not
    // about either literal being malformed.
    expect([JOSE, COSE, coseAsJose, joseAsCose]).toHaveLength(4);
  });

  test("a JOSE result has no unprotected bucket to report — not an empty one, none", () => {
    const refusedUnprotected: JoseVerifiedStructuredToken = {
      header: { alg: "ES512" },
      // @ts-expect-error compact JWS/JWE carry ONE header, so there is no second bucket
      unprotectedHeader: {},
      custom: { header: {} },
      payload: {},
      token: "header.payload.signature",
    };

    const refusedProtected: JoseVerifiedStructuredToken = {
      header: { alg: "ES512" },
      // @ts-expect-error a JOSE result names its one header `header`, not `protectedHeader`
      protectedHeader: { alg: "ES512" },
      custom: { header: {} },
      payload: {},
      token: "header.payload.signature",
    };

    const refusedCoseCustom: JoseVerifiedStructuredToken = {
      header: { alg: "ES512" },
      // @ts-expect-error the JOSE custom bag has ONE bucket, named for the header it belongs to
      custom: { protected: {}, unprotected: {} },
      payload: {},
      token: "header.payload.signature",
    };

    expect([refusedUnprotected, refusedProtected, refusedCoseCustom]).toHaveLength(3);
  });

  test("a COSE result carries both buckets and both custom halves", () => {
    const refusedJoseHeader: CoseVerifiedStructuredToken = {
      protectedHeader: { alg: "ES512" },
      unprotectedHeader: {},
      // @ts-expect-error the COSE buckets are named for their integrity, not `header`
      custom: { header: {} },
      payload: {},
      token: Buffer.from("cose-token"),
    };

    // The positive half: `COSE` above states all four members and compiles.
    expect([COSE, refusedJoseHeader]).toHaveLength(2);
  });

  test("the token type is pinned by the RESULT type, never by a caller's generic", () => {
    const joseBuffer: JoseVerifiedStructuredToken = {
      header: { alg: "ES512" },
      custom: { header: {} },
      payload: {},
      // @ts-expect-error a JOSE token is the compact string, never a Buffer
      token: Buffer.from("cose-token"),
    };

    const coseString: CoseVerifiedStructuredToken = {
      protectedHeader: { alg: "ES512" },
      unprotectedHeader: {},
      custom: { protected: {}, unprotected: {} },
      payload: {},
      // @ts-expect-error a COSE token is the encoded bytes, never a compact string
      token: "header.payload.signature",
    };

    expect([joseBuffer, coseString]).toHaveLength(2);
  });
});
