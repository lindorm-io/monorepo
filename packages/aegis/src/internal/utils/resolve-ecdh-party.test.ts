import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { resolveEcdhParty } from "./resolve-ecdh-party.js";

const APU = B64.encode(Buffer.from("producer", "utf8"), "base64url");
const APV = B64.encode(Buffer.from("recipient", "utf8"), "base64url");

describe("resolveEcdhParty", () => {
  test("decodes the base64url party info for an ECDH-ES algorithm", () => {
    const resolved = resolveEcdhParty("ECDH-ES", {
      partyProducer: APU,
      partyRecipient: APV,
    });

    expect(resolved.partyProducer).toBe(APU);
    expect(resolved.partyRecipient).toBe(APV);
    expect(resolved.apu?.toString("utf8")).toBe("producer");
    expect(resolved.apv?.toString("utf8")).toBe("recipient");
  });

  test("STRIPS the party info for every non-ECDH-ES algorithm", () => {
    // RFC 7518 §4.6 gives apu/apv meaning only to the Concat-KDF, so emitting them
    // elsewhere would claim a binding the key agreement never made.
    for (const algorithm of ["dir", "A256KW", "RSA-OAEP"]) {
      expect(
        resolveEcdhParty(algorithm, { partyProducer: APU, partyRecipient: APV }),
      ).toEqual({
        partyProducer: undefined,
        partyRecipient: undefined,
        apu: undefined,
        apv: undefined,
      });
    }
  });

  test("an ECDH-ES call with no party info resolves to all-undefined", () => {
    expect(resolveEcdhParty("ECDH-ES", {})).toEqual({
      partyProducer: undefined,
      partyRecipient: undefined,
      apu: undefined,
      apv: undefined,
    });
  });

  test("⚠ a MALFORMED apu is never DECODED for a non-ECDH-ES algorithm", () => {
    // The strip happens BEFORE `B64.toBuffer`, so an un-decodable value cannot
    // reach the decoder at all. On an ECDH-ES algorithm the same value does reach
    // it and throws the raw `SyntaxError` `Uint8Array.fromBase64` raises — the
    // contrast is what shows the gate, not the decoder, is doing the work.
    expect(resolveEcdhParty("A256KW", { partyProducer: "!!!" }).apu).toBeUndefined();

    expect(() => resolveEcdhParty("ECDH-ES", { partyProducer: "!!!" })).toThrow(
      SyntaxError,
    );
  });

  test("resolves the two halves INDEPENDENTLY", () => {
    // A producer that addresses no particular recipient is legal; one half being
    // absent must not suppress the other.
    const resolved = resolveEcdhParty("ECDH-ES+A256KW", { partyProducer: APU });

    expect(resolved.apu?.toString("utf8")).toBe("producer");
    expect(resolved.apv).toBeUndefined();
  });
});
