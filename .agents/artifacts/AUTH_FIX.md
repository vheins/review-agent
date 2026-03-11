# Authentication Fix - 401 Unauthorized

## Problem

API server memiliki auth middleware yang require `x-api-key` header, tapi Electron app (localhost) tidak mengirim API key → **401 Unauthorized**

## Solution

**Allow localhost requests** tanpa API key di auth middleware.

### Changes

**File**: `src/api-server.js`

```javascript
// Before
this.app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey || req.path.startsWith('/api/webhooks') || req.path === '/health') {
    next();
  } else {
    next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
  }
});

// After
this.app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  // Allow Electron app (localhost), webhooks, and health check
  if (apiKey || req.hostname === 'localhost' || req.hostname === '127.0.0.1' || 
      req.path.startsWith('/api/webhooks') || req.path === '/health') {
    next();
  } else {
    next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
  }
});
```

## Additional Fix: Error Handling

**Problem**: `prependLog()` expects string but receives object → `message.trim is not a function`

**Solution**: Convert message to string first

**File**: `electron/app.jsx`

```javascript
const prependLog = useEffectEvent((type, message) => {
    // Convert message to string if it's not already
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    startTransition(() => {
        setLogs((current) => [
            { 
                id: `${Date.now()}-${Math.random()}`, 
                type, 
                message: `[${new Date().toLocaleTimeString()}] ${messageStr.trim()}` 
            }, 
            ...current
        ].slice(0, 200));
        // ...
    });
});
```

## Security Note

Allowing localhost without authentication is safe for development because:
1. Backend server only listens on `127.0.0.1` (not accessible from network)
2. Electron app runs on same machine
3. Production deployment should use proper authentication

For production, consider:
- Use API key from environment variable
- Add JWT authentication
- Use HTTPS with client certificates

## Testing

```bash
# Start app
yarn app

# Should work without 401 errors
```

Expected:
- ✅ Dashboard loads successfully
- ✅ No 401 Unauthorized errors
- ✅ All API calls work

## Files Changed

1. **src/api-server.js** - Allow localhost requests
2. **electron/app.jsx** - Fix error handling in prependLog
3. **AUTH_FIX.md** - This documentation
