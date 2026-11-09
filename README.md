# HustleHub+ MERN Marketplace

HustleHub+ is a full-stack marketplace where clients discover and book freelance services, and freelancers publish gigs and manage booking activity. The application includes JWT authentication, role-based access control, booking-generated transaction records, a React web client, an Express API, and MongoDB persistence.
(AI was consulted on project)
## Contributors
- Kennedy Mwashusha-ST1019788
- Simphiwe Mathenjwa-ST10258505
- Nairon Cossa-ST10255547
- Rico Baloi-ST10441543
- Andile Nkonyane-ST10453474

## Frontend Application
<br>
<img width="1919" height="990" alt="image" src="https://github.com/user-attachments/assets/149326b7-dd7b-4f17-a337-b3db73f74db2" />
<br>
<img width="1919" height="992" alt="image" src="https://github.com/user-attachments/assets/43e50d92-79af-4373-aa37-45c4ca049aa8" />

>Viewing all gigs

### When Logged in as Newman Client
<img width="1600" height="828" alt="image" src="https://github.com/user-attachments/assets/0e2c8e7a-854d-49ea-86aa-ae6787653b9e" />
<br>
<img width="1600" height="825" alt="image" src="https://github.com/user-attachments/assets/6c508ebb-5bc2-4ab6-9b7f-38a4f61bc408" />
<br>
<img width="1600" height="789" alt="image" src="https://github.com/user-attachments/assets/76a3171a-bb24-4630-ac2f-01524a5a39dd" />
<br>
<img width="1600" height="827" alt="image" src="https://github.com/user-attachments/assets/0c73265f-d64c-4822-9286-fced7d0cb1b6" />
<br>


### When Logged in as Newman Freelancer

<img width="1600" height="825" alt="image" src="https://github.com/user-attachments/assets/158a0d5a-a13d-48ee-855f-79558b63bafc" />

>Freelancer gig creator
<br><br>

## Backend Demo Demonstration
https://www.youtube.com/watch?v=TmKB_lQ9Vwo
<br>

### This doc contains screenshots of Newman executions

