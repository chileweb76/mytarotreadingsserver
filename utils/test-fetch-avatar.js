;(async () => {
  let fetchAndStore
  try {
    fetchAndStore = require('./fetchAndStoreRemoteImage')
  } catch (e) {
    console.error('Require failed', e)
    process.exit(1)
  }

  console.log('fetchAndStore type:', typeof fetchAndStore)
  const remote = 'https://www.gstatic.com/webp/gallery/1.jpg'
  const serverBase = 'http://localhost:5002'
  console.log('Testing download of', remote)
  const res = await fetchAndStore(remote, serverBase, 'test-avatar')
  console.log('Result:', res)
})().catch(err => console.error(err))
