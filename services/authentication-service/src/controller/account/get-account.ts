import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

export const getAccountController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    entity: { account },
  } = ctx;

  return {
    body: {
      browserLinkCode: !!account.browserLinkCode,
      password: !!account.password,
      recoveryCode: !!account.recoveryCode,
      totp: !!account.totp,
    },
  };
};
