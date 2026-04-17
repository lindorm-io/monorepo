import type { Dict } from "@lindorm/types";
import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata";

export type EncryptedOptions = {
  id?: string;
  algorithm?: string;
  encryption?: string;
  purpose?: string;
  type?: string;
  ownerId?: string;
};

export const Encrypted =
  (options?: EncryptedOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    let predicate: Dict | null = null;

    if (options) {
      const entries = Object.entries(options).filter(([, v]) => v !== undefined);
      predicate = entries.length > 0 ? Object.fromEntries(entries) : null;
    }

    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Encrypted",
      encrypted: { predicate },
    });
  };
