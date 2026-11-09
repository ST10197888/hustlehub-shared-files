# HustleHub+ Frontend

React frontend for the HustleHub+ marketplace.

## Run the frontend

In a terminal opened in this `Frontend` folder, run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Connect to the backend

Start the backend in a second terminal from the repository root:

```bash
cd hustlehub-backend
npm install
```

Create `hustlehub-backend/.env` from `.env.example`, make sure MongoDB is running and the `JWT_SECRET` and `MONGODB_URI` values are set, then start the server:

```bash
npm run dev
```

The API defaults to `http://localhost:5000`. The frontend uses that address automatically. To use a different API address, copy `.env.example` to `.env.local`, edit `VITE_API_URL`, then restart Vite.

The frontend calls `GET /api/gigs`, `GET /api/gigs/:id`, `POST /register`, `POST /login`, `POST /api/gigs`, `POST /api/bookings`, and `GET /api/bookings/my`. Protected requests automatically include the saved bearer token.
