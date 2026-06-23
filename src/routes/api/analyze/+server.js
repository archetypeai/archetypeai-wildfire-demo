import { json } from '@sveltejs/kit';
import { analyzeImage } from '$lib/server/newton.js';

const INSTRUCTION =
	'You are a wildfire detection AI monitoring live ALERTCalifornia camera feeds across California. ' +
	'These cameras are positioned on mountain peaks, ridgelines, and elevated points to provide early wildfire detection. ' +
	'Your role is to analyze camera frames for signs of smoke, fire, haze, or unusual atmospheric conditions. ' +
	'IMPORTANT: All images contain watermark text such as "UC San Diego", "UCSD", "HPWREN", "SIO", "SDSC", or "ALERTCalifornia". ' +
	'These are the names of the organizations that operate the camera network (UC San Diego, High Performance Wireless Research and Education Network, Scripps Institution of Oceanography). ' +
	'They do NOT indicate the camera location. NEVER use watermark text to determine location. ' +
	'ONLY use the camera name and county explicitly provided in the prompt to identify where the camera is.';
const DEFAULT_FOCUS =
	'Analyze this camera frame for wildfire indicators: visible smoke plumes, fire glow, unusual haze or reduced visibility, atmospheric discoloration. ' +
	'Report: visibility conditions, sky clarity, any smoke or fire signs, and overall risk assessment (clear/watch/warning/danger).';

export async function POST({ request }) {
	try {
		const { imageUrl, camera, query } = await request.json();
		if (!imageUrl) {
			return json({ error: 'Missing imageUrl' }, { status: 400 });
		}

		// Fetch the camera image server-side and convert to base64
		const imgRes = await fetch(imageUrl);
		if (!imgRes.ok) throw new Error(`Failed to fetch camera image: ${imgRes.status}`);
		const buffer = await imgRes.arrayBuffer();
		const rawBase64 = Buffer.from(buffer).toString('base64');
		const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

		// Build camera-specific context
		let instruction = INSTRUCTION;
		let focus;
		if (camera) {
			const loc = `Camera: "${camera.name}", located in ${camera.county} County, California.`;
			instruction += ` ${loc}`;
			if (query) {
				focus = `${loc} ${query}`;
			} else {
				focus =
					`${loc} Analyze this frame for wildfire indicators: visible smoke plumes, fire glow, unusual haze or reduced visibility. ` +
					'Report: visibility conditions, sky clarity, any smoke or fire signs, and overall risk assessment (clear/watch/warning/danger).';
			}
		} else {
			focus = query || DEFAULT_FOCUS;
		}
		const analysis = await analyzeImage(rawBase64, instruction, focus, mimeType);
		return json({ analysis, timestamp: Date.now() });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
