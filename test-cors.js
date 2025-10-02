#!/usr/bin/env node
/**
 * Simple CORS test script
 * Tests both OPTIONS preflight and actual requests to verify CORS headers
 */

async function testCORS() {
  const baseUrl = 'https://mytarotreadingsserver.vercel.app'
  const origin = 'https://mytarotreadings.vercel.app'
  
  console.log('🔵 Testing CORS configuration...')
  console.log('Base URL:', baseUrl)
  console.log('Origin:', origin)
  console.log()
  
  // Test 1: OPTIONS preflight for blob upload
  console.log('1. Testing OPTIONS preflight for blob upload...')
  try {
    const response = await fetch(`${baseUrl}/api/readings/test-id/blob/upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    })
    
    console.log('Status:', response.status)
    console.log('Headers:')
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('access-control')) {
        console.log(`  ${key}: ${value}`)
      }
    }
  } catch (error) {
    console.error('OPTIONS test failed:', error.message)
  }
  
  console.log()
  
  // Test 2: OPTIONS preflight for general API
  console.log('2. Testing OPTIONS preflight for general API...')
  try {
    const response = await fetch(`${baseUrl}/api/cors-test`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET'
      }
    })
    
    console.log('Status:', response.status)
    console.log('Headers:')
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('access-control')) {
        console.log(`  ${key}: ${value}`)
      }
    }
  } catch (error) {
    console.error('General OPTIONS test failed:', error.message)
  }
  
  console.log()
  
  // Test 3: Actual GET request
  console.log('3. Testing actual GET request...')
  try {
    const response = await fetch(`${baseUrl}/api/cors-test`, {
      method: 'GET',
      headers: {
        'Origin': origin
      }
    })
    
    console.log('Status:', response.status)
    console.log('Headers:')
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('access-control')) {
        console.log(`  ${key}: ${value}`)
      }
    }
    
    if (response.ok) {
      const data = await response.json()
      console.log('Response body:', data)
    }
  } catch (error) {
    console.error('GET test failed:', error.message)
  }
}

if (require.main === module) {
  testCORS().catch(console.error)
}

module.exports = { testCORS }