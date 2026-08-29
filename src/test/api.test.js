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

  it("refreshes an expired session and retries the original request once", async () => {
    let protectedRequestCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.endsWith("/api/auth/csrf")) {
        document.cookie = "ECOMMERCE-XSRF-TOKEN=csrf-value";
        return { ok: true, status: 200, headers: { get: () => "" } };
      }
      if (url.endsWith("/api/auth/refresh")) {
        return { ok: true, status: 200, headers: { get: () => "" } };
      }
      protectedRequestCount += 1;
      return protectedRequestCount === 1
        ? {
            ok: false,
            status: 401,
            headers: { get: () => "application/json" },
            json: async () => ({ message: "Authentication is required." }),
          }
        : {
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ content: ["conversation"] }),
          };
    });

    await expect(api("/api/support/conversations")).resolves.toEqual({
      content: ["conversation"],
    });
    expect(protectedRequestCount).toBe(2);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/auth/refresh",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-XSRF-TOKEN": "csrf-value" }),
      }),
    );
  });

  it("uses one refresh request when concurrent requests receive 401", async () => {
    let refreshCount = 0;
    const attempts = new Map();
    fetch.mockImplementation(async (url) => {
      if (url.endsWith("/api/auth/csrf")) {
        document.cookie = "ECOMMERCE-XSRF-TOKEN=csrf-value";
        return { ok: true, status: 200, headers: { get: () => "" } };
      }
      if (url.endsWith("/api/auth/refresh")) {
        refreshCount += 1;
        return { ok: true, status: 200, headers: { get: () => "" } };
      }
      const attempt = (attempts.get(url) || 0) + 1;
      attempts.set(url, attempt);
      return attempt === 1
        ? {
            ok: false,
            status: 401,
            headers: { get: () => "application/json" },
            json: async () => ({ message: "Authentication is required." }),
          }
        : {
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ ok: true }),
          };
    });

    await Promise.all([api("/api/orders"), api("/api/support/conversations")]);

    expect(refreshCount).toBe(1);
  });
});
