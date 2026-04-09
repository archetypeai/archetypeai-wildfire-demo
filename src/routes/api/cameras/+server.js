import { json } from '@sveltejs/kit';
import { getCamerasForZone, FIRE_ZONES } from '$lib/server/cameras.js';

export async function GET({ url }) {
	const zoneId = url.searchParams.get('zone');

	if (!zoneId) {
		return json({ zones: FIRE_ZONES });
	}

	try {
		const cameras = await getCamerasForZone(zoneId);
		const zone = FIRE_ZONES.find((z) => z.id === zoneId);
		return json({ zone, cameras });
	} catch (err) {
		return json({ error: err.message }, { status: 400 });
	}
}
