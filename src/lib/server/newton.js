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

// Tolerant JSON-object parse: strip markdown fences, then slice to the outer {}.
function parseJson(text) {
	let t = (text || '').trim();
	t = t
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '')
		.trim();
	try {
		return JSON.parse(t);
	} catch {
		const start = t.indexOf('{');
		const end = t.lastIndexOf('}');
		if (start !== -1 && end !== -1) return JSON.parse(t.slice(start, end + 1));
		throw new Error('Could not parse JSON from model response');
	}
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
// as an independent image (`multi_image: true`, up to 16). The model returns a
// single zone-level overview plus per-camera statuses (for the grid dots).
// Returns { overview, cameras: [{ camera_index, status: good|warning|critical }] }.
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
		'Assess wildfire risk from visible smoke, fire glow, haze, or unusual atmospheric conditions. ' +
		'Respond with ONLY a JSON object (no markdown fences): ' +
		'{"overview": "<2-4 sentences assessing the WHOLE zone: overall risk level, roughly how many cameras are clear vs of concern, and name any specific camera showing smoke, fire, or haze>", ' +
		`"cameras": [{"camera_index": <int>, "status": "clear|watch|danger"}]} with one cameras entry per image, in image order (${cameras.length} total).`;

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
				max_new_tokens: 1000,
				multi_image: true,
				events
			}),
			signal: controller.signal
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`POST /query failed: ${res.status} - ${JSON.stringify(err)}`);
		}
		const parsed = parseJson(extractText(await res.json()));
		const list = Array.isArray(parsed.cameras) ? parsed.cameras : [];
		return {
			overview: parsed.overview ?? 'No overview returned.',
			cameras: cameras.map((cam, i) => {
				const entry = list.find((p) => p.camera_index === i) ?? list[i] ?? {};
				return {
					camera_index: i,
					status: ZONE_STATUS_MAP[String(entry.status).toLowerCase()] ?? 'good'
				};
			})
		};
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
