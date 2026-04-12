# kicable

## Quickstart

**Prerequisites:** Node.js >= 20, pnpm >= 9

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The client will be available at `http://localhost:5173`.

By default the app runs in local-only mode using IndexedDB for storage. To connect to a backend server, set the `VITE_BACKEND_URL` environment variable before starting:

```bash
VITE_BACKEND_URL=http://localhost:3000 pnpm dev
```