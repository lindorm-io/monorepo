#!/usr/bin/env node

import { realpathSync } from "fs";
import { pathToFileURL } from "url";
import { confirm, input, select } from "@inquirer/prompts";
import { expiresAt, isReadableTime } from "@lindorm/date";
import { AES_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import { program } from "commander";
import { KryptosKit } from "./classes/index.js";
import { KryptosError } from "./errors/index.js";
import { getEcCurve } from "./internal/utils/ec/get-curve.js";
import { getOkpCurve } from "./internal/utils/okp/get-curve.js";
import {
  EC_CURVES,
  EC_ENC_ALGORITHMS,
  EC_SIG_ALGORITHMS,
  type KryptosAlgorithm,
  type KryptosCertificateOption,
  type KryptosCurve,
  type KryptosEncryption,
  type KryptosType,
  type KryptosUse,
  OCT_ENC_DIR_ALGORITHMS,
  OCT_ENC_STD_ALGORITHMS,
  OCT_SIG_ALGORITHMS,
  OKP_ENC_ALGORITHMS,
  OKP_ENC_CURVES,
  OKP_SIG_ALGORITHMS,
  OKP_SIG_CURVES,
  RSA_ENC_ALGORITHMS,
  RSA_SIG_ALGORITHMS,
} from "./types/index.js";

program.name("kryptos").description("CLI for managing kryptos keys");

const selectType = async (): Promise<KryptosType> =>
  await select({
    message: "Type",
    choices: [
      { value: "EC", name: "[EC] - Elliptic Curve" },
      { value: "OKP", name: "[OKP] - Octet Key Pair" },
      { value: "RSA", name: "[RSA] - Rivest-Shamir-Adleman" },
      { value: "oct", name: "[oct] - Octet Key" },
    ],
  });

const selectUse = async (): Promise<KryptosUse> =>
  await select({
    message: "Use",
    choices: [
      { value: "sig", name: "Signature" },
      { value: "enc", name: "Encryption" },
    ],
  });

const switchAlgorithmChoices = (
  type: KryptosType,
  use: KryptosUse,
): readonly string[] => {
  switch (use) {
    case "enc":
      switch (type) {
        case "EC":
          return EC_ENC_ALGORITHMS;
        case "OKP":
          return OKP_ENC_ALGORITHMS;
        case "RSA":
          return RSA_ENC_ALGORITHMS;
        case "oct":
          return [...OCT_ENC_STD_ALGORITHMS, ...OCT_ENC_DIR_ALGORITHMS];
        default:
          throw new KryptosError("Unsupported key type", {
            code: "unsupported_key_type",
            title: "Unsupported Key Type",
            details: `The key type "${type}" is not supported for encryption (enc) use.`,
            data: { type, use },
          });
      }

    case "sig":
      switch (type) {
        case "EC":
          return EC_SIG_ALGORITHMS;
        case "OKP":
          return OKP_SIG_ALGORITHMS;
        case "RSA":
          return RSA_SIG_ALGORITHMS;
        case "oct":
          return OCT_SIG_ALGORITHMS;
        default:
          throw new KryptosError("Unsupported key type", {
            code: "unsupported_key_type",
            title: "Unsupported Key Type",
            details: `The key type "${type}" is not supported for signature (sig) use.`,
            data: { type, use },
          });
      }

    default:
      throw new KryptosError("Unsupported key use", {
        code: "unsupported_key_use",
        title: "Unsupported Key Use",
        details: `The key use "${use as string}" is not supported; use sig or enc.`,
        data: { use },
      });
  }
};

const selectAlgorithm = async (
  type: KryptosType,
  use: KryptosUse,
): Promise<KryptosAlgorithm> =>
  (await select({
    message: "Algorithm",
    choices: switchAlgorithmChoices(type, use),
  })) as KryptosAlgorithm;

const selectEncryption = async (): Promise<KryptosEncryption> =>
  await select({
    message: "Encryption",
    choices: AES_ENCRYPTION_ALGORITHMS,
    default: "A256GCM",
  });

// The curves a (type, algorithm) pair can legitimately carry, plus the library
// default. `null` means the key type has no selectable curve (RSA, oct, AKP).
const curveConfigFor = (
  type: KryptosType,
  algorithm: KryptosAlgorithm,
): { choices: readonly KryptosCurve[]; fallback: KryptosCurve } | null => {
  switch (type) {
    case "EC":
      if ((EC_SIG_ALGORITHMS as readonly string[]).includes(algorithm)) {
        // ES256/384/512 each pin exactly one P-curve.
        const curve = getEcCurve({ algorithm });
        return { choices: [curve], fallback: curve };
      }
      if ((EC_ENC_ALGORITHMS as readonly string[]).includes(algorithm)) {
        return { choices: EC_CURVES, fallback: getEcCurve({ algorithm }) };
      }
      return null;

    case "OKP":
      if ((OKP_SIG_ALGORITHMS as readonly string[]).includes(algorithm)) {
        return { choices: OKP_SIG_CURVES, fallback: getOkpCurve({ algorithm }) };
      }
      if ((OKP_ENC_ALGORITHMS as readonly string[]).includes(algorithm)) {
        return { choices: OKP_ENC_CURVES, fallback: getOkpCurve({ algorithm }) };
      }
      return null;

    default:
      return null;
  }
};

const selectCurve = async (
  choices: readonly KryptosCurve[],
  fallback: KryptosCurve,
): Promise<KryptosCurve> =>
  (await select({
    message: "Curve",
    choices: choices as readonly string[],
    default: fallback,
  })) as KryptosCurve;

// Resolve the curve from the flag (validated against the algorithm), an
// interactive prompt (only when the algorithm supports more than one curve), or
// leave it to the library default.
const resolveCurve = async (
  type: KryptosType,
  algorithm: KryptosAlgorithm,
  curve: string | undefined,
  scripted: boolean,
): Promise<KryptosCurve | undefined> => {
  const config = curveConfigFor(type, algorithm);

  if (!config) {
    if (curve) {
      throw new KryptosError("Curve not supported for key type", {
        code: "invalid_curve",
        title: "Invalid Curve",
        details: `The key type '${type}' does not take a curve.`,
        data: { type, curve },
      });
    }
    return undefined;
  }

  if (curve) {
    if (!(config.choices as readonly string[]).includes(curve)) {
      throw new KryptosError("Invalid curve for algorithm", {
        code: "invalid_curve",
        title: "Invalid Curve",
        details: `Curve '${curve}' is not valid for algorithm '${algorithm}'. Valid curves: ${config.choices.join(", ")}.`,
        data: { algorithm, curve, valid: [...config.choices] },
      });
    }
    return curve as KryptosCurve;
  }

  if (!scripted && config.choices.length > 1) {
    return selectCurve(config.choices, config.fallback);
  }

  return undefined;
};

// Convert a `@lindorm/date` duration string into an absolute expiry Date. Empty
// falls through to the library default; an unparseable duration throws.
const resolveExpiry = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;

  if (!isReadableTime(value)) {
    throw new KryptosError("Invalid expiry duration", {
      code: "invalid_expiry",
      title: "Invalid Expiry",
      details: `The expiry '${value}' is not a valid duration string (e.g. '20y', '6mo', '90d').`,
      data: { expiry: value },
    });
  }

  return expiresAt(value);
};

