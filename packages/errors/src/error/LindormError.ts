import { ExtendableError } from "./ExtendableError";
import { cloneDeep } from "lodash";
import { randomUUID } from "crypto";

export interface ILindormError {
  id: string;
  code: string | null;
  data: Record<string, any>;
  debug: Record<string, any>;
  description: string | null;
  errors: Array<Error>;
  message: string;
  name: string;
  stack?: any;
  title: string | null;
  trace: Array<string>;
}

export interface LindormErrorOptions {
  code?: string;
  data?: Record<string, any>;
  debug?: Record<string, any>;
  description?: string;
  error?: Error;
  title?: string;
}

export class LindormError extends ExtendableError {
  public readonly id: string;
  public readonly code: string | null;
  public readonly data: Record<string, any>;
  public readonly debug: Record<string, any>;
  public readonly description: string | null;
  public readonly errors: Array<Error>;
  public readonly title: string | null;
  public readonly trace: Array<string>;

  public constructor(message: string, options: LindormErrorOptions = {}) {
    super(message);

    const inherited: ILindormError | null =
      options.error && options.error instanceof LindormError
        ? cloneDeep(options.error.toJSON())
        : null;

    this.id = inherited?.id || randomUUID();
    this.code = options.code || inherited?.code || null;
    this.data = options.data || inherited?.data || {};
    this.debug = options.debug || inherited?.debug || {};
    this.description = options.description || inherited?.description || null;
    this.errors = inherited?.errors || [];
    this.title = options.title || inherited?.title || null;
    this.trace = inherited?.trace || [];

    if (options.error instanceof Error) {
      const prefix = options.error.constructor?.name
        ? `${options.error.constructor?.name}: `
        : "Error";

      this.errors.push(options.error);
      this.trace.push(`${prefix}${options.error.message}`);
    }
  }

  public toJSON(): ILindormError {
    return {
      id: this.id,
      code: this.code,
      data: this.data,
      debug: this.debug,
      description: this.description,
      errors: this.errors,
      message: this.message,
      name: this.name,
      stack: this.stack,
      title: this.title,
      trace: this.trace,
    };
  }
}
