function staffAuthHeaders(session) {
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

export async function syncClientPortalCredentialsToCloud(session, credentials) {
  const response = await fetch('/api/client-credentials', {
    method: 'PUT',
    headers: staffAuthHeaders(session),
    body: JSON.stringify({ credentials }),
  });

  if (response.status === 401) {
    throw new Error('Staff session expired. Sign in again and retry.');
  }

  if (response.status === 503) {
    throw new Error('Cloud sync is not configured. Connect Upstash Redis in Vercel first.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Could not save client logins to cloud.');
  }

  return response.json();
}
