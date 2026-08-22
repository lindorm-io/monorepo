import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { CoseError } from "../../errors/index.js";
import { isOfficialCoseAlg } from "./alg-labels.js";
import { isOfficialCoseEnc } from "./enc-labels.js";

/**
 * What is being gated: a signing algorithm (`alg`) or a content encryption
 * (`enc`). The two carry different value sets, so the parameter bag is a
 * discriminated union rather than one widened `string`.
 */
export type AssertCoseRegisteredOptions =
  | {
      kind: "alg";
      value: KryptosAlgorithm;
      proprietary: boolean | undefined;
      error: typeof CoseError;
    }
  | {
      kind: "enc";
      value: KryptosEncryption;
      proprietary: boolean | undefined;
      error: typeof CoseError;
    };

/**
 * The COSE INTEROP gate, for both write kits. A non-proprietary write refuses a
 * value with no OFFICIAL COSE label, so the token stays readable by a foreign
 * implementation; a private-use label is legal COSE but on-platform only, so it
 * requires `proprietary: true` — the flag that threads to the claim codec too.
 *
 * ⚠ The `alg` side guards a FUTURE private-use algorithm; every kryptos signing
 * algorithm is registered. The `enc` side is the reachable twin, because the
 * AES-CBC-HMAC family has no COSE registration at all.
 */
export const assertCoseRegistered = (options: AssertCoseRegisteredOptions): void => {
  if (options.proprietary) return;

  switch (options.kind) {
    case "alg": {
      if (isOfficialCoseAlg(options.value)) return;

      throw new options.error(
        `Algorithm "${options.value}" has no official COSE registration`,
        {
          code: "cose_alg_not_registered",
          data: { algorithm: options.value },
          title: "COSE Algorithm Not Registered",
          details:
            "In interoperable (non-proprietary) mode the signing algorithm must carry an official COSE-RFC label; a private-use algorithm requires proprietary mode.",
        },
      );
    }

    case "enc": {
      if (isOfficialCoseEnc(options.value)) return;

      throw new options.error(
        `Encryption "${options.value}" has no official COSE registration`,
        {
          code: "cose_enc_not_registered",
          data: { encryption: options.value },
          title: "COSE Encryption Not Registered",
          details:
            "In interoperable (non-proprietary) mode the content encryption must carry an official COSE-RFC label; the AES-CBC-HMAC family is private-use and requires proprietary mode.",
        },
      );
    }

    default: {
      const exhaustive: never = options;
      throw new CoseError("Unhandled COSE registration kind", {
        code: "cose_unhandled_registration_kind",
        data: { kind: String((exhaustive as { kind?: unknown }).kind) },
        title: "Unhandled COSE Registration Kind",
        details:
          "The interop gate was asked about something other than a signing algorithm or a content encryption.",
      });
    }
  }
};
