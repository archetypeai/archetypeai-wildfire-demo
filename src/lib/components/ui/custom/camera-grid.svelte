<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import { ScrollArea } from '$lib/components/ui/primitives/scroll-area/index.js';
	import GridIcon from '@lucide/svelte/icons/layout-grid';

	let {
		cameras = [],
		selectedId = $bindable(null),
		loading = false,
		onselect,
		class: className,
		...restProps
	} = $props();

	let tick = $state(0);

	// Refresh thumbnails every 15s
	$effect(() => {
		const id = setInterval(() => { tick++; }, 15000);
		return () => clearInterval(id);
	});

	function thumbUrl(cameraId) {
		return `https://cameras.alertcalifornia.org/public-camera-data/${cameraId}/latest-thumb.jpg?rqts=${Math.floor(Date.now() / 1000)}&t=${tick}`;
	}
</script>

<BackgroundCard
	title="Cameras"
	icon={GridIcon}
	class={cn('flex max-h-full flex-col gap-3 overflow-hidden', className)}
	{...restProps}
>
	<ScrollArea class="min-h-0 flex-1">
		{#if loading}
			<p class="text-muted-foreground py-8 text-center text-sm">Loading cameras...</p>
		{:else if cameras.length === 0}
			<p class="text-muted-foreground py-8 text-center text-sm">Select a fire zone</p>
		{:else}
			<div class="grid grid-cols-3 gap-2 pr-3">
				{#each cameras as cam (cam.id)}
					<button
						class={cn(
							'group relative cursor-pointer overflow-hidden rounded-xs border transition-all',
							selectedId === cam.id
								? 'border-atai-warning ring-atai-warning/30 ring-2'
								: 'border-border hover:border-muted-foreground'
						)}
						onclick={() => {
							selectedId = cam.id;
							onselect?.(cam);
						}}
					>
						<img
							src={thumbUrl(cam.id)}
							alt={cam.name}
							class="aspect-video w-full object-cover"
							loading="lazy"
						/>
						<div class="bg-background/80 absolute inset-x-0 bottom-0 px-1.5 py-0.5 backdrop-blur-sm">
							<span class="text-foreground block truncate font-mono text-[10px]">
								{cam.name}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</ScrollArea>
</BackgroundCard>