const inputPurpose = async (): Promise<string | null> => {
  const value = await input({
    message: "Purpose (leave empty for any)",
    default: "",
  });
  return value.trim() || null;
};

const inputOptional = async (message: string): Promise<string | undefined> => {
  const value = await input({ message, default: "" });
  return value.trim() || undefined;
};

const inputList = async (message: string): Promise<Array<string> | undefined> => {
  const value = await input({ message, default: "" });
  const list = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
};

// Every field is a flag that falls back to an interactive prompt when unset, so
// `kryptos generate` is fully interactive, fully scriptable, or any mix.
export type GenerateOptions = {
  type?: string;
  use?: string;
  algorithm?: string;
  curve?: string;
  encryption?: string;
  expiry?: string;
  purpose?: string;
  certificate?: string;
  subject?: string;
  organization?: string;
  san?: Array<string>;
  pathLength?: string;
  ca?: string;
};

const resolveCertificate = async (
  type: KryptosType,
  options: GenerateOptions,
  scripted: boolean,
): Promise<KryptosCertificateOption | undefined> => {
  // Symmetric (oct) keys have no public half, so they cannot carry an X.509 cert.
  if (type === "oct") return undefined;

  let mode = options.certificate as "self-signed" | "root-ca" | "ca-signed" | undefined;

  // No mode flag → a scripted run simply gets no cert; interactively, ask.
  if (!mode) {
    if (scripted) return undefined;

    const wanted = await confirm({
      message: "Generate an X.509 certificate for this key?",
      default: false,
    });
    if (!wanted) return undefined;

    mode = await select<"self-signed" | "root-ca" | "ca-signed">({
      message: "Certificate mode",
      choices: [
        { value: "self-signed", name: "self-signed — a standalone leaf certificate" },
        {
          value: "root-ca",
          name: "root-ca — a self-signed CA that can sign other certs",
        },
        { value: "ca-signed", name: "ca-signed — signed by an existing CA key" },
      ],
    });
  }

  // Cert fields: flag if given, else prompt — but never prompt in a scripted run.
  const interactive = !scripted;

  const subject =
    options.subject ??
    (interactive
      ? await inputOptional("Subject common name / CN (optional)")
      : undefined);
  const organization =
    options.organization ??
    (interactive ? await inputOptional("Organization / O (optional)") : undefined);
  const subjectAlternativeNames = options.san?.length
    ? options.san
    : interactive
      ? await inputList("Subject alternative names (comma-separated, optional)")
      : undefined;

  if (mode === "root-ca") {
    const pathLength =
      options.pathLength ??
      (interactive
        ? await inputOptional("Path length constraint (optional integer)")
        : undefined);
    return {
      mode,
      subject,
      organization,
      subjectAlternativeNames,
      pathLengthConstraint: pathLength != null ? Number(pathLength) : undefined,
    };
  }

  if (mode === "ca-signed") {
    // Parent CA: --ca flag (works interactively too), else prompt to paste it.
    const caEnv =
      options.ca ??
      (interactive
        ? await input({
            message: "Issuing CA key (its kryptos:… env string)",
            validate: (value) =>
              value.trim().startsWith("kryptos:")
                ? true
                : "Paste the kryptos: env string exported from the CA key",
          })
        : undefined);

    if (!caEnv) {
      throw new KryptosError("Missing issuing CA for a ca-signed certificate", {
        code: "missing_issuing_ca",
        title: "Missing Issuing CA",
        details:
          "A ca-signed certificate needs the issuing CA — pass --ca <kryptos:… env string>.",
      });
    }

    return {
      mode,
      ca: KryptosKit.env.import(caEnv.trim()),
      subject,
      organization,
      subjectAlternativeNames,
    };
  }

  return { mode, subject, organization, subjectAlternativeNames };
};

