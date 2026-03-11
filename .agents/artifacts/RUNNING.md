# Running the Application

## Development Mode

To run the Electron app in development mode:

```bash
yarn app:dev
```

**What happens automatically:**
1. Vite dev server starts on port 5173
2. Electron app launches
3. **Backend server automatically starts** on port 3000 (if not already running)
4. Backend server stops when you close the app

**No need to run the backend server separately!** The Electron app will start it automatically.

## Production Mode

To build and run the production version:

```bash
# Build the UI
yarn ui:build

# Run the app
yarn app
```

## Backend Server Only

To run just the backend API server (optional, usually not needed):

```bash
yarn server
```

**Note**: The Electron app automatically starts the backend server, so you usually don't need to run this command separately.

The server will start on port 3000 (or the port specified in `API_PORT` environment variable).

## Troubleshooting

### WebSocket Connection Errors

If you see `ERR_CONNECTION_REFUSED` errors:
- The backend server should start automatically
- If it doesn't, check the Electron console for errors
- Manually start with: `yarn server`
- Check that port 3000 is not blocked by firewall
- Verify the `.env` file has correct `API_PORT` setting

### Database Errors

If you see "Cannot read properties of null (reading 'prepare')":
- The database failed to initialize
- Check that the `data/` directory exists and is writable
- Check the console for database initialization errors
- Try deleting `data/history.db` and restarting

### Port Already in Use

If port 3000 or 5173 is already in use:
- Change `API_PORT` in `.env` file
- Or stop the process using that port
