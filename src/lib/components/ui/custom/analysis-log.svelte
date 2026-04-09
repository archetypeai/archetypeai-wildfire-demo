<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import FlatLogItem from '$lib/components/ui/patterns/flat-log-item/index.js';
	import { ScrollArea } from '$lib/components/ui/primitives/scroll-area/index.js';
	import ShieldIcon from '@lucide/svelte/icons/shield-alert';

	let { entries = [], class: className, ...restProps } = $props();

	const LABELS = {
		good: 'CLEAR',
		warning: 'WATCH',
		critical: 'DANGER',
		neutral: 'SCANNING'
	};

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
	title="Analysis"
	icon={ShieldIcon}
	class={cn('flex max-h-full flex-col gap-3 overflow-hidden', className)}
	{...restProps}
>
	<ScrollArea class="min-h-0 flex-1">
		<div class="flex flex-col gap-2 pr-3">
			{#if entries.length === 0}
				<p class="text-muted-foreground py-8 text-center text-sm">
					Waiting for analysis...
				</p>
			{:else}
				{#each entries as entry (entry.id)}
					<FlatLogItem
						title={LABELS[entry.status] ?? 'SCANNING'}
						message={entry.text}
						status={entry.status}
						detail={formatTime(entry.timestamp)}
					/>
				{/each}
			{/if}
		</div>
	</ScrollArea>
</BackgroundCard>
