import { isReadableTime } from "@lindorm/date";
import { isArray, isFunction, isNumber, isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { LindormWorkerScannerError } from "../errors";
import { ILindormWorker } from "../interfaces";
import {
  LindormWorkerConfig,
  LindormWorkerScannerInput,
  LindormWorkerScannerOutput,
} from "../types";
import { LindormWorker } from "./LindormWorker";

export class LindormWorkerScanner {
  public static scan(input: LindormWorkerScannerInput): LindormWorkerScannerOutput {
    const instances = input.filter(
      (a): a is ILindormWorker => a instanceof LindormWorker,
    );
    const configs = input.filter(
      (a): a is LindormWorkerConfig => isObject(a) && !(a instanceof LindormWorker),
    );
    const strings = input.filter((a): a is string => isString(a));

    const result: LindormWorkerScannerOutput = [...instances, ...configs];

    if (!strings.length) return result;

    for (const path of strings) {
      const item = LindormWorkerScanner.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...LindormWorkerScanner.scanDirectory(item));
      }
      if (item.isFile) {
        result.push(LindormWorkerScanner.scanFile(item));
      }
    }

    return result;
  }

  // private

  private static scanDirectory(
    data: IScanData,
  ): Array<LindormWorkerConfig | ILindormWorker> {
    const result: Array<LindormWorkerConfig | ILindormWorker> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...LindormWorkerScanner.scanDirectory(child));
      }
      if (child.isFile) {
        result.push(LindormWorkerScanner.scanFile(child));
      }
    }

    return result;
  }

  private static scanFile(data: IScanData): LindormWorkerConfig | ILindormWorker {
    const module: any = LindormWorkerScanner.scanner.require(data.fullPath);

    for (const value of Object.values(module)) {
      if (value instanceof LindormWorker) {
        return value;
      }
    }

    if (!module.CALLBACK) {
      throw new LindormWorkerScannerError(
        `No LindormWorker export or CALLBACK export found in file: ${data.fullPath}`,
      );
    }

    const result: Partial<LindormWorkerConfig> = {};

    if (isString(module.ALIAS)) {
      result.alias = module.ALIAS;
    }

    if (isFunction(module.CALLBACK)) {
      result.callback = module.CALLBACK;
    }

    if (isReadableTime(module.INTERVAL) || isNumber(module.INTERVAL)) {
      result.interval = module.INTERVAL;
    }

    if (isArray(module.LISTENERS)) {
      result.listeners = module.LISTENERS;
    }

    if (isReadableTime(module.JITTER) || isNumber(module.JITTER)) {
      result.jitter = module.JITTER;
    }

    if (isReadableTime(module.CALLBACK_TIMEOUT) || isNumber(module.CALLBACK_TIMEOUT)) {
      result.callbackTimeout = module.CALLBACK_TIMEOUT;
    }

    if (isFunction(module.ERROR_CALLBACK)) {
      result.errorCallback = module.ERROR_CALLBACK;
    }

    if (
      isObject(module.RETRY) &&
      (module.RETRY.maxAttempts ||
        module.RETRY.strategy ||
        module.RETRY.timeout ||
        module.RETRY.timeoutMax)
    ) {
      result.retry = module.RETRY;
    }

    if (!result.alias) {
      result.alias = data.baseName;
    }

    return result as LindormWorkerConfig;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
