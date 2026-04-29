import type { Constructor } from "@lindorm/types";
import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
import type { IMessage } from "../../../interfaces/index.js";
import type { MessageMetadata } from "../types/metadata.js";
import { collectAll, collectOwn, collectSingular } from "./collect.js";
import { validateFields } from "./validate-fields.js";
import { validateGenerated } from "./validate-generated.js";
import { validateHeaders } from "./validate-headers.js";

const hasConcreteAncestor = (target: Function): boolean => {
  let current = Object.getPrototypeOf(target);
  while (current && current !== Function.prototype && current !== Object) {
    const ownMessage = collectOwn(current, "message");
    if (ownMessage && ownMessage.decorator === "Message") {
      return true;
    }
    current = Object.getPrototypeOf(current);
  }
  return false;
};

const R_VERSION_SUFFIX = /_[vV](\d+)$/;

const extractVersionFromName = (name: string): number | null => {
  const match = R_VERSION_SUFFIX.exec(name);
  return match ? Number(match[1]) : null;
};

export const buildMessageMetadata = (target: Function): MessageMetadata => {
  // Guard: abstract-only or conflict
  const isAbstract = Boolean(collectOwn(target, "__abstract"));
  const hasMessage = Boolean(collectOwn(target, "__hasMessage"));

  if (isAbstract && hasMessage) {
    throw new IrisMetadataError(
      "@AbstractMessage and @Message cannot be used on the same class",
      { debug: { target: target.name } },
    );
  }

  if (isAbstract && !hasMessage) {
    throw new IrisMetadataError(
      "Cannot build metadata for abstract message without @Message on concrete subclass",
      { debug: { target: target.name } },
    );
  }

  const message = collectSingular(target, "message");

  if (!message || message.decorator !== "Message") {
    throw new IrisMetadataError("Message metadata not found", {
      debug: { target: target.name },
    });
  }

  // Guard: concrete extending concrete
  if (hasConcreteAncestor(target)) {
    throw new IrisMetadataError("@Message class cannot extend another @Message class", {
      debug: { target: target.name },
    });
  }

  // Collect raw staged metadata
  const fields = collectAll(target, "fields").map((f) => ({ ...f }));
  const generated = collectAll(target, "generated");
  const headers = collectAll(target, "headers");
  const hooks = collectAll(target, "hooks");

  const transforms = collectAll(target, "transforms");

  // Singletons
  const broadcast = collectSingular(target, "broadcast") ?? false;
  const compressed = collectSingular(target, "compressed") ?? null;
  const deadLetter = collectSingular(target, "deadLetter") ?? false;
  const encrypted = collectSingular(target, "encrypted") ?? null;
  const namespace = collectSingular(target, "namespace") ?? null;
  const persistent = collectSingular(target, "persistent") ?? false;
  const priority = collectSingular(target, "priority") ?? null;
  const retry = collectSingular(target, "retry") ?? null;
  const topic = collectSingular(target, "topic") ?? null;
  const explicitVersion = collectSingular(target, "version");
  const version = explicitVersion ?? extractVersionFromName(target.name) ?? 1;
  const expiry = collectSingular(target, "expiry") ?? null;
  const delay = collectSingular(target, "delay") ?? null;

  // Check for duplicate transforms on same key
  const seenTransformKeys = new Set<string>();
  for (const { key } of transforms) {
    if (seenTransformKeys.has(key)) {
      throw new IrisMetadataError("Duplicate @Transform", {
        debug: { target: target.name, key },
      });
    }
    seenTransformKeys.add(key);
  }

  // Merge transforms into fields
  for (const transform of transforms) {
    const field = fields.find((f) => f.key === transform.key);
    if (!field) {
      throw new IrisMetadataError(
        `@Transform on property "${transform.key}" requires a @Field decorator`,
        { debug: { target: target.name, property: transform.key } },
      );
    }
    field.transform = transform.transform;
  }

  // Merge field modifiers into fields
  const fieldModifiers = collectAll(target, "fieldModifiers");
  for (const mod of fieldModifiers) {
    const field = fields.find((f) => f.key === mod.key);
    if (!field) {
      throw new IrisMetadataError(
        `@${mod.decorator} on property "${mod.key}" requires a @Field decorator`,
        { debug: { target: target.name, property: mod.key } },
      );
    }
    if (mod.min != null) field.min = mod.min;
    if (mod.max != null) field.max = mod.max;
    if (mod.enum != null) field.enum = mod.enum;
    if (mod.schema != null) field.schema = mod.schema;
    if (mod.default !== undefined) field.default = mod.default;
    if (mod.nullable === true) field.nullable = true;
    if (mod.optional === true) field.optional = true;
    if (mod.transform != null) field.transform = mod.transform;
  }

  // Validate
  validateFields(target.name, fields);
  validateHeaders(target.name, headers, fields);
  validateGenerated(target.name, generated, fields);

  return {
    target: target as Constructor<IMessage>,
    broadcast,
    compressed,
    deadLetter,
    encrypted,
    fields,
    generated,
    headers,
    hooks,
    message,
    namespace,
    persistent,
    priority,
    retry,
    topic,
    version,
    expiry,
    delay,
  };
};
