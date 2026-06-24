<script>
	import Menubar from '$lib/components/ui/patterns/menubar/index.js';
	import { Button } from '$lib/components/ui/primitives/button/index.js';
	import StatusBadge from '$lib/components/ui/patterns/status-badge/status-badge.svelte';
	import ZoneSelector from '$lib/components/ui/custom/zone-selector.svelte';
	import CameraGrid from '$lib/components/ui/custom/camera-grid.svelte';
	import CameraViewer from '$lib/components/ui/custom/camera-viewer.svelte';
	import ZoneAnalysis from '$lib/components/ui/custom/zone-analysis.svelte';
	import ChatPanel from '$lib/components/ui/custom/chat-panel.svelte';
	import * as Dialog from '$lib/components/ui/primitives/dialog/index.js';
	import { analyze, analyzeZone, fetchCameras } from '$lib/api/newton.js';

	let selectedZone = $state('palisades');
	let cameras = $state([]);
	let selectedCamera = $state(null);
	let selectedCameraId = $state(null);
	let camerasLoading = $state(false);

	let scanning = $state(false); // continuous zone scan active
	let cameraResults = $state({}); // { [id]: { status, text, timestamp } }
	let zoneOverview = $state(null); // { text, status, timestamp } from the latest scan
	let chatMessages = $state([]);
	let chatLoading = $state(false);
	let modalOpen = $state(false); // per-camera focus modal

	let scanTimeout = null;
	let scanWaitResolve = null;
	const SCAN_INTERVAL = 20000;

	// Per-camera status for the grid dots, and the selected camera's full result.
	let statusMap = $derived(
		Object.fromEntries(Object.entries(cameraResults).map(([id, r]) => [id, r.status]))
	);
	let selectedResult = $derived(selectedCameraId ? (cameraResults[selectedCameraId] ?? null) : null);

	function getImageUrl(cameraId) {
		return `https://cameras.alertcalifornia.org/public-camera-data/${cameraId}/latest-frame.jpg?rqts=${Math.floor(Date.now() / 1000)}`;
	}

	function inferStatus(text) {
		const lower = text.toLowerCase();

		// Check for clear/negative signals first — these override keyword matches
		const clearPatterns = [
			/\b(no|not|does not|do not|doesn't|don't)\s+.{0,30}(signs?\s+of\s+)?(smoke|fire|haze|flame|wildfire)/,
			/\b(no|not)\s+(visible\s+)?(smoke|fire|haze|flame|wildfire)\b/,
			/\b(clear|normal)\s+(sky|skies|visibility|conditions|atmosphere)/,
			/\bvisibility\s+(is\s+)?(good|clear|normal|excellent)/,
			/\b(no|not|does not|doesn't)\s+.{0,20}(abnormal|unusual)\s+(atmospheric|conditions)/,
			/\b(no|not|does not|doesn't)\s+.{0,30}(indicators?|evidence|signs?|display|show)\b/,
			/\bundisturbed\s+natural\s+environment/
		];

		for (const pat of clearPatterns) {
			if (pat.test(lower)) return 'good';
		}

		// Only flag danger for confirmed active fire language
		const dangerPatterns = [
			/\b(active|confirmed|detected)\s+(fire|wildfire|blaze)\b/,
			/\bsmoke\s+plume\s+(visible|detected|observed)\b/,
			/\bflames?\s+(visible|detected|observed)\b/,
			/\bfire\s+glow\s+(visible|detected|observed)\b/
		];

		const watchPatterns = [
			/\b(hazy|reduced\s+visibility|poor\s+visibility)\b/,
			/\b(unusual|suspicious)\s+(haze|discoloration|glow)\b/,
			/\bpossible\s+smoke\b/,
			/\b(faint|distant)\s+smoke\b/
		];

		for (const pat of dangerPatterns) {
			if (pat.test(lower)) return 'critical';
		}
		for (const pat of watchPatterns) {
			if (pat.test(lower)) return 'warning';
		}
		return 'good';
	}

	async function loadCameras(zoneId) {
		stopScan();
		camerasLoading = true;
		selectedCamera = null;
		selectedCameraId = null;
		cameraResults = {};
		zoneOverview = null;
		chatMessages = [];
		try {
			const data = await fetchCameras(zoneId);
			cameras = data.cameras;
			if (cameras.length > 0) {
				selectedCamera = cameras[0];
				selectedCameraId = cameras[0].id;
			}
		} catch (err) {
			console.error('Failed to load cameras:', err);
			cameras = [];
		} finally {
			camerasLoading = false;
		}
	}

	// Analyze one camera: update its status dot + the selected-camera result, and
	// push a zone-log entry. Shared by the zone scan and on-select re-analysis.
	async function analyzeCamera(cam) {
		cameraResults[cam.id] = { ...cameraResults[cam.id], status: 'analyzing' };
		try {
			const result = await analyze(getImageUrl(cam.id), cam);
			const status = inferStatus(result.analysis);
			cameraResults[cam.id] = { status, text: result.analysis, timestamp: result.timestamp };
		} catch (err) {
			cameraResults[cam.id] = { ...cameraResults[cam.id], status: 'error' };
			console.error(`Analysis failed for ${cam.name}:`, err);
		}
	}

	// One full pass over the zone in a single multi-image /query call. The model
	// returns a per-camera assessment which we fan back out to the status dots
	// and the rolling log.
	async function scanZoneOnce() {
		if (cameras.length === 0) return;
		for (const cam of cameras) {
			cameraResults[cam.id] = { ...cameraResults[cam.id], status: 'analyzing' };
		}
		try {
			const { overview, results, timestamp } = await analyzeZone(cameras);
			for (const r of results) {
				const cam = cameras[r.camera_index];
				if (!cam) continue;
				cameraResults[cam.id] = { ...cameraResults[cam.id], status: r.status, timestamp };
			}
			const statuses = results.map((r) => r.status);
			const aggregate = statuses.includes('critical')
				? 'critical'
				: statuses.includes('warning')
					? 'warning'
					: 'good';
			zoneOverview = { text: overview, status: aggregate, timestamp };
		} catch (err) {
			for (const cam of cameras) {
				cameraResults[cam.id] = { ...cameraResults[cam.id], status: 'error' };
			}
			console.error('Zone scan failed:', err);
		}
	}

	async function scanLoop() {
		while (scanning) {
			await scanZoneOnce();
			if (!scanning) break;
			// Cancellable idle wait between passes.
			await new Promise((resolve) => {
				scanWaitResolve = resolve;
				scanTimeout = setTimeout(resolve, SCAN_INTERVAL);
			});
		}
	}

	function toggleScan() {
		if (scanning) {
			stopScan();
		} else if (cameras.length > 0) {
			scanning = true;
			scanLoop();
		}
	}

	function stopScan() {
		scanning = false;
		if (scanTimeout) {
			clearTimeout(scanTimeout);
			scanTimeout = null;
		}
		if (scanWaitResolve) {
			scanWaitResolve();
			scanWaitResolve = null;
		}
	}

	function handleCameraSelect(cam) {
		selectedCamera = cam;
		selectedCameraId = cam.id;
		modalOpen = true; // open the focus modal for this camera
		analyzeCamera(cam); // fresh analysis for the camera you just picked
	}

	async function handleChatSend(text) {
		if (!selectedCamera) return;

		chatMessages = [
			...chatMessages,
			{ id: crypto.randomUUID(), role: 'user', text, timestamp: Date.now() }
		];
		chatLoading = true;

		try {
			const result = await analyze(getImageUrl(selectedCamera.id), selectedCamera, text);
			chatMessages = [
				...chatMessages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					text: result.analysis,
					timestamp: result.timestamp
				}
			];
		} catch (err) {
			chatMessages = [
				...chatMessages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					text: `Error: ${err.message}`,
					timestamp: Date.now()
				}
			];
		} finally {
			chatLoading = false;
		}
	}

	// Load cameras on mount and whenever the zone changes; stop scanning on teardown.
	$effect(() => {
		loadCameras(selectedZone);
		return () => stopScan();
	});
