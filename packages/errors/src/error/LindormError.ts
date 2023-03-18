import clone from "clone";
import { ExtendableError } from "./ExtendableError";
import { v4 as uuid } from "uuid";

export type LindormErrorAttributes = {
  id: string;
  code: string | null;
  data?: Record<string, any>;
  debug?: Record<string, any>;
  description: string | null;
  message: string;
  name: string;
  parents: Array<Partial<LindormErrorAttributes>>;
  stack?: any;
  title: string | null;
  trace: Array<string>;
};

export type LindormErrorOptions = {
  code?: string | null;
  data?: Record<string, any>;
  debug?: Record<string, any>;
  description?: string | null;
  error?: Error;
  title?: string | null;
};

export class LindormError extends ExtendableError {
  public readonly id: string;
  public readonly code: string | null;
  public readonly data: Record<string, any>;
  public readonly debug: Record<string, any>;
  public readonly description: string | null;
  public readonly parents: Array<Partial<LindormErrorAttributes>>;
  public readonly title: string | null;
  public readonly trace: Array<string>;

  public constructor(message: string, options: LindormErrorOptions = {}) {
    super(message);

    const { code, data = {}, debug = {}, description, title } = options;
    const error = LindormError.destruct(options.error);

    this.id = error.id || uuid();
    this.code = code || error?.code || null;
    this.data = { ...data, ...(error.data || {}) };
    this.debug = { ...debug, ...(error.debug || {}) };
    this.description = description || error?.description || null;
    this.parents = error.parents || [];
    this.title = title || error?.title || null;
    this.trace = error.trace || [];

    if (error.name && error.message) {
      const { id, parents, trace, ...rest } = error;
      this.parents.push(clone(rest));
      this.trace.push(`${error.name}: ${error.message}`);
    }
  }

  private static destruct(error?: any): any {
    if (!error) return {};

    const {
      id,
      code,
      data,
      debug,
      description,
      message,
      name,
      parents,
      stack,
      title,
      trace,
      ...rest
    } = error;

    return {
      id: typeof id === "string" ? id : undefined,
      code: typeof code === "string" ? code : undefined,
      data: typeof data === "object" && !Array.isArray(data) ? data : undefined,
      debug: typeof debug === "object" && !Array.isArray(debug) ? debug : undefined,
      description: typeof description === "string" ? description : undefined,
      message: message || undefined,
      name: error.constructor?.name || undefined,
      parents: Array.isArray(parents) ? [...parents] : undefined,
      title: typeof title === "string" ? title : undefined,
      trace: Array.isArray(trace) ? [...trace] : undefined,

      ...rest,
    };
  }

  public toJSON(): LindormErrorAttributes {
    return clone({
      id: this.id,
      code: this.code,
      data: this.data,
      debug: this.debug,
      description: this.description,
      message: this.message,
      name: this.name,
      parents: this.parents,
      stack: this.stack,
      title: this.title,
      trace: this.trace,
    });
  }
}
