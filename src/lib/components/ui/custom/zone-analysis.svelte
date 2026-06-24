<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import Badge from '$lib/components/ui/primitives/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/primitives/scroll-area/index.js';
	import ShieldIcon from '@lucide/svelte/icons/shield-alert';
	import { marked } from 'marked';

	marked.setOptions({ breaks: true, gfm: true });

	// overview: { text, status: good|warning|critical, timestamp } | null
	let { overview = null, scanning = false, class: className, ...restProps } = $props();

	const STATUS = {
		good: { label: 'CLEAR', class: 'bg-atai-good text-black/70' },
		warning: { label: 'WATCH', class: 'bg-atai-warning text-black/70' },
		critical: { label: 'DANGER', class: 'bg-atai-critical text-black/70' }
	};
	let badge = $derived(overview?.status ? (STATUS[overview.status] ?? null) : null);

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
	title="Zone Analysis"
	icon={ShieldIcon}
	class={cn('flex max-h-full flex-col gap-3 overflow-hidden', className)}
	{...restProps}
>
	{#if overview?.text}
		<div class="flex items-center justify-between">
			{#if badge}
				<Badge variant="outline" class={cn('font-mono text-xs uppercase', badge.class)}>
					{badge.label}
				</Badge>
			{/if}
			{#if overview.timestamp}
				<span class="text-muted-foreground font-mono text-xs">{formatTime(overview.timestamp)}</span>
			{/if}
		</div>
		<ScrollArea class="min-h-0 flex-1">
			<div
				class="prose-sm prose-invert pr-3 leading-relaxed [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Newton model output -->
				{@html marked(overview.text)}
			</div>
		</ScrollArea>
	{:else}
		<p class="text-muted-foreground py-8 text-center text-sm">
			{scanning ? 'Analyzing the zone…' : 'Scan the zone to see an overview of all cameras.'}
		</p>
	{/if}
</BackgroundCard>
