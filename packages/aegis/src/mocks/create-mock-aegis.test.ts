import { describe, expect, test, vi } from "vitest";
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
import { createMockAegis } from "./vitest.js";

/**
 * The member map is BOUND to the interfaces by `satisfies Record<keyof …, …>` —
 * a member added to `IAegis` or to one of its namespaces fails `npm run
 * typecheck` here until it is listed, so this is derived from the declaration
 * rather than a copy of it.
 *
 * It is the RUNTIME half of the completeness `_createMockAegis` gets from its
 * `IAegis` return type: every member the factory supplies is typed `any` (the
 * mock function comes from the runner, not from aegis), so the compiler cannot
 * see whether a member actually holds a mock function.
 */
const MEMBERS = {
  issuer: true,

  aes: { decrypt: true, encrypt: true } satisfies Record<keyof IAegisAes, true>,
  cwe: { decrypt: true, encrypt: true } satisfies Record<keyof IAegisCwe, true>,
  cwm: { sign: true, verify: true } satisfies Record<keyof IAegisCwm, true>,
  cws: { sign: true, verify: true } satisfies Record<keyof IAegisCws, true>,
  cwt: { sign: true, verify: true } satisfies Record<keyof IAegisCwt, true>,
  jwe: { decrypt: true, encrypt: true } satisfies Record<keyof IAegisJwe, true>,
  jws: { sign: true, verify: true } satisfies Record<keyof IAegisJws, true>,
  jwt: { sign: true, verify: true } satisfies Record<keyof IAegisJwt, true>,

  decrypt: true,
  encrypt: true,
  mint: true,
  parse: true,
  registerProfile: true,
  sign: true,
  verify: true,
} satisfies Record<keyof IAegis, true | Record<string, true>>;

const MEMBER_NAMES: Array<string> = Object.entries(MEMBERS)
  .flatMap(([key, value]) =>
    value === true ? [key] : Object.keys(value).map((method) => `${key}.${method}`),
  )
  .sort();

/** Every member but `issuer`, which is the one non-callable member of `IAegis`. */
const CALLABLE_NAMES: Array<string> = MEMBER_NAMES.filter((name) => name !== "issuer");

/**
 * The aes arms FORWARD to a real `IAesKit` rather than resolving a default, so they
 * have no default shape to record and calling them needs real input. Derived from
 * `MEMBERS.aes` so a member added to `IAegisAes` is excluded without a second list.
 */
const FORWARDING_NAMES: Array<string> = Object.keys(MEMBERS.aes).map(
  (method) => `aes.${method}`,
);

const DEFAULT_NAMES: Array<string> = CALLABLE_NAMES.filter(
  (name) => !FORWARDING_NAMES.includes(name),
);

const read = (mock: IAegis, name: string): unknown =>
  name.split(".").reduce<any>((acc, part) => acc?.[part], mock);

/** A mock arm ignores its arguments, so the default it was built with needs none. */
const call = (mock: IAegis, name: string): unknown =>
  (read(mock, name) as (...args: Array<any>) => unknown)();

type ArmValue<F extends (...args: Array<any>) => any> = Awaited<ReturnType<F>>;

describe("createMockAegis", () => {
  test("declares every member of IAegis", () => {
    expect(MEMBER_NAMES).toMatchSnapshot();
  });

  test.each(MEMBER_NAMES)("supplies %s", (name) => {
    expect(read(createMockAegis(), name)).toBeDefined();
  });

  test.each(CALLABLE_NAMES)("mocks %s", (name) => {
    expect(vi.isMockFunction(read(createMockAegis(), name))).toBe(true);
  });

  test("supplies issuer as a string", () => {
    expect(createMockAegis().issuer).toMatchSnapshot();
  });

  test("returns independent mocks per call", () => {
    expect(createMockAegis().verify).not.toBe(createMockAegis().verify);
  });

  test.each(DEFAULT_NAMES)("resolves %s to its interface shape", async (name) => {
    expect(await call(createMockAegis(), name)).toMatchSnapshot();
  });
});

/**
 * The premise `_createMockAegis` rests on, asserted where a runtime test cannot
 * reach: an arm's own interface member is strict enough to refuse a wrong default.
 * The factory measures every default against exactly this type, and `npm run
 * typecheck` over `create-mock-aegis.ts` is what holds it to that.
 *
 * ⚠ `@ts-expect-error` IS THE ASSERTION, and it only bites under `tsc`: vitest
 * strips types without checking them. A directive that stops being needed fails the
 * typecheck as an UNUSED `@ts-expect-error`, so each row is falsifiable both ways.
 *
 * ⚠ THE POSITIVE LINE BESIDE EACH REFUSAL is what stops a row passing for the wrong
 * reason: an `@ts-expect-error` is satisfied by ANY error on the line.
 */
describe("an arm's default measured against its interface member", () => {
  test("a member the result type requires, and one it does not declare", () => {
    const carried: ArmValue<IAegisJwe["encrypt"]> = {
      format: "jwe",
      token: "mocked_token",
    };

    // @ts-expect-error the result's `format` discriminant is required, not optional
    const missing: ArmValue<IAegisJwe["encrypt"]> = { token: "mocked_token" };

    const undeclared: ArmValue<IAegisJwe["encrypt"]> = {
      format: "jwe",
      token: "mocked_token",
      // @ts-expect-error an encrypt result reports no envelope around itself
      wrapper: "jwe",
    };

    expect([carried, missing, undeclared]).toHaveLength(3);
  });

  test("a generic arm is measured against its CONSTRAINT, so one default serves it", () => {
    const bytes: ArmValue<IAegisJws["verify"]> = {
      header: { alg: "HS256" },
      custom: { header: {} },
      payload: Buffer.from("verified_payload"),
      token: "mocked_token",
    };

    // The declaration's default is `Buffer`, so a string payload compiling here is
    // the constraint (`TokenContent`) at work and not that default.
    const text: ArmValue<IAegisJws["verify"]> = {
      header: { alg: "HS256" },
      custom: { header: {} },
      payload: "verified_payload",
      token: "mocked_token",
    };

    const refused: ArmValue<IAegisJws["verify"]> = {
      header: { alg: "HS256" },
      custom: { header: {} },
      // @ts-expect-error `TokenContent` does not admit a null payload
      payload: null,
      token: "mocked_token",
    };

    expect([bytes, text, refused]).toHaveLength(3);
  });
});
