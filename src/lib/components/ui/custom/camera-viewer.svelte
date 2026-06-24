<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import Badge from '$lib/components/ui/primitives/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/primitives/scroll-area/index.js';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	let { camera = null, result = null, class: className, ...restProps } = $props();

	let tick = $state(0);
	let countdown = $state(15);

	$effect(() => {
		countdown = 15;
		const id = setInterval(() => {
			countdown--;
			if (countdown <= 0) {
				tick++;
				countdown = 15;
			}
		}, 1000);
		return () => clearInterval(id);
	});

	let imageUrl = $derived(
		camera
			? `https://cameras.alertcalifornia.org/public-camera-data/${camera.id}/latest-frame.jpg?rqts=${Math.floor(Date.now() / 1000)}&t=${tick}`
			: null
	);

	const STATUS = {
		analyzing: { label: 'ANALYZING', class: 'bg-atai-neutral text-black/70' },
		good: { label: 'CLEAR', class: 'bg-atai-good text-black/70' },
		warning: { label: 'WATCH', class: 'bg-atai-warning text-black/70' },
		critical: { label: 'DANGER', class: 'bg-atai-critical text-black/70' },
		error: { label: 'ERROR', class: 'bg-muted text-muted-foreground' }
	};
	let badge = $derived(result?.status ? (STATUS[result.status] ?? null) : null);

	function formatTime(ts) {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<BackgroundCard
	title={camera ? camera.name : 'Camera Feed'}
	icon={CameraIcon}
	class={cn('flex max-h-full flex-col gap-3 overflow-hidden', className)}
	{...restProps}
>
	<div class="relative shrink-0 overflow-hidden rounded-xs">
		{#if imageUrl}
			<img
				src={imageUrl}
				alt={camera?.name ?? 'Camera feed'}
				class="bg-muted aspect-video w-full object-contain"
			/>
		{:else}
			<div class="bg-muted flex aspect-video w-full items-center justify-center">
				<p class="text-muted-foreground text-sm">Select a camera</p>
			</div>
		{/if}

		{#if badge}
			<div class="absolute top-2 left-2">
				<Badge variant="outline" class={cn('font-mono text-xs uppercase', badge.class)}>
					{badge.label}
				</Badge>
			</div>
		{/if}

		{#if camera}
			<div class="absolute right-2 bottom-2">
				<Badge variant="outline" class="bg-background/80 font-mono text-[10px] backdrop-blur-sm">
					{camera.county ?? ''} County
				</Badge>
			</div>
		{/if}
	</div>

	{#if camera}
		<div class="flex min-h-0 flex-1 flex-col gap-2">
			{#if result?.text}
				<ScrollArea class="min-h-0 flex-1">
					<p class="text-foreground pr-3 text-sm leading-relaxed whitespace-pre-wrap">
						{result.text}
					</p>
				</ScrollArea>
				<div class="text-muted-foreground flex items-center justify-between text-xs">
					<span class="flex items-center gap-1.5">
						<RefreshCwIcon class="size-3" aria-hidden="true" />
						refreshes in <span class="text-foreground font-mono">{countdown}s</span>
					</span>
					{#if result?.timestamp}
						<span class="font-mono">{formatTime(result.timestamp)}</span>
					{/if}
				</div>
			{:else if result?.status === 'analyzing'}
				<p class="text-muted-foreground flex-1 text-sm">Analyzing…</p>
			{:else}
				<p class="text-muted-foreground flex-1 text-sm">
					Not yet analyzed — Scan Zone, or re-select this camera for a fresh read.
				</p>
			{/if}
		</div>
	{/if}
</BackgroundCard>
