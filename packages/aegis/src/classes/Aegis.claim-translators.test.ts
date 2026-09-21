import { describe, expect, test } from "vitest";
import { AegisDomainError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";

/**
 * The PUBLIC claim translators — `Aegis.toWire` and `Aegis.toDomain`, the
 * vocabulary source of truth consumers build their own claim mapping on rather
 * than re-deriving the registry.
 *
 * The translation itself is covered where it lives (`internal/claims/`). What is
 * covered HERE is that the two statics still reach it: they are assignments to
 * the internal functions, so nothing in those suites would notice either one
 * being pointed somewhere else. It is asserted BEHAVIOURALLY rather than by
 * comparing the statics to the functions they are assigned from — an identity
 * check against its own import states no consequence, and a caller that got a
 * different-but-identically-shaped translator would be equally broken.
 *
 * ⚠ Not a feature scenario: there is no token and no act. These operate on a flat
 * claim dict of unknown provenance, which is a different door from the token
 * read path — `toDomain` answers to either spelling, where a token read resolves
 * the wire name and nothing else.
 */
describe("Aegis — the public claim translators", () => {
  test("round-trips a domain claim set out to the wire and back", () => {
    const domain = {
      subject: "user-1",
      issuer: "https://idp.lindorm.io/",
      tokenId: "tok_abc",
      audience: ["https://rs.lindorm.io/"],
      customFlag: true,
    };

    const wire = Aegis.toWire(domain);

    // Registered claims take their JOSE wire names; an unregistered key
    // snake-cases and keeps its value.
    expect(wire.sub).toBe("user-1");
    expect(wire.iss).toBe("https://idp.lindorm.io/");
    expect(wire.jti).toBe("tok_abc");
    expect(wire.aud).toEqual(["https://rs.lindorm.io/"]);
    expect(wire.custom_flag).toBe(true);

    const { claims, custom } = Aegis.toDomain(wire);

    expect(claims.subject).toBe("user-1");
    expect(claims.issuer).toBe("https://idp.lindorm.io/");
    expect(claims.tokenId).toBe("tok_abc");
    expect(claims.audience).toEqual(["https://rs.lindorm.io/"]);

    // The unregistered claim lands OUTSIDE the registered bucket. Without this
    // the round trip would pass just as well over a translator that resolved
    // everything into `claims`, which is the categorisation consumers rely on.
    expect(custom.customFlag).toBe(true);
    expect(claims).not.toHaveProperty("customFlag");
  });

  // The spaced wire form crosses the public translators through the same codec
  // every internal write/read site uses: `scope` is one space-delimited string
  // on the wire (RFC 8693 §4.2) and an Array<string> on the domain surface.
  test("joins a spaced array claim to its space-delimited wire string", () => {
    expect(Aegis.toWire({ scope: ["a", "b"] })).toEqual({ scope: "a b" });
  });

  test("splits a space-delimited wire string to the domain list", () => {
    expect(Aegis.toDomain({ scope: "a b" }).claims.scope).toEqual(["a", "b"]);
  });

  // The public translator reaches the same refusal the mint pipeline does: a
  // member containing the delimiter has no spelling on the wire — aegis policy
  // at mint (RFC 6749 §3.3).
  test("refuses a spaced member containing a space rather than join it", () => {
    const write = () => Aegis.toWire({ scope: ["a b"] });

    expect(write).toThrow(AegisDomainError);
    expect(write).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [
            { key: "scope[0]", message: 'Member "scope[0]" must not contain a space' },
          ],
        },
      }) as unknown as Error,
    );
  });

  // An empty member joins to nothing, so the wire would spell a shorter list —
  // aegis policy at mint (RFC 6749 §3.3).
  test("refuses an empty spaced member rather than join it", () => {
    const write = () => Aegis.toWire({ scope: [""] });

    expect(write).toThrow(AegisDomainError);
    expect(write).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [{ key: "scope[0]", message: 'Member "scope[0]" must not be empty' }],
        },
      }) as unknown as Error,
    );
  });

  // A member outside the `scope-token` production has no spelling on the wire —
  // aegis policy at mint (RFC 6749 §3.3).
  test("refuses a spaced member outside the scope-token production rather than join it", () => {
    const write = () => Aegis.toWire({ scope: ['re"ad'] });

    expect(write).toThrow(AegisDomainError);
    expect(write).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [
            {
              key: "scope[0]",
              message:
                'Member "scope[0]" must contain only scope-token characters (RFC 6749 §3.3)',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  // One refusal carries every faulty member at its own index, in member order.
  test("lists every faulty spaced member at its own index in one refusal", () => {
    const write = () =>
      Aegis.toWire({ scope: ["a b", "read", 7, "c d"] as unknown as Array<string> });

    expect(write).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "scope",
          invalid: [
            { key: "scope[0]", message: 'Member "scope[0]" must not contain a space' },
            { key: "scope[2]", message: 'Member "scope[2]" must be a string' },
            { key: "scope[3]", message: 'Member "scope[3]" must not contain a space' },
          ],
        },
      }) as unknown as Error,
    );
  });
});
