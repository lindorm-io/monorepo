import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { AegisError } from "../errors/index.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { Tag } from "../internal/cose/cbor.js";
import {
  COSE_HEADER,
  COSE_TAG,
  buildSigStructure,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { SignatureKit } from "./SignatureKit.js";

export type CwsKitOptions = {
  kryptos: IKryptos;
  logger: ILogger;
};

export type CwsSignOptions = {
  /** COSE `typ` header (label 16, RFC 9596) — the profile's COSE media type. */
  typ?: string;
};

export type CwsVerifyResult = {
  payload: Buffer;
  protectedHeader: Map<number, unknown>;
  unprotected: Map<number, unknown>;
};

const unwrapSign1 = (value: unknown): Array<unknown> => {
  const contents =
    value instanceof Tag && value.tag === COSE_TAG.sign1 ? value.contents : value;
  if (!Array.isArray(contents) || contents.length !== 4) {
    throw new AegisError("Malformed COSE_Sign1", {
      code: "cose_malformed",
      title: "Malformed COSE_Sign1",
      details:
        "A COSE_Sign1 must be a 4-element array [protected, unprotected, payload, signature].",
    });
  }
  return contents;
};

/**
 * COSE_Sign1 (RFC 9052 §4.4) — the COSE analogue of JwsKit. Signs/verifies a
 * payload with a single signer, producing/consuming a CBOR tag-18 structure.
 * The signature is computed over `Sig_structure` with the SAME primitive the
 * JOSE path uses (SignatureKit, raw r‖s for ECDSA), so no new crypto.
 *
 * Operates on the COSE_Sign1 STRUCTURE (a `Tag`), not bytes — the CBOR
 * encode/decode (and any outer CWT tag 61) is owned by the layer above
 * (CwtKit), so the same Sign1 can be tagged or embedded.
 */
export class CwsKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  public constructor(options: CwsKitOptions) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwsKit"]);
  }

  public sign(payload: Buffer, options: CwsSignOptions = {}): Tag {
    this.logger.debug("Signing COSE_Sign1", { options });

    const protectedMap = new Map<number, unknown>();
    protectedMap.set(COSE_HEADER.alg, algToCoseLabel(this.kryptos.algorithm));
    if (options.typ !== undefined) protectedMap.set(COSE_HEADER.typ, options.typ);
    const protectedHeader = encodeProtectedHeader(protectedMap);

    // kid travels UNprotected — it is read to resolve the verification key
    // before the signature is checked (amphora kid-only resolution).
    const unprotected = new Map<number, unknown>();
    unprotected.set(COSE_HEADER.kid, Buffer.from(this.kryptos.id, "utf8"));

    const toBeSigned = buildSigStructure(protectedHeader, payload);
    const signature = new SignatureKit({ kryptos: this.kryptos, raw: true }).sign(
      toBeSigned,
    );

    return new Tag(COSE_TAG.sign1, [protectedHeader, unprotected, payload, signature]);
  }

  public verify(sign1: unknown): CwsVerifyResult {
    const [protectedHeader, unprotected, payload, signature] = unwrapSign1(sign1) as [
      Uint8Array,
      Map<number, unknown>,
      Uint8Array,
      Uint8Array,
    ];

    const toBeSigned = buildSigStructure(
      Buffer.from(protectedHeader),
      Buffer.from(payload),
    );
    const valid = new SignatureKit({ kryptos: this.kryptos, raw: true }).verify(
      toBeSigned,
      Buffer.from(signature),
    );

    if (!valid) {
      throw new AegisError("Invalid COSE_Sign1 signature", {
        code: "cose_signature_invalid",
        title: "Invalid COSE Signature",
        details: "The COSE_Sign1 signature did not verify against the resolved key.",
      });
    }

    return {
      payload: Buffer.from(payload),
      protectedHeader: decodeProtectedHeader(protectedHeader),
      unprotected,
    };
  }

  /**
   * Read the `kid` (unprotected, label 4) from a COSE_Sign1 structure WITHOUT
   * verifying — so the caller can resolve the verification key first.
   */
  public static peekKid(sign1: unknown): string | undefined {
    const [, unprotected] = unwrapSign1(sign1) as [unknown, Map<number, unknown>];
    const kid = unprotected.get(COSE_HEADER.kid);
    return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
  }
}
