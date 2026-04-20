import { ILogger } from "@lindorm/logger";
import { uniq } from "@lindorm/utils";
import { PylonListener } from "../../classes/PylonListener";
import { PylonError } from "../../errors";
import { PylonSocketContext, PylonSocketMiddleware } from "../../types";
import { EventMatcher, EventSegment } from "./EventMatcher";
import { PylonScannerBase, ScannedFile } from "./PylonScannerBase";

const LISTENER_METHODS = ["ON", "ONCE"] as const;
type ListenerMethod = (typeof LISTENER_METHODS)[number];

export type ListenerScanResult<S extends PylonSocketContext> = {
  listeners: Array<PylonListener<S>>;
  namespaces: Array<string>;
};

export class PylonListenerScanner<
  S extends PylonSocketContext = PylonSocketContext,
> extends PylonScannerBase {
  public constructor(logger: ILogger) {
    super(logger.child(["PylonListenerScanner"]));
  }

  public async scan(directory: string): Promise<ListenerScanResult<S>> {
    const start = Date.now();

    this.logger.debug("Scanning listeners", { directory });

    const files = await this.scanDirectory(directory);
    const listeners: Array<PylonListener<S>> = [];

    for (const file of files) {
      const listener = this.processFile(file);
      if (listener) {
        listeners.push(listener);
      }
    }

    const namespaces = uniq(
      listeners.map((l) => l.namespace).filter(Boolean) as Array<string>,
    );

    this.logger.debug("Listeners scanned", {
      directory,
      listeners: listeners.length,
      namespaces,
      time: Date.now() - start,
    });

    return { listeners, namespaces };
  }

  private processFile(file: ScannedFile): PylonListener<S> | null {
    const listenerInstance = this.findListenerInstance(file);

    if (listenerInstance) {
      if (file.middleware.length) {
        listenerInstance.use(...(file.middleware as Array<PylonSocketMiddleware<S>>));
      }

      this.logger.debug("Registered listener instance", {
        file: file.scan.relativePath,
      });

      return listenerInstance;
    }

    const methods = this.findListenerMethods(file);

    if (methods.length) {
      const segments = this.buildEventSegments(file);
      const event = this.buildEventName(segments);
      const listener = new PylonListener<S>();

      if (file.middleware.length) {
        listener.use(...(file.middleware as Array<PylonSocketMiddleware<S>>));
      }

      for (const { method, handlers } of methods) {
        listener._addScannedListener(
          event,
          method === "ON" ? "on" : "once",
          segments,
          handlers,
        );

        this.logger.debug("Registered listener", {
          method,
          event,
          file: file.scan.relativePath,
        });
      }

      return listener;
    }

    throw new PylonError(
      `File [ ${file.scan.relativePath} ] has no valid exports (expected PylonListener instance or listener method exports: ON, ONCE)`,
    );
  }

  private findListenerInstance(file: ScannedFile): PylonListener<S> | null {
    for (const value of Object.values(file.module)) {
      if (value instanceof PylonListener) {
        return value as PylonListener<S>;
      }
    }
    return null;
  }

  private findListenerMethods(
    file: ScannedFile,
  ): Array<{ method: ListenerMethod; handlers: Array<PylonSocketMiddleware<S>> }> {
    const result: Array<{
      method: ListenerMethod;
      handlers: Array<PylonSocketMiddleware<S>>;
    }> = [];

    for (const method of LISTENER_METHODS) {
      const exported = file.module[method];
      if (!exported) continue;

      const handlers = Array.isArray(exported)
        ? (exported as Array<PylonSocketMiddleware<S>>)
        : [exported as PylonSocketMiddleware<S>];

      result.push({ method, handlers });
    }

    return result;
  }

  private buildEventSegments(file: ScannedFile): Array<EventSegment> {
    const filtered = file.pathSegments.filter((s) => !s.isGroup && s.path);
    return EventMatcher.parseSegments(filtered);
  }

  private buildEventName(segments: Array<EventSegment>): string {
    return segments
      .map((s) => {
        switch (s.type) {
          case "literal":
            return s.value;
          case "param":
            return `:${s.value}`;
          case "catchAll":
            return `*${s.value}`;
        }
      })
      .join(":");
  }
}
