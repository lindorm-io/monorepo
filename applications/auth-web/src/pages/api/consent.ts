import type { NextApiRequest, NextApiResponse } from "next";
import { camelKeys, createURL } from "@lindorm-io/core";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = camelKeys<Record<string, string>>(req.query);

  const url = createURL("/consent", {
    host: "http://rm.rm",
    query: { sessionId },
  });

  return res.redirect(url.toString().replace("http://rm.rm", ""));
}
