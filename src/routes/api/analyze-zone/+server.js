import { json } from '@sveltejs/kit';
import { analyzeZone } from '$lib/server/newton.js';

const INSTRUCTION =
	'You are a wildfire detection AI monitoring live ALERTCalifornia camera feeds across California. ' +
	'These cameras are positioned on mountain peaks, ridgelines, and elevated points to provide early wildfire detection. ' +
	'Your role is to analyze camera frames for signs of smoke, fire, haze, or unusual atmospheric conditions. ' +
	'IMPORTANT: All images contain watermark text such as "UC San Diego", "UCSD", "HPWREN", "SIO", "SDSC", or "ALERTCalifornia". ' +
	'These are the organizations that operate the camera network, NOT the camera location. ' +
	'ONLY use the camera name and county provided in the prompt to identify where each camera is.';

export async function POST({ request }) {
	try {
		const { cameras } = await request.json();
		if (!Array.isArray(cameras) || cameras.length === 0) {
			return json({ error: 'Missing cameras' }, { status: 400 });
		}
		const results = await analyzeZone(cameras, INSTRUCTION);
		return json({ results, timestamp: Date.now() });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
