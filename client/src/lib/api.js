/**
 * Single place the client talks to the API.
 *
 * Same-origin by design — nginx serves the build and proxies /api in
 * production, and vite.config.js mirrors that in dev — so there is no base URL
 * to configure and no CORS anywhere.
 */
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (HTTP ${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const apiHealth = () => request('/health');

export default request;
