import { ReadableTime } from "@lindorm/date";
import { isFunction, isNumber, isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { LindormWorkerScannerError } from "../errors";
import {
  LindormWorkerConfig,
  LindormWorkerScannerInput,
  LindormWorkerScannerOutput,
} from "../types";

export class LindormWorkerScanner {
  public static scan(input: LindormWorkerScannerInput): LindormWorkerScannerOutput {
    const objects = input.filter((a) => isObject(a));
    const strings = input.filter((a) => isString(a));

    const result: Array<LindormWorkerConfig> = [...objects];

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

  private static scanDirectory(data: IScanData): Array<LindormWorkerConfig> {
    const result: Array<LindormWorkerConfig> = [];

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

  private static scanFile(data: IScanData): LindormWorkerConfig {
    const module = LindormWorkerScanner.scanner.require<LindormWorkerConfig>(
      data.fullPath,
    );

    if (!module.callback) {
      throw new LindormWorkerScannerError(`No callback found in file: ${data.fullPath}`);
    }

    const result: Partial<LindormWorkerConfig> = {};

    if (isString(module.alias)) {
      result.alias = module.alias;
    }

    if (isFunction(module.callback)) {
      result.callback = module.callback;
    }

    if (isString<ReadableTime>(module.interval) || isNumber(module.interval)) {
      result.interval = module.interval;
    }

    if (
      isObject(module.retry) &&
      (module.retry.maxAttempts ||
        module.retry.strategy ||
        module.retry.timeout ||
        module.retry.timeoutMax)
    ) {
      result.retry = module.retry;
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
