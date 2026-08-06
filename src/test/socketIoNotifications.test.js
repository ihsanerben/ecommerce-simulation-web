import { describe, expect, it } from "vitest";
import { socketIOServerUrl } from "../socketIoNotifications";

describe("socketIOServerUrl", () => {
  it("uses the local Socket.IO port in development", () => {
    expect(socketIOServerUrl("http://localhost:8080")).toBe(
      "http://localhost:9092",
    );
  });
});
