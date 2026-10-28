<script setup lang="ts">
import coverManifest from '~/assets/cover-media.json'

interface CoverMedia {
	src: string
	left: string
	right: string
	hero?: string
	heroWidth?: number
	heroHeight?: number
	ambientLight?: string
	ambientLightWidth?: number
	ambientLightHeight?: number
	width: number
	height: number
	fadeStart: number
	fadeEnd: number
	rightFadeStart?: number
	rightFadeEnd?: number
}

const props = withDefaults(defineProps<{
	src: string
	alt?: string
	direction?: 'left' | 'right'
	zoom?: boolean
	filter?: string
	eager?: boolean
	banner?: boolean
	ambient?: boolean
}>(), {
	alt: '',
	direction: 'left',
})

const media = computed(() => (coverManifest as Record<string, CoverMedia>)[props.src])
const clearFailed = ref(false)
const edgeFailed = ref(false)
const ambientFailed = ref(false)
watch(() => props.src, () => {
	clearFailed.value = false
	edgeFailed.value = false
	ambientFailed.value = false
})
const prepared = computed(() => clearFailed.value ? undefined : media.value)
const ambientSource = computed(() => !ambientFailed.value && media.value?.ambientLight)
const edge = computed(() => !props.banner && !edgeFailed.value && prepared.value?.[props.direction])
const clearSource = computed(() => (props.banner ? prepared.value?.hero : prepared.value?.src) || props.src)
const frameStyle = computed(() => {
	const cover = prepared.value
	const right = props.direction === 'right'
	return {
		'--cover-ratio': cover ? `${cover.width} / ${cover.height}` : '16 / 9',
		'--fade-start': `${100 * (right ? cover?.rightFadeStart ?? 0.08 : cover?.fadeStart ?? 0.08)}%`,
		'--fade-end': `${100 * (right ? cover?.rightFadeEnd ?? 0.3 : cover?.fadeEnd ?? 0.3)}%`,
		'filter': props.filter,
	}
})
</script>

<template>
<div class="cover-artwork" :class="[`extend-${direction}`, { 'is-banner': banner, 'has-edge': edge, 'is-ambient': ambient && ambientSource }]" :style="frameStyle">
	<NuxtImg
		v-if="ambient && ambientSource"
		class="cover-ambient-light"
		:src="ambientSource"
		:width="media?.ambientLightWidth"
		:height="media?.ambientLightHeight"
		densities="1"
		alt=""
		aria-hidden="true"
		@error="ambientFailed = true"
	/>
	<img
		v-if="edge"
		class="cover-bleed"
		:src="edge"
		alt=""
		aria-hidden="true"
		decoding="async"
		:loading="eager ? 'eager' : 'lazy'"
		@error="edgeFailed = true"
	>
	<Pic
		v-if="zoom"
		class="cover-clear"
		densities="1"
		:src="clearSource"
		:alt
		:width="banner ? prepared?.heroWidth : prepared?.width"
		:height="banner ? prepared?.heroHeight : prepared?.height"
		@error.capture="clearFailed = true"
	/>
	<NuxtImg
		v-else
		class="cover-clear"
		densities="1"
		:src="clearSource"
		:alt
		:width="banner ? prepared?.heroWidth : prepared?.width"
		:height="banner ? prepared?.heroHeight : prepared?.height"
		:loading="eager ? 'eager' : 'lazy'"
		@error="clearFailed = true"
	/>
</div>
</template>

<style scoped>
.cover-artwork {
	--fade-direction: right;
	--fade-span: calc(var(--fade-end) - var(--fade-start));

	position: relative;
	aspect-ratio: var(--cover-ratio);
	isolation: isolate;

	&.extend-right { --fade-direction: left; }
}

.cover-bleed {
	position: absolute;
	top: -12%;
	left: -100%;
	width: 200%;
	height: 124%;
	max-width: none;
	object-fit: fill;
	pointer-events: none;
	z-index: -1;

	.extend-right & { left: 0; }
}

.cover-clear {
	display: block;
	width: 100%;
	height: 100%;
	margin: 0;
	object-fit: contain;

	:deep(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
}

.has-edge .cover-clear {
	mask-image:
		linear-gradient(
			to var(--fade-direction),
			transparent var(--fade-start),
			#0000001A calc(var(--fade-start) + var(--fade-span) * 0.25),
			#00000080 calc(var(--fade-start) + var(--fade-span) * 0.5),
			#000000E6 calc(var(--fade-start) + var(--fade-span) * 0.75),
			#000 var(--fade-end)
		);
}

.is-banner {
	aspect-ratio: auto;

	.cover-clear, :deep(.cover-clear img) {
		object-fit: cover;
		object-position: right center;
	}
}

.cover-ambient-light {
	display: none;
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

:root.light .is-ambient {
	.cover-clear { visibility: hidden; }
	.cover-ambient-light { display: block; }
}
</style>
