import { describe, expect, test } from "vitest";
import { SpecCorpusError } from "./SpecCorpusError.js";
import { toCitation } from "./document-urls.js";
import { verifyCitation } from "./verify-citation.js";

describe("verifyCitation", () => {
  /**
   * ⭐ THE DELIBERATELY BROKEN CITATION, kept red on purpose and forever.
   *
   * RFC 7519 has no section 99.9. The corpus carries seven real rfc7519
   * extracts, so a harness that verified by finding nothing would report this as
   * green — which is the one failure mode the whole instrument exists to rule
   * out. It throws instead.
   */
  test("should refuse RFC 7519 §99.9, which does not exist", () => {
    const citation = toCitation("rfc7519", "99.9");

    expect(citation.url).toEqual("https://www.rfc-editor.org/rfc/rfc7519#section-99.9");
    expect(() => verifyCitation(citation, { governs: ["aud"] })).toThrow(SpecCorpusError);
    expect(() => verifyCitation(citation, { governs: ["aud"] })).toThrow(
      expect.objectContaining({
        code: "section_missing",
        message: "Section missing from corpus: rfc7519/section-99.9",
      }),
    );
  });

  test("should verify the claim its section governs", () => {
    expect(
      verifyCitation(toCitation("rfc7519", "4.1.3"), { governs: ["aud"] }).key,
    ).toEqual("rfc7519/section-4.1.3");
  });

  test("should accept a term named without quotes", () => {
    expect(() =>
      verifyCitation(toCitation("rfc9493", "3"), { governs: ["Subject Identifier"] }),
    ).not.toThrow();
  });

  test("should accept several terms one openid section governs", () => {
    expect(() =>
      verifyCitation(toCitation("openid-connect-core-1_0", "5.1"), {
        governs: ["email", "phone_number", "updated_at"],
      }),
    ).not.toThrow();
  });

  // G8 — presence is the machine-checkable proxy for governance, and the section
  // that defines "aud" never names "nonce".
  test("should refuse a term its section never names", () => {
    expect(() =>
      verifyCitation(toCitation("rfc7519", "4.1.3"), { governs: ["nonce"] }),
    ).toThrow(expect.objectContaining({ code: "term_not_governed" }));
  });

  test("should name every ungoverned term at once", () => {
    try {
      verifyCitation(toCitation("rfc7519", "4.1.3"), {
        governs: ["aud", "nonce", "cnf"],
      });
      expect.unreachable();
    } catch (error) {
      expect((error as SpecCorpusError).data).toEqual(
        expect.objectContaining({ ungoverned: ["nonce", "cnf"] }),
      );
    }
  });

  test("should still enforce the read guarantees when nothing is governed", () => {
    expect(
      verifyCitation(toCitation("rfc7519", "4.1.7"), { governs: [] }).heading,
    ).toEqual('4.1.7.  "jti" (JWT ID) Claim');
    expect(() => verifyCitation(toCitation("rfc7519", "99.9"), { governs: [] })).toThrow(
      expect.objectContaining({ code: "section_missing" }),
    );
  });
});
