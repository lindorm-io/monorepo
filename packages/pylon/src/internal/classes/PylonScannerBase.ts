import { ILogger } from "@lindorm/logger";
import { IScanData, IScanner, Scanner } from "@lindorm/scanner";
import { PylonError } from "../../errors";

const MIDDLEWARE_FILE = "_middleware";
const GROUP_PATTERN = /^\(.*\)$/;
const PARAM_PATTERN = /^\[([^\]]+)\]$/;
const CATCH_ALL_PATTERN = /^\[\.\.\.([^\]]+)\]$/;
const OPTIONAL_CATCH_ALL_PATTERN = /^\[\[\.\.\.([^\]]+)\]\]$/;

export type ParsedSegment = {
  raw: string;
  path: string;
  isParam: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
  isGroup: boolean;
  paramName: string | null;
};

export type ScannedFile = {
  scan: IScanData;
  module: Record<string, unknown>;
  pathSegments: Array<ParsedSegment>;
  middleware: Array<unknown>;
};

export abstract class PylonScannerBase {
  protected readonly logger: ILogger;
  protected readonly scanner: IScanner;

  public constructor(logger: ILogger) {
    this.logger = logger;
    this.scanner = new Scanner({
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  protected async scanDirectory(directory: string): Promise<Array<ScannedFile>> {
    if (!Scanner.hasFiles(directory)) {
      throw new PylonError(`Directory [ ${directory} ] is empty`);
    }

    const root = this.scanner.scan(directory);
    const files: Array<ScannedFile> = [];

    // Root is the scanned directory itself — skip its name, process children
    const middlewareFile = root.children.find((c) => this.isMiddlewareFile(c));
    const rootMiddleware = middlewareFile
      ? await this.loadMiddleware(middlewareFile)
      : [];

    for (const child of root.children) {
      await this.walkTree(child, [], rootMiddleware, files);
    }

    return files;
  }

  protected parseSegment(name: string): ParsedSegment {
    if (GROUP_PATTERN.test(name)) {
      return {
        raw: name,
        path: "",
        isParam: false,
        isCatchAll: false,
        isOptionalCatchAll: false,
        isGroup: true,
        paramName: null,
      };
    }

    const optionalCatchAll = OPTIONAL_CATCH_ALL_PATTERN.exec(name);
    if (optionalCatchAll) {
      return {
        raw: name,
        path: `{*${optionalCatchAll[1]}}`,
        isParam: false,
        isCatchAll: false,
        isOptionalCatchAll: true,
        isGroup: false,
        paramName: optionalCatchAll[1],
      };
    }

    const catchAll = CATCH_ALL_PATTERN.exec(name);
    if (catchAll) {
      return {
        raw: name,
        path: `{*${catchAll[1]}}`,
        isParam: false,
        isCatchAll: true,
        isOptionalCatchAll: false,
        isGroup: false,
        paramName: catchAll[1],
      };
    }

    const param = PARAM_PATTERN.exec(name);
    if (param) {
      return {
        raw: name,
        path: `:${param[1]}`,
        isParam: true,
        isCatchAll: false,
        isOptionalCatchAll: false,
        isGroup: false,
        paramName: param[1],
      };
    }

    return {
      raw: name,
      path: name,
      isParam: false,
      isCatchAll: false,
      isOptionalCatchAll: false,
      isGroup: false,
      paramName: null,
    };
  }

  protected getBaseName(scan: IScanData): string {
    return scan.fullName.replace(/\.[^.]+$/, "");
  }

  protected isMiddlewareFile(scan: IScanData): boolean {
    return scan.isFile && this.getBaseName(scan) === MIDDLEWARE_FILE;
  }

  protected async loadMiddleware(scan: IScanData): Promise<Array<unknown>> {
    const module = await this.scanner.import<Record<string, unknown>>(scan.fullPath);

    if (module.MIDDLEWARE) {
      return Array.isArray(module.MIDDLEWARE) ? module.MIDDLEWARE : [module.MIDDLEWARE];
    }

    return [];
  }

  private async walkTree(
    scan: IScanData,
    parentSegments: Array<ParsedSegment>,
    parentMiddleware: Array<unknown>,
    results: Array<ScannedFile>,
  ): Promise<void> {
    if (scan.isFile) {
      if (this.isMiddlewareFile(scan)) return;

      const name = this.getBaseName(scan);
      const segment = this.parseSegment(name === "index" ? "" : name);
      const pathSegments = segment.path ? [...parentSegments, segment] : parentSegments;

      const module = await this.scanner.import<Record<string, unknown>>(scan.fullPath);

      results.push({
        scan,
        module,
        pathSegments,
        middleware: [...parentMiddleware],
      });

      return;
    }

    if (scan.isDirectory) {
      const segment = this.parseSegment(scan.baseName);
      const segments = segment.isGroup ? parentSegments : [...parentSegments, segment];

      const middlewareFile = scan.children.find((c) => this.isMiddlewareFile(c));
      const dirMiddleware = middlewareFile
        ? [...parentMiddleware, ...(await this.loadMiddleware(middlewareFile))]
        : parentMiddleware;

      for (const child of scan.children) {
        await this.walkTree(child, segments, dirMiddleware, results);
      }
    }
  }
}
