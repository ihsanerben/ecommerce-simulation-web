import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api";

describe("api client", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", { writable: true, value: "" });
    global.fetch = vi.fn();
  });

  it("sends credentials and the CSRF header for state-changing requests", async () => {
    fetch
      .mockImplementationOnce(async () => {
        document.cookie = "ECOMMERCE-XSRF-TOKEN=csrf-value";
        return { ok: true, headers: { get: () => "" } };
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true }),
      });

    await api("/api/cart/items", {
      method: "POST",
      body: '{"productId":1,"quantity":1}',
    });

    expect(fetch).toHaveBeenLastCalledWith(
      "http://localhost:8080/api/cart/items",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "X-XSRF-TOKEN": "csrf-value",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("surfaces backend field validation messages", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({
        fieldErrors: { quantity: "Quantity must be positive" },
      }),
    });

    await expect(api("/api/cart")).rejects.toThrow("Quantity must be positive");
  });

  it("exposes rate-limit status and retry-after metadata", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (name) => (name === "content-type" ? "application/json" : "60"),
      },
      json: async () => ({ message: "Too many requests." }),
    });

    await expect(api("/api/auth/login")).rejects.toMatchObject({
      name: ApiError.name,
      status: 429,
      retryAfter: 60,
    });
  });
});
