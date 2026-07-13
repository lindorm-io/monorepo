import { ID_ALPHABET, ID_CHARACTER_CLASS } from "../constants/id-format.js";

// Bounded by ID_MIN_LENGTH / ID_MAX_LENGTH — pinned by is-lindorm-id.test.ts, which
// generates every length in this union and validates it against LINDORM_ID_PATTERN.
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

// 256 - (256 % 62) = 248; reject bytes at or above to avoid modulo bias
const MAX = 256 - (256 % ID_ALPHABET.length);

const NAMESPACE_PATTERN = new RegExp(`^${ID_CHARACTER_CLASS}+$`);

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
      if (byte < MAX) result += ID_ALPHABET[byte % ID_ALPHABET.length];
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
