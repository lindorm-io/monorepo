import { isFunction, isObject, isString } from "@lindorm/is";
import { ScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { AmqpSourceError } from "../../errors";
import { IAmqpMessage } from "../../interfaces";
import { AmqpSourceMessage, AmqpSourceMessages } from "../../types";

export class MessageScanner {
  // public

  public static scan(array: AmqpSourceMessages): Array<AmqpSourceMessage> {
    const result: Array<AmqpSourceMessage> = [];

    const strings = array.filter((message) => isString(message)) as Array<string>;

    const options = array.filter(
      (opts) => isObject(opts) && (opts as AmqpSourceMessage).Message,
    ) as Array<AmqpSourceMessage>;

    const messages = array
      .filter(
        (opts) =>
          !isObject(opts) &&
          !isString(opts) &&
          (opts as Constructor<IAmqpMessage>).prototype,
      )
      .map((i) => ({ Message: i })) as Array<AmqpSourceMessage>;

    result.push(...options, ...messages);

    if (!strings.length) return result;

    for (const path of strings) {
      const item = MessageScanner.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...MessageScanner.scanDirectory(item));
      }
      if (item.isFile) {
        result.push(MessageScanner.scanFile(item));
      }
    }

    return result;
  }

  // private

  private static scanDirectory(data: ScanData): Array<AmqpSourceMessage> {
    const result: Array<AmqpSourceMessage> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...MessageScanner.scanDirectory(child));
      }
      if (child.isFile) {
        result.push(MessageScanner.scanFile(child));
      }
    }

    return result;
  }

  private static scanFile(data: ScanData): AmqpSourceMessage {
    const module = MessageScanner.scanner.require<Dict>(data.fullPath);
    const entries = Object.entries(module);
    const result: Partial<AmqpSourceMessage> = {};

    if (entries.length === 0) {
      throw new AmqpSourceError(`No messages found in file: ${data.fullPath}`);
    }

    for (const [key, value] of Object.entries(module)) {
      if (key === "default") continue;
      if (result.Message && result.validate) break;

      if (key === "validate" && isFunction(value)) {
        result.validate = value;
        continue;
      }

      if (value.prototype) {
        result.Message = value;
        continue;
      }
    }

    if (!result.Message) {
      throw new AmqpSourceError(`No messages found in file: ${data.fullPath}`);
    }

    return result as AmqpSourceMessage;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
