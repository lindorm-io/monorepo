import type { Constructor } from "@lindorm/types";
import type { z } from "zod";
import type { IMessage } from "../../../interfaces";
import type { AmphoraPredicate } from "@lindorm/amphora";
import type {
  MetaFieldDecorator,
  MetaFieldDefault,
  MetaFieldType,
  MetaGeneratedStrategy,
  MetaHookDecorator,
  MetaTransform,
} from "./types";

export type MetaField<T extends MetaFieldDecorator = MetaFieldDecorator> = {
  key: string;
  decorator: T;
  default: MetaFieldDefault | null;
  enum: Record<string, string | number> | null;
  max: number | null;
  min: number | null;
  nullable: boolean;
  optional: boolean;
  schema: z.ZodType | null;
  transform: MetaTransform | null;
  type: MetaFieldType;
};

export type MetaMessage = {
  decorator: "Message" | "AbstractMessage";
  name: string;
};

export type MetaHook = {
  decorator: MetaHookDecorator;
  callback: (message: any, context?: any, ...extra: Array<any>) => void | Promise<void>;
};

export type MetaGenerated = {
  key: string;
  length: number | null;
  max: number | null;
  min: number | null;
  strategy: MetaGeneratedStrategy;
};

export type MetaTopic = {
  callback: (message: any) => string;
};

export type MetaHeader = {
  key: string;
  headerName: string;
};

export type MetaStagedTransform = {
  key: string;
  transform: MetaTransform;
};

export type MetaEncrypted = {
  predicate: AmphoraPredicate;
};

export type MetaCompressed = {
  algorithm: "gzip" | "deflate" | "brotli";
};

export type MetaRetry = {
  maxRetries: number;
  strategy: "constant" | "linear" | "exponential";
  delay: number;
  delayMax: number;
  multiplier: number;
  jitter: boolean;
};

export type MessageMetadata = {
  target: Constructor<IMessage>;
  broadcast: boolean;
  compressed: MetaCompressed | null;
  deadLetter: boolean;
  encrypted: MetaEncrypted | null;
  fields: Array<MetaField>;
  generated: Array<MetaGenerated>;
  headers: Array<MetaHeader>;
  hooks: Array<MetaHook>;
  message: MetaMessage;
  namespace: string | null;
  persistent: boolean;
  priority: number | null;
  retry: MetaRetry | null;
  topic: MetaTopic | null;
  version: number;
  expiry: number | null;
  delay: number | null;
};
