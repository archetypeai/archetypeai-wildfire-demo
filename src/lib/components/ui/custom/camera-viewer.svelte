<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import Badge from '$lib/components/ui/primitives/badge/index.js';
	import CameraIcon from '@lucide/svelte/icons/camera';

	let {
		camera = null,
		status = 'idle',
		class: className,
		...restProps
	} = $props();

	let tick = $state(0);

	// Refresh full image every 15s
	$effect(() => {
		const id = setInterval(() => { tick++; }, 15000);
		return () => clearInterval(id);
	});

	let imageUrl = $derived(
		camera
			? `https://cameras.alertcalifornia.org/public-camera-data/${camera.id}/latest-frame.jpg?rqts=${Math.floor(Date.now() / 1000)}&t=${tick}`
			: null
	);

	const STATUS_COLORS = {
		analyzing: 'bg-atai-warning text-black/70',
		clear: 'bg-atai-good text-black/70',
		watch: 'bg-atai-warning text-black/70',
		warning: 'bg-atai-critical text-black/70',
		idle: 'bg-muted text-muted-foreground'
	};
</script>

<BackgroundCard
	title={camera ? camera.name : 'Camera Feed'}
	icon={CameraIcon}
	class={cn('gap-3', className)}
	{...restProps}
>
	<div class="relative overflow-hidden rounded-xs">
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

		<div class="absolute top-2 left-2">
			<Badge
				variant="outline"
				class={cn(
					'font-mono text-xs uppercase',
					STATUS_COLORS[status] ?? STATUS_COLORS.idle
				)}
			>
				{status}
			</Badge>
		</div>

		{#if camera}
			<div class="absolute right-2 bottom-2">
				<Badge variant="outline" class="bg-background/80 font-mono text-[10px] backdrop-blur-sm">
					{camera.county ?? ''} County
				</Badge>
			</div>
		{/if}
	</div>
</BackgroundCard>
