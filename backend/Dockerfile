FROM node:22-alpine

WORKDIR /app

# Install fonts for sharp SVG text rendering on Alpine
RUN apk add --no-cache ttf-dejavu fontconfig

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

EXPOSE 5001

CMD ["node", "--experimental-strip-types", "app.ts"]
