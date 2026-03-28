import { randomUUID } from "@lindorm/random";
import { randomInt, randomBytes } from "crypto";
import type { MetaGenerated } from "../types/metadata";
import type { MessageMetadata } from "../types/metadata";

const generateValue = (gen: MetaGenerated): unknown => {
  switch (gen.strategy) {
    case "uuid":
      return randomUUID();

    case "date":
      return new Date();

    case "string": {
      const length = gen.length ?? 32;
      const bytes = Math.ceil((length * 3) / 4);
      return randomBytes(bytes).toString("base64url").slice(0, length);
    }

    case "integer": {
      const min = gen.min ?? 0;
      const max = gen.max ?? 999999;
      return randomInt(min, max);
    }

    case "float": {
      const min = gen.min ?? 0;
      const max = gen.max ?? 999999;
      return Math.random() * (max - min) + min;
    }

    default:
      return null;
  }
};

export const generateFields = (metadata: MessageMetadata, message: any): void => {
  for (const gen of metadata.generated) {
    if (message[gen.key] != null) continue;
    message[gen.key] = generateValue(gen);
  }
};
