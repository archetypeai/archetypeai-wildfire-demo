import { json } from '@sveltejs/kit';
import { analyzeFrame } from '$lib/server/newton.js';
import { getImageUrl } from '$lib/server/cameras.js';

const INSTRUCTION =
	'You are a wildfire detection AI monitoring live ALERTCalifornia camera feeds across California. ' +
	'These cameras are positioned on mountain peaks, ridgelines, and elevated points to provide early wildfire detection. ' +
	'Your role is to analyze camera frames for signs of smoke, fire, haze, or unusual atmospheric conditions. ' +
	'IMPORTANT: The "UC San Diego" watermark visible on all images is the ALERTCalifornia program operator logo — it does NOT indicate the camera location. ' +
	'Always use the camera name and county provided in the prompt to identify the location, never the watermark.';
const DEFAULT_FOCUS =
	'Analyze this camera frame for wildfire indicators: visible smoke plumes, fire glow, unusual haze or reduced visibility, atmospheric discoloration. ' +
	'Report: visibility conditions, sky clarity, any smoke or fire signs, and overall risk assessment (clear/watch/warning/danger).';

export async function POST({ request }) {
	try {
		const { sessionId, imageUrl, camera, query } = await request.json();
		if (!sessionId || !imageUrl) {
			return json({ error: 'Missing sessionId or imageUrl' }, { status: 400 });
		}

		// Fetch the camera image server-side and convert to base64
		const imgRes = await fetch(imageUrl);
		if (!imgRes.ok) throw new Error(`Failed to fetch camera image: ${imgRes.status}`);
		const buffer = await imgRes.arrayBuffer();
		const rawBase64 = Buffer.from(buffer).toString('base64');

		// Build camera-specific context
		let instruction = INSTRUCTION;
		let focus;
		if (camera) {
			const loc = `Camera: "${camera.name}", located in ${camera.county} County, California.`;
			instruction += ` ${loc}`;
			focus =
				query ||
				`${loc} Analyze this frame for wildfire indicators: visible smoke plumes, fire glow, unusual haze or reduced visibility. ` +
				'Report: visibility conditions, sky clarity, any smoke or fire signs, and overall risk assessment (clear/watch/warning/danger).';
		} else {
			focus = query || DEFAULT_FOCUS;
		}
		const analysis = await analyzeFrame(sessionId, rawBase64, instruction, focus);
		return json({ analysis, timestamp: Date.now() });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
