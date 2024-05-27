import { ILogger } from "@lindorm/logger";
import { IScanner, ScanData, Scanner } from "@lindorm/scanner";
import { uniq } from "@lindorm/utils";
import { PylonError } from "../../errors";
import { PylonEventContext } from "../../types";
import { PylonListener } from "../PylonListener";

type File<S extends PylonEventContext> = {
  default?: PylonListener<S>;
  listener?: PylonListener<S>;
};

type Result<S extends PylonEventContext> = {
  namespaces: Array<string>;
  listeners: Array<PylonListener<S>>;
};

export class PylonListenerScanner<S extends PylonEventContext> {
  private readonly logger: ILogger;
  private readonly scanner: IScanner;

  public constructor(logger: ILogger) {
    this.logger = logger;
    this.scanner = new Scanner({
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }

  // public

  public scan(socketListenersDirectory: string): Result<S> {
    const start = Date.now();

    this.logger.debug("Finding listeners automatically", { socketListenersDirectory });

    if (!Scanner.hasFiles(socketListenersDirectory)) {
      throw new PylonError(
        `Listeners directory [ ${socketListenersDirectory} ] is empty`,
      );
    }

    const scan = this.scanner.scan(socketListenersDirectory);

    const listeners = this.mapScanData(scan)
      .flat()
      .filter((item) => Boolean(item.listeners.length));

    const namespaces = uniq(listeners.map((item) => item.namespace).filter(Boolean));

    this.logger.debug("Listeners found automatically", {
      directory: socketListenersDirectory,
      listeners: listeners.length,
      namespaces,
      time: Date.now() - start,
    });

    return { listeners, namespaces };
  }

  // private

  private findIndexInDirectory(
    scan: ScanData,
    parent?: PylonListener<S>,
  ): PylonListener<S> | undefined {
    this.logger.silly("Finding index in directory", { relative: scan.relativePath });

    const index = scan.children.find((item) => item.baseName === "index");

    this.logger.silly("Found index in directory", { index: Boolean(index) });

    if (!index) return;

    return this.findListenerInFile(index, parent);
  }

  private findListenersInDirectory(
    scan: ScanData,
    parent?: PylonListener<S>,
  ): Array<PylonListener<S>> {
    this.logger.silly("Finding listeners in directory", { relative: scan.relativePath });

    const index = this.findIndexInDirectory(scan, parent);
    const result: Array<PylonListener<S>> = [];

    for (const item of scan.children) {
      const isIndex = item.baseName === "index";
      const children = this.mapScanData(item, isIndex ? parent : index);

      result.push(...children);
    }

    this.logger.silly("Returning listener from directory", {
      relative: scan.relativePath,
    });

    return result;
  }

  private findListenerInFile(
    scan: ScanData,
    parent?: PylonListener<S>,
  ): PylonListener<S> {
    this.logger.silly("Finding listener in file", { relative: scan.relativePath });

    const file = this.scanner.require<File<S>>(scan.fullPath);
    const listener = file.listener ? file.listener : file.default;

    this.logger.silly("Listener found in file", { listener });

    if (!listener) {
      throw new PylonError(
        `File [ ${scan.relativePath} ] has no exported listener from [ default | listener ]`,
      );
    }

    if (parent) {
      this.logger.silly("Setting parent listener", {
        namespace: parent.namespace,
        prefix: parent.prefix,
      });

      listener.parent(parent);
    }

    listener.namespace = scan.parents.slice(1).join("/");
    listener.prefix = scan.baseName;

    this.logger.silly("Returning listener from file", {
      namespace: listener.namespace,
      listeners: listener.listeners,
      prefix: listener.prefix,
      relative: scan.relativePath,
    });

    return listener;
  }

  private mapScanData(
    scan: ScanData,
    parent?: PylonListener<S>,
  ): Array<PylonListener<S>> {
    this.logger.silly("Mapping scan data", { scan });

    const result: Array<PylonListener<S>> = [];

    if (scan.isDirectory) {
      result.push(...this.findListenersInDirectory(scan, parent));
    }

    if (scan.isFile) {
      result.push(this.findListenerInFile(scan, parent));
    }

    return result;
  }
}
