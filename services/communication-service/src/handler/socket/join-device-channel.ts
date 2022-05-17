import { ServerSocket } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { ChallengeConfirmationTokenClaims } from "../../common";

export const joinDeviceChannel = (socket: ServerSocket): ServerSocket =>
  socket.on("join_device_channel", (token: string) => {
    const { jwt } = socket.ctx;

    if (!token) {
      throw new ClientError("Invalid token", {
        description: "Token could not be found",
      });
    }

    const verified = jwt.verify<Record<string, any>, ChallengeConfirmationTokenClaims>(token);

    socket.join(verified.claims.deviceLinkId);
  });
