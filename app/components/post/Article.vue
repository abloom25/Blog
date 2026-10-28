<script setup lang="ts">
import type { ArticleProps } from '~/types/article'

const props = defineProps<{ useUpdated?: boolean } & ArticleProps>()

const showAllDate = isTimeDiffSignificant(props.date, props.updated)
</script>

<template>
<UtilLink class="article-card" :class="{ 'with-cover': image }" :data-transition-key="path" data-transition-enter>
	<div v-if="image" class="article-cover" aria-hidden="true">
		<PostCover :src="image" banner />
	</div>
	<article>
		<h2 class="article-title">
			{{ title }}
		</h2>

		<p v-if="description" class="article-description">
			{{ description }}
		</p>

		<div class="article-info">
			<UtilDate
				v-if="date && (showAllDate || !useUpdated)"
				:date
				icon="tabler:pencil-minus"
			/>

			<UtilDate
				v-if="updated && (showAllDate || useUpdated)"
				:class="{ 'use-updated': useUpdated }"
				:date="updated"
				icon="tabler:clock-edit"
			/>

			<span v-if="categories" class="article-category" :style="{ '--category-color': getCategoryColor(categories[0]) }">
				<Icon :name="getCategoryIcon(categories[0])" />
				{{ categories[0] }}
			</span>

			<span v-if="readingTime?.words" class="article-words">
				<Icon name="tabler:pilcrow" />
				{{ formatNumber(readingTime?.words) }}字
			</span>
		</div>
	</article>
</UtilLink>
</template>

<style scoped>
.article-card {
	container-type: inline-size;
	display: block;
	position: relative;
	overflow: clip;
	margin: 1em 0;
	border-radius: 0.8em;
	color: var(--c-text);
	isolation: isolate;

	&:hover,
	&:focus-visible {
		.article-title {
			color: var(--c-primary);
		}

		.article-cover {
			opacity: 1;
		}
	}

	> article {
		display: grid;
		gap: 0.5em;
		position: relative;
		padding: 1em;
	}

	&.with-cover > article { width: 60%; }
}

.article-info {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em clamp(0.8em, 4%, 1.4em);
	margin-top: 0.25rem;
	font-size: 0.73em;
	line-height: 1.7;
	color: var(--c-text-2);

	&:empty {
		display: none;
	}

	.use-updated {
		order: -1;
	}

	.article-category {
		color: color-mix(in oklab, var(--category-color, var(--c-text-2)) 62%, var(--c-text));
	}
}

.article-title {
	display: -webkit-box;
	overflow: hidden;
	font-family: var(--font-creative);
	font-size: 1.2rem;
	font-weight: 600;
	letter-spacing: 0;
	-webkit-line-clamp: 2;
	line-height: 1.5;
	text-wrap: pretty;
	color: var(--c-text);
	transition: color 0.28s;
	-webkit-box-orient: vertical;
}

.article-description {
	display: -webkit-box;
	align-self: start;
	overflow: hidden;
	font-size: 0.87em;
	-webkit-line-clamp: 3;
	line-height: 1.85;
	color: var(--c-text-2);
	-webkit-box-orient: vertical;
}

.article-cover {
	position: absolute;
	opacity: 0.9;
	inset: 0;
	width: 100%;
	height: 100%;
	margin: 0;
	mask-image: linear-gradient(to right, transparent 8%, #0000000A 30%, #00000026 45%, #00000099 62%, #000 80%);
	transition: opacity 0.35s;
	pointer-events: none;
	z-index: -1;

	> :deep(.cover-artwork) {
		width: 100%;
		height: 100%;
	}

	:root.light & {
		mask-image: linear-gradient(to right, transparent 30%, #00000005 55%, #00000033 64%, #000000B3 76%, #000 88%);
	}
}

@container (max-width: 528px) {
	.article-cover {
		position: relative;
		height: auto;
		aspect-ratio: 2.4;
		margin-bottom: -10%;
		mask-image: linear-gradient(#000 50%, transparent);

		:root.light & { mask-image: linear-gradient(#000 50%, transparent); }

		> :deep(.cover-artwork) {
			position: absolute;
			inset: 0;
		}
	}

	.article-card.with-cover > article,
	.article-card > article {
		width: 100%;
		padding: 1em;
	}

	.article-title {
		font-size: 1.2rem;
	}

	.article-description {
		-webkit-line-clamp: 2;
	}
}

@media (prefers-reduced-motion: reduce) {
	.article-title,
	.article-cover {
		transition: none;
	}
}
</style>
