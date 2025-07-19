import { Aegis } from "@lindorm/aegis";
import { ServerError } from "@lindorm/errors";
import { removeUndefined } from "@lindorm/utils";
import { IPylonSession } from "../../interfaces";
import {
  PylonHttpMiddleware,
  PylonSessionConfig,
  PylonSessionOptions,
} from "../../types";
import { createSessionStore } from "../../utils/private";

export const createHttpSessionMiddleware = (
  options: PylonSessionOptions<any>,
): PylonHttpMiddleware => {
  const name = options.name ?? "pylon_session";

  const config: PylonSessionConfig = removeUndefined({
    domain: options.domain,
    encoding: options.encoding,
    encrypted: options.encrypted,
    expiry: options.expiry,
    httpOnly: options.httpOnly,
    path: options.path,
    priority: options.priority,
    sameSite: options.sameSite,
    secure: options.secure,
    signed: options.signed,
  });

  const store = createSessionStore(options);

  return async function httpSessionMiddleware(ctx, next) {
    ctx.session = {
      set: async (session: IPylonSession): Promise<void> => {
        const value = store ? await store.set(ctx, session) : session;
        await ctx.cookies.set(name, value, config);
      },

      get: async (): Promise<IPylonSession | null> => {
        const cookie = await ctx.cookies.get(name, config);
        const value = store ? await store.get(ctx, cookie) : cookie;
        return value ?? null;
      },

      del: async (): Promise<void> => {
        if (store) {
          const cookie = await ctx.cookies.get(name, config);
          await store.del(ctx, cookie);
        }
        ctx.cookies.del(name);
      },

      logout: async (subject: string): Promise<void> => {
        if (store) {
          await store.logout(ctx, subject);
        } else {
          throw new ServerError("Session store not found");
        }
      },
    };

    ctx.state.session = await ctx.session.get();

    if (ctx.state.session) {
      ctx.state.metadata.sessionId = ctx.state.session.id;
      ctx.logger.correlation({ sessionId: ctx.state.session.id });
    }

    if (ctx.state.session?.accessToken) {
      try {
        ctx.state.tokens.accessToken = Aegis.parse(ctx.state.session.accessToken);
      } catch {
        /* ignore */
      }
    }

    if (ctx.state.session?.idToken) {
      ctx.state.tokens.idToken = Aegis.parse(ctx.state.session.idToken);
    }

    await next();
  };
};
