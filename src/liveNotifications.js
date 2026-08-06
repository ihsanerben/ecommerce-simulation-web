const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:8080");

export function notificationWebSocketUrl(apiUrl = API_URL) {
  const url = new URL(apiUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/notifications";
  url.search = "";
  return url.toString();
}

export function connectLiveNotifications({ onNotification, onStatusChange }) {
  if (typeof WebSocket === "undefined") return () => {};

  let socket;
  let reconnectTimer;
  let stopped = false;

  const connect = () => {
    onStatusChange?.("connecting");
    socket = new WebSocket(notificationWebSocketUrl());
    socket.addEventListener("open", () => onStatusChange?.("connected"));
    socket.addEventListener("message", (event) => {
      try {
        onNotification(JSON.parse(event.data));
      } catch {
        // Ignore malformed server frames and keep the live connection active.
      }
    });
    socket.addEventListener("close", () => {
      onStatusChange?.("disconnected");
      if (!stopped) reconnectTimer = window.setTimeout(connect, 3000);
    });
    socket.addEventListener("error", () => socket.close());
  };

  connect();

  return () => {
    stopped = true;
    window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
