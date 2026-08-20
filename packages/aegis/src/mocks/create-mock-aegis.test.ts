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

const read = (mock: IAegis, name: string): unknown =>
  name.split(".").reduce<any>((acc, part) => acc?.[part], mock);

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
});
