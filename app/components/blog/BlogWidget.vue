<script setup lang="ts">
defineProps<{
	title?: string
	card?: boolean
	shrink?: boolean
	grayscale?: boolean
	dim?: boolean
	bgImg?: string
	bgAside?: boolean
}>()

const body = useTemplateRef('widget-body')

defineExpose({ body })
</script>

<template>
<section
	class="blog-widget"
	data-transition-enter
	:class="{ shrink, grayscale, dim }"
>
	<hgroup class="widget-header text-creative">
		<slot name="title">
			{{ title }}
		</slot>
		<span v-if="$slots.action" class="seperator" />
		<slot name="action" />
	</hgroup>

	<div
		ref="widget-body"
		class="widget-body"
		:class="{ 'widget-card': card, 'with-bg': bgImg, 'scrollcheck-y scrollbar-hidden': shrink }"
	>
		<LazyNuxtImg v-if="bgImg" class="bg-img" :class="{ 'bg-right': bgAside }" :src="bgImg" alt="" />
		<slot />
	</div>
</section>
</template>

<style scoped>
.blog-widget {
	flex-shrink: 1;
	font-size: 0.9em;

	&.shrink {
		display: flex;
		flex-direction: column;
		overflow: auto;
	}

	&.grayscale :where(.iconify, img) {
		transition: filter 0.2s;
		filter: grayscale(0.8);
	}

	#blog-aside:hover &.grayscale :where(.iconify, img),
	&.grayscale :where(.iconify, img):focus-within,
	#blog-aside.show &.grayscale :where(.iconify, img) {
		filter: grayscale(0);
	}

	&.dim {
		color: var(--c-text-2);
		transition: color 0.2s;

		#blog-aside:hover &,
		&:focus-within,
		#blog-aside.show & {
			color: var(--c-text-1);
		}
	}
}

.widget-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem;
	color: var(--c-text-2);

	&:empty {
		display: none;
	}

	> .seperator {
		flex-grow: 1;
	}

	> :deep(a) {
		transition: color 0.2s;
	}

	> :deep(a[href]:hover) {
		color: var(--c-primary);
	}
}

.widget-body {
	overscroll-behavior: contain;

	&.with-bg {
		contain: paint; /* overflow hidden + position relative */
		z-index: 0;

		> .bg-img {
			position: absolute;
			opacity: 0.2;
			inset: 0;
			width: 100%;
			height: 100%;
			object-fit: cover;
			pointer-events: none;
			z-index: -1;

			&.bg-right {
				inset-inline-start: 50%;
				width: 50%;
				mask-image: linear-gradient(to var(--end), transparent, #FFF 50%);
			}
		}
	}

	&.widget-card {
		padding: 0.35rem 0.5rem;
		border-radius: 0.8rem;

		:deep(p) {
			padding: 0.2em 0;
		}
	}
}
</style>
