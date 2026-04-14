import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { AegisError } from "../../errors";
import { CertBindingMode } from "../../types";

type VerifyCertBindingOptions = {
  header: { x5tS256: string | undefined };
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
// Aegis binds exclusively on x5t#S256 (SHA-256). The legacy SHA-1 `x5t`
// header is not verified — if an incoming token carries `x5t` but no
// `x5t#S256`, cert binding is simply not checked.
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
  if (header.x5tS256 === undefined) return;

  if (kryptos.certificateThumbprint === null) {
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
    return;
  }

  if (header.x5tS256 !== kryptos.certificateThumbprint) {
    throw new AegisError("signing certificate thumbprint mismatch", {
      debug: {
        expected: kryptos.certificateThumbprint,
        received: header.x5tS256,
      },
    });
  }
};
