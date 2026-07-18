import { lindormId } from "@lindorm/random";
import { hkdfSync } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromDerive } from "../../../types/index.js";
import { isKryptos } from "../is-kryptos.js";
import { keyIdFromBytes } from "../key-id-from-bytes.js";
import { getOctSize } from "../oct/get-size.js";

// Extra HKDF-Expand bytes taken past the key material to seed a deterministic
// id. HKDF-Expand output is prefix-stable (T(1)|T(2)|…), so the leading `size`
// bytes are byte-identical whether we expand `size` or `size + ID_BYTES`.
const ID_BYTES = 16;

// Resolve the HKDF input keying material (IKM). A string passphrase keeps the
// exact legacy behaviour (utf8 bytes); an oct seed key contributes its raw
// private key bytes.
const resolveIkm = (deriveFrom: KryptosFromDerive["deriveFrom"]): Buffer => {
  if (isKryptos(deriveFrom)) {
    if (deriveFrom.type !== "oct") {
      throw new KryptosError("Invalid seed key type", {
        code: "unsupported_seed_key_type",
        title: "Unsupported Seed Key Type",
        details: `The derive seed key must be an oct key; received '${deriveFrom.type}'.`,
        data: { type: deriveFrom.type },
      });
    }

    if (!deriveFrom.hasPrivateKey) {
      throw new KryptosError("Missing seed private key", {
        code: "missing_seed_private_key",
        title: "Missing Seed Private Key",
        details: "The derive seed oct key has no private key material to derive from.",
      });
    }

    return Buffer.from(deriveFrom.export("der").privateKey as Buffer);
  }

  return Buffer.from(deriveFrom, "utf8");
};

// Expand `size` key bytes plus `ID_BYTES` id-seed bytes from a single HKDF call.
const expand = (options: KryptosFromDerive): { key: Buffer; idSeed: Buffer } => {
  if (!options.deriveFrom) {
    throw new KryptosError("Missing passphrase", {
      code: "missing_oct_passphrase",
      title: "Missing Oct Passphrase",
      details: "No passphrase or seed key was provided to derive the oct key.",
    });
  }

  const size = getOctSize(options);

  // A path binds the algorithm into `info` (preventing cross-algorithm reuse);
  // absent a path we keep the legacy `lindorm:oct:<algorithm>` info verbatim.
  const info = options.path
    ? `${options.path}:${options.algorithm}`
    : "lindorm:oct:" + options.algorithm;

  const out = Buffer.from(
    hkdfSync(
      "sha256",
      resolveIkm(options.deriveFrom),
      Buffer.alloc(0),
      Buffer.from(info),
      size + ID_BYTES,
    ),
  );

  return { key: out.subarray(0, size), idSeed: out.subarray(size, size + ID_BYTES) };
};

export const createDerFromDerive = (options: KryptosFromDerive): KryptosBuffer => {
  switch (options.type) {
    case "oct": {
      const { key, idSeed } = expand(options);

      // Explicit id always wins. With a path, the id is derived deterministically
      // so a re-derived key reproduces it (ciphertexts embed the key id). Legacy
      // (no path, no id) keeps a fresh random id, exactly as the Kryptos
      // constructor would have assigned.
      const id = options.id
        ? options.id
        : options.path
          ? keyIdFromBytes(idSeed)
          : lindormId({ namespace: "key", length: 16 });

      return {
        id,
        algorithm: options.algorithm,
        privateKey: Buffer.from(key),
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };
    }

    default:
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type '${options.type}' is not supported for derive import; only 'oct' is allowed.`,
        data: { type: options.type },
      });
  }
};