export const generate = async (options: GenerateOptions = {}): Promise<void> => {
  // `--type` flips the command into scripted mode: nothing is prompted, every
  // value comes from a flag (optional ones fall back to their default, not a
  // prompt). Without it the command is fully interactive, and any flag that IS
  // passed pre-fills the matching answer.
  const scripted = options.type != null;

  if (!scripted) {
    console.log("This script will generate a Kryptos key for you.\n\n");
  }

  const type = (options.type as KryptosType) ?? (await selectType());

  const use = (options.use as KryptosUse) ?? (await selectUse());

  const algorithm =
    (options.algorithm as KryptosAlgorithm) ?? (await selectAlgorithm(type, use));

  const curve = await resolveCurve(type, algorithm, options.curve, scripted);

  let encryption = options.encryption as KryptosEncryption | undefined;

  if (use === "enc" && !encryption && !scripted) {
    encryption = await selectEncryption();
  }

  const purpose = scripted ? (options.purpose ?? null) : await inputPurpose();

  const keyExpiresAt = resolveExpiry(
    options.expiry ??
      (scripted
        ? undefined
        : await inputOptional("Expiry duration (e.g. 20y, 6mo — empty for default)")),
  );

  const certificate = await resolveCertificate(type, options, scripted);

  const kryptos = KryptosKit.generate.auto({
    algorithm,
    certificate,
    purpose,
    ...(curve ? { curve } : {}),
    ...(encryption ? { encryption } : {}),
    ...(keyExpiresAt ? { expiresAt: keyExpiresAt } : {}),
  });

  const result = KryptosKit.env.export(kryptos);

  if (kryptos.hasCertificate) {
    console.log(
      `\nGenerated an X.509 certificate (thumbprint ${kryptos.certificateThumbprint}). It is embedded in the env string below.`,
    );
  }

  console.log(
    `\nCopy the string to your env:\n\n${result}\n\nThe string can be imported into a Kryptos object by using KryptosKit:\n\nconst key = KryptosKit.env.import("${result}");\n`,
  );
};

// Every field is a flag that falls back to an interactive prompt when unset, so
// `kryptos derive` mirrors `generate`: fully interactive, fully scriptable, or a
// mix. `--type` (oct only) flips scripted mode, exactly like `generate`.
export type DeriveOptions = {
  seed?: string;
  path?: string;
  type?: string;
  use?: string;
  algorithm?: string;
  encryption?: string;
  purpose?: string;
};

const inputSeed = async (): Promise<string> =>
  await input({
    message: "Seed key (its kryptos:… env string)",
    validate: (value) =>
      value.trim().startsWith("kryptos:")
        ? true
        : "Paste the kryptos: env string exported from the seed key",
  });

