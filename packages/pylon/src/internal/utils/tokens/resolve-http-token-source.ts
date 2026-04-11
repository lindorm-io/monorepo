import { isString } from "@lindorm/is";
import { IPylonSession } from "../../../interfaces";
import { PylonHttpContext } from "../../../types";

export type HttpTokenSource =
  | { kind: "bearer"; token: string }
  | { kind: "dpop"; token: string }
  | { kind: "session"; session: IPylonSession }
  | { kind: "none" };

export const resolveHttpTokenSource = (ctx: PylonHttpContext): HttpTokenSource => {
  const auth = ctx.state.authorization;

  if (auth.type === "bearer" && isString(auth.value) && auth.value.length > 0) {
    return { kind: "bearer", token: auth.value };
  }

  if (auth.type === "dpop" && isString(auth.value) && auth.value.length > 0) {
    return { kind: "dpop", token: auth.value };
  }

  const session = ctx.state.session;
  if (session && isString(session.accessToken) && session.accessToken.length > 0) {
    return { kind: "session", session };
  }

  return { kind: "none" };
};
