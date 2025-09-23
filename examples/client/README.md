# Example Client Verify Page

This folder contains an example React component you can drop into your frontend app to implement client-side verification.

Files:
- `VerifyPage.jsx` - The React component. Mount it at `/auth/verify` in your router.

Usage notes:
- The component reads `token` from the URL query string and POSTs it to `/api/auth/verify`.
- Set `REACT_APP_API_BASE` to your API base if your client is hosted at a different origin. Example:
  ```env
  REACT_APP_API_BASE=https://mytarotreadingsserver.vercel.app
  ```
- Ensure CORS on the server allows your client origin and that the POST endpoint is reachable.

Testing:
- Register a test account to receive a verification token.
- Click the email link and confirm it redirects to `https://<your-client>/auth/verify?token=...`.
- The component should auto-POST the token and show success.
