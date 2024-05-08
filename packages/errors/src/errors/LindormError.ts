import { isArray, isFinite, isFunction, isObject, isString } from "@lindorm/is";
import { v4 as uuid } from "uuid";

export type LindormErrorAttributes = {
  id: string;
  code: string | null;
  data: Record<string, any>;
  debug: Record<string, any>;
  errors: Array<string>;
  message: string;
  name: string;
  stack: any;
  status: number;
  title: string | null;
};

export type LindormErrorOptions = {
  code?: string;
  data?: Record<string, any>;
  debug?: Record<string, any>;
  error?: Error;
  status?: number;
  title?: string;
};

export class LindormError extends Error {
  public readonly id: string;
  public readonly code: string | null;
  public readonly data: Record<string, any>;
  public readonly debug: Record<string, any>;
  public readonly status: number;
  public readonly title: string | null;
  public readonly errors: Array<string>;

  public constructor(message: string, options: LindormErrorOptions = {}) {
    super(message);

    this.name = this.constructor.name;

    if (isFunction(Error.captureStackTrace)) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }

    const { code, data = {}, debug = {}, status, title } = options;
    const destruct = LindormError.destruct(options.error);

    this.id = destruct.id ?? uuid();
    this.code = code ?? destruct?.code ?? null;
    this.data = { ...destruct.data, ...data };
    this.debug = { ...destruct.debug, ...debug };
    this.errors = destruct.errors;
    this.status = status ?? destruct?.status ?? 500;
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
      errors: this.errors,
      message: this.message,
      name: this.name,
      stack: this.stack,
      status: this.status,
      title: this.title,
    };
  }

  // private static

  private static destruct(error?: any): LindormErrorAttributes {
    return {
      id: isString(error?.id) ? error.id : undefined,
      code: isString(error?.code) ? error.code : undefined,
      data: isObject(error?.data) ? error.data : {},
      debug: isObject(error?.debug) ? error.debug : {},
      errors: isArray(error?.errors) ? error.errors : [],
      message: isString(error?.message) ? error.message : "",
      name: isString(error?.constructor?.name) ? error.constructor.name : "Error",
      stack: error?.stack ?? undefined,
      status: isFinite(error?.status) ? error.status : undefined,
      title: isString(error?.title) ? error.title : undefined,
    };
  }
}
