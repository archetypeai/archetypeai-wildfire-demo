<script>
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/primitives/button/index.js';
	import Badge from '$lib/components/ui/primitives/badge/index.js';
	import FlameIcon from '@lucide/svelte/icons/flame';

	const ZONES = [
		{ id: 'palisades', label: 'Palisades', county: 'LA', acres: '23K' },
		{ id: 'eaton', label: 'Eaton', county: 'LA', acres: '14K' },
		{ id: 'park', label: 'Park', county: 'Butte', acres: '430K' },
		{ id: 'thompson', label: 'Thompson', county: 'Butte', acres: '3K' },
		{ id: 'smith', label: 'Smith', county: 'San Diego', acres: '700' }
	];

	let { selected = $bindable('palisades'), onchange, class: className, ...restProps } = $props();
</script>

<div class={cn('flex flex-wrap gap-2', className)} {...restProps}>
	{#each ZONES as zone (zone.id)}
		<Button
			variant={selected === zone.id ? 'default' : 'outline'}
			size="sm"
			onclick={() => {
				selected = zone.id;
				onchange?.(zone.id);
			}}
		>
			<FlameIcon class="size-3" aria-hidden="true" />
			{zone.label}
			<Badge variant="outline" class="text-[10px] ml-1 px-1 py-0 opacity-70">
				{zone.acres} ac
			</Badge>
		</Button>
	{/each}
</div>
