/**
 * Edge Function for blob upload - handles CORS at the edge
 * Edge functions run on Vercel's edge network and have different CORS handling
 */
export const config = {
  runtime: 'edge',
}

import { put } from '@vercel/blob'

export default async function handler(req) {
  // Set CORS headers for edge function
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://mytarotreadings.vercel.app',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-reading-id, x-user-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ success: true, message: 'CORS OK' }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  // Handle POST upload
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const readingId = url.searchParams.get('readingId')

    if (!readingId) {
      return new Response(JSON.stringify({ error: 'Reading ID required' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    // Get the form data
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    // Upload to Vercel Blob
    const filename = `reading-${readingId}-${Date.now()}.${file.name.split('.').pop()}`
    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    })

    // Note: We can't update MongoDB from edge function without connecting
    // So we return the URL and let the client update the reading

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: blob.url,
        readingId: readingId,
        message: 'Image uploaded via Edge Function',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Upload failed: ' + error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
}
