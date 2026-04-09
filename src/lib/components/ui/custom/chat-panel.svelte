<script>
	import { cn } from '$lib/utils.js';
	import BackgroundCard from '$lib/components/ui/patterns/background-card/index.js';
	import { Button } from '$lib/components/ui/primitives/button/index.js';
	import { ScrollArea } from '$lib/components/ui/primitives/scroll-area/index.js';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import SendIcon from '@lucide/svelte/icons/send';
	import SpinnerIcon from '@lucide/svelte/icons/loader';

	let {
		messages = $bindable([]),
		loading = false,
		disabled = false,
		onsend,
		class: className,
		...restProps
	} = $props();

	let inputValue = $state('');
	let textareaRef = $state(null);

	function autoResize() {
		if (!textareaRef) return;
		textareaRef.style.height = 'auto';
		textareaRef.style.height = Math.min(textareaRef.scrollHeight, 120) + 'px';
	}

	function handleSubmit(e) {
		e.preventDefault();
		const text = inputValue.trim();
		if (!text || loading || disabled) return;
		inputValue = '';
		if (textareaRef) textareaRef.style.height = 'auto';
		onsend?.(text);
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}
</script>

<BackgroundCard
	title="Chat"
	icon={MessageSquareIcon}
	class={cn('flex max-h-full flex-col gap-3 overflow-hidden', className)}
	{...restProps}
>
	<ScrollArea class="min-h-0 flex-1">
		<div class="flex flex-col gap-3 pr-3">
			{#if messages.length === 0}
				<p class="text-muted-foreground py-8 text-center text-sm">
					Ask Newton about the camera feed
				</p>
			{:else}
				{#each messages as msg (msg.id)}
					<div
						class={cn(
							'rounded-md px-3 py-2 text-sm',
							msg.role === 'user'
								? 'bg-secondary text-secondary-foreground ml-8'
								: 'bg-atai-neutral/10 text-foreground mr-8 border border-atai-neutral/20'
						)}
					>
						<p class="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
						<span class="text-[10px] opacity-50">
							{new Date(msg.timestamp).toLocaleTimeString('en-US', {
								hour12: false,
								hour: '2-digit',
								minute: '2-digit'
							})}
						</span>
					</div>
				{/each}
				{#if loading}
					<div class="bg-muted mr-8 flex items-center gap-2 rounded-md px-3 py-2">
						<SpinnerIcon class="text-muted-foreground size-4 animate-spin" />
						<span class="text-muted-foreground text-sm">Analyzing...</span>
					</div>
				{/if}
			{/if}
		</div>
	</ScrollArea>

	<form class="flex items-end gap-2" onsubmit={handleSubmit}>
		<textarea
			bind:this={textareaRef}
			bind:value={inputValue}
			oninput={autoResize}
			onkeydown={handleKeydown}
			placeholder={disabled ? 'Start analysis first...' : 'Ask about the camera...'}
			{disabled}
			rows="1"
			class={cn(
				'border-input bg-transparent ring-ring/50 placeholder:text-muted-foreground flex-1 resize-none rounded-xs border px-3 py-2 text-sm outline-none transition-colors',
				'focus-visible:border-ring focus-visible:ring-[3px]',
				'disabled:pointer-events-none disabled:opacity-50'
			)}
		></textarea>
		<Button
			type="submit"
			size="icon"
			disabled={disabled || loading || !inputValue.trim()}
			aria-label="Send message"
		>
			<SendIcon class="size-4" />
		</Button>
	</form>
</BackgroundCard>
