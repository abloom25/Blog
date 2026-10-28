<script setup lang="ts">
withDefaults(defineProps<{
	tag?: string
}>(), {
	tag: 'div',
})
const appConfig = useAppConfig()
</script>

<template>
<UtilLink class="blog-header">
	<NuxtImg
		:src="appConfig.header.logo"
		class="blog-logo"
		:alt="appConfig.title"
		width="64"
		height="64"
	/>

	<div v-if="appConfig.header.showTitle" class="blog-text">
		<component :is="tag" class="header-title">
			{{ appConfig.title }}
		</component>

		<div class="header-subtitle">
			{{ appConfig.header.subtitle }}
		</div>
	</div>
</UtilLink>
</template>

<style scoped>
.blog-header {
	display: flex;
	align-items: center;
	gap: 1rem;
	margin: 1.5rem 0;
	line-height: 1.4;
	color: var(--c-text);
	user-select: none;

	&:focus-visible {
		border-radius: 8px;
		outline: 2px solid var(--c-primary);
		outline-offset: 8px;
	}
}

.blog-logo {
	flex: 0 0 auto;
	width: 48px;
	height: 48px;
	border: 1px solid var(--c-border);
	border-radius: 50%;
	box-shadow: 0 8px 32px color-mix(in srgb, var(--c-accent) 12%, transparent);
	transition: transform 0.35s var(--motion-easing, ease);
	object-fit: cover;
}

.blog-text {
	min-width: 0;
}

.header-title {
	font-family: var(--font-display, Georgia, serif);
	font-size: 1.6rem;
	font-weight: 500;
	letter-spacing: 0.04em;
}

.header-subtitle {
	margin-top: 0.5rem;
	font-family: Georgia, serif;
	font-size: 0.75rem;
	font-style: italic;
	letter-spacing: 0.03em;
	color: var(--c-text-3);
}

.sidebar-header {
	flex-direction: column;
	align-items: flex-start;
	gap: 1.2rem;
	margin: 0 0 1.7rem;

	.blog-logo {
		width: 64px;
		height: 64px;
	}

	.header-title {
		font-size: 2rem;
	}
}

@media (hover: hover) and (pointer: fine) {
	.blog-header:hover .blog-logo {
		transform: translateY(-2px);
	}
}

@media (prefers-reduced-motion: reduce) {
	.blog-logo {
		transition: none;
	}
}
</style>
