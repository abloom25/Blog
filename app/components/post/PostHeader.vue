<script setup lang="ts">
import type { ArticleProps } from '~/types/article'

defineOptions({ inheritAttrs: false })

const props = defineProps<ArticleProps>()

const appConfig = useAppConfig()

const coverFilter = computed(() => props.meta?.coverFilter || (props.meta?.coverDim && 'brightness(0.75)') || undefined)

const shareText = `【${appConfig.title}】${props.title}\n\n${
	props.subtitle ? `${props.subtitle}\n\n` : ''}${
	props.description ? `${props.description}\n\n` : ''}${
	new URL(props.path!, appConfig.url).href}`

const { copy, copied } = useCopy(shareText)
</script>

<template>
<div id="post-header" class="post-header" :class="{ 'has-cover': image }" :data-transition-key="path" data-transition-enter>
	<PostCover v-if="image" class="post-cover" :src="image" :alt="title" :filter="coverFilter" eager zoom banner />
	<div class="post-nav">
		<div class="operations">
			<Icon v-show="false" name="tabler:check" />
			<ZButton
				:icon="copied ? 'tabler:check' : 'tabler:share'"
				text="文字分享"
				@click="copy()"
			/>
		</div>

		<div v-if="!meta?.hideInfo" class="post-info">
			<UtilDate
				v-if="date"
				v-tip
				:tip-transform="d => `创建于${d}`"
				:date
				icon="tabler:pencil-minus"
			/>

			<UtilDate
				v-if="updated && isTimeDiffSignificant(date, updated, 1)"
				v-tip
				:tip-transform="d => `修改于${d}`"
				:date="updated"
				icon="tabler:clock-edit"
			/>

			<span v-if="categories">
				<Icon :name="getCategoryIcon(categories[0])" />
				{{ categories[0] }}
			</span>

			<span>
				<Icon name="tabler:pilcrow" />
				{{ formatNumber(readingTime?.words) }} 字
			</span>
		</div>
	</div>

	<hgroup class="post-heading" :class="{ 'has-subtitle': subtitle, 'is-story': type === 'story' }">
		<h1 class="post-title" :class="getPostTypeClassName(type)">
			{{ title }}
		</h1>
		<p v-if="subtitle" class="post-subtitle">
			{{ subtitle }}
		</p>
	</hgroup>
</div>
</template>

<style scoped>
.post-header {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 1.5rem;
	position: relative;
	min-height: 12rem;
	margin: 1rem;
	color: var(--c-text);
	isolation: isolate;

	@media (max-width: 768px) {
		margin: 0.75rem 1rem;
	}

	&.has-cover {
		container-type: inline-size;
		justify-content: center;
		gap: 1.25rem;
		overflow: clip;
		min-width: 0;
		min-height: 0;
		aspect-ratio: 3.38;
		padding: 2rem clamp(1.5rem, 3vw, 3rem);

		.post-title { font-size: clamp(1.4rem, 3.5cqw, 3.5rem); }
		.post-subtitle { color: var(--c-text-2); }
		.post-heading, .post-nav { width: 46%; }
		.post-nav {
			flex-direction: column;
			gap: 1rem;
		}
		.post-nav, .post-title, .post-subtitle { padding-inline: 0; }
		.operations { color: var(--c-text-2); }
	}
}

.operations {
	color: var(--c-text-2);

	:deep(.z-button) {
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
	}
}

.post-cover {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	margin: 0;
	mask-composite: intersect;
	mask-image:
		linear-gradient(to right, transparent, #0000000D 20%, #00000033 40%, #000000B3 58%, #000 75%),
		linear-gradient(to bottom, #000 65%, transparent);
	z-index: -2;

	:root.light & {
		mask-image:
			linear-gradient(to right, transparent 10%, #0000000D 35%, #00000033 48%, #000000B3 65%, #000 80%),
			linear-gradient(to bottom, #000 65%, transparent);
	}
}

.post-heading {
	z-index: 1;

	&.is-story .post-title {
		font-family: var(--font-display);
	}

	&.has-subtitle {
		.post-title {
			padding-bottom: 0.4em;
		}
	}
}

.post-title {
	padding: 0 1.5rem 0.5rem;
	font-size: clamp(1.8rem, 3.6vw, 2.75rem);
	font-weight: 600;
	letter-spacing: -0.035em;
	line-height: 1.45;
	text-wrap: balance;
}

.post-subtitle {
	margin: 0;
	padding: 0 1.5rem;
	font-size: 0.85rem;
	line-height: 1.9;
	text-wrap: balance;
	color: var(--c-text-2);
}

.post-nav {
	display: flex;
	flex-direction: row-reverse;
	align-items: flex-start;
	justify-content: space-between;
	gap: 1.5rem;
	position: relative;
	padding: 0 1.5rem;
	font-size: 0.73em;
	line-height: 1.8;
	z-index: 1;

	.post-info {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em 1.2em;
		column-gap: clamp(1em, 3%, 1.5em);
	}
}

@media (max-width: 768px) {
	.post-header.has-cover {
		gap: 1rem;
		min-height: 0;
		aspect-ratio: auto;
		padding: calc(100% / 3.38 + 1.5rem) 1.5rem 1.5rem;
		text-shadow: none;
		color: var(--c-text);

		&::before { display: none; }
		.post-cover {
			bottom: auto;
			height: auto;
			aspect-ratio: 3.38;
		}
		.post-title { font-size: 1.8rem; }
		.post-heading, .post-nav { width: 100%; }
		.post-nav { flex-direction: row-reverse; }
		.post-subtitle, .operations { color: var(--c-text-2); }
	}

	.post-nav, .post-title, .post-subtitle { padding-inline: 0; }
	.post-nav {
		flex-direction: row-reverse;
		align-items: start;
		justify-content: space-between;
	}
	.operations { flex-shrink: 0; }
}
</style>
