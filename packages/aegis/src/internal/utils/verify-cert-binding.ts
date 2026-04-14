import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { AegisError } from "../../errors";
import { CertBindingMode } from "../../types";

type VerifyCertBindingOptions = {
  header: { x5t: string | undefined; x5tS256: string | undefined };
  kryptos: IKryptos;
  logger: ILogger;
  mode: CertBindingMode;
};

// POST-VERIFY CONTENT TAMPER CHECK.
// This runs AFTER the signature has already been verified with the
// amphora-sourced kryptos. It is NOT a key selection step. Header cert
// fields remain forbidden as key sources — see the SECURITY INVARIANT
// in Aegis.kryptosSig.
//
// Mode semantics:
// - "strict" (default): if the header carries a thumbprint but the
//   amphora-sourced kryptos has no certificateChain, throw. This catches
//   the case where the verifying kryptos has lost its chain (rotation,
//   clone, backfill) and we can no longer prove the binding.
// - "lax": if the header carries a thumbprint but the kryptos has no
//   certificateChain, log a warning and pass through. The signature has
//   already been verified, but we cannot perform the binding check.
//   Lax NEVER skips a thumbprint mismatch — that's always a hard reject.
export const verifyCertBinding = ({
  header,
  kryptos,
  logger,
  mode,
}: VerifyCertBindingOptions): void => {
  if (header.x5tS256 !== undefined) {
    if (kryptos.x5tS256 === undefined) {
      if (mode === "strict") {
        throw new AegisError(
          "token header x5t#S256 present but signing kryptos has no certificateChain",
          { debug: { kryptosId: kryptos.id } },
        );
      }
      logger.warn(
        "Cert binding: token header x5t#S256 present but signing kryptos has no certificateChain (lax mode — passing through)",
        { kryptosId: kryptos.id },
      );
    } else if (header.x5tS256 !== kryptos.x5tS256) {
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
      if (mode === "strict") {
        throw new AegisError(
          "token header x5t present but signing kryptos has no certificateChain",
          { debug: { kryptosId: kryptos.id } },
        );
      }
      logger.warn(
        "Cert binding: token header x5t present but signing kryptos has no certificateChain (lax mode — passing through)",
        { kryptosId: kryptos.id },
      );
    } else if (header.x5t !== kryptos.x5t) {
      throw new AegisError("signing certificate thumbprint mismatch", {
        debug: { expected: kryptos.x5t, received: header.x5t },
      });
    }
  }
};
