import { describe, expect, expectTypeOf, test } from "vitest";
import type { ConfirmationClaimMembers } from "../../types/index.js";
import type { CnfMember, CoseCnfMember } from "./cnf-members.js";
import {
  CNF_DOMAIN_MEMBERS,
  CNF_JOSE_MEMBERS,
  CNF_MEMBERS,
  COSE_CNF_LABELS,
  COSE_CNF_MEMBERS,
} from "./cnf-members.js";

describe("CNF_MEMBERS", () => {
  /**
   * ⭐ THE LITERAL PIN. Everything else about the confirmation is DERIVED from
   * this table — both translator directions, the mint-side shape rule's entry
   * point, both capability rows and the COSE codec's labels — so nothing else in
   * the package can say whether the table itself is right.
   *
   * ⛔ WRITTEN OUT, NOT DERIVED. A test reading the names back off the same
   * declaration agrees with whatever it currently says, including a wrong
   * spelling — and a wrong `cnf` member name mints a binding no conformant
   * verifier can interpret while every derived check still agrees with it.
   *
   * The spellings: RFC 9449 §6.1 · RFC 8705 §3.1 · RFC 7800 §3.2 · RFC 7800 §3.4
   * · RFC 7800 §3.5.
   */
  test("is exactly the five confirmation members aegis carries, spelled as their specifications do", () => {
    expect(
      CNF_MEMBERS.map((member) => [member.domain, member.wire.jose.name, member.value]),
    ).toEqual([
      ["thumbprint", "jkt", "text"],
      ["mtlsCertThumbprint", "x5t#S256", "text"],
      ["key", "jwk", "jwk"],
      ["keyId", "kid", "text"],
      ["jwkSetUri", "jku", "text"],
    ]);
  });

  /**
   * ⚠ THE LABELS AS WELL AS THE MEMBER NAMES. A wrong label mints a confirmation
   * no RFC 8747 reader can interpret. What the CODEC does with the table is
   * pinned beside the codec, in `cose/cose-key.test.ts`.
   */
  test("gives COSE exactly the two members RFC 8747 §3.1 labels", () => {
    expect(COSE_CNF_LABELS).toEqual({ jwk: 1, kid: 3 });
    expect(COSE_CNF_MEMBERS).toEqual(["jwk", "kid"]);
  });

  /**
   * ⚠ A REASON IS NOT OPTIONAL ON AN ABSENT CELL, and these three are the claim
   * side's first users of it. Pinned as a SET rather than by text so the reason
   * can be improved without a test edit — what must not change quietly is WHICH
   * members COSE cannot carry.
   */
  test("states, with a reason, the three members COSE cannot carry", () => {
    expect(
      CNF_MEMBERS.flatMap((member) =>
        member.wire.cose.kind === "absent"
          ? [[member.wire.jose.name, member.wire.cose.reason.length > 0]]
          : [],
      ),
    ).toEqual([
      ["jkt", true],
      ["x5t#S256", true],
      ["jku", true],
    ]);
  });

  /**
   * ⭐ THE TABLE AND THE PUBLIC TYPE ARE BOUND TO EACH OTHER, in both directions.
   * `ConfirmationClaimMembers` is what a consumer writes against and this table is
   * what the translator reads; a member declared in one and not the other is a
   * member a caller can name and nothing carries, or one aegis emits and no type
   * admits. The `Record` is TOTAL over the type, so removing a member from the
   * type without removing it here does not compile, and the runtime comparison
   * catches the other direction.
   */
  test("declares exactly the members the public confirmation type names", () => {
    const declared: Record<keyof ConfirmationClaimMembers, true> = {
      thumbprint: true,
      mtlsCertThumbprint: true,
      key: true,
      keyId: true,
      jwkSetUri: true,
    };

    expect([...CNF_DOMAIN_MEMBERS].sort()).toEqual(Object.keys(declared).sort());
  });

  /**
   * ⭐⭐ THE ONE DERIVATION WITH NO RUNTIME READER, AND THEREFORE THE ONE NO
   * BEHAVIOURAL TEST CAN EVER REACH. {@link CnfMember} is derived from the
   * members' own JOSE names so a capability set cannot admit a member nothing
   * declares — and a sabotage probe replaced the derivation with a hand-written
   * union CARRYING A MEMBER THAT DOES NOT EXIST (`"jwe"`), which typechecked
   * clean and left the whole suite green. The union has no value at runtime, so
   * only the compiler can hold it, and only if something asks.
   *
   * ⚠ THE CONTRAST IS THE POINT, and it is why this is the only type-level
   * assertion in the file: `CNF_JOSE_MEMBERS`, `COSE_CNF_LABELS` and
   * `CoseCnfMember` each have a runtime reader and are caught by the tests around
   * it, so a type assertion for those would restate what behaviour already proves.
   *
   * ⛔ WRITTEN OUT, NOT DERIVED, like every other pin in this file. An assertion
   * built from `CNF_MEMBERS` agrees with whatever the declaration currently says,
   * including a member RFC 7800 never defined.
   *
   * ⚠⚠ IT FAILS AT `typecheck`, NOT IN THE TEST RUNNER — vitest transpiles without
   * checking types, so `npm test` stays GREEN on a broken union and only
   * `npm run verify` catches it (TS2344 on the `expectTypeOf` below). Anyone who
   * reds this assertion and sees a passing `npm test` has not disproved it.
   */
  test("derives the member union from the declaration, and from nothing else", () => {
    expectTypeOf<CnfMember>().toEqualTypeOf<
      "jkt" | "x5t#S256" | "jwk" | "kid" | "jku" | "ckt"
    >();

    // The COSE narrowing is derived by DISCRIMINATING each member's `wire.cose`,
    // so it is a second, independent statement: a member losing its label would
    // move this union without moving the one above.
    expectTypeOf<CoseCnfMember>().toEqualTypeOf<"jwk" | "kid">();
  });

  test("offers the JOSE kits every member it declares", () => {
    expect(CNF_JOSE_MEMBERS).toEqual(["jkt", "x5t#S256", "jwk", "kid", "jku"]);
  });
});
