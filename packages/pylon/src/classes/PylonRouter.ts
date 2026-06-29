import type { DefaultState } from "koa";
import Router, { type IRouterOptions } from "koa-router";
import { httpParamsParserMiddleware } from "../internal/middleware/http-params-parser-middleware.js";
import type { PylonHttpContext, PylonHttpMiddleware } from "../types/index.js";

export class PylonRouter<C extends PylonHttpContext = PylonHttpContext> {
  private readonly _router: Router<DefaultState, C>;

  constructor(options?: IRouterOptions) {
    this._router = new Router<DefaultState, C>(options);
  }

  allowedMethods(): PylonHttpMiddleware<C> {
    return this._router.allowedMethods() as PylonHttpMiddleware<C>;
  }

  middleware(): PylonHttpMiddleware<C> {
    return this._router.middleware() as PylonHttpMiddleware<C>;
  }

  routes(): PylonHttpMiddleware<C> {
    return this._router.routes() as PylonHttpMiddleware<C>;
  }

  get stack(): Router.Layer[] {
    return this._router.stack;
  }

  use(...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C>;
  use(
    path: string | Array<string>,
    ...middleware: Array<PylonHttpMiddleware<C>>
  ): PylonRouter<C>;
  use(...args: any): PylonRouter<C> {
    this._router.use(...args);
    return this;
  }

  get(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.get(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.get(path, ...middleware);
    }
    return this;
  }

  post(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.post(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.post(path, ...middleware);
    }
    return this;
  }

  put(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.put(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.put(path, ...middleware);
    }
    return this;
  }

  link(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.link(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.link(path, ...middleware);
    }
    return this;
  }

  unlink(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.unlink(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.unlink(path, ...middleware);
    }
    return this;
  }

  delete(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.delete(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.delete(path, ...middleware);
    }
    return this;
  }

  head(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.head(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.head(path, ...middleware);
    }
    return this;
  }

  options(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.options(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.options(path, ...middleware);
    }
    return this;
  }

  patch(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.patch(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.patch(path, ...middleware);
    }
    return this;
  }

  all(path: string, ...middleware: Array<PylonHttpMiddleware<C>>): PylonRouter<C> {
    if (path.includes("/:")) {
      this._router.all(path, ...[httpParamsParserMiddleware, ...middleware]);
    } else {
      this._router.all(path, ...middleware);
    }
    return this;
  }
}
