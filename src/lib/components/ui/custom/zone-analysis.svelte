<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import Badge from '$lib/components/ui/primitives/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/primitives/scroll-area/index.js';
	import ShieldIcon from '@lucide/svelte/icons/shield-alert';
	import { marked } from 'marked';

	marked.setOptions({ breaks: true, gfm: true });

	// entries: [{ id, text, status: good|warning|critical, timestamp }] — newest first
	let { entries = [], scanning = false, class: className, ...restProps } = $props();

	const STATUS = {
		good: { label: 'CLEAR', class: 'bg-atai-good text-black/70' },
		warning: { label: 'WATCH', class: 'bg-atai-warning text-black/70' },
		critical: { label: 'DANGER', class: 'bg-atai-critical text-black/70' }
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
	title="Zone Analysis"
	icon={ShieldIcon}
	class={cn('flex max-h-full flex-col gap-3 overflow-hidden', className)}
	{...restProps}
>
	<ScrollArea class="min-h-0 flex-1">
		{#if entries.length === 0}
			<p class="text-muted-foreground py-8 text-center text-sm">
				{scanning ? 'Analyzing the zone…' : 'Scan the zone to see an overview of all cameras.'}
			</p>
		{:else}
			<div class="flex flex-col gap-4 pr-3">
				{#each entries as entry (entry.id)}
					<div class="border-border/60 flex flex-col gap-1.5 border-b pb-4 last:border-b-0">
						<div class="flex items-center justify-between">
							{#if STATUS[entry.status]}
								<Badge
									variant="outline"
									class={cn('font-mono text-xs uppercase', STATUS[entry.status].class)}
								>
									{STATUS[entry.status].label}
								</Badge>
							{/if}
							<span class="text-muted-foreground font-mono text-xs">
								{formatTime(entry.timestamp)}
							</span>
						</div>
						<div
							class="prose-sm prose-invert leading-relaxed [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Newton model output -->
							{@html marked(entry.text)}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</ScrollArea>
</BackgroundCard>
