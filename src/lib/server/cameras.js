const BASE_URL = 'https://cameras.alertcalifornia.org';
const DATA_URL = `${BASE_URL}/public-camera-data`;

export const FIRE_ZONES = [
	{
		id: 'palisades',
		name: 'Palisades Fire Zone',
		fire: 'Palisades Fire (Jan 2025)',
		acres: '23,448',
		county: 'Los Angeles',
		lat: 34.05,
		lon: -118.53
	},
	{
		id: 'eaton',
		name: 'Eaton Fire Zone',
		fire: 'Eaton Fire (Jan 2025)',
		acres: '14,021',
		county: 'Los Angeles',
		lat: 34.19,
		lon: -118.1
	},
	{
		id: 'park',
		name: 'Park Fire Zone',
		fire: 'Park Fire (Jul 2024)',
		acres: '429,603',
		county: 'Butte / Tehama',
		lat: 39.76,
		lon: -121.6
	},
	{
		id: 'thompson',
		name: 'Thompson Fire Zone',
		fire: 'Thompson Fire (Jul 2024)',
		acres: '3,000+',
		county: 'Butte',
		lat: 39.52,
		lon: -121.55
	},
	{
		id: 'smith',
		name: 'Smith Fire Zone',
		fire: 'Smith Fire (Feb 2025)',
		acres: '700+',
		county: 'San Diego',
		lat: 32.82,
		lon: -116.78
	}
];

let cachedCameras = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function dist(lat1, lon1, lat2, lon2) {
	return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
}

export async function fetchAllCameras() {
	if (cachedCameras && Date.now() - cacheTime < CACHE_TTL) {
		return cachedCameras;
	}

	const res = await fetch(`${DATA_URL}/all_cameras-v3.json`);
	if (!res.ok) throw new Error(`Failed to fetch cameras: ${res.status}`);
	const data = await res.json();

	cachedCameras = data.features
		.filter((f) => f.geometry.coordinates[0] && f.geometry.coordinates[1])
		.map((f) => ({
			id: f.properties.id,
			name: f.properties.name || f.properties.id,
			county: f.properties.county,
			lat: f.geometry.coordinates[1],
			lon: f.geometry.coordinates[0]
		}));
	cacheTime = Date.now();

	return cachedCameras;
}

export async function getCamerasForZone(zoneId, limit = 12) {
	const zone = FIRE_ZONES.find((z) => z.id === zoneId);
	if (!zone) throw new Error(`Unknown zone: ${zoneId}`);

	const cameras = await fetchAllCameras();

	return cameras
		.map((c) => ({ ...c, dist: dist(zone.lat, zone.lon, c.lat, c.lon) }))
		.filter((c) => c.dist < 0.4)
		.sort((a, b) => a.dist - b.dist)
		.slice(0, limit);
}

export function getImageUrl(cameraId, type = 'thumb') {
	const imageType = type === 'full' ? 'frame' : type;
	return `${DATA_URL}/${cameraId}/latest-${imageType}.jpg?rqts=${Math.floor(Date.now() / 1000)}`;
}
