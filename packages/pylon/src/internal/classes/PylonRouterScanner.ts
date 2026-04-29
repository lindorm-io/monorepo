import type { ILogger } from "@lindorm/logger";
import { PylonRouter } from "../../classes/PylonRouter.js";
import { PylonError } from "../../errors/index.js";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../types/index.js";
import { PylonScannerBase, type ScannedFile } from "./PylonScannerBase.js";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

export class PylonRouterScanner<
  C extends PylonHttpContext = PylonHttpContext,
> extends PylonScannerBase {
  public constructor(logger: ILogger) {
    super(logger.child(["PylonRouterScanner"]));
  }

  public async scan(directory: string): Promise<PylonRouter<C>> {
    const start = Date.now();

    this.logger.debug("Scanning routes", { directory });

    const files = await this.scanDirectory(directory);
    const root = new PylonRouter<C>();

    for (const file of files) {
      this.processFile(root, file);
    }

    this.logger.debug("Routes scanned", {
      directory,
      routes: files.length,
      time: Date.now() - start,
    });

    return root;
  }

  private processFile(root: PylonRouter<C>, file: ScannedFile): void {
    const routerInstance = this.findRouterInstance(file);

    if (routerInstance) {
      const path = this.buildRoutePath(file);

      if (file.middleware.length) {
        routerInstance.use(...(file.middleware as Array<PylonHttpMiddleware<C>>));
      }

      root.use(path, routerInstance.routes(), routerInstance.allowedMethods());

      this.logger.debug("Registered router", { path, file: file.scan.relativePath });
      return;
    }

    const methods = this.findHttpMethods(file);

    if (methods.length) {
      const path = this.buildRoutePath(file);
      const router = new PylonRouter<C>();

      for (const { method, handlers } of methods) {
        const allHandlers = [
          ...(file.middleware as Array<PylonHttpMiddleware<C>>),
          ...handlers,
        ];

        switch (method) {
          case "GET":
            router.get(path, ...allHandlers);
            break;
          case "POST":
            router.post(path, ...allHandlers);
            break;
          case "PUT":
            router.put(path, ...allHandlers);
            break;
          case "PATCH":
            router.patch(path, ...allHandlers);
            break;
          case "DELETE":
            router.delete(path, ...allHandlers);
            break;
          case "HEAD":
            router.head(path, ...allHandlers);
            break;
          case "OPTIONS":
            router.options(path, ...allHandlers);
            break;
        }

        this.logger.debug("Registered route", {
          method,
          path,
          file: file.scan.relativePath,
        });
      }

      root.use(router.routes(), router.allowedMethods());
      return;
    }

    throw new PylonError(
      `File [ ${file.scan.relativePath} ] has no valid exports (expected PylonRouter instance or HTTP method exports: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)`,
    );
  }

  private findRouterInstance(file: ScannedFile): PylonRouter<C> | null {
    for (const value of Object.values(file.module)) {
      if (value instanceof PylonRouter) {
        return value as PylonRouter<C>;
      }
    }
    return null;
  }

  private findHttpMethods(
    file: ScannedFile,
  ): Array<{ method: HttpMethod; handlers: Array<PylonHttpMiddleware<C>> }> {
    const result: Array<{
      method: HttpMethod;
      handlers: Array<PylonHttpMiddleware<C>>;
    }> = [];

    for (const method of HTTP_METHODS) {
      const exported = file.module[method];
      if (!exported) continue;

      const handlers = Array.isArray(exported)
        ? (exported as Array<PylonHttpMiddleware<C>>)
        : [exported as PylonHttpMiddleware<C>];

      result.push({ method, handlers });
    }

    return result;
  }

  private buildRoutePath(file: ScannedFile): string {
    const segments = file.pathSegments
      .filter((s) => !s.isGroup && s.path)
      .map((s) => s.path);

    const path = "/" + segments.join("/");

    return path === "/" ? "/" : path;
  }
}
