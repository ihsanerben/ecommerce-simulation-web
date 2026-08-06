import { describe, expect, it } from "vitest";
import { notificationWebSocketUrl } from "../liveNotifications";

describe("notificationWebSocketUrl", () => {
  it("uses secure WebSocket for an HTTPS API", () => {
    expect(notificationWebSocketUrl("https://api.example.com/api")).toBe(
      "wss://api.example.com/ws/notifications",
    );
  });

  it("uses plain WebSocket for a local HTTP API", () => {
    expect(notificationWebSocketUrl("http://localhost:8080")).toBe(
      "ws://localhost:8080/ws/notifications",
    );
  });
});
