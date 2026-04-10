import { AuthorizationState, AuthorizationType, PylonSocket } from "../../types";

const DEFAULT: AuthorizationState = {
  type: "none",
  value: null,
} as const;

export const getSocketAuthorization = (socket: PylonSocket): AuthorizationState => {
  const auth = socket.handshake?.auth?.token ?? socket.handshake?.headers?.authorization;

  if (!auth || typeof auth !== "string") {
    return DEFAULT;
  }

  const [t, value] = auth.split(" ");
  const type = t?.toLowerCase() as AuthorizationType;

  if (!["basic", "bearer", "dpop"].includes(type)) {
    return DEFAULT;
  }

  if (!value || !value.length) {
    return DEFAULT;
  }

  return { type, value } as AuthorizationState;
};
