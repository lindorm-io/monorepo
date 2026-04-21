import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
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
} from "../types/metadata.js";
import type { StagedFieldModifier, StagedMetadata } from "../types/staged.js";
import { ABSTRACT_MESSAGE_KEY } from "./abstract-message.js";

const ensureOwnArray = <K extends keyof StagedMetadata>(
  metadata: DecoratorMetadataObject,
  key: K,
): NonNullable<StagedMetadata[K]> => {
  if (!Object.hasOwn(metadata, key)) {
    metadata[key] = [];
  }
  return (metadata as any)[key];
};

// Field-level staging (arrays)

export const stageField = (metadata: DecoratorMetadataObject, field: MetaField): void => {
  ensureOwnArray(metadata, "fields").push(field);
};

export const stageFieldModifier = (
  metadata: DecoratorMetadataObject,
  modifier: StagedFieldModifier,
): void => {
  ensureOwnArray(metadata, "fieldModifiers").push(modifier);
};

export const stageGenerated = (
  metadata: DecoratorMetadataObject,
  gen: MetaGenerated,
): void => {
  ensureOwnArray(metadata, "generated").push(gen);
};

export const stageHeader = (
  metadata: DecoratorMetadataObject,
  header: MetaHeader,
): void => {
  if (!header.headerName || !header.headerName.trim()) {
    throw new IrisMetadataError("@Header name must not be empty");
  }
  ensureOwnArray(metadata, "headers").push(header);
};

export const stageHook = (metadata: DecoratorMetadataObject, hook: MetaHook): void => {
  ensureOwnArray(metadata, "hooks").push(hook);
};

export const stageTransform = (
  metadata: DecoratorMetadataObject,
  transform: MetaStagedTransform,
): void => {
  ensureOwnArray(metadata, "transforms").push(transform);
};

// Class-level staging (singletons)

export const stageMessage = (
  metadata: DecoratorMetadataObject,
  message: MetaMessage,
): void => {
  if (!message.name || !message.name.trim()) {
    throw new IrisMetadataError("@Message name must not be empty");
  }
  if (Object.hasOwn(metadata, ABSTRACT_MESSAGE_KEY)) {
    throw new IrisMetadataError(
      "Cannot combine @AbstractMessage and @Message on the same class",
    );
  }
  metadata.message = message;
  metadata.__hasMessage = true;
};

export const stageAbstractMessage = (
  metadata: DecoratorMetadataObject,
  message: MetaMessage,
): void => {
  if (Object.hasOwn(metadata, "__hasMessage")) {
    throw new IrisMetadataError(
      "Cannot combine @AbstractMessage and @Message on the same class",
    );
  }
  metadata[ABSTRACT_MESSAGE_KEY] = true;
  metadata.message = message;
};

export const stageTopic = (metadata: DecoratorMetadataObject, topic: MetaTopic): void => {
  metadata.topic = topic;
};

export const stagePriority = (
  metadata: DecoratorMetadataObject,
  priority: number,
): void => {
  metadata.priority = priority;
};

export const stageEncrypted = (
  metadata: DecoratorMetadataObject,
  encrypted: MetaEncrypted,
): void => {
  metadata.encrypted = encrypted;
};

export const stageCompressed = (
  metadata: DecoratorMetadataObject,
  compressed: MetaCompressed,
): void => {
  metadata.compressed = compressed;
};

export const stageDeadLetter = (metadata: DecoratorMetadataObject): void => {
  metadata.deadLetter = true;
};

export const stagePersistent = (metadata: DecoratorMetadataObject): void => {
  metadata.persistent = true;
};

export const stageBroadcast = (metadata: DecoratorMetadataObject): void => {
  metadata.broadcast = true;
};

export const stageRetry = (metadata: DecoratorMetadataObject, retry: MetaRetry): void => {
  metadata.retry = retry;
};

export const stageExpiry = (metadata: DecoratorMetadataObject, expiry: number): void => {
  metadata.expiry = expiry;
};

export const stageDelay = (metadata: DecoratorMetadataObject, delay: number): void => {
  metadata.delay = delay;
};

export const stageNamespace = (
  metadata: DecoratorMetadataObject,
  namespace: string,
): void => {
  if (!namespace || !namespace.trim()) {
    throw new IrisMetadataError("@Namespace value must not be empty");
  }
  metadata.namespace = namespace;
};

export const stageVersion = (
  metadata: DecoratorMetadataObject,
  version: number,
): void => {
  metadata.version = version;
};
