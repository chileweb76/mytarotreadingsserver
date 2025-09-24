// Test fetch from placeholder URL
(async () => {
  try {
    console.log('Testing placeholder URL fetch...');
    const url = 'https://via.placeholder.com/300x500/4a90e2/ffffff?text=The%20Fool';
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    const buffer = Buffer.from(arrayBuffer);
    console.log('Buffer size:', buffer.length);
    
    console.log('✅ Test successful!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();