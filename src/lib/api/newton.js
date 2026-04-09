export async function startSession() {
	const res = await fetch('/api/session', { method: 'POST' });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Failed to create session');
	}
	return res.json();
}

export async function analyze(sessionId, imageUrl, query) {
	const body = { sessionId, imageUrl };
	if (query) body.query = query;

	const res = await fetch('/api/analyze', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Analysis failed');
	}
	return res.json();
}

export async function endSession(sessionId) {
	await fetch('/api/session', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sessionId })
	});
}

export async function fetchCameras(zoneId) {
	const res = await fetch(`/api/cameras?zone=${zoneId}`);
	if (!res.ok) throw new Error('Failed to fetch cameras');
	return res.json();
}
