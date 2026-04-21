// CJS interop shims — override third-party .d.ts shapes that do not resolve
// cleanly under module: NodeNext + verbatimModuleSyntax. These match the
// actual runtime exports, which Node's cjs-module-lexer derives from the
// shipped JS regardless of what the upstream .d.ts claims.

declare module "fast-safe-stringify" {
  type Replacer = (key: string, value: unknown) => unknown;
  type Options = { depthLimit?: number; edgesLimit?: number };
  function stringify(
    value: unknown,
    replacer?: Replacer,
    space?: string | number,
    options?: Options,
  ): string;
  namespace stringify {
    const stable: typeof stringify;
    const stableStringify: typeof stringify;
  }
  export = stringify;
}

declare module "picocolors" {
  export type Formatter = (input: string | number | null | undefined) => string;
  export const isColorSupported: boolean;
  export const reset: Formatter;
  export const bold: Formatter;
  export const dim: Formatter;
  export const italic: Formatter;
  export const underline: Formatter;
  export const inverse: Formatter;
  export const hidden: Formatter;
  export const strikethrough: Formatter;
  export const black: Formatter;
  export const red: Formatter;
  export const green: Formatter;
  export const yellow: Formatter;
  export const blue: Formatter;
  export const magenta: Formatter;
  export const cyan: Formatter;
  export const white: Formatter;
  export const gray: Formatter;
  export const bgBlack: Formatter;
  export const bgRed: Formatter;
  export const bgGreen: Formatter;
  export const bgYellow: Formatter;
  export const bgBlue: Formatter;
  export const bgMagenta: Formatter;
  export const bgCyan: Formatter;
  export const bgWhite: Formatter;
  export const blackBright: Formatter;
  export const redBright: Formatter;
  export const greenBright: Formatter;
  export const yellowBright: Formatter;
  export const blueBright: Formatter;
  export const magentaBright: Formatter;
  export const cyanBright: Formatter;
  export const whiteBright: Formatter;
  export const bgBlackBright: Formatter;
  export const bgRedBright: Formatter;
  export const bgGreenBright: Formatter;
  export const bgYellowBright: Formatter;
  export const bgBlueBright: Formatter;
  export const bgMagentaBright: Formatter;
  export const bgCyanBright: Formatter;
  export const bgWhiteBright: Formatter;
  export function createColors(enabled?: boolean): Record<string, Formatter>;
}

declare module "object-path" {
  type Path = Array<number | string> | number | string;
  export function get(obj: object, path: Path): any;
  export function get<T>(obj: object, path: Path, defaultValue: T): T;
  export function set<T = any>(obj: object, path: Path, value: T): any;
  export function has(obj: object, path: Path): boolean;
  export function del(obj: object, path: Path): { [key: string]: any };
  export function push(obj: object, path: Path, ...args: any[]): void;
  export function insert(obj: object, path: Path, value: any, at?: number): void;
  export function empty(obj: object, path: Path): any;
  export function coalesce<T>(obj: object, paths: Path[], defaultValue?: T): T;
  export function ensureExists<T>(obj: object, path: Path, value: T): T;
}
