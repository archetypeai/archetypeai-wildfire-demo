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

const ZONE_STATUS_MAP = { clear: 'good', watch: 'warning', danger: 'critical' };

// Tolerant JSON-array parse: strip markdown fences and slice to the outer [...].
function parseJsonArray(text) {
	let t = (text || '').trim();
	t = t
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '')
		.trim();
	const start = t.indexOf('[');
	const end = t.lastIndexOf(']');
	if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
	return JSON.parse(t);
}

async function fetchBase64Event(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch camera image: ${res.status}`);
	const buffer = await res.arrayBuffer();
	return {
		type: 'data.base64_img',
		event_data: {
			contents: Buffer.from(buffer).toString('base64'),
			mime_type: res.headers.get('content-type') || 'image/jpeg'
		}
	};
}

// One stateless /query covering an entire zone: every camera frame is attached
// as an independent image (`multi_image: true`, up to 16) and the model returns
// a JSON array of per-camera assessments. Returns results aligned to the input
// camera order: [{ camera_index, status: good|warning|critical, summary }].
export async function analyzeZone(cameras, instruction, timeoutMs = 120000) {
	const events = await Promise.all(
		cameras.map((cam) =>
			fetchBase64Event(
				`https://cameras.alertcalifornia.org/public-camera-data/${cam.id}/latest-frame.jpg?rqts=${Math.floor(Date.now() / 1000)}`
			)
		)
	);

	const list = cameras
		.map((c, i) => `Image ${i} = "${c.name}"${c.county ? ` (${c.county} County)` : ''}`)
		.join('. ');
	const query =
		`You are given ${cameras.length} wildfire camera frames as independent images, in order. ${list}. ` +
		'For EACH image, assess wildfire risk from visible smoke, fire glow, haze, or unusual atmospheric conditions. ' +
		`Respond with ONLY a JSON array (no markdown fences) of ${cameras.length} objects in image order: ` +
		'[{"camera_index": <int>, "status": "clear|watch|danger", "summary": "<one or two sentences>"}].';

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
				instruction_prompt: `${instruction} Output only the JSON array, no prose, no markdown fences.`,
				file_ids: [],
				model: MODEL_VERSION,
				max_new_tokens: 1500,
				multi_image: true,
				events
			}),
			signal: controller.signal
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`POST /query failed: ${res.status} - ${JSON.stringify(err)}`);
		}
		const parsed = parseJsonArray(extractText(await res.json()));
		return cameras.map((cam, i) => {
			const entry = parsed.find((p) => p.camera_index === i) ?? parsed[i] ?? {};
			return {
				camera_index: i,
				status: ZONE_STATUS_MAP[String(entry.status).toLowerCase()] ?? 'good',
				summary: entry.summary ?? 'No assessment returned.'
			};
		});
	} finally {
		clearTimeout(timeoutId);
	}
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
