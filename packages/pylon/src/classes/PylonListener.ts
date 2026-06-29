import type { EventSegment } from "../internal/classes/EventMatcher.js";
import type {
  PylonListenerMethod,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../types/index.js";

type Listener<C extends PylonSocketContext> = {
  event: string;
  method: PylonListenerMethod;
  listeners: Array<PylonSocketMiddleware<C>>;
  segments?: Array<EventSegment>;
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

  constructor(options: Options = {}) {
    this._listeners = [];
    this._middleware = [];
    this._namespace = this.parseNamespace(options.namespace);
    this._prefix = options.prefix ?? null;
  }

  // public getters

  get listeners(): Array<Listener<C>> {
    return this._listeners;
  }

  get middleware(): Array<PylonSocketMiddleware<C>> {
    return this._middleware;
  }

  get namespace(): string | null {
    return this._namespace;
  }

  set namespace(value: string | null) {
    this._namespace = this.parseNamespace(value);
  }

  get prefix(): string | null {
    return this._prefix;
  }

  set prefix(value: string | null) {
    this._prefix = value;
  }

  // public

  parent(listener: PylonListener<C>): void {
    this._middleware = [...listener.middleware, ...this._middleware];
  }

  use(...middleware: Array<PylonSocketMiddleware<C>>): void {
    this._middleware.push(...middleware);
  }

  on(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "on", listeners });
  }

  onAny(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "onAny", listeners });
  }

  onAnyOutgoing(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "onAnyOutgoing", listeners });
  }

  once(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "once", listeners });
  }

  prependAny(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "prependAny", listeners });
  }

  prependAnyOutgoing(event: string, ...listeners: Array<PylonSocketMiddleware<C>>): void {
    this._listeners.push({ event, method: "prependAnyOutgoing", listeners });
  }

  /** @internal — used by PylonListenerScanner to register listeners with segment metadata */
  _addScannedListener(
    event: string,
    method: PylonListenerMethod,
    segments: Array<EventSegment>,
    handlers: Array<PylonSocketMiddleware<C>>,
  ): void {
    this._listeners.push({ event, method, listeners: handlers, segments });
  }

  // private

  private parseNamespace(value?: string | null): string | null {
    return !value ? null : value?.startsWith("/") ? value : `/${value}`;
  }
}
