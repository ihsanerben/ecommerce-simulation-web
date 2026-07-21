import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import "./styles.css";
import n11Logo from "../n11_photos/logo1.jpg";
import n11Cover from "../n11_photos/Cover Banner 2.jpg";

const money = (v) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    v || 0,
  );
const date = (v) => new Date(v).toLocaleString("tr-TR");
const paths = [
  "/products",
  "/cart",
  "/orders",
  "/account",
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];
const currentPath = () =>
  paths.includes(location.pathname) ? location.pathname : "/products";
const productImages = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80",
];
const productImage = (p) =>
  productImages[Math.abs(Number(p.id) || 0) % productImages.length];

function Field({ label, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function Empty({ children }) {
  return <div className="empty-state">{children}</div>;
}

function AuthForm({ mode, navigate, reloadUser, notify }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    newPassword: "",
  });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: form.username,
            password: form.password,
          }),
        });
        await reloadUser();
        notify(`Hoş geldin ${form.username}! Giriş başarılı.`);
        navigate("/products");
      }
      if (mode === "register") {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: form.username,
            email: form.email,
            password: form.password,
          }),
        });
        await reloadUser();
        notify(`Hoş geldin ${form.username}! Hesabın oluşturuldu.`);
        navigate("/products");
      }
      if (mode === "forgot")
        notify(
          (
            await api("/api/auth/forgot-password", {
              method: "POST",
              body: JSON.stringify({ email: form.email }),
            })
          ).message,
        );
      if (mode === "reset") {
        const token = new URLSearchParams(location.search).get("token");
        if (!token) throw Error("Reset token bulunamadı.");
        notify(
          (
            await api("/api/auth/reset-password", {
              method: "POST",
              body: JSON.stringify({ token, newPassword: form.newPassword }),
            })
          ).message,
        );
        setTimeout(() => navigate("/login"), 1000);
      }
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const title = {
    login: "Giriş yap",
    register: "Hesap oluştur",
    forgot: "Parolamı unuttum",
    reset: "Yeni parola belirle",
  }[mode];
  return (
    <Panel title={title} sub="Cookie tabanlı güvenli authentication akışı.">
      <form onSubmit={submit}>
        {["login", "register"].includes(mode) && (
          <Field
            label="Kullanıcı adı"
            name="username"
            value={form.username}
            onChange={set}
            required
          />
        )}
        {["register", "forgot"].includes(mode) && (
          <Field
            label="E-posta"
            name="email"
            type="email"
            value={form.email}
            onChange={set}
            required
          />
        )}
        {["login", "register"].includes(mode) && (
          <Field
            label="Parola"
            name="password"
            type="password"
            minLength="8"
            value={form.password}
            onChange={set}
            required
          />
        )}
        {mode === "reset" && (
          <Field
            label="Yeni parola"
            name="newPassword"
            type="password"
            minLength="8"
            value={form.newPassword}
            onChange={set}
            required
          />
        )}
        <button className="primary">Devam et</button>
      </form>
      <div className="form-links">
        <button onClick={() => navigate("/login")}>Giriş</button>
        <button onClick={() => navigate("/register")}>Kayıt</button>
        <button onClick={() => navigate("/forgot-password")}>
          Parolamı unuttum
        </button>
      </div>
    </Panel>
  );
}

