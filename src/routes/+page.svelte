<script>
	import Menubar from '$lib/components/ui/patterns/menubar/index.js';
	import { Button } from '$lib/components/ui/primitives/button/index.js';
	import StatusBadge from '$lib/components/ui/patterns/status-badge/status-badge.svelte';
	import ZoneSelector from '$lib/components/ui/custom/zone-selector.svelte';
	import CameraGrid from '$lib/components/ui/custom/camera-grid.svelte';
	import CameraViewer from '$lib/components/ui/custom/camera-viewer.svelte';
	import AnalysisLog from '$lib/components/ui/custom/analysis-log.svelte';
	import ChatPanel from '$lib/components/ui/custom/chat-panel.svelte';
	import { startSession, analyze, endSession, fetchCameras } from '$lib/api/newton.js';

	let selectedZone = $state('palisades');
	let cameras = $state([]);
	let selectedCamera = $state(null);
	let selectedCameraId = $state(null);
	let camerasLoading = $state(false);

	let sessionId = $state(null);
	let sessionStatus = $state('idle');
	let busy = $state(false);
	let frameCount = $state(0);
	let entries = $state([]);
	let chatMessages = $state([]);
	let chatLoading = $state(false);
	let intervalId = $state(null);

	function getImageUrl(cameraId) {
		return `https://cameras.alertcalifornia.org/public-camera-data/${cameraId}/latest-frame.jpg?rqts=${Math.floor(Date.now() / 1000)}`;
	}

	function inferStatus(text) {
		const lower = text.toLowerCase();

		const dangerPatterns = [
			/\b(visible\s+)?(smoke|fire|flame|glow|burning)\b/,
			/\b(active|confirmed)\s+(fire|wildfire|blaze)\b/,
			/\bsmoke\s+plume/
		];

		const watchPatterns = [
			/\b(haze|hazy|reduced\s+visibility|poor\s+visibility)\b/,
			/\b(unusual|suspicious)\s+(haze|discoloration|glow)\b/,
			/\bpossible\s+smoke\b/
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
		camerasLoading = true;
		selectedCamera = null;
		selectedCameraId = null;
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

	async function analyzeSelected() {
		if (busy || !sessionId || !selectedCamera) return;

		busy = true;
		frameCount++;

		try {
			const url = getImageUrl(selectedCamera.id);
			const result = await analyze(sessionId, url, selectedCamera);
			const text = result.analysis;
			const status = inferStatus(text);

			entries = [
				{
					id: crypto.randomUUID(),
					text,
					timestamp: result.timestamp,
					status,
					camera: selectedCamera.name
				},
				...entries.slice(0, 49)
			];
		} catch (err) {
			console.error('Analysis failed:', err);
		} finally {
			busy = false;
		}
	}

	async function handleChatSend(text) {
		if (!sessionId || !selectedCamera) return;

		chatMessages = [
			...chatMessages,
			{ id: crypto.randomUUID(), role: 'user', text, timestamp: Date.now() }
		];
		chatLoading = true;

		while (busy) {
			await new Promise((r) => setTimeout(r, 200));
		}
		busy = true;

		try {
			const url = getImageUrl(selectedCamera.id);
			const result = await analyze(sessionId, url, selectedCamera, text);
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
			busy = false;
			chatLoading = false;
		}
	}

	async function handleStart() {
		if (sessionId) return;
		sessionStatus = 'connecting';

		try {
			const result = await startSession();
			sessionId = result.sessionId;
			sessionStatus = 'active';

			analyzeSelected();
			intervalId = setInterval(analyzeSelected, 10000);
		} catch (err) {
			console.error('Session failed:', err);
			sessionStatus = 'error';
		}
	}

	async function handleStop() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		if (sessionId) {
			try {
				await endSession(sessionId);
			} catch {
				// ignore
			}
			sessionId = null;
		}
		sessionStatus = 'idle';
		busy = false;
	}

	function handleZoneChange(zoneId) {
		loadCameras(zoneId);
	}

	function handleCameraSelect(cam) {
		selectedCamera = cam;
		selectedCameraId = cam.id;
	}

	// Load cameras on mount
	$effect(() => {
		loadCameras(selectedZone);
	});
</script>

{#snippet partnerSnippet()}
	<span class="text-muted-foreground font-mono text-sm tracking-wider uppercase"
		>Wildfire Watch</span
	>
{/snippet}

<div
	class="bg-background text-foreground grid h-screen w-screen grid-rows-[auto_auto_1fr] overflow-hidden"
>
	<Menubar partnerLogo={partnerSnippet}>
		<div class="flex items-center gap-3">
			{#if sessionStatus === 'active'}
				<StatusBadge label="Newton" percentage={100} initial="N" />
			{/if}
			{#if !sessionId}
				<Button variant="default" size="sm" onclick={handleStart}>Start Analysis</Button>
			{:else}
				<Button variant="outline" size="sm" onclick={handleStop}>Stop</Button>
			{/if}
		</div>
	</Menubar>

	<div class="border-border border-b px-4 py-2">
		<ZoneSelector bind:selected={selectedZone} onchange={handleZoneChange} />
	</div>

	<main class="grid grid-cols-3 grid-rows-2 gap-4 overflow-hidden p-4">
		<CameraViewer
			camera={selectedCamera}
			status={busy ? 'analyzing' : sessionId ? 'clear' : 'idle'}
			class="max-h-full"
		/>

		<CameraGrid
			{cameras}
			bind:selectedId={selectedCameraId}
			loading={camerasLoading}
			onselect={handleCameraSelect}
			class="row-span-2 max-h-full"
		/>

		<AnalysisLog {entries} class="row-span-2 max-h-full" />

		<ChatPanel
			bind:messages={chatMessages}
			loading={chatLoading}
			disabled={!sessionId}
			onsend={handleChatSend}
			class="max-h-full"
		/>
	</main>
</div>
