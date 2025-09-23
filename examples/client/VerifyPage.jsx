import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Ready-to-drop verification page component.
// Usage: add to your client route at /auth/verify
// Ensure your client env has REACT_APP_API_BASE (optional) to point to the API base.
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
        const apiBase = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '')
        const endpoint = `${apiBase}/api/auth/verify`
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include', // send cookies if you're using them
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        if (res.ok) {
          setStatus('success')
          // Optional: show message then redirect to login or success page
          setTimeout(() => navigate('/auth/success'), 1200)
          return
        }

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
  if (status === 'success') return <div>Your email was verified — redirecting…</div>
  return <div>Failed to verify your email. Try resending the verification email or contact support.</div>
}
