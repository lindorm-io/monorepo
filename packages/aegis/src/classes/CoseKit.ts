import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { CwtKit, type CwtDecoded, type CwtVerifyResult } from "./CwtKit.js";

export type CoseKitOptions = {
  logger: ILogger;
};

export type CoseMintOptions = {
  /** COSE `typ` header (label 16) — the profile's COSE media type. */
  typ?: string;
};

/**
 * The COSE format facade — the COSE analogue of (the future) JoseKit. Aegis
 * hands it the resolved key + the DOMAIN-keyed common claims and gets back / in
 * a COSE token, so Aegis itself never touches the COSE wire kits.
 *
 * Today it issues signed CWTs (COSE_Sign1 via CwtKit -> CwsKit). It is the
 * dispatch point for the encrypted (COSE_Encrypt0 via CweKit) and MAC'd
 * (COSE_Mac0 via CwmKit) variants as those are wired into the profile flow.
 */
export class CoseKit {
  private readonly logger: ILogger;

  public constructor(options: CoseKitOptions) {
    this.logger = options.logger.child(["CoseKit"]);
  }

  /** Mint a signed CWT (COSE_Sign1) from the domain-keyed common claims. */
  public sign(kryptos: IKryptos, common: Dict, options: CoseMintOptions = {}): Buffer {
    return new CwtKit({ kryptos, logger: this.logger }).sign(common, options);
  }

  /** Verify a CWT with an already-resolved key; returns the domain-keyed claims. */
  public verify(kryptos: IKryptos, token: Buffer): CwtVerifyResult {
    return new CwtKit({ kryptos, logger: this.logger }).verify(token);
  }

  /** Decode the COSE headers (kid/alg/typ) WITHOUT verifying, for key resolution. */
  public decode(token: Buffer): CwtDecoded {
    return CwtKit.decode(token);
  }
}
