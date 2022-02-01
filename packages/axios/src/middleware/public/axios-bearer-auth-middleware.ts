import { AxiosMiddleware, AxiosRequest } from "../../types";

export const axiosBearerAuthMiddleware = (accessToken: string): AxiosMiddleware => ({
  request: async (request): Promise<AxiosRequest> => ({
    ...request,
    headers: {
      ...(request.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  }),
});
