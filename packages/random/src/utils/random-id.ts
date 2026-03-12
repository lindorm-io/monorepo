type Bytes = 8 | 16 | 24 | 32 | 40 | 48 | 56 | 64;

type Options = {
  namespace?: string;
  bytes?: Bytes;
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

export function randomId(): string;
export function randomId(namespace: string, options?: Omit<Options, "namespace">): string;
export function randomId(options: Options): string;
export function randomId(
  arg?: string | Options,
  options?: Omit<Options, "namespace">,
): string {
  const namespace = typeof arg === "string" ? arg : arg?.namespace;
  const size = (typeof arg === "string" ? options?.bytes : arg?.bytes) ?? 16;
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  const id = toBase64Url(bytes);
  return namespace ? `${namespace}~${id}` : id;
}
