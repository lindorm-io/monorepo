import { ILogger } from "@lindorm/logger";
import { IScanData, IScanner, Scanner } from "@lindorm/scanner";
import { PylonError } from "../../errors";
import { PylonHttpContext } from "../../types";
import { PylonRouter } from "../PylonRouter";

type File<C extends PylonHttpContext> = {
  default?: PylonRouter<C>;
  router?: PylonRouter<C>;
};

type Result<C extends PylonHttpContext> = {
  path: string;
  router: PylonRouter<C>;
};

export class PylonRouterScanner<C extends PylonHttpContext> {
  private readonly logger: ILogger;
  private readonly scanner: IScanner;

  public constructor(logger: ILogger) {
    this.logger = logger;
    this.scanner = new Scanner({
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  // public

  public scan(httpRoutersDirectory: string): PylonRouter<C> {
    const start = Date.now();

    this.logger.debug("Finding routers automatically", { httpRoutersDirectory });

    if (!Scanner.hasFiles(httpRoutersDirectory)) {
      throw new PylonError(`Routers directory [ ${httpRoutersDirectory} ] is empty`);
    }

    const scan = this.scanner.scan(httpRoutersDirectory);

    const { router } = this.mapScanData(scan);

    this.logger.debug("Found routers automatically", {
      directory: httpRoutersDirectory,
      time: Date.now() - start,
    });

    return router;
  }

  // private

  public createRoutePath(scan: IScanData): string {
    const path = "/" + scan.baseName.replace(/index/, "");

    if (path.startsWith("[") && path.endsWith("]")) {
      const replaced = path.replace("[", ":").replace("]", "");

      this.logger.silly("Created route path", {
        baseName: scan.baseName,
        path: replaced,
        from: path,
      });

      return replaced;
    }

    this.logger.silly("Created route path", { baseName: scan.baseName, path });

    return path;
  }

  private findIndexInDirectory(scan: IScanData): Result<C> | undefined {
    this.logger.silly("Finding index in directory", { relative: scan.relativePath });

    const index = scan.children.find((file) => file.baseName === "index");

    this.logger.silly("Found index in directory", { index: Boolean(index) });

    if (!index) return;

    return this.findRouterInFile(index);
  }

  private findRoutersInDirectory(scan: IScanData): Result<C> {
    this.logger.silly("Finding routers in directory", { relative: scan.relativePath });

    const index = this.findIndexInDirectory(scan);
    const router = index ? index.router : new PylonRouter<C>();
    const path = this.createRoutePath(scan);

    if (!index) {
      this.logger.silly("Created new router from directory without index file", { path });
    }

    for (const item of scan.children) {
      if (item.baseName === "index") continue;

      const child = this.mapScanData(item);

      this.logger.silly("Adding child to router", {
        path: child.path,
        relative: scan.relativePath,
      });

      router.use(child.path, child.router.routes(), child.router.allowedMethods());
    }

    this.logger.silly("Returning router from directory", {
      path,
      relative: scan.relativePath,
    });

    return { path, router };
  }

  private findRouterInFile(scan: IScanData): Result<C> {
    this.logger.silly("Finding router in file", { relative: scan.relativePath });

    const file = this.scanner.require<File<C>>(scan.fullPath);
    const router = file.router ? file.router : file.default;
    const path = this.createRoutePath(scan);

    if (!router) {
      throw new PylonError(
        `File [ ${scan.relativePath} ] has no exported router from [ default | router ]`,
      );
    }

    this.logger.silly("Returning router from file", {
      path,
      relative: scan.relativePath,
    });

    return { path, router };
  }

  private mapScanData(scan: IScanData): Result<C> {
    this.logger.silly("Mapping scan data", { scan });

    if (scan.isDirectory) {
      return this.findRoutersInDirectory(scan);
    }

    if (scan.isFile) {
      return this.findRouterInFile(scan);
    }

    throw new PylonError("Invalid scan data");
  }
}
