import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

interface PublicBrowserLink {
  id: string;
  browser: string;
  created: Date;
  os: string;
  platform: string;
}

interface ResponseBody {
  browserLinks: Array<PublicBrowserLink>;
}

export const getBrowserLinksController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    mongo: { browserLinkRepository },
    token: {
      bearerToken: { subject: accountId },
    },
  } = ctx;

  const browserLinks = await browserLinkRepository.findMany({ accountId });

  return {
    body: {
      browserLinks: browserLinks.map((item) => ({
        id: item.id,
        browser: item.browser,
        created: item.created,
        os: item.os,
        platform: item.platform,
      })),
    },
  };
};
