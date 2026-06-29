import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { AegisError } from "../errors/index.js";
import { algToCoseLabel } from "../internal/cose/alg-labels.js";
import { Tag } from "../internal/cose/cbor.js";
import {
  COSE_HEADER,
  COSE_TAG,
  buildMacStructure,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { SignatureKit } from "./SignatureKit.js";

export type CwmKitOptions = {
  kryptos: IKryptos;
  logger: ILogger;
};

export type CwmTagOptions = {
  typ?: string;
};

export type CwmVerifyResult = {
  payload: Buffer;
  protectedHeader: Map<number, unknown>;
};

const unwrapMac0 = (value: unknown): Array<unknown> => {
  const contents =
    value instanceof Tag && value.tag === COSE_TAG.mac0 ? value.contents : value;
  if (!Array.isArray(contents) || contents.length !== 4) {
    throw new AegisError("Malformed COSE_Mac0", {
      code: "cose_malformed",
      title: "Malformed COSE_Mac0",
      details:
        "A COSE_Mac0 must be a 4-element array [protected, unprotected, payload, tag].",
    });
  }
  return contents;
};

/**
 * COSE_Mac0 (RFC 9052 §6.2) — symmetric authentication with a shared key. Uses
 * HMAC (COSE algs 5/6/7) over `MAC_structure` via the same SignatureKit the
 * JOSE HS* path uses; no AES-MAC, no new primitives. For same-party
 * (issuer == verifier) tokens.
 */
export class CwmKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  constructor(options: CwmKitOptions) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwmKit"]);
  }

  tag(payload: Buffer, options: CwmTagOptions = {}): Tag {
    this.logger.debug("MAC'ing COSE_Mac0", { options });

    const protectedMap = new Map<number, unknown>();
    protectedMap.set(COSE_HEADER.alg, algToCoseLabel(this.kryptos.algorithm));
    if (options.typ !== undefined) protectedMap.set(COSE_HEADER.typ, options.typ);
    const protectedHeader = encodeProtectedHeader(protectedMap);

    const unprotected = new Map<number, unknown>();
    unprotected.set(COSE_HEADER.kid, Buffer.from(this.kryptos.id, "utf8"));

    const toBeMaced = buildMacStructure(protectedHeader, payload);
    const tag = new SignatureKit({ kryptos: this.kryptos }).sign(toBeMaced);

    return new Tag(COSE_TAG.mac0, [protectedHeader, unprotected, payload, tag]);
  }

  verify(mac0: unknown): CwmVerifyResult {
    const [protectedHeader, , payload, tag] = unwrapMac0(mac0) as [
      Uint8Array,
      unknown,
      Uint8Array,
      Uint8Array,
    ];

    const toBeMaced = buildMacStructure(
      Buffer.from(protectedHeader),
      Buffer.from(payload),
    );
    const valid = new SignatureKit({ kryptos: this.kryptos }).verify(
      toBeMaced,
      Buffer.from(tag),
    );

    if (!valid) {
      throw new AegisError("Invalid COSE_Mac0 tag", {
        code: "cose_mac_invalid",
        title: "Invalid COSE MAC",
        details:
          "The COSE_Mac0 authentication tag did not verify against the resolved key.",
      });
    }

    return {
      payload: Buffer.from(payload),
      protectedHeader: decodeProtectedHeader(protectedHeader),
    };
  }
}
