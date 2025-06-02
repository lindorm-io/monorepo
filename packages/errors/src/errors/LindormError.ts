import { isArray, isFinite, isFunction, isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { v4 as uuid } from "uuid";

export type LindormErrorAttributes = {
  id: string;
  code: string | null;
  data: Dict;
  debug: Dict;
  details: string | null;
  errors: Array<string>;
  message: string;
  name: string;
  stack: any;
  status: number;
  support: string | null;
  title: string | null;
};

export type LindormErrorOptions = {
  id?: string;
  code?: string;
  data?: Dict;
  debug?: Dict;
  details?: string;
  error?: Error;
  status?: number;
  support?: string;
  title?: string;
};

export class LindormError extends Error {
  public readonly id: string;
  public readonly code: string | null;
  public readonly data: Dict;
  public readonly debug: Dict;
  public readonly details: string | null;
  public readonly errors: Array<string>;
  public readonly status: number;
  public readonly support: string | null;
  public readonly title: string | null;

  public constructor(message: string, options: LindormErrorOptions = {}) {
    super(message);

    this.name = this.constructor.name;

    if (options.error?.stack) {
      this.stack = options.error.stack;
    } else if (isFunction(Error.captureStackTrace)) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }

    const { id, code, data = {}, debug = {}, status, support, title } = options;
    const destruct = LindormError.destruct(options.error);

    this.id = id ?? destruct.id ?? uuid();
    this.code = code ?? destruct?.code ?? null;
    this.data = { ...destruct.data, ...data };
    this.debug = { ...destruct.debug, ...debug };
    this.details = options.details ?? destruct.details ?? null;
    this.errors = destruct.errors ?? [];
    this.status = status ?? destruct?.status ?? 500;
    this.support = support ?? destruct?.support ?? null;
    this.title = title ?? destruct?.title ?? null;

    if (options.error instanceof Error && options.error.name && options.error.message) {
      this.errors.push(`${destruct.name}: ${destruct.message}`);
    }
  }

  // public

  public toJSON(): LindormErrorAttributes {
    return {
      id: this.id,
      code: this.code,
      data: this.data,
      debug: this.debug,
      details: this.details,
      errors: this.errors,
      message: this.message,
      name: this.name,
      stack: this.stack,
      status: this.status,
      support: this.support,
      title: this.title,
    };
  }

  // private static

  private static destruct(error?: any): Partial<LindormErrorAttributes> {
    return {
      id: isString(error?.id) ? error.id : undefined,
      code: isString(error?.code) ? error.code : undefined,
      data: isObject(error?.data) ? error.data : {},
      debug: isObject(error?.debug) ? error.debug : {},
      details: isString(error?.details) ? error.details : undefined,
      errors: isArray(error?.errors) ? error.errors : [],
      message: isString(error?.message) ? error.message : "",
      name: isString(error?.constructor?.name) ? error.constructor.name : "Error",
      stack: error?.stack ?? undefined,
      status: isFinite(error?.status) ? error.status : undefined,
      support: isString(error?.support) ? error.support : undefined,
      title: isString(error?.title) ? error.title : undefined,
    };
  }
}
