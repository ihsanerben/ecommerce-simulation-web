import { io } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:8080");

export function socketIOServerUrl(apiUrl = API_URL) {
  const url = new URL(apiUrl, window.location.origin);
  if (!import.meta.env.PROD) url.port = "9092";
  url.pathname = "";
  url.search = "";
  return url.origin;
}

export function connectLiveNotifications({ onNotification, onStatusChange }) {
  onStatusChange?.("connecting");
  const socket = io(socketIOServerUrl(), {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 3000,
  });

  socket.on("connect", () => onStatusChange?.("connected"));
  socket.on("disconnect", () => onStatusChange?.("disconnected"));
  socket.on("connect_error", () => onStatusChange?.("disconnected"));
  socket.on("live-notification", onNotification);

  return () => socket.disconnect();
}
