import { io } from "socket.io-client";

const [bearerToken, deviceToken] = process.argv.slice(2);

const socket = io("http://127.0.0.1:3002", {
  auth: {
    bearerToken,
  },
});

socket.on("connect_error", (err) => {
  console.log("connect_error", err);
});

socket.on("connect", () => {
  console.log("connect", { id: socket.id, connected: socket.connected });

  socket.emit("test", "arg1", "arg2");

  if (deviceToken) {
    socket.emit("join_device_channel", deviceToken);
  }
});

socket.on("device_room", (...args) => {
  console.log("device_room", { id: socket.id, args });
});

socket.on("identity_room", (...args) => {
  console.log("identity_room", { id: socket.id, args });
});

socket.on("session_room", (...args) => {
  console.log("session_room", { id: socket.id, args });
});

socket.connect();