function Panel({ title, sub, actions, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Products({ user, navigate, notify }) {
  const [products, setProducts] = useState([]),
    [categories, setCategories] = useState([]),
    [meta, setMeta] = useState({ page: 0, totalPages: 1 });
  const [filter, setFilter] = useState({ search: "", categoryId: "" }),
    [detail, setDetail] = useState(null);
  const load = useCallback(
    async (page = 0) => {
      try {
        const q = new URLSearchParams({ page, size: 10, sort: "id,asc" });
        if (filter.search) q.set("search", filter.search);
        if (filter.categoryId) q.set("categoryId", filter.categoryId);
        const d = await api(`/api/products?${q}`);
        setProducts(d.content || []);
        setMeta({
          page: d.page?.number || 0,
          totalPages: d.page?.totalPages || 1,
        });
      } catch (e) {
        notify(e.message, "error");
      }
    },
    [filter],
  );
  useEffect(() => {
    api("/api/categories")
      .then(setCategories)
      .catch((e) => notify(e.message, "error"));
    load();
  }, [load]);
  const add = async (product) => {
    if (!user) return navigate("/login");
    try {
      await api("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      notify(`${product.name} sepete eklendi.`);
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <>
      <section className="hero" style={{ "--hero-cover": `url(${n11Cover})` }}>
        <div>
          <span>İHSAN'IN SEÇİMLERİ</span>
          <h1>
            Tarzını yakala,
            <br />
            alışverişin keyfini çıkar.
          </h1>
          <p>
            Teknolojiden modaya, ev yaşamından kişisel bakıma seçili ürünler.
          </p>
        </div>
        <div className="hero-bubble">
          %25<small>fırsat</small>
        </div>
      </section>
      <Panel
        title="Senin için seçtiklerimiz"
        sub="Arama, kategori filtresi, detay ve sepete ekleme."
      >
        <div className="filters">
          <input
            placeholder="Ürün ara"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            value={filter.categoryId}
            onChange={(e) =>
              setFilter({ ...filter, categoryId: e.target.value })
            }
          >
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={() => load(0)}>Ara</button>
        </div>
        <div className="product-grid">
          {products.map((p) => (
            <article className="product" key={p.id}>
              <div className="product-art">
                <img src={productImage(p)} alt={p.name} loading="lazy" />
              </div>
              <small>{p.category?.name}</small>
              <h3>{p.name}</h3>
              <p>{p.description || "Açıklama yok"}</p>
              <b>{money(p.price)}</b>
              <span>Stok: {p.stockQuantity}</span>
              <div>
                <button
                  onClick={async () =>
                    setDetail(await api(`/api/products/${p.id}`))
                  }
                >
                  Detay
                </button>
                <button
                  className="primary small"
                  disabled={!p.stockQuantity}
                  onClick={() => add(p)}
                >
                  Sepete ekle
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="pager">
          <button disabled={!meta.page} onClick={() => load(meta.page - 1)}>
            Önceki
          </button>
          <span>
            {meta.page + 1} / {Math.max(meta.totalPages, 1)}
          </span>
          <button
            disabled={meta.page + 1 >= meta.totalPages}
            onClick={() => load(meta.page + 1)}
          >
            Sonraki
          </button>
        </div>
      </Panel>
      {detail && (
        <div className="modal" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setDetail(null)}>
              ×
            </button>
            <h2>{detail.name}</h2>
            <p>{detail.description}</p>
            <dl>
              <dt>Kategori</dt>
              <dd>{detail.category?.name}</dd>
              <dt>Fiyat</dt>
              <dd>{money(detail.price)}</dd>
              <dt>Stok</dt>
              <dd>{detail.stockQuantity}</dd>
              <dt>Güncellendi</dt>
              <dd>{date(detail.updatedAt)}</dd>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

function Cart({ navigate, notify }) {
  const [cart, setCart] = useState(null);
  const load = () =>
    api("/api/cart")
      .then(setCart)
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    load();
  }, []);
  const act = async (path, options, message) => {
    try {
      const d = await api(path, options);
      if (d) setCart(d);
      else load();
      notify(message);
    } catch (e) {
      notify(e.message, "error");
    }
  };
  if (!cart) return <Panel title="Sepet" />;
  return (
    <Panel
      title="Sepetim"
      sub={`${cart.items.length} ürün`}
      actions={
        <button
          className="danger"
          onClick={() =>
            act("/api/cart", { method: "DELETE" }, "Sepet temizlendi.")
          }
        >
          Sepeti temizle
        </button>
      }
    >
      {!cart.items.length ? (
        <Empty>
          Sepetin boş.{" "}
          <button onClick={() => navigate("/products")}>
            Alışverişe başla
          </button>
        </Empty>
      ) : (
        <>
          <div className="list">
            {cart.items.map((i) => (
              <div className="row" key={i.id}>
                <div>
                  <b>{i.product.name}</b>
                  <small>{money(i.product.price)}</small>
                </div>
                <div className="qty">
                  <button
                    onClick={() =>
                      i.quantity > 1 &&
                      act(
                        `/api/cart/items/${i.id}`,
                        {
                          method: "PUT",
                          body: JSON.stringify({ quantity: i.quantity - 1 }),
                        },
                        `${i.product.name} −1 · Sepet güncellendi.`,
                      )
                    }
                  >
                    −
                  </button>
                  <span>{i.quantity}</span>
                  <button
                    onClick={() =>
                      act(
                        `/api/cart/items/${i.id}`,
                        {
                          method: "PUT",
                          body: JSON.stringify({ quantity: i.quantity + 1 }),
                        },
                        `${i.product.name} +1 · Sepet güncellendi.`,
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <b>{money(i.product.price * i.quantity)}</b>
                <button
                  className="danger"
                  onClick={() =>
                    act(
                      `/api/cart/items/${i.id}`,
                      { method: "DELETE" },
                      `${i.product.name} sepetten kaldırıldı.`,
                    )
                  }
                >
                  Kaldır
                </button>
              </div>
            ))}
          </div>
          <div className="checkout">
            <h2>{money(cart.totalPrice)}</h2>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await api("/api/orders", { method: "POST" });
                  notify("Siparişin başarıyla oluşturuldu.");
                  navigate("/orders");
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              Siparişi oluştur
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

function Orders({ notify }) {
  const [orders, setOrders] = useState([]),
    [detail, setDetail] = useState(null),
    [approvedOrder, setApprovedOrder] = useState(null);
  const load = () =>
    api("/api/orders")
      .then(setOrders)
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    load();
  }, []);
  const cancel = async (id) => {
    try {
      await api(`/api/orders/${id}/cancel`, { method: "POST" });
      notify(`#${id} numaralı sipariş iptal edildi.`, "danger");
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const approve = async (id) => {
    try {
      const approved = await api(`/api/orders/${id}/approve`, {
        method: "POST",
      });
      setApprovedOrder(approved);
      notify(`#${id} numaralı sipariş onaylandı.`);
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <Panel
      title="Siparişlerim"
      sub="Sipariş onayı, detayları ve iptal işlemleri."
    >
      {!orders.length ? (
        <Empty>Henüz sipariş yok.</Empty>
      ) : (
        <div className="order-grid">
          {orders.map((o) => (
            <article className="order" key={o.id}>
              <div>
                <b>#{o.id}</b>
                <span className={`badge ${o.approved ? "APPROVE" : o.status}`}>
                  {o.approved ? "APPROVE" : o.status}
                </span>
              </div>
              <small>{date(o.createdAt)}</small>
              <h3>{money(o.totalAmount)}</h3>
              <p>{o.items.length} kalem ürün</p>
              <button
                onClick={async () =>
                  setDetail(await api(`/api/orders/${o.id}`))
                }
              >
                Detay
              </button>
              {o.status === "PENDING" && !o.approved && (
                <button className="primary" onClick={() => approve(o.id)}>
                  Siparişi onayla
                </button>
              )}
              {o.status === "PENDING" && (
                <button className="danger" onClick={() => cancel(o.id)}>
                  İptal et
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {detail && (
        <div className="modal" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setDetail(null)}>
              ×
            </button>
            <h2>Sipariş #{detail.id}</h2>
            {detail.items.map((i) => (
              <div className="row" key={i.id}>
                <span>
                  {i.product.name} × {i.quantity}
                </span>
                <b>{money(i.subtotal)}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      {approvedOrder && (
        <div className="modal" onClick={() => setApprovedOrder(null)}>
          <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setApprovedOrder(null)}>
              ×
            </button>
            <div className="approval-icon">✓</div>
            <h2>Siparişin onaylandı</h2>
            <p>
              #{approvedOrder.id} numaralı siparişin başarıyla onaylandı.
              Siparişinin durumunu bu sayfadan takip edebilirsin.
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Account({ user, setUser, navigate, notify }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" }),
    [showPasswordForm, setShowPasswordForm] = useState(false);
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const action = async (path, text) => {
    try {
      await api(path, { method: "POST" });
      notify(text, path.includes("logout-all") ? "danger" : "ok");
      if (path.includes("logout-all")) {
        setUser(null);
        navigate("/login");
      }
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <div className="account-layout">
      <Panel
        title="Hesabım"
        sub="Profil bilgilerin ve güvenlik seçeneklerin."
        className="account-panel"
      >
        <div className="profile-card">
          <div>{user.username.slice(0, 1).toUpperCase()}</div>
          <span>
            <b>{user.username}</b>
            <small>
              {user.role === "ADMIN"
                ? "Mağaza yöneticisi"
                : "Değerli müşterimiz"}
            </small>
          </span>
        </div>
        <div className="account-actions">
          <button
            className="account-action"
            onClick={() => setShowPasswordForm((visible) => !visible)}
          >
            <span className="action-icon">⌁</span>
            <span>
              <b>Parolamı değiştir</b>
              <small>Mevcut parolanı doğrulayarak yeni parola belirle</small>
            </span>
            <strong>{showPasswordForm ? "−" : "›"}</strong>
          </button>
          <button
            className="account-action danger-action"
            onClick={() =>
              action("/api/auth/logout-all", "Tüm oturumlar kapatıldı.")
            }
          >
            <span className="action-icon">↪</span>
            <span>
              <b>Tüm cihazlardan çık</b>
              <small>Açık olan bütün oturumlarını güvenle kapat</small>
            </span>
            <strong>›</strong>
          </button>
        </div>
      </Panel>
      {showPasswordForm && (
        <Panel
          title="Parola değiştir"
          sub="İşlem tamamlandığında güvenliğin için tüm oturumların kapanır."
          className="password-panel"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                notify(
                  (
                    await api("/api/auth/change-password", {
                      method: "POST",
                      body: JSON.stringify(form),
                    })
                  ).message,
                );
                setUser(null);
                setTimeout(() => navigate("/login"), 800);
              } catch (x) {
                notify(x.message, "error");
              }
            }}
          >
            <Field
              label="Mevcut parola"
              name="currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={set}
              required
            />
            <Field
              label="Yeni parola"
              name="newPassword"
              type="password"
              minLength="8"
              value={form.newPassword}
              onChange={set}
              required
            />
            <div className="form-actions">
              <button type="button" onClick={() => setShowPasswordForm(false)}>
                Vazgeç
              </button>
              <button className="primary">Parolayı güncelle</button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}

function Admin({ notify }) {
  const blankP = {
      name: "",
      description: "",
      price: "",
      stockQuantity: "",
      categoryId: "",
    },
    blankC = { name: "", description: "" };
  const [products, setProducts] = useState([]),
    [categories, setCategories] = useState([]),
    [pf, setPf] = useState(blankP),
    [cf, setCf] = useState(blankC),
    [editP, setEditP] = useState(null),
    [editC, setEditC] = useState(null),
    [order, setOrder] = useState({ id: "", status: "PAID" });
  const load = async () => {
    try {
      setCategories(await api("/api/categories"));
      setProducts(
        (await api("/api/products?size=100&sort=id,asc")).content || [],
      );
    } catch (e) {
      notify(e.message, "error");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const run = async (path, method, body, message) => {
    try {
      await api(path, { method, body: body && JSON.stringify(body) });
      notify(message);
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const productBody = {
    ...pf,
    price: Number(pf.price),
    stockQuantity: Number(pf.stockQuantity),
    categoryId: Number(pf.categoryId),
  };
  return (
    <>
      <div className="columns">
        <Panel title="Kategori yönetimi">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                editC ? `/api/categories/${editC}` : "/api/categories",
                editC ? "PUT" : "POST",
                cf,
                "Kategori kaydedildi.",
              );
              setCf(blankC);
              setEditC(null);
            }}
          >
            <Field
              label="Ad"
              value={cf.name}
              onChange={(e) => setCf({ ...cf, name: e.target.value })}
              required
            />
            <Field
              label="Açıklama"
              value={cf.description}
              onChange={(e) => setCf({ ...cf, description: e.target.value })}
            />
            <button className="primary">{editC ? "Güncelle" : "Ekle"}</button>
          </form>
          <div className="mini-list">
            {categories.map((c) => (
              <div key={c.id}>
                <span>{c.name}</span>
                <button
                  onClick={async () => {
                    const d = await api(`/api/categories/${c.id}`);
                    setCf({ name: d.name, description: d.description || "" });
                    setEditC(c.id);
                  }}
                >
                  Düzenle
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    run(
                      `/api/categories/${c.id}`,
                      "DELETE",
                      null,
                      "Kategori silindi.",
                    )
                  }
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Sipariş durumu">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                `/api/orders/${order.id}/status`,
                "PUT",
                { status: order.status },
                "Sipariş güncellendi.",
              );
            }}
          >
            <Field
              label="Sipariş ID"
              type="number"
              value={order.id}
              onChange={(e) => setOrder({ ...order, id: e.target.value })}
              required
            />
            <label>
              <span>Durum</span>
              <select
                value={order.status}
                onChange={(e) => setOrder({ ...order, status: e.target.value })}
              >
                {["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <button className="primary">Durumu güncelle</button>
          </form>
        </Panel>
      </div>
      <Panel title="Ürün yönetimi">
        <form
          className="product-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              editP ? `/api/products/${editP}` : "/api/products",
              editP ? "PUT" : "POST",
              productBody,
              "Ürün kaydedildi.",
            );
            setPf(blankP);
            setEditP(null);
          }}
        >
          <Field
            label="Ad"
            value={pf.name}
            onChange={(e) => setPf({ ...pf, name: e.target.value })}
            required
          />
          <Field
            label="Açıklama"
            value={pf.description}
            onChange={(e) => setPf({ ...pf, description: e.target.value })}
          />
          <Field
            label="Fiyat"
            type="number"
            step="0.01"
            value={pf.price}
            onChange={(e) => setPf({ ...pf, price: e.target.value })}
            required
          />
          <Field
            label="Stok"
            type="number"
            value={pf.stockQuantity}
            onChange={(e) => setPf({ ...pf, stockQuantity: e.target.value })}
            required
          />
          <label>
            <span>Kategori</span>
            <select
              value={pf.categoryId}
              onChange={(e) => setPf({ ...pf, categoryId: e.target.value })}
              required
            >
              <option value="">Seç</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">
            {editP ? "Güncelle" : "Ürün ekle"}
          </button>
        </form>
        <div className="mini-list">
          {products.map((p) => (
            <div key={p.id}>
              <span>
                <b>{p.name}</b> · {money(p.price)} · {p.stockQuantity} stok
              </span>
              <button
                onClick={async () => {
                  const d = await api(`/api/products/${p.id}`);
                  setPf({
                    name: d.name,
                    description: d.description || "",
                    price: d.price,
                    stockQuantity: d.stockQuantity,
                    categoryId: d.category.id,
                  });
                  setEditP(p.id);
                }}
              >
                Düzenle
              </button>
              <button
                className="danger"
                onClick={() =>
                  run(`/api/products/${p.id}`, "DELETE", null, "Ürün silindi.")
                }
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export function App() {
  const [path, setPath] = useState(currentPath()),
    [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState(null);
  const notify = useCallback((text, type = "ok") => {
    setToast({ text, type });
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 2800);
  }, []);
  const navigate = (p) => {
    history.pushState({}, "", p);
    setPath(p);
  };
  useEffect(() => {
    const f = () => setPath(currentPath());
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  const reloadUser = useCallback(async () => {
    try {
      setUser(await api("/api/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reloadUser();
  }, [reloadUser]);
  const protectedPage = ["/cart", "/orders", "/account"].includes(path);
  let page;
  if (loading) page = <Empty>Oturum kontrol ediliyor…</Empty>;
  else if (protectedPage && !user)
    page = (
      <Empty>
        Bu sayfa için giriş yapmalısın.{" "}
        <button onClick={() => navigate("/login")}>Giriş yap</button>
      </Empty>
    );
  else
    page =
      path === "/products" ? (
        <Products user={user} navigate={navigate} notify={notify} />
      ) : path === "/cart" ? (
        <Cart navigate={navigate} notify={notify} />
      ) : path === "/orders" ? (
        <Orders notify={notify} />
      ) : path === "/account" ? (
        <Account
          user={user}
          setUser={setUser}
          navigate={navigate}
          notify={notify}
        />
      ) : path === "/admin" ? (
        user?.role === "ADMIN" ? (
          <Admin notify={notify} />
        ) : (
          <Empty>Bu alan yalnızca ADMIN rolüne açıktır.</Empty>
        )
      ) : (
        <AuthForm
          mode={
            {
              "/login": "login",
              "/register": "register",
              "/forgot-password": "forgot",
              "/reset-password": "reset",
            }[path] || "login"
          }
          navigate={navigate}
          reloadUser={reloadUser}
          notify={notify}
        />
      );
  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      navigate("/products");
      notify("Oturumun güvenle kapatıldı.", "danger");
    }
  };
  return (
    <div>
      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>
            {toast.type === "error" ? "!" : toast.type === "danger" ? "↪" : "✓"}
          </span>
          {toast.text}
        </div>
      )}
      <header>
        <button className="brand" onClick={() => navigate("/products")}>
          <img className="brand-logo" src={n11Logo} alt="n11" />
          <span>by İhsan</span>
        </button>
        <nav>
          <button
            className={path === "/products" ? "active" : ""}
            onClick={() => navigate("/products")}
          >
            Ürünler
          </button>
          {user && (
            <>
              <button
                className={path === "/cart" ? "active" : ""}
                onClick={() => navigate("/cart")}
              >
                Sepet
              </button>
              <button
                className={path === "/orders" ? "active" : ""}
                onClick={() => navigate("/orders")}
              >
                Siparişler
              </button>
            </>
          )}
          {user?.role === "ADMIN" && (
            <button
              className={path === "/admin" ? "active" : ""}
              onClick={() => navigate("/admin")}
            >
              Yönetim
            </button>
          )}
        </nav>
        <div className="session">
          {user ? (
            <>
              <button
                className={`account-menu ${path === "/account" ? "active" : ""}`}
                aria-label="Hesabım"
                onClick={() => navigate("/account")}
              >
                <span>{user.username.slice(0, 1).toUpperCase()}</span>
                <div>
                  <b>Hesabım</b>
                  <small>{user.username}</small>
                </div>
              </button>
              <button className="logout-button" onClick={logout}>
                Çıkış
              </button>
            </>
          ) : (
            <button
              className="primary small"
              onClick={() => navigate("/login")}
            >
              Giriş yap
            </button>
          )}
        </div>
      </header>
      <main>{page}</main>
      <footer>
        <b>n11 · İhsan</b>
        <span>Sevgiyle tasarlandı · 2026</span>
      </footer>
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
