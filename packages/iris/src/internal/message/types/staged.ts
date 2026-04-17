import type { z } from "zod/v4";
import type {
  MetaCompressed,
  MetaEncrypted,
  MetaField,
  MetaGenerated,
  MetaHeader,
  MetaHook,
  MetaMessage,
  MetaRetry,
  MetaStagedTransform,
  MetaTopic,
} from "./metadata";
import type { MetaFieldDefault, MetaTransform } from "./types";

export type StagedFieldModifier = {
  key: string;
  decorator: string;
  default?: MetaFieldDefault | null;
  enum?: Record<string, string | number> | null;
  min?: number | null;
  max?: number | null;
  nullable?: boolean;
  optional?: boolean;
  schema?: z.ZodType | null;
  transform?: MetaTransform | null;
};

export type StagedMetadata = {
  // Field-level (arrays — accumulated across hierarchy)
  fields?: Array<MetaField>;
  fieldModifiers?: Array<StagedFieldModifier>;
  generated?: Array<MetaGenerated>;
  headers?: Array<MetaHeader>;
  hooks?: Array<MetaHook>;
  transforms?: Array<MetaStagedTransform>;

  // Class-level (singletons — set once per class)
  __abstract?: boolean;
  __hasMessage?: boolean;
  broadcast?: boolean;
  compressed?: MetaCompressed;
  deadLetter?: boolean;
  encrypted?: MetaEncrypted;
  message?: MetaMessage;
  namespace?: string;
  persistent?: boolean;
  priority?: number;
  retry?: MetaRetry;
  topic?: MetaTopic;
  version?: number;
  expiry?: number;
  delay?: number;
};