export const derive = async (options: DeriveOptions = {}): Promise<void> => {
  // `--type` flips scripted mode (oct is the only allowed type). Without it the
  // command is interactive; any flag that IS passed pre-fills that answer.
  const scripted = options.type != null;

  if (options.type != null && options.type !== "oct") {
    throw new KryptosError("Unsupported derive key type", {
      code: "unsupported_derive_key_type",
      title: "Unsupported Derive Key Type",
      details: `Key derivation only supports 'oct' keys; received '${options.type}'.`,
      data: { type: options.type },
    });
  }

  if (!scripted) {
    console.log("This script will derive a deterministic oct key from a seed.\n\n");
  }

  const seedEnv = options.seed ?? (scripted ? undefined : await inputSeed());

  if (!seedEnv) {
    throw new KryptosError("Missing seed key", {
      code: "missing_seed",
      title: "Missing Seed Key",
      details: "A seed key is required — pass --seed <kryptos:… env string>.",
    });
  }

  const seed = KryptosKit.env.import(seedEnv.trim());

  const path =
    options.path ??
    (scripted
      ? undefined
      : await input({
          message: "Derivation path (e.g. urn:lindorm:tyr:kek:v1)",
          validate: (value) => (value.trim() ? true : "A derivation path is required"),
        }));

  if (!path) {
    throw new KryptosError("Missing derivation path", {
      code: "missing_path",
      title: "Missing Derivation Path",
      details: "A derivation path is required — pass --path <path>.",
    });
  }

  const use = (options.use as KryptosUse) ?? (await selectUse());

  const algorithm =
    (options.algorithm as KryptosAlgorithm) ?? (await selectAlgorithm("oct", use));

  let encryption = options.encryption as KryptosEncryption | undefined;

  if (use === "enc" && !encryption && !scripted) {
    encryption = await selectEncryption();
  }

  const purpose = scripted ? (options.purpose ?? null) : await inputPurpose();

  const kryptos = KryptosKit.from.derive({
    type: "oct",
    use,
    algorithm,
    deriveFrom: seed,
    path: path.trim(),
    purpose,
    ...(encryption ? { encryption } : {}),
  });

  const result = KryptosKit.env.export(kryptos);

  console.log(
    `\nCopy the string to your env:\n\n${result}\n\nThe string can be imported into a Kryptos object by using KryptosKit:\n\nconst key = KryptosKit.env.import("${result}");\n`,
  );
};

program
  .command("generate")
  .description(
    "Generate a Kryptos key (flags are optional; anything omitted is prompted)",
  )
  .option("-t, --type <type>", "key type: EC, OKP, RSA, oct")
  .option("-u, --use <use>", "key use: sig, enc")
  .option("-a, --algorithm <algorithm>", "algorithm, e.g. ES384, RS256, EdDSA")
  .option("--curve <curve>", "curve when the algorithm supports more than one")
  .option("-e, --encryption <encryption>", "AES encryption for enc keys, e.g. A256GCM")
  .option("--expiry <duration>", "validity duration, e.g. 20y, 6mo (default 25y)")
  .option("-p, --purpose <purpose>", "key purpose")
  .option("-c, --certificate <mode>", "stamp a cert: self-signed, root-ca, ca-signed")
  .option("--subject <subject>", "certificate subject / CN")
  .option("--organization <organization>", "certificate organization / O")
  .option("--san <san...>", "certificate subject alternative name (repeatable)")
  .option("--path-length <n>", "root-ca path length constraint")
  .option("--ca <env>", "issuing CA key env string (kryptos:…) for ca-signed")
  .action(generate);

program
  .command("derive")
  .description(
    "Derive a deterministic oct key from a seed key + path (oct only; flags are optional, anything omitted is prompted)",
  )
  .option("-s, --seed <env>", "seed key env string (kryptos:…) — must be an oct key")
  .option("--path <path>", "derivation path, e.g. urn:lindorm:tyr:kek:v1")
  .option("-t, --type <type>", "key type: oct (the only supported type)")
  .option("-u, --use <use>", "key use: sig, enc")
  .option("-a, --algorithm <algorithm>", "algorithm, e.g. A256KW, HS256")
  .option(
    "-e, --encryption <encryption>",
    "AES encryption for 'dir' enc keys, e.g. A256GCM",
  )
  .option("-p, --purpose <purpose>", "key purpose")
  .action(derive);

const invokedAs = process.argv[1]
  ? pathToFileURL(realpathSync(process.argv[1])).href
  : "";

// Only parse argv when run as the CLI binary — importing this module (e.g. in
// tests) must not trigger commander.
if (import.meta.url === invokedAs) {
  program.parse();
}
