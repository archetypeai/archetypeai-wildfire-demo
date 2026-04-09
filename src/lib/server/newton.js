import { ATAI_API_KEY, ATAI_API_ENDPOINT } from '$env/static/private';

const API_VERSION = 'v0.5';
const LENS_NAME = 'wildfire-camera-lens';
const MODEL_VERSION = 'Newton::c2_4_7b_251215a172f6d7';

function apiUrl(path) {
	return `${ATAI_API_ENDPOINT.replace(/\/$/, '')}/${API_VERSION}${path}`;
}

async function apiGet(path) {
	const res = await fetch(apiUrl(path), {
		headers: { Authorization: `Bearer ${ATAI_API_KEY}` }
	});
	if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
	return res.json();
}

async function apiPost(path, body, timeoutMs = 10000) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(apiUrl(path), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ATAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body),
			signal: controller.signal
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`POST ${path} failed: ${res.status} - ${JSON.stringify(err)}`);
		}
		return res.json();
	} finally {
		clearTimeout(timeoutId);
	}
}

async function cleanStaleLenses() {
	const lenses = await apiGet('/lens/metadata');
	const stale = Array.isArray(lenses)
		? lenses.find((l) => l.lens_name === LENS_NAME)
		: null;
	if (stale) {
		await apiPost('/lens/delete', { lens_id: stale.lens_id });
	}
}

async function waitForSession(sessionId, maxWaitMs = 30000) {
	const start = Date.now();
	while (Date.now() - start < maxWaitMs) {
		const status = await apiPost(
			'/lens/sessions/events/process',
			{ session_id: sessionId, event: { type: 'session.status' } },
			10000
		);
		const s = status.session_status;
		if (s === 'LensSessionStatus.SESSION_STATUS_RUNNING' || s === '3') return true;
		if (s === 'LensSessionStatus.SESSION_STATUS_FAILED' || s === '6') return false;
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

export async function createSession(instruction, focus) {
	await cleanStaleLenses();

	const lens = await apiPost('/lens/register', {
		lens_config: {
			lens_name: LENS_NAME,
			lens_config: {
				model_pipeline: [{ processor_name: 'lens_camera_processor', processor_config: {} }],
				model_parameters: {
					model_version: MODEL_VERSION,
					template_name: 'image_qa_template_task',
					instruction,
					focus,
					max_new_tokens: 512,
					camera_buffer_size: 1,
					min_replicas: 1,
					max_replicas: 1
				}
			}
		}
	});

	const session = await apiPost('/lens/sessions/create', { lens_id: lens.lens_id });
	const sessionId = session.session_id;

	const ready = await waitForSession(sessionId);
	if (!ready) throw new Error('Session failed to start');

	await apiPost(
		'/lens/sessions/events/process',
		{
			session_id: sessionId,
			event: { type: 'session.modify', event_data: { camera_buffer_size: 1 } }
		},
		30000
	);

	return { sessionId, lensId: lens.lens_id };
}

export async function analyzeFrame(sessionId, rawBase64, instruction, focus) {
	const response = await apiPost(
		'/lens/sessions/events/process',
		{
			session_id: sessionId,
			event: {
				type: 'model.query',
				event_data: {
					model_version: MODEL_VERSION,
					template_name: 'image_qa_template_task',
					instruction,
					focus,
					max_new_tokens: 512,
					data: [{ type: 'base64_img', base64_img: rawBase64 }]
				}
			}
		},
		60000
	);

	if (response.type === 'model.query.response' && response.event_data) {
		const text = response.event_data.response;
		if (typeof text === 'string') return text;
		if (Array.isArray(text)) return text.join('\n');
		return JSON.stringify(response.event_data);
	}

	return JSON.stringify(response);
}

export async function destroySession(sessionId) {
	await apiPost('/lens/sessions/destroy', { session_id: sessionId });
}
