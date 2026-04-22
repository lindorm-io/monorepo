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

// picocolors and object-path are CJS modules whose named ESM interop only
// exposes `default` + whatever cjs-module-lexer can statically see. Named
// imports blow up at runtime. Always `import pc from "picocolors"` / `import
// objectPath from "object-path"` and call properties off the default.
declare module "picocolors" {
  export type Formatter = (input: string | number | null | undefined) => string;
  type Picocolors = {
    isColorSupported: boolean;
    reset: Formatter;
    bold: Formatter;
    dim: Formatter;
    italic: Formatter;
    underline: Formatter;
    inverse: Formatter;
    hidden: Formatter;
    strikethrough: Formatter;
    black: Formatter;
    red: Formatter;
    green: Formatter;
    yellow: Formatter;
    blue: Formatter;
    magenta: Formatter;
    cyan: Formatter;
    white: Formatter;
    gray: Formatter;
    bgBlack: Formatter;
    bgRed: Formatter;
    bgGreen: Formatter;
    bgYellow: Formatter;
    bgBlue: Formatter;
    bgMagenta: Formatter;
    bgCyan: Formatter;
    bgWhite: Formatter;
    blackBright: Formatter;
    redBright: Formatter;
    greenBright: Formatter;
    yellowBright: Formatter;
    blueBright: Formatter;
    magentaBright: Formatter;
    cyanBright: Formatter;
    whiteBright: Formatter;
    bgBlackBright: Formatter;
    bgRedBright: Formatter;
    bgGreenBright: Formatter;
    bgYellowBright: Formatter;
    bgBlueBright: Formatter;
    bgMagentaBright: Formatter;
    bgCyanBright: Formatter;
    bgWhiteBright: Formatter;
  };
  const pc: Picocolors;
  export default pc;
  export function createColors(enabled?: boolean): Picocolors;
}

declare module "object-path" {
  type Path = Array<number | string> | number | string;
  type ObjectPath = {
    get(obj: object, path: Path): any;
    get<T>(obj: object, path: Path, defaultValue: T): T;
    set<T = any>(obj: object, path: Path, value: T): any;
    has(obj: object, path: Path): boolean;
    del(obj: object, path: Path): { [key: string]: any };
    push(obj: object, path: Path, ...args: any[]): void;
    insert(obj: object, path: Path, value: any, at?: number): void;
    empty(obj: object, path: Path): any;
    coalesce<T>(obj: object, paths: Path[], defaultValue?: T): T;
    ensureExists<T>(obj: object, path: Path, value: T): T;
  };
  const objectPath: ObjectPath;
  export default objectPath;
}
