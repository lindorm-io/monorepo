import { AegisDomainError } from "../../errors/index.js";
import { verifyPartyBinding } from "./verify-party-binding.js";
import { describe, expect, test } from "vitest";

describe("verifyPartyBinding", () => {
  test("should no-op when no partyRecipient is configured", () => {
    expect(() =>
      verifyPartyBinding({ expected: undefined, actual: "anything" }),
    ).not.toThrow();
  });

  test("should pass when the incoming apv matches the configured recipient", () => {
    expect(() =>
      verifyPartyBinding({ expected: "recipient", actual: "recipient" }),
    ).not.toThrow();
  });

  test("should reject when the incoming apv differs from the configured recipient", () => {
    expect(() => verifyPartyBinding({ expected: "recipient", actual: "other" })).toThrow(
      AegisDomainError,
    );
  });

  test("should reject with party_recipient_mismatch when the incoming apv is absent", () => {
    let caught: unknown;
    try {
      verifyPartyBinding({ expected: "recipient", actual: undefined });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AegisDomainError);
    expect((caught as AegisDomainError).code).toBe("party_recipient_mismatch");
  });
});
