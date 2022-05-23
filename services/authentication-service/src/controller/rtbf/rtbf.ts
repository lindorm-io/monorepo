import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { destroyAccountCallback } from "../../handler";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    entity: { account },
    repository: { accountRepository },
  } = ctx;

  await accountRepository.destroy(account, destroyAccountCallback(ctx));
};
