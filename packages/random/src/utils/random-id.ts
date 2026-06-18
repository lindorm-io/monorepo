type Length = 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64;

type Options = {
  namespace?: string;
  length?: Length;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX = 248; // 256 - (256 % 62); reject bytes at or above to avoid modulo bias

const randomChars = (length: number): string => {
  let result = "";
  while (result.length < length) {
    const bytes = new Uint8Array(length - result.length);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < MAX) result += ALPHABET[byte % 62];
      if (result.length === length) break;
    }
  }
  return result;
};

export function randomId(): string;
export function randomId(namespace: string, options?: Omit<Options, "namespace">): string;
export function randomId(options: Options): string;
export function randomId(
  arg?: string | Options,
  options?: Omit<Options, "namespace">,
): string {
  const namespace = typeof arg === "string" ? arg : arg?.namespace;
  const length = (typeof arg === "string" ? options?.length : arg?.length) ?? 24;
  const id = randomChars(length);
  return namespace ? `${namespace}_${id}` : id;
}
