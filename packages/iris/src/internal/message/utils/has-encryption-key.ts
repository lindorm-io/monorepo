import { isEmpty, isUndefined } from "@lindorm/is";
import type { IrisEncryptionKey } from "../../../types/encryption.js";

/**
 * Does this descriptor actually NAME a key?
 *
 * An empty predicate is not a predicate: `find({})` resolves to "the newest
 * published key, whatever it is" — which is how a signing key ends up wrapping
 * a payload. So a bare `{}` counts as ABSENT, exactly like `undefined`.
 */
export const hasEncryptionKey = (key: IrisEncryptionKey): boolean =>
  !isUndefined(key.kryptos) || !isEmpty(key.predicate);
