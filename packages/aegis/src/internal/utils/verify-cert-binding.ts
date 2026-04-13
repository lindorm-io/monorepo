import { IKryptos } from "@lindorm/kryptos";
import { AegisError } from "../../errors";

// POST-VERIFY CONTENT TAMPER CHECK.
// This runs AFTER the signature has already been verified with the
// amphora-sourced kryptos. It is NOT a key selection step. Header cert
// fields remain forbidden as key sources — see the SECURITY INVARIANT
// in Aegis.kryptosSig.
export const verifyCertBinding = (
  kryptos: IKryptos,
  header: { x5t: string | undefined; x5tS256: string | undefined },
): void => {
  if (header.x5tS256 !== undefined) {
    if (kryptos.x5tS256 === undefined) {
      throw new AegisError(
        "token header x5t#S256 present but signing kryptos has no certificateChain",
        { debug: { kryptosId: kryptos.id } },
      );
    }
    if (header.x5tS256 !== kryptos.x5tS256) {
      throw new AegisError("signing certificate thumbprint mismatch", {
        debug: {
          expected: kryptos.x5tS256,
          received: header.x5tS256,
        },
      });
    }
  }

  if (header.x5t !== undefined) {
    if (kryptos.x5t === undefined) {
      throw new AegisError(
        "token header x5t present but signing kryptos has no certificateChain",
        { debug: { kryptosId: kryptos.id } },
      );
    }
    if (header.x5t !== kryptos.x5t) {
      throw new AegisError("signing certificate thumbprint mismatch", {
        debug: { expected: kryptos.x5t, received: header.x5t },
      });
    }
  }
};
