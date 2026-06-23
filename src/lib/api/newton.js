// Stateless analysis against Newton C 2.6 via /query — no session lifecycle.
// Each call sends one camera frame as a self-contained request.
export async function analyze(imageUrl, camera, query) {
	const body = { imageUrl };
	if (camera) body.camera = camera;
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

export async function fetchCameras(zoneId) {
	const res = await fetch(`/api/cameras?zone=${zoneId}`);
	if (!res.ok) throw new Error('Failed to fetch cameras');
	return res.json();
}
