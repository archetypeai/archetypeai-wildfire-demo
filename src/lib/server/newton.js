import { ATAI_API_KEY, ATAI_API_ENDPOINT } from '$env/static/private';

const API_VERSION = 'v0.5';
// C 2.6 fusion checkpoint — the full `Newton::` prefix AND the `_fp8_` segment
// are required; omitting either returns 400 invalid_model_version.
const MODEL_VERSION = 'Newton::c2_6_8b_fp8_260424d7a55d5e';

function apiUrl(path) {
	return `${ATAI_API_ENDPOINT.replace(/\/$/, '')}/${API_VERSION}${path}`;
}

// Canonical extraction path is response.response[0]; fall back across the
// shape variants the model has been observed to return.
function extractText(payload) {
	const response = payload?.response;
	if (response && typeof response === 'object' && !Array.isArray(response)) {
		const inner = response.response;
		if (Array.isArray(inner) && inner.length) return inner[0] || '';
		if (typeof inner === 'string') return inner;
	}
	if (Array.isArray(response) && response.length) return response[0] || '';
	if (typeof response === 'string') return response;
	if (typeof payload?.text === 'string') return payload.text;
	return JSON.stringify(payload);
}

// Single stateless /query call against the C 2.6 fusion model. The camera frame
// is attached inline as a base64 image event; the system turn goes in
// `instruction_prompt` (the only field C 2.6 honors), the question in `query`.
export async function analyzeImage(
	rawBase64,
	instruction,
	query,
	mimeType = 'image/jpeg',
	timeoutMs = 60000
) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(apiUrl('/query'), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ATAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query,
				instruction_prompt: instruction,
				file_ids: [],
				model: MODEL_VERSION,
				max_new_tokens: 512,
				events: [
					{
						type: 'data.base64_img',
						event_data: { contents: rawBase64, mime_type: mimeType }
					}
				]
			}),
			signal: controller.signal
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`POST /query failed: ${res.status} - ${JSON.stringify(err)}`);
		}
		return extractText(await res.json());
	} finally {
		clearTimeout(timeoutId);
	}
}
