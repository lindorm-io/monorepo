import { isReadableTime } from "@lindorm/date";
import { isArray, isFunction, isNumber, isObject, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { IScanData, Scanner } from "@lindorm/scanner";
import { LindormWorkerScannerError } from "../errors";
import { ILindormWorker } from "../interfaces";
import {
  LindormWorkerOptions,
  LindormWorkerScannerInput,
  LindormWorkerScannerOutput,
} from "../types";
import { LindormWorker } from "./LindormWorker";

export class LindormWorkerScanner {
  public static scan(
    input: LindormWorkerScannerInput,
    logger: ILogger,
  ): LindormWorkerScannerOutput {
    const instances = input.filter(
      (a): a is ILindormWorker => a instanceof LindormWorker,
    );
    const strings = input.filter((a): a is string => isString(a));

    const result: LindormWorkerScannerOutput = [...instances];

    if (!strings.length) return result;

    for (const path of strings) {
      const item = LindormWorkerScanner.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...LindormWorkerScanner.scanDirectory(item, logger));
      }
      if (item.isFile) {
        result.push(LindormWorkerScanner.scanFile(item, logger));
      }
    }

    return result;
  }

  // private

  private static scanDirectory(data: IScanData, logger: ILogger): Array<ILindormWorker> {
    const result: Array<ILindormWorker> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...LindormWorkerScanner.scanDirectory(child, logger));
      }
      if (child.isFile) {
        result.push(LindormWorkerScanner.scanFile(child, logger));
      }
    }

    return result;
  }

  private static scanFile(data: IScanData, logger: ILogger): ILindormWorker {
    const module: any = LindormWorkerScanner.scanner.require(data.fullPath);

    for (const value of Object.values(module)) {
      if (value instanceof LindormWorker) {
        return value;
      }
    }

    if (!isFunction(module.CALLBACK)) {
      throw new LindormWorkerScannerError(
        `No LindormWorker export or CALLBACK export found in file: ${data.fullPath}`,
      );
    }

    const alias: string = isString(module.ALIAS) ? module.ALIAS : data.baseName;

    if (!isReadableTime(module.INTERVAL) && !isNumber(module.INTERVAL)) {
      throw new LindormWorkerScannerError(
        `Missing INTERVAL export in file: ${data.fullPath}`,
      );
    }

    const options: LindormWorkerOptions = {
      alias,
      callback: module.CALLBACK,
      interval: module.INTERVAL,
      logger,
    };

    if (isArray(module.LISTENERS)) {
      options.listeners = module.LISTENERS;
    }

    if (isReadableTime(module.JITTER) || isNumber(module.JITTER)) {
      options.jitter = module.JITTER;
    }

    if (isReadableTime(module.CALLBACK_TIMEOUT) || isNumber(module.CALLBACK_TIMEOUT)) {
      options.callbackTimeout = module.CALLBACK_TIMEOUT;
    }

    if (isFunction(module.ERROR_CALLBACK)) {
      options.errorCallback = module.ERROR_CALLBACK;
    }

    if (
      isObject(module.RETRY) &&
      (module.RETRY.maxAttempts ||
        module.RETRY.strategy ||
        module.RETRY.timeout ||
        module.RETRY.timeoutMax)
    ) {
      options.retry = module.RETRY;
    }

    return new LindormWorker(options);
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
