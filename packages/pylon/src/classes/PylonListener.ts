import { PylonListenerMethod, PylonSocketContext, PylonSocketMiddleware } from "../types";

type Listener<C extends PylonSocketContext> = {
  event: string;
  method: PylonListenerMethod;
  listeners: Array<PylonSocketMiddleware<C>>;
};

type Options = {
  namespace?: string;
  prefix?: string;
};

export class PylonListener<C extends PylonSocketContext = PylonSocketContext> {
  private readonly _listeners: Array<Listener<C>>;
  private _middleware: Array<PylonSocketMiddleware<C>>;
  private _namespace: string | null;
  private _prefix: string | null;

  public constructor(options: Options = {}) {
    this._listeners = [];
    this._middleware = [];
    this._namespace = this.parseNamespace(options.namespace);
    this._prefix = options.prefix ?? null;
  }

  // public getters

  public get listeners(): Array<Listener<C>> {
    return this._listeners;
  }

  public get middleware(): Array<PylonSocketMiddleware<C>> {
    return this._middleware;
  }

  public get namespace(): string | null {
    return this._namespace;
  }

  public set namespace(value: string | null) {
    this._namespace = this.parseNamespace(value);
  }

  public get prefix(): string | null {
    return this._prefix;
  }

  public set prefix(value: string | null) {
    this._prefix = value;
  }

  // public

  public parent(listener: PylonListener<C>): void {
    this._middleware = [...listener.middleware, ...this._middleware];
  }

  public use(...middleware: Array<PylonSocketMiddleware<C>>): void {
    this._middleware.push(...middleware);
  }

  public on(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "on", listeners });
  }

  public onAny(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "onAny", listeners });
  }

  public onAnyOutgoing(
    event: string,
    ...listeners: Array<PylonSocketMiddleware<C>>
  ): void {
    this._listeners.push({ event, method: "onAnyOutgoing", listeners });
  }

  public once(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "once", listeners });
  }

  public prependAny(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "prependAny", listeners });
  }

  public prependAnyOutgoing(
    event: string,
    ...listeners: Array<PylonSocketMiddleware<C>>
  ): void {
    this._listeners.push({ event, method: "prependAnyOutgoing", listeners });
  }

  // private

  private parseNamespace(value?: string | null): string | null {
    return !value ? null : value?.startsWith("/") ? value : `/${value}`;
  }
}
