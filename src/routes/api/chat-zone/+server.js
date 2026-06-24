import { json } from '@sveltejs/kit';
import { chatAboutZone } from '$lib/server/newton.js';

const INSTRUCTION =
	'You are a wildfire detection AI assistant for a network of ALERTCalifornia cameras across a fire zone. ' +
	'You help an operator understand current conditions across the zone and at individual cameras. ' +
	'Be precise and concise. Ground every answer in the provided scan results.';

export async function POST({ request }) {
	try {
		const { question, findings, overview } = await request.json();
		if (!question) {
			return json({ error: 'Missing question' }, { status: 400 });
		}
		const answer = await chatAboutZone(question, findings || [], overview || '', INSTRUCTION);
		return json({ answer, timestamp: Date.now() });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
