export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Mentora Backend</h1>
      <p>AI-powered tutoring platform backend API</p>

      <h2>Status</h2>
      <p>✓ Server is running</p>

      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>POST /api/sessions</code> - Create session</li>
        <li><code>GET /api/sessions</code> - List sessions</li>
        <li><code>GET /api/sessions/:id</code> - Get session details</li>
        <li><code>POST /api/qa</code> - Ask question (main teaching endpoint)</li>
        <li><code>POST /api/transcript</code> - Transcribe audio</li>
      </ul>

      <h2>Documentation</h2>
      <p>See <a href="https://github.com/your-repo/README.md">README.md</a> for full API documentation.</p>
    </main>
  )
}