[Newman collection output screenshots.docx](https://github.com/user-attachments/files/33357647/Newman.collection.output.screenshots.docx)

<br><br>

## 1. Project Overview and Features

- Register and sign in as a `client` or `freelancer`.
- Browse gigs, open gig details, and book a gig as a client.
- Create, update, and delete gigs as the owning freelancer.
- Review client bookings and freelancer booking activity.
- Create a transaction record when a booking is confirmed; the amount is taken from the stored gig price.
- Protect authenticated endpoints with JWT bearer tokens and role checks.
- Validate request bodies, reject unexpected fields, sanitize display strings, and validate MongoDB IDs.
- Apply rate limiting, Helmet security headers, and restricted credential-enabled CORS.
- Run API scenarios with Postman/Newman and UI tests with Jest and React Testing Library.

## 2. Architecture

```text
------------------+       HTTP/JSON + JWT        +---------------------+       Mongoose        +------------------+
| React + Vite     | ---------------------------> | Express API         | --------------------> | MongoDB          |
| Frontend         | <--------------------------- | Node.js backend     | <-------------------- | Local or Atlas   |
------------------+          JSON responses      +---------------------+                       +------------------+
```

The frontend calls the API using Axios. Express validates and authorizes requests, controllers implement marketplace workflows, and Mongoose reads and writes users, gigs, bookings, and transactions.

## 3. Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios, TypeScript/TSX |
| Backend | Node.js, Express 5, CommonJS |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens (HS256), bcryptjs |
| Validation/security | express-validator, express-rate-limit, Helmet, CORS |
| Testing | Jest, Supertest, React Testing Library, user-event, Newman |

## 4. Folder Structure

```text
.
├── README.md
├── package.json                         # Root Newman scripts and dependencies
├── package-lock.json
├── postman/
│   ├── MERN-Marketplace.postman_collection.json
│   └── local.postman_environment.json
├── Frontend/
│   ├── package.json
│   ├── babel.config.cjs
│   ├── jest.config.cjs
│   └── src/
│       ├── App.jsx
│       ├── components/                   # Navbar, GigCard
│       ├── context/                      # AuthContext
│       ├── pages/                        # Browse, GigDetails, Login, Register, etc.
│       ├── services/api.ts               # Axios API client
│       ├── types/
│       └── __tests__/                    # Jest/RTL tests
└── hustlehub-backend/
	├── package.json
	├── .env.example
	├── src/
	│   ├── app.js
	│   ├── server.js
	│   ├── config/database.js
	│   ├── controllers/
	│   ├── middleware/                   # Auth, roles, validation, rate limits
	│   ├── models/                       # User, Gig, Booking, Transaction
	│   └── routes/
	└── tests/
```

## 5. Environment Variables

Create local env files from the examples. Never commit real secrets, database credentials, or private certificates.

### Backend: `hustlehub-backend/.env`

```dotenv
PORT=5000
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1h
MONGODB_URI=mongodb://127.0.0.1:27017/hustlehub
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/hustlehub_test
HTTPS_ENABLED=false
SSL_PFX_PATH=certs/cert.pfx
SSL_PFX_PASSPHRASE=replace_with_your_certificate_passphrase
CLIENT_ORIGIN=http://localhost:5173
```

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend listen port; defaults to `5000`. |
| `JWT_SECRET` | Private signing key used for access tokens. Use a unique, high-entropy value. |
| `JWT_EXPIRES_IN` | JWT lifetime accepted by `jsonwebtoken`, for example `1h`. |
| `MONGODB_URI` | Application database connection URI. |
| `MONGODB_TEST_URI` | Dedicated database URI for backend Jest tests. Its database name must include `test`; never point it at production. |
| `HTTPS_ENABLED` | Set to `true` to serve HTTPS using the configured PFX certificate; otherwise the server uses HTTP. |
| `SSL_PFX_PATH` | PFX path relative to `hustlehub-backend/`, required when HTTPS is enabled. |
| `SSL_PFX_PASSPHRASE` | Passphrase for the PFX certificate. |
| `CLIENT_ORIGIN` | The single browser origin allowed by CORS. Vite uses `http://localhost:5173` by default. |

The API currently defaults CORS to `http://localhost:3000` when `CLIENT_ORIGIN` is unset. Set it to the exact frontend origin in use. The configured Content Security Policy currently includes `http://localhost:5000` in `connectSrc`; adjust that policy if your deployment uses a different API origin/protocol.

### Frontend: `Frontend/.env`

```dotenv
VITE_API_URL=http://localhost:5000
```

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend origin used by the Axios client. Vite only exposes variables prefixed with `VITE_` to browser code. |

When using HTTPS locally, set `VITE_API_URL=https://localhost:5000` and configure a certificate trusted by your browser. Do not put secrets in frontend environment variables; they are bundled into client-side code.

## 6. MongoDB Setup

### Local MongoDB

1. Install and start MongoDB Community Server, or start a local MongoDB container.
2. Use separate application and test databases, for example `hustlehub` and `hustlehub_test`.
3. Set `MONGODB_URI` and `MONGODB_TEST_URI` in `hustlehub-backend/.env` as shown above.
4. Ensure the MongoDB service is running before starting the backend or running backend Jest tests.

### MongoDB Atlas

1. Create an Atlas cluster and a database user with only the permissions required by this application.
2. Add your development machine's IP to the Atlas network access allowlist. Avoid unrestricted access for deployed environments.
3. Copy the cluster's application connection string and place it in `MONGODB_URI`. Include a database name in the path, for example:

```dotenv
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/hustlehub?retryWrites=true&w=majority
```

URL-encode reserved characters in usernames and passwords. Keep `MONGODB_TEST_URI` pointed at a separate test database; tests clear user documents after each test.

## 7. Backend Commands

Run these from the repository root:

```bash
cd hustlehub-backend
npm install
npm run dev
```

`npm run dev` starts the API with Nodemon. For a normal start:

```bash
npm start
```

Run backend Jest tests with a running test MongoDB and a valid `MONGODB_TEST_URI`:

```bash
npm test
```

The Newman `test:api` script is defined in the repository-root package, so run it from the root (not from `hustlehub-backend`):

```bash
cd ..
npm run test:api
```

## 8. Frontend Commands

Run these from the repository root:

```bash
cd Frontend
npm install
npm run dev
```

Open the local Vite URL printed in the terminal (usually `http://localhost:5173`). Run frontend tests with:

```bash
npm test
```

Other useful checks are `npm run lint` and `npm run build`.

## 9. Authentication and RBAC

Users register with one of two roles:

- **Client:** can browse and book gigs, view their bookings, and view their transaction records.
- **Freelancer:** can create gigs, update/delete gigs they own, and view bookings for their gigs and income.

Registration and login return a JWT for authenticated requests. Send it as:

```http
Authorization: Bearer <token>
```

The backend verifies the token and attaches its user ID, email, and role to the request. Authentication failures return `401`; a valid user without the required role or ownership returns `403`. The frontend Axios client adds the saved token to protected requests.

## 10. Security Controls

- **Rate limiting:** global limit of 100 requests per IP per 15 minutes; auth limit of 10 per IP per 15 minutes; booking creation limit of 20 per IP per 15 minutes. Limit responses are JSON with status `429`.
- **Helmet:** sets security headers, including Cross-Origin-Resource-Policy, Referrer-Policy, and HSTS for secure requests.
- **Content Security Policy:** `default-src 'self'`; scripts same-origin; styles same-origin plus inline styles; images same-origin, data, or HTTPS; connections same-origin and the configured local API origin; objects and framing are disallowed.
- **CORS:** allows only `CLIENT_ORIGIN`, credentials, `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, and `Content-Type`/`Authorization` headers. Disallowed origins receive a JSON `403`.
- **Validation and sanitization:** express-validator checks types, required values, lengths, email formats, allowed fields, and MongoDB IDs. Text fields are trimmed and HTML-escaped. Passwords are not altered by HTML escaping or trimming.
- **Authentication:** bcryptjs password hashing and HS256 JWT verification with explicit algorithm restrictions.
- **Request/error handling:** JSON request bodies are capped at 10 KB; malformed or oversized bodies receive controlled errors. Secrets and private certificates belong in ignored local files.

## 11. API Endpoint Reference

Protected routes require a bearer token. `client` and `freelancer` identify role restrictions. Auth routes are available under `/api/auth/*`; the legacy `/register` and `/login` paths remain available.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Health check. |
| `POST` | `/api/auth/register` | Public | Register a client or freelancer. |
| `POST` | `/api/auth/login` | Public | Authenticate and receive a JWT. |
| `POST` | `/register` | Public, legacy alias | Register a user. |
| `POST` | `/login` | Public, legacy alias | Authenticate and receive a JWT. |
| `GET` | `/profile` | Authenticated | Return the current token user's profile. |
| `GET` | `/client-area` | Client | Example client-only protected route. |
| `GET` | `/freelancer-area` | Freelancer | Example freelancer-only protected route. |
| `GET` | `/api/gigs` | Public | List gigs. |
| `GET` | `/api/gigs/:id` | Public | Get gig details by MongoDB ID. |
| `GET` | `/api/gigs/my` | Freelancer | Declared route to list the current freelancer's gigs; see the implementation note below. |
| `POST` | `/api/gigs` | Freelancer | Create a gig. |
| `PUT` | `/api/gigs/:id` | Owning freelancer | Update an owned gig. |
| `DELETE` | `/api/gigs/:id` | Owning freelancer | Delete an owned gig. |
| `POST` | `/api/bookings` | Client | Book a gig and create a transaction record. |
| `GET` | `/api/bookings/my` | Client | List the current client's bookings. |
| `GET` | `/api/bookings/freelancer` | Freelancer | List bookings for the current freelancer. |
| `GET` | `/api/transactions/my` | Client | List the current client's transactions. |
| `GET` | `/api/transactions/income` | Freelancer | Get income summary and recent transactions. |

**Implementation note:** `gigRoutes.js` currently declares `GET /:id` before `GET /my`, so Express may match `/my` as an ID. Move the static `/my` route above `/:id` before relying on the freelancer's gig-list endpoint.

## 12. Testing

### Postman and Newman

The collection and local environment are in `postman/`. Install root dependencies once, set `jwtSecret` to match the backend `JWT_SECRET`, provide a valid freelancer JWT as `freelancerToken`, and run:

```bash
npm install
npm run test:api
```

The collection exercises authentication, role/ownership access, gig CRUD, booking flows, and transaction amount consistency. Newman prints a CLI summary and the `htmlextra` reporter creates a detailed HTML report with request/response details, assertion results, failures, and run statistics. For a self-signed HTTPS certificate, configure trust or set the environment `baseUrl` to the HTTP API origin when HTTPS is disabled.

### Backend Jest

From `hustlehub-backend/`, with a dedicated test database running:

```bash
npm test
```

The test setup refuses to run without `MONGODB_TEST_URI` and requires the database name to include `test`.

### React Testing Library and Jest

From `Frontend/`:

```bash
npm test
```

The frontend suite covers auth forms, gig listing/cards, booking behavior, and role-specific page access.

## 13. Demonstration Flow Checklist

- [ ] Configure local MongoDB or Atlas credentials and backend/frontend env files.
- [ ] Start the backend and confirm `GET /` returns the API health response.
- [ ] Start the React frontend and confirm it can reach the API.
- [ ] Register and log in as a freelancer.
- [ ] Create a gig, then browse it and open its details.
- [ ] Register and log in as a client.
- [ ] Book the freelancer's gig and confirm the booking response.
- [ ] Verify the client booking/transaction and the freelancer booking/income views.
- [ ] Confirm role restrictions and ownership checks reject unauthorized actions.
- [ ] Run the React tests and, when the test database and API are available, the backend tests and Newman collection.

## 14. Git Workflow and Branch Naming

Use a short-lived branch per change, keep commits focused, and open a pull request for review. Suggested branch prefixes:

| Change type | Example branch |
| --- | --- |
| Feature | `feature/gig-search` |
| Bug fix | `fix/booking-validation` |
| Tests | `test/auth-flows` |
| Documentation | `docs/setup-guide` |
| Maintenance | `chore/update-dependencies` |

Typical workflow:

```bash
git switch main
git pull
git switch -c feature/short-description
# make and verify the change
git add <files>
git commit -m "Add short description"
git push -u origin feature/short-description
```

Do not commit `.env` files, database credentials, JWT secrets, or certificate/private-key files. Keep generated dependencies and build output out of commits.
