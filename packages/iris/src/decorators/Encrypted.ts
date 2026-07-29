import { stageEncrypted } from "../internal/message/metadata/stage-metadata.js";
import type { IrisEncryptionKey } from "../types/encryption.js";

/**
 * Encrypts the message payload on the wire.
 *
 * The descriptor must NAME the key — `{ kryptos }` or `{ condition }` — either
 * here or as the `encryption` default on the source. A message that names no key
 * is refused when the source loads.
 *
 * A `kryptos` on a decorator is deliberate: a message KEK is typically an env
 * key, so `KryptosKit.env.import(process.env.KEK!)` is available at class
 * definition time — and naming the key beats describing one.
 */
export const Encrypted =
  (key: IrisEncryptionKey = {}) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageEncrypted(context.metadata, key);
  };
