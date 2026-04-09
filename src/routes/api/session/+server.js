import { json } from '@sveltejs/kit';
import { createSession, destroySession } from '$lib/server/newton.js';

const INSTRUCTION =
	'You are a wildfire detection AI monitoring live ALERTCalifornia camera feeds across California. ' +
	'These cameras are positioned on mountain peaks, ridgelines, and elevated points to provide early wildfire detection. ' +
	'California has experienced devastating wildfires including the Palisades Fire (23,448 acres, LA County, Jan 2025), ' +
	'Eaton Fire (14,021 acres, LA County, Jan 2025), and Park Fire (429,603 acres, Butte County, Jul 2024). ' +
	'Your role is to analyze camera frames for signs of smoke, fire, haze, or unusual atmospheric conditions.';
const FOCUS = 'Answer questions about the wildfire camera image.';

export async function POST() {
	try {
		const { sessionId, lensId } = await createSession(INSTRUCTION, FOCUS);
		return json({ sessionId, lensId });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}

export async function DELETE({ request }) {
	try {
		const { sessionId } = await request.json();
		await destroySession(sessionId);
		return json({ ok: true });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
