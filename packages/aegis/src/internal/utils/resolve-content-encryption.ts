import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";

/**
 * The content-encryption floor both encrypting kits resolve, stated ONCE.
 *
 * KEY FIRST — the key selects the cipher, and a key that declares one is not
 * overridable by a deployment setting. Then the deployment's `defaultEncryption`,
 * which fills in for a key that declares none. Then `A256GCM`.
 *
 * ⚠ The last step is a SECURITY DEFAULT with a magic constant in it, and it was
 * written out character-for-character in `JweKit` and in `CweKit`. A duplicated
 * default is a default that can be raised on one wire and left behind on the
 * other, which is the failure mode a floor exists to prevent — so the two kits
 * now ask one function. `@lindorm/aes` resolves its own floor the same way for
 * the layer below.
 */
export const resolveContentEncryption = (
  kryptos: IKryptos,
  defaultEncryption: KryptosEncryption | undefined,
): KryptosEncryption => kryptos.encryption ?? defaultEncryption ?? "A256GCM";
