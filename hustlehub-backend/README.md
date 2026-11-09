# HustleHub+ Backend

Backend API for HustleHub+, supporting user registration, login, JWT authentication, and role-based access control (RBAC).

## Technologies

- Node.js and Express
- MongoDB and Mongoose
- bcryptjs for password hashing
- JSON Web Tokens (JWT) for authentication
- express-validator for request validation
- Jest and Supertest for automated testing

## Prerequisites

- Node.js and npm
- MongoDB running locally or an accessible MongoDB Atlas database

## Installation and Configuration

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file from the example.

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Edit `.env` and configure the environment variables.

   | Variable | Purpose |
   |---|---|
   | `PORT` | Server port |
   | `HTTPS_ENABLED` | Enables HTTPS when set to `true` |
   | `JWT_SECRET` | Secret used to sign and verify JWTs |
   | `JWT_EXPIRES_IN` | Token lifetime, for example `1h` |
   | `MONGODB_URI` | Main application database connection |
   | `MONGODB_TEST_URI` | Separate database used by automated tests |
   | `SSL_PFX_PATH` | Path to the HTTPS certificate file |
   | `SSL_PFX_PASSPHRASE` | Certificate passphrase |

4. Replace all example secrets with your own values. Keep `.env` and certificate files out of version control.

5. Ensure MongoDB is running and the configured database URIs are valid.

**Important:** Use a dedicated test database whose name includes `test`. The automated tests clear user records from this database between tests. Never point `MONGODB_TEST_URI` at a production or personal database.

## Running the Server
Firstly before running the following commands ensure you are in the correct directory:
> Change to the backend project's directory run: `cd hustlehub-backend`

Start the server:

```bash
npm start
```

Start in development mode with Nodemon:

```bash
npm run dev
```

The server connects to MongoDB before accepting requests. Configure HTTPS and its certificate settings when HTTPS is enabled. HTTP is intended for local development and should not be used for sensitive traffic in production.

## API Endpoints

The current routes are mounted directly, without an `/api` prefix.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/register` | Public | Register a client or freelancer |
| POST | `/login` | Public | Authenticate and receive a JWT |
| GET | `/profile` | Authenticated | Access the authenticated user's profile |
| GET | `/client-area` | Client role | Access client-only functionality |
| GET | `/freelancer-area` | Freelancer role | Access freelancer-only functionality |

### Registration

Send a JSON request to `POST /register` with:

```json
{
  "name": "Example",
  "surname": "User",
  "email": "example@example.com",
  "password": "your_password",
  "role": "client"
}
```

The supported roles are `client` and `freelancer`. Email addresses are normalized, duplicate registrations are rejected, and passwords are hashed before being stored. Responses do not include password hashes.

### Login

Send the registered email and password to `POST /login`:

```json
{
  "email": "example@example.com",
  "password": "your_password"
}
```

A successful response includes a JWT and public user information. Invalid credentials return an authentication error.

### Accessing Protected Endpoints

Include the token returned by login in the HTTP request header:

```text
Authorization: Bearer <your_jwt_token>
```

A missing, invalid, or expired token is rejected. Authenticated users must also have the appropriate role to access role-restricted endpoints. Authentication failures return HTTP 401, while insufficient role permissions return HTTP 403.

## Running Automated Tests

Run the test suite:

```bash
npm test
```

The tests use `MONGODB_TEST_URI` and verify registration, duplicate email handling, role validation, login, password rejection, protected routes, and role-based access.

The test setup validates the test database configuration before connecting. Do not bypass this safeguard or use a production database for tests.

## Security Notes

- Store real environment variables and secrets outside source control.
- Use a strong, randomly generated JWT secret.
- Never store plaintext passwords; password hashing is handled by bcryptjs.
- Keep authentication and authorization checks enabled on protected endpoints.
- Use HTTPS in production and protect private certificate files.
- Review dependency audit reports and update vulnerable packages without introducing unverified breaking changes.
- Rotate any credentials that may have been exposed.

## Project Structure

```text
hustlehub-backend/
├── src/
│   ├── config/       # Database configuration
│   ├── middleware/   # Authentication and role checks
│   ├── models/      # Mongoose models
│   ├── routes/       # Registration, login and protected routes
│   ├── app.js         # Express application
│   └── server.js      # Server startup
├── tests/             # Authentication and RBAC tests
├── .env.example       # Safe environment variable template
├── .gitignore
├── package.json
└── package-lock.json
```
