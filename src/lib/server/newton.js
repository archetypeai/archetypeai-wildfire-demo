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

// Bound the per-call vision load: encoding too many full-res frames in one
// multi-image batch can OOM the model GPU (12×1080p crashed it). Keep batches
// small and run them sequentially so peak vision-token load stays low.
const ZONE_CHUNK_SIZE = 4;

// Tolerant JSON-array parse: strip markdown fences and slice to the outer [].
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

// POST one /query with the shared auth + model defaults; returns the model text.
async function postQuery(body, timeoutMs) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(apiUrl('/query'), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ATAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ file_ids: [], model: MODEL_VERSION, ...body }),
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

// Analyze an entire zone without overloading the model GPU. Per-camera vision
// runs in small SEQUENTIAL multi-image batches (≤ ZONE_CHUNK_SIZE frames each,
// so peak vision-token load stays well under the level that OOM'd the engine),
// then a single text-only call synthesizes one zone overview from the findings.
// Returns { overview, cameras: [{ camera_index, status: good|warning|critical }] }.
export async function analyzeZone(cameras, instruction, timeoutMs = 120000) {
	const perCamera = []; // aligned to camera order: { name, status, summary }

	for (let i = 0; i < cameras.length; i += ZONE_CHUNK_SIZE) {
		const chunk = cameras.slice(i, i + ZONE_CHUNK_SIZE);
		const events = await Promise.all(
			chunk.map((cam) =>
				fetchBase64Event(
					`https://cameras.alertcalifornia.org/public-camera-data/${cam.id}/latest-frame.jpg?rqts=${Math.floor(Date.now() / 1000)}`
				)
			)
		);
		const labels = chunk
			.map((c, j) => `Image ${j} = "${c.name}"${c.county ? ` (${c.county} County)` : ''}`)
			.join('. ');
		const text = await postQuery(
			{
				query:
					`You are given ${chunk.length} wildfire camera frames as independent images, in order. ${labels}. ` +
					'For EACH image, assess wildfire risk from visible smoke, fire glow, haze, or unusual atmospheric conditions. ' +
					`Respond with ONLY a JSON array (no markdown fences) of ${chunk.length} objects in image order: ` +
					'[{"camera_index": <int>, "status": "clear|watch|danger", "summary": "<one sentence>"}].',
				instruction_prompt: `${instruction} Output only the JSON array, no prose, no markdown fences.`,
				max_new_tokens: 600,
				multi_image: true,
				events
			},
			timeoutMs
		);
		const parsed = parseJsonArray(text);
		chunk.forEach((cam, j) => {
			const entry = parsed.find((p) => p.camera_index === j) ?? parsed[j] ?? {};
			perCamera.push({
				name: cam.name,
				status: ZONE_STATUS_MAP[String(entry.status).toLowerCase()] ?? 'good',
				summary: entry.summary ?? ''
			});
		});
	}

	// Synthesize one zone overview from the per-camera findings — text only, so
	// there is no image-vision GPU pressure.
	const digest = perCamera
		.map((c, i) => `${i + 1}. ${c.name}: ${c.status.toUpperCase()} — ${c.summary}`)
		.join('\n');
	const overview = await postQuery(
		{
			query:
				`Per-camera wildfire assessments across the zone:\n${digest}\n\n` +
				'Write a 2-4 sentence overview of the WHOLE zone: overall risk level, roughly how many cameras are clear vs of concern, and name any camera showing smoke, fire, or haze. Plain prose, no JSON.',
			instruction_prompt: instruction,
			max_new_tokens: 300
		},
		timeoutMs
	);

	return {
		overview: overview.trim() || 'No overview returned.',
		cameras: perCamera.map((c, i) => ({ camera_index: i, status: c.status }))
	};
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
