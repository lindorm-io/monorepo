import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../errors/index.js";
import { coseLabelToAlg } from "../internal/cose/alg-labels.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { encodeCwtClaims, decodeCwtClaims } from "../internal/cose/cwt-claims.js";
import {
  COSE_HEADER,
  COSE_TAG,
  decodeProtectedHeader,
} from "../internal/cose/structures.js";
import { CwsKit } from "./CwsKit.js";

export type CwtKitOptions = {
  kryptos: IKryptos;
  logger: ILogger;
};

export type CwtSignOptions = {
  typ?: string;
  /** Allow lindorm-proprietary COSE encodings (default true); see encodeCwtClaims. */
  proprietary?: boolean;
};

export type CwtVerifyResult = {
  claims: Dict;
  protectedHeader: Map<number, unknown>;
  typ: string | undefined;
};

export type CwtDecoded = {
  /** The COSE structure inside the CWT (a COSE_Sign1 Tag for now). */
  cose: unknown;
  kid: string | undefined;
  algorithm: string | undefined;
  typ: string | undefined;
};

// A CWT may be the bare COSE object or wrapped in the CWT tag (61). Strip it.
const unwrapCwt = (value: unknown): unknown =>
  value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;

/**
 * CWT (RFC 8392) — the CBOR Web Token claims layer, the COSE analogue of
 * JwtKit. Encodes the DOMAIN-keyed common claims to a CWT claims map (via the
 * registry-driven codec), secures it with a COSE structure (COSE_Sign1 today),
 * and wraps the result in the CWT tag (61). Verify reverses it, returning the
 * domain-keyed claims the same verify floor consumes.
 */
export class CwtKit {
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  public constructor(options: CwtKitOptions) {
    this.kryptos = options.kryptos;
    this.logger = options.logger.child(["CwtKit"]);
  }

  public sign(common: Dict, options: CwtSignOptions = {}): Buffer {
    this.logger.debug("Minting CWT (COSE_Sign1)", { options });

    const payload = encodeCbor(
      encodeCwtClaims(common, { proprietary: options.proprietary }),
    );
    const sign1 = new CwsKit({ kryptos: this.kryptos, logger: this.logger }).sign(
      payload,
      {
        typ: options.typ,
      },
    );

    // Always emit the CWT tag (61); verify accepts tagged or untagged.
    return encodeCbor(new Tag(COSE_TAG.cwt, sign1));
  }

  public verify(token: Buffer): CwtVerifyResult {
    const cose = unwrapCwt(decodeCbor(token));
    const { payload, protectedHeader } = new CwsKit({
      kryptos: this.kryptos,
      logger: this.logger,
    }).verify(cose);

    // preferMap:false so nested claim objects (act, sub_id, events, custom)
    // decode as plain objects; the top CWT map has integer keys so it stays a Map.
    const claims = decodeCwtClaims(
      decodeCbor<Map<unknown, unknown>>(payload, { preferMap: false }),
    );
    const typ = protectedHeader.get(COSE_HEADER.typ);

    return {
      claims,
      protectedHeader,
      typ: typeof typ === "string" ? typ : undefined,
    };
  }

  /**
   * Decode a CWT WITHOUT verifying — exposes the kid/alg/typ from the headers so
   * the caller can resolve the verification key before checking the signature.
   */
  public static decode(token: Buffer): CwtDecoded {
    const cose = unwrapCwt(decodeCbor(token));
    const contents = cose instanceof Tag ? cose.contents : cose;

    if (!Array.isArray(contents) || contents.length < 2) {
      throw new AegisError("Malformed CWT", {
        code: "cose_malformed",
        title: "Malformed CWT",
        details: "The CWT does not contain a recognisable COSE structure.",
      });
    }

    const [protectedBstr, unprotected] = contents as [Uint8Array, Map<number, unknown>];
    const protectedHeader = decodeProtectedHeader(protectedBstr);

    const kidValue = unprotected.get(COSE_HEADER.kid);
    const algLabel = protectedHeader.get(COSE_HEADER.alg);
    const typ = protectedHeader.get(COSE_HEADER.typ);

    return {
      cose,
      kid:
        kidValue instanceof Uint8Array
          ? Buffer.from(kidValue).toString("utf8")
          : undefined,
      algorithm: typeof algLabel === "number" ? coseLabelToAlg(algLabel) : undefined,
      typ: typeof typ === "string" ? typ : undefined,
    };
  }
}
