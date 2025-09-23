# Client-side verification flow (reliable for serverless)

This document explains a small, robust client-side flow you can add to the frontend `auth/verify` page so that email verification links work reliably in serverless deployments.

Problem solved
- Some serverless GET handlers that immediately talk to the database (on cold start) can time out or be slow. To make the UX reliable, keep the email link clickable but perform the actual DB write from the client after redirecting.

Overview
1. Email contains a clickable link to: `https://<your-server>/api/auth/verify?token=<token>`.
2. The server now responds to that GET by redirecting the browser to your client verify page:
   - `https://<your-client>/auth/verify?token=<token>`
3. On the client `auth/verify` page, read the `token` from the URL and `POST` it to `POST https://<your-server>/api/auth/verify` with JSON `{ token }`.
4. The API will validate the token and mark the user verified. Show success/failure to the user.

Why this is robust
- The client POST reaches the Express route (which will initialize DB, use the serverless-safe connector, and perform the write). It avoids doing DB work in the GET redirect wrapper (which remains clickable for users and for email clients).

React example (drop into your client `auth/verify` page)

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function VerifyPage() {
  const [status, setStatus] = useState('pending') // pending | success | error
  const navigate = useNavigate()

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const token = qs.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    async function doVerify() {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE || ''}/api/auth/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        if (res.ok) {
          setStatus('success')
          // Optional: redirect to login or success page after a short delay
          setTimeout(() => navigate('/auth/success'), 1200)
          return
        }

        // read JSON error if present
        let payload = null
        try { payload = await res.json() } catch (e) { /* ignore */ }
        console.error('Verify failed', res.status, payload)
        setStatus('error')
      } catch (err) {
        console.error('Network or server error during verification', err)
        setStatus('error')
      }
    }

    doVerify()
  }, [navigate])

  if (status === 'pending') return <div>Verifying your email…</div>
  if (status === 'success') return <div>Your email has been verified — redirecting…</div>
  return <div>Failed to verify your email. Try resending the verification email or contact support.</div>
}
```

Plain JavaScript (no framework)

```html
<!-- on the client /auth/verify page -->
<script>
  (async function () {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      document.body.innerText = 'Missing verification token'
      return
    }

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      if (res.ok) {
        document.body.innerText = 'Email verified — you can now sign in.'
        return
      }
      const body = await res.json().catch(() => null)
      document.body.innerText = 'Verification failed: ' + (body && body.error ? body.error : 'Unknown error')
    } catch (err) {
      document.body.innerText = 'Network error while verifying. Please try again.'
    }
  })()
</script>
```

cURL examples (for testing)

- Simulate the client POST (replace `<token>`):

```bash
curl -i -X POST 'https://mytarotreadingsserver.vercel.app/api/auth/verify' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://mytarotreadings.vercel.app' \
  -d '{"token":"<token>"}'
```

- Test GET email link behavior (should redirect to client page with token preserved):

```bash
curl -i -L 'https://mytarotreadingsserver.vercel.app/api/auth/verify?token=<token>'
```

Deployment notes and environment
- Make sure `CLIENT_URL` is set in your server environment to your frontend URL (production `https://mytarotreadings.vercel.app`). The GET redirect uses `CLIENT_URL` to build the redirect target.
- Ensure CORS is configured to allow your frontend origin (the server already supports a populated `ALLOWED_ORIGINS` / `CLIENT_URL` pattern). The client `fetch` uses `credentials: 'include'` so cookies will be sent if you rely on them.

Testing checklist (quick)
1. Deploy server changes (already pushed).
2. Send yourself a verification email (or register a test account).
3. Click link in the email — you should land at `https://<client>/auth/verify?token=...`.
4. The page should auto-POST the token to `/api/auth/verify` and show a success message. If the server times out, the client will show an error and you can retry the POST.

If you'd like, I can also:
- Add a tiny client example file to the `client` repo (if you provide the client workspace), or
- Add a brief `README.md` entry into this repo's root pointing front-end developers to `docs/verify-client.md`.

