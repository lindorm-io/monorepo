import { AegisError } from "../../errors/index.js";

export type KeyOperation = "sign" | "verify" | "encrypt" | "decrypt";

export type KeyOperationCopy = {
  /** `<operation>_key_not_found` — no vault key satisfies the policy. */
  notFound: { message: string; title: string; details: string };
  /** `<operation>_key_policy_violation` — a key reached us that the policy forbids. */
  violation: { message: string; title: string; details: string };
};

/**
 * The error copy for each key operation. With no fallback in key selection, a
 * policy miss is the ONLY outcome — so the error IS the feature: amphora throws
 * a bare "Kryptos not found using query", and it is the difference between a
 * three-minute and a three-hour debug to say which policy went unsatisfied, for
 * which profile.
 *
 * Returns a decision; the caller throws (the switch's own default throws, as
 * the operation set is closed).
 */
export const describeKeyOperation = (operation: KeyOperation): KeyOperationCopy => {
  switch (operation) {
    case "sign":
      return {
        notFound: {
          message: "No signing key satisfies the signing policy",
          title: "Signing Key Not Found",
          details:
            "No active key in the vault satisfies the signing policy, so no token can be minted; the resolved policy is in the error data. There is deliberately no fallback to a key the policy forbids.",
        },
        violation: {
          message: "Signing key does not satisfy the signing policy",
          title: "Signing Key Policy Violation",
          details:
            "The signing key that was supplied or pinned does not satisfy the signing policy for this token — for example an HS256 client secret offered for an artifact whose profile mandates an asymmetric signature.",
        },
      };

    case "verify":
      return {
        notFound: {
          message: "No verification key satisfies the verification policy",
          title: "Verification Key Not Found",
          details:
            "No key in the vault satisfies the verification policy for this token, so its signature cannot be checked.",
        },
        violation: {
          message: "Verification key does not satisfy the verification policy",
          title: "Verification Key Policy Violation",
          details:
            "The key named by the token's kid header does not satisfy the verification policy, so the token is rejected before its signature is checked; a token must not be able to choose the class of key that verifies it (RFC 8725 §3.1).",
        },
      };

    case "encrypt":
      return {
        notFound: {
          message: "No encryption key satisfies the encryption policy",
          title: "Encryption Key Not Found",
          details:
            "No key in the vault satisfies the encryption policy, so the recipient key for this token cannot be resolved.",
        },
        violation: {
          message: "Encryption key does not satisfy the encryption policy",
          title: "Encryption Key Policy Violation",
          details:
            "The encryption key that was supplied or pinned does not satisfy the encryption policy for this token.",
        },
      };

    case "decrypt":
      return {
        notFound: {
          message: "No decryption key satisfies the decryption policy",
          title: "Decryption Key Not Found",
          details:
            "No key in the vault satisfies the decryption policy for this token; a key holding only a public half can never decrypt, so it is not a candidate.",
        },
        violation: {
          message: "Decryption key does not satisfy the decryption policy",
          title: "Decryption Key Policy Violation",
          details:
            "The key named by the token's kid header does not satisfy the decryption policy — most commonly because it holds no private half, which is what decryption requires.",
        },
      };

    default:
      throw new AegisError(`Unsupported key operation: ${operation as string}`, {
        code: "unsupported_key_operation",
        data: { operation },
        title: "Unsupported Key Operation",
        details:
          "Key resolution was asked for an operation that is not one of sign, verify, encrypt, or decrypt.",
      });
  }
};
