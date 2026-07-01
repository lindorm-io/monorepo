import {
  isArray,
  isDate,
  isFinite,
  isFunction,
  isNumber,
  isObject,
  isString,
} from "@lindorm/is";
import { randomId } from "@lindorm/random";
import type { Dict } from "@lindorm/types";
import {
  assertValidErrorType,
  createErrorTypeUrn,
  generateSupport,
} from "../utils/index.js";

export type LindormErrorAttributes = {
  id: string;
  code: string | number | null;
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
  type: string;
  timestamp: Date;
};

export type LindormErrorOptions = {
  id?: string;
  code?: string | number;
  data?: Dict;
  debug?: Dict;
  details?: string;
  error?: Error;
  status?: number;
  support?: string;
  title?: string;
  type?: string;
};

export class LindormError extends Error {
  static readonly namespace: string | null = null;

  readonly id: string;
  readonly code: string | number | null;
  readonly data: Dict;
  readonly debug: Dict;
  readonly details: string | null;
  readonly errors: Array<string>;
  readonly status: number;
  readonly support: string | null;
  readonly title: string | null;
  readonly type: string;
  readonly timestamp: Date;

  constructor(message: string, options: LindormErrorOptions = {}) {
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

    this.id = id ?? destruct.id ?? randomId({ namespace: "err", length: 16 });
    this.code = code ?? destruct?.code ?? null;
    this.data = { ...destruct.data, ...data };
    this.debug = { ...destruct.debug, ...debug };
    this.details = options.details ?? destruct.details ?? null;
    this.errors = destruct.errors ?? [];
    this.status = status ?? destruct?.status ?? -1;
    // Auto-generate a readable support code (like `id`) when none is provided,
    // so the same code is logged with the error AND shown to the user — making
    // it actually correlatable when quoted back.
    this.support = support ?? destruct?.support ?? generateSupport();
    this.title = title ?? destruct?.title ?? null;
    this.timestamp = destruct?.timestamp ?? new Date();

    if (isString(options.type)) {
      assertValidErrorType(options.type);
      this.type = options.type;
    } else {
      const namespace = (this.constructor as typeof LindormError).namespace;
      this.type = destruct?.type ?? createErrorTypeUrn(this.code, this.name, namespace);
    }

    if (options.error instanceof Error && options.error.name && options.error.message) {
      this.errors.push(`${destruct.name}: ${destruct.message}`);
    }
  }

  // public

  toJSON(): LindormErrorAttributes {
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
      type: this.type,
      timestamp: this.timestamp,
    };
  }

  // private static

  private static destruct(error?: any): Partial<LindormErrorAttributes> {
    return {
      id: isString(error?.id) ? error.id : undefined,
      code: isString(error?.code) || isNumber(error?.code) ? error.code : undefined,
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
      type: isString(error?.type) ? error.type : undefined,
      timestamp: isDate(error?.timestamp) ? error.timestamp : undefined,
    };
  }
}
