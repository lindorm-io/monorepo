export type RandomIdLength =
  | 16
  | 20
  | 24
  | 28
  | 32
  | 36
  | 40
  | 44
  | 48
  | 52
  | 56
  | 60
  | 64;

export type RandomIdOptions = {
  namespace?: string;
  length?: RandomIdLength;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX = 248; // 256 - (256 % 62); reject bytes at or above to avoid modulo bias

const NAMESPACE_PATTERN = /^[A-Za-z0-9]+$/;

const assertNamespace = (namespace: string): void => {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      `Invalid randomId namespace "${namespace}": a namespace must be non-empty and contain only [A-Za-z0-9]. ` +
        `The id body is alphanumeric and joined with "_", so a symbol in the namespace would make "namespace_id" ambiguous to split.`,
    );
  }
};

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
export function randomId(
  namespace: string,
  options?: Omit<RandomIdOptions, "namespace">,
): string;
export function randomId(options: RandomIdOptions): string;
export function randomId(
  arg?: string | RandomIdOptions,
  options?: Omit<RandomIdOptions, "namespace">,
): string {
  const namespace = typeof arg === "string" ? arg : arg?.namespace;
  const length = (typeof arg === "string" ? options?.length : arg?.length) ?? 24;
  if (namespace !== undefined) assertNamespace(namespace);
  const id = randomChars(length);
  return namespace ? `${namespace}_${id}` : id;
}
