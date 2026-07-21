# Ecommerce Authentication UI

Small React/Vite UI for manually testing the authentication flows provided by
the sibling `ecommerce-simulation-api` project.

## Run locally

Start the backend at `http://localhost:8080`, then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The default API URL is
`http://localhost:8080`. To override it:

```bash
cp .env.example .env
```

Then change `VITE_API_URL` in `.env`.

## Tests

```bash
npm test
```

The Vitest/Testing Library suite covers session-loading race conditions, guest
route guards, USER navigation, ADMIN navigation, CSRF headers, credentials, and
backend validation error propagation.

## Available flows

- Authentication: register, login, current user, refresh, logout, logout from
  every session, forgot/reset password, and authenticated password change
- Catalog: paginated product listing, search, category filtering, and details
- Cart: add, update quantity, remove, clear, and checkout
- Orders: list, details, and cancellation
- ADMIN: category CRUD, product CRUD, and order status updates

The backend currently defines only `USER` and `ADMIN` roles. There is no seller
controller or seller-specific endpoint, so the management UI follows the actual
Swagger contract and is visible only for `ADMIN` users. Because the API does not
provide an admin endpoint for listing every user's orders, order status updates
accept an order ID directly.

The backend must allow `http://localhost:3000` through `FRONTEND_ORIGIN`, and
its password reset URL should be
`FRONTEND_RESET_PASSWORD_URL=http://localhost:3000/reset-password`.
