#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Syncing dependencies..."
npm install

echo "Running database migrations..."
npx sequelize-cli db:migrate

echo "Running database seeders..."
npx sequelize-cli db:seed:all

echo "Starting server..."
exec "$@"
