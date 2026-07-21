import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../main";
import { api } from "../api";

vi.mock("../api", () => ({ api: vi.fn() }));

const page = { content: [], page: { number: 0, totalPages: 0 } };
const emptyCart = { id: 1, items: [], totalPrice: 0 };

function mockUser(role = "USER") {
  api.mockImplementation((path) => {
    if (path === "/api/auth/me")
      return Promise.resolve({ username: "ihsan", role });
    if (path === "/api/categories") return Promise.resolve([]);
    if (path.startsWith("/api/products")) return Promise.resolve(page);
    if (path === "/api/cart") return Promise.resolve(emptyCart);
    if (path === "/api/orders") return Promise.resolve([]);
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  history.replaceState({}, "", "/products");
  api.mockReset();
});

describe("page navigation", () => {
  it("does not mount a protected page before the session check finishes", async () => {
    let resolveMe;
    api.mockImplementation((path) =>
      path === "/api/auth/me"
        ? new Promise((resolve) => {
            resolveMe = resolve;
          })
        : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    history.replaceState({}, "", "/account");

    render(<App />);

    expect(screen.getByText("Oturum kontrol ediliyor…")).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);

    await act(async () => resolveMe({ username: "ihsan", role: "USER" }));
    expect(
      await screen.findByRole("heading", { name: "Hesabım" }),
    ).toBeInTheDocument();
  });

  it("keeps guests away from cart without making a cart request", async () => {
    api.mockRejectedValueOnce(new Error("Unauthorized"));
    history.replaceState({}, "", "/cart");

    render(<App />);

    expect(
      await screen.findByText("Bu sayfa için giriş yapmalısın."),
    ).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalledWith("/api/cart");
  });

  it("navigates between catalog, cart, orders and account for a user", async () => {
    const user = userEvent.setup();
    mockUser();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Senin için seçtiklerimiz" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sepet" }));
    expect(
      await screen.findByRole("heading", { name: "Sepetim" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siparişler" }));
    expect(
      await screen.findByRole("heading", { name: "Siparişlerim" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hesabım" }));
    expect(
      screen.queryByRole("heading", { name: "Parola değiştir" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Parolamı değiştir/ }));
    expect(
      await screen.findByRole("heading", { name: "Parola değiştir" }),
    ).toBeInTheDocument();
  });

  it("loads at most ten products per page and requests the next page", async () => {
    const user = userEvent.setup();
    api.mockImplementation((path) => {
      if (path === "/api/auth/me") return Promise.reject(new Error("Guest"));
      if (path === "/api/categories") return Promise.resolve([]);
      if (path.startsWith("/api/products"))
        return Promise.resolve({
          content: [],
          page: { number: path.includes("page=1") ? 1 : 0, totalPages: 2 },
        });
      return Promise.resolve(null);
    });

    render(<App />);

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(expect.stringMatching(/size=10/)),
    );
    await user.click(screen.getByRole("button", { name: "Sonraki" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(expect.stringMatching(/page=1/)),
    );
  });

  it("shows the product name in the add-to-cart notification", async () => {
    const user = userEvent.setup();
    const product = {
      id: 7,
      name: "Akıllı Saat Fit",
      description: "Günlük aktivite takibi",
      price: 1699,
      stockQuantity: 8,
      category: { name: "Elektronik" },
    };
    api.mockImplementation((path) => {
      if (path === "/api/auth/me")
        return Promise.resolve({ username: "ihsan", role: "USER" });
      if (path === "/api/categories") return Promise.resolve([]);
      if (path.startsWith("/api/products"))
        return Promise.resolve({
          content: [product],
          page: { number: 0, totalPages: 1 },
        });
      return Promise.resolve(null);
    });

    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Sepete ekle" }),
    );

    expect(
      await screen.findByText("Akıllı Saat Fit sepete eklendi."),
    ).toBeInTheDocument();
  });

  it("warns guests before redirecting them to login from add to cart", async () => {
    const user = userEvent.setup();
    api.mockImplementation((path) => {
      if (path === "/api/auth/me") return Promise.reject(new Error("Guest"));
      if (path === "/api/categories") return Promise.resolve([]);
      if (path.startsWith("/api/products"))
        return Promise.resolve({
          content: [
            {
              id: 7,
              name: "Akıllı Saat Fit",
              price: 1699,
              stockQuantity: 8,
              category: { name: "Elektronik" },
            },
          ],
          page: { number: 0, totalPages: 1 },
        });
      return Promise.resolve(null);
    });

    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Sepete ekle" }),
    );

    expect(
      await screen.findByText("Sepete ürün eklemek için giriş yapmalısınız."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Giriş yap" }),
    ).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith("/api/cart/items", expect.anything());
  });

  it("shows the product name and quantity change in cart notifications", async () => {
    const user = userEvent.setup();
    const cart = {
      id: 1,
      totalPrice: 1699,
      items: [
        {
          id: 11,
          quantity: 1,
          product: { name: "Akıllı Saat Fit", price: 1699 },
        },
      ],
    };
    api.mockImplementation((path) => {
      if (path === "/api/auth/me")
        return Promise.resolve({ username: "ihsan", role: "USER" });
      if (path === "/api/cart") return Promise.resolve(cart);
      if (path === "/api/cart/items/11")
        return Promise.resolve({
          ...cart,
          items: [{ ...cart.items[0], quantity: 2 }],
          totalPrice: 3398,
        });
      return Promise.resolve(null);
    });
    history.replaceState({}, "", "/cart");

    render(<App />);
    await user.click(await screen.findByRole("button", { name: "+" }));

    expect(
      await screen.findByText("Akıllı Saat Fit +1 · Sepet güncellendi."),
    ).toBeInTheDocument();
  });

  it("shows management pages only to admins", async () => {
    const user = userEvent.setup();
    mockUser("ADMIN");
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Yönetim" }));
    expect(
      await screen.findByRole("heading", { name: "Kategori yönetimi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ürün yönetimi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sipariş durumu" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/products?size=100&sort=id,asc"),
    );
  });

  it("approves an order and closes the confirmation dialog", async () => {
    const user = userEvent.setup();
    const order = {
      id: 42,
      items: [{ id: 1, product: { name: "Kulaklık" }, quantity: 1 }],
      totalAmount: 799,
      status: "PENDING",
      approved: false,
      createdAt: "2026-07-21T12:00:00",
    };
    api.mockImplementation((path, options) => {
      if (path === "/api/auth/me")
        return Promise.resolve({ username: "ihsan", role: "USER" });
      if (path === "/api/orders/42/approve" && options?.method === "POST")
        return Promise.resolve({ ...order, approved: true });
      if (path === "/api/orders") return Promise.resolve([order]);
      return Promise.resolve(null);
    });
    history.replaceState({}, "", "/orders");

    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Siparişi onayla" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Siparişin onaylandı" }),
    ).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/api/orders/42/approve", {
      method: "POST",
    });

    await user.click(screen.getByRole("button", { name: "×" }));
    expect(
      screen.queryByRole("heading", { name: "Siparişin onaylandı" }),
    ).not.toBeInTheDocument();
  });
});
