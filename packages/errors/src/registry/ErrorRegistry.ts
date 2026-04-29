import type { Dict } from "@lindorm/types";
import { ClientError } from "../errors/ClientError.js";
import { LindormError, type LindormErrorOptions } from "../errors/LindormError.js";
import { ServerError } from "../errors/ServerError.js";

export type LindormErrorClass = {
  new (message: string, options?: LindormErrorOptions): LindormError;
  readonly name: string;
  readonly status?: number;
};

export type ResolveHint = {
  name?: string;
  status?: number;
};

export type ReconstructPayload = {
  code?: string | number;
  data?: Dict;
  debug?: Dict;
  id?: string;
  message: string;
  name?: string;
  status?: number;
  support?: string;
  title?: string;
};

export class ErrorRegistry {
  private readonly byName: Map<string, LindormErrorClass> = new Map();
  private readonly byStatus: Map<number, LindormErrorClass> = new Map();

  public register(cls: LindormErrorClass): void {
    if (!cls.name) {
      throw new LindormError("Cannot register anonymous error class");
    }
    this.byName.set(cls.name, cls);
    if (typeof cls.status === "number") {
      this.byStatus.set(cls.status, cls);
    }
  }

  public resolve(hint: ResolveHint): LindormErrorClass {
    if (hint.name && this.byName.has(hint.name)) {
      return this.byName.get(hint.name)!;
    }
    if (typeof hint.status === "number") {
      const exact = this.byStatus.get(hint.status);
      if (exact) return exact;
      if (hint.status >= 400 && hint.status < 500) return ClientError;
      if (hint.status >= 500 && hint.status < 600) return ServerError;
    }
    return LindormError;
  }

  public reconstruct(payload: ReconstructPayload): LindormError {
    const Cls = this.resolve({ name: payload.name, status: payload.status });
    return new Cls(payload.message, {
      id: payload.id,
      code: payload.code,
      data: payload.data,
      debug: payload.debug,
      status: payload.status,
      support: payload.support,
      title: payload.title,
    });
  }

  public has(name: string): boolean {
    return this.byName.has(name);
  }

  public unregister(name: string): boolean {
    const cls = this.byName.get(name);
    if (!cls) return false;
    this.byName.delete(name);
    if (typeof cls.status === "number") this.byStatus.delete(cls.status);
    return true;
  }

  /**
   * @internal Test-only. Resets registry state between cases.
   * Not part of the public API. Calling this from application code will
   * desync the HTTP class registry from the imported error classes and
   * break `reconstruct()` until classes are re-imported. The fixture at
   * `registry/__fixtures__/reset.ts` is the sanctioned bypass.
   */
  // @ts-ignore TS6133 — intentionally unreachable from in-package code; reset fixture accesses via @ts-expect-error.
  private clear(): void {
    this.byName.clear();
    this.byStatus.clear();
  }
}

export const errorRegistry = new ErrorRegistry();
