import type { NextApiRequest, NextApiResponse } from "next";
import { authClient } from "../../../backend/axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const response = await authClient.get("/sessions/consent/:id", {
    params: { id: req.query.session_id },
  });

  return res.status(200).json(response.data);
}
