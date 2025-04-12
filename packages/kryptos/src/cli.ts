#!/usr/bin/env node

import { input, select } from "@inquirer/prompts";
import { AES_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import { KryptosKit } from "./classes";
import {
  EC_ENC_ALGORITHMS,
  EC_SIG_ALGORITHMS,
  KryptosAlgorithm,
  KryptosEncryption,
  KryptosType,
  KryptosUse,
  OCT_ENC_DIR_ALGORITHMS,
  OCT_ENC_STD_ALGORITHMS,
  OCT_SIG_ALGORITHMS,
  OKP_ENC_ALGORITHMS,
  OKP_SIG_ALGORITHMS,
  RSA_ENC_ALGORITHMS,
  RSA_SIG_ALGORITHMS,
} from "./types";

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

const switchAlgorithmChoices = (type: KryptosType, use: KryptosUse) => {
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
          throw new Error("Unexpected Error");
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
          throw new Error("Unexpected Error");
      }

    default:
      throw new Error("Unexpected Error");
  }
};

const selectAlgorithm = async (
  type: KryptosType,
  use: KryptosUse,
): Promise<KryptosAlgorithm> =>
  await select({
    message: "Algorithm",
    choices: switchAlgorithmChoices(type, use),
  });

const selectEncryption = async (): Promise<KryptosEncryption> =>
  await select({
    message: "Encryption",
    choices: AES_ENCRYPTION_ALGORITHMS,
    default: AES_ENCRYPTION_ALGORITHMS[AES_ENCRYPTION_ALGORITHMS.length - 1],
  });

export const main = async (): Promise<void> => {
  console.log("This script will generate a Kryptos key for you.\n\n");
  const type = await selectType();

  const use = await selectUse();

  const algorithm = await selectAlgorithm(type, use);

  let encryption: KryptosEncryption | undefined;

  if (use === "enc") {
    encryption = await selectEncryption();
  }

  const purpose = await input({
    message: "Purpose (Optional)",
  });

  const kryptos = KryptosKit.generate.auto({
    algorithm,
    encryption,
    purpose,
  });

  const result = KryptosKit.env.export(kryptos);

  console.log(
    `\nCopy the string to your env:\n\n${result}\n\nThe string can be imported into a Kryptos object by using KryptosKit:\n\nconst key = KryptosKit.env.import("${result}");\n`,
  );
};

main()
  .catch(console.error)
  .finally(() => process.exit(0));
