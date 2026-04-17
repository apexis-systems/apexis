# Backend Docker

This backend can run as a self-contained local Docker stack with:

- Node/Express API
- Postgres
- Redis

## Quick Start

1. Create a backend env file if you do not already have one:

```sh
cp .env.example .env
```

2. Start the backend stack:

```sh
docker compose up --build
```

3. Open the API:

```text
http://localhost:5001/
```

## What Starts

- `backend` runs the API in watch mode with `npm run dev`
- `postgres` stores relational data in the `postgresdata` volume
- `redis` stores cache/pubsub data in the `redisdata` volume

## Startup Behavior

When the backend container starts it will:

1. Wait for Postgres and Redis
2. Install dependencies into the container volume when needed
3. Run Sequelize migrations
4. Run seeders when `RUN_DB_SEEDERS=true`
5. Optionally create the primary superadmin when `BOOTSTRAP_SUPERADMIN=true`

## Useful Commands

Start fresh:

```sh
docker compose up --build
```

Stop containers:

```sh
docker compose down
```

Stop containers and remove database/cache data:

```sh
docker compose down -v
```

## Notes

- Docker forces the backend container to use local `development` settings so it can talk to the bundled Postgres service without SSL.
- The image no longer bakes `.env` into the build context; runtime config still comes from your local `backend/.env`.
- Firebase is optional. If no service account is provided, push notifications stay disabled and the server still boots.