</script>

{#snippet partnerSnippet()}
	<span class="text-muted-foreground font-mono text-sm tracking-wider uppercase">Wildfire Watch</span>
{/snippet}

<div
	class="bg-background text-foreground grid h-screen w-screen grid-rows-[auto_auto_1fr] overflow-hidden"
>
	<Menubar partnerLogo={partnerSnippet}>
		<div class="flex items-center gap-3">
			{#if scanning}
				<StatusBadge label="Newton" percentage={100} initial="N" />
				<span class="text-muted-foreground hidden font-mono text-xs md:inline">
					Scanning {cameras.length} cameras
				</span>
			{/if}
			<Button
				variant={scanning ? 'outline' : 'default'}
				size="sm"
				onclick={toggleScan}
				disabled={cameras.length === 0}
			>
				{scanning ? 'Stop Scanning' : 'Scan Zone'}
			</Button>
		</div>
	</Menubar>

	<div class="border-border flex items-center gap-6 border-b px-4 py-2">
		<ZoneSelector bind:selected={selectedZone} />
		{#if !scanning}
			<div class="text-muted-foreground hidden items-center gap-4 text-xs lg:flex">
				<span
					><span
						class="bg-muted text-foreground mr-1 inline-flex size-5 items-center justify-center rounded-full font-mono text-[10px]"
						>1</span
					> Select a fire zone</span
				>
				<span
					><span
						class="bg-muted text-foreground mr-1 inline-flex size-5 items-center justify-center rounded-full font-mono text-[10px]"
						>2</span
					> Scan the zone</span
				>
				<span
					><span
						class="bg-muted text-foreground mr-1 inline-flex size-5 items-center justify-center rounded-full font-mono text-[10px]"
						>3</span
					> Select a camera for detail</span
				>
			</div>
		{/if}
	</div>

	<main class="grid grid-cols-3 gap-4 overflow-hidden p-4">
		<CameraGrid
			{cameras}
			bind:selectedId={selectedCameraId}
			statuses={statusMap}
			loading={camerasLoading}
			onselect={handleCameraSelect}
			class="max-h-full"
		/>

		<ZoneAnalysis overview={zoneOverview} {scanning} class="max-h-full" />

		<ChatPanel
			bind:messages={chatMessages}
			loading={chatLoading}
			disabled={!selectedCamera}
			onsend={handleChatSend}
			class="max-h-full"
		/>
	</main>
</div>

<Dialog.Root bind:open={modalOpen}>
	<Dialog.Content class="sm:max-w-4xl">
		<Dialog.Header>
			<Dialog.Title class="font-mono">{selectedCamera?.name ?? 'Camera'}</Dialog.Title>
			<Dialog.Description>
				{selectedCamera?.county ? `${selectedCamera.county} County · ` : ''}ALERTCalifornia live feed
			</Dialog.Description>
		</Dialog.Header>
		<CameraViewer camera={selectedCamera} result={selectedResult} />
	</Dialog.Content>
</Dialog.Root>
