<script setup lang="ts">
const { slots } = provideLayoutSlots()
</script>

<template>
<NuxtLoadingIndicator />
<NuxtRouteAnnouncer :style="{ position: 'absolute' }" />
<BlogSkipToContent />
<BlogCover>
	<slot name="cover" />
</BlogCover>
<BlogSidebar />
<main id="main-content">
	<slot />
</main>
<!-- 与正文同高的容器限制侧栏 sticky 边界，让页脚进入视口时将侧栏向上顶走。 -->
<div class="blog-aside-track">
	<BlogAside>
		<slot name="aside" />
	</BlogAside>
</div>
<BlogFooter />
<BlogPanel :has-aside="!!slots?.aside" />
<BikariyaModals />
</template>

<!-- eslint-disable-next-line vue/enforce-style-attribute -->
<style>
#blog-root {
	--aside-width: 280px;
	--sidebar-width: 248px;
	--layout-row: 1;
	--layout-gutter: max(2.5rem, calc((100vw - 1440px) / 2));

	display: grid;
	grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--aside-width);
	align-items: start;
	column-gap: 1.5rem;
	width: 100%;
	min-width: 0;
	margin-inline: auto;
	padding-inline: var(--layout-gutter);

	&:not(:has(> .blog-aside-track > #blog-aside:not(.is-empty))) {
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
	}

	@media (max-width: 1080px) {
		--sidebar-width: 224px;
		--layout-gutter: 1.5rem;

		column-gap: 2rem;

		&, &:not(:has(> .blog-aside-track > #blog-aside:not(.is-empty))) {
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
		}
	}

	@media (max-width: 768px) {
		--layout-gutter: 0.5rem;

		&, &:not(:has(> .blog-aside-track > #blog-aside:not(.is-empty))) {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	&:has(> .post-masthead) {
		--layout-row: 2;

		> .post-masthead {
			grid-area: 1 / 2 / auto / -1;
			min-width: 0;
			margin: 0 calc(-1 * var(--layout-gutter)) 0 0;

			> .post-header { margin: 0; }
		}

		> #blog-sidebar {
			grid-area: 1 / 1 / span 2;
		}

		@media (max-width: 768px) {
			> .post-masthead {
				grid-column: 1 / -1;
				margin-inline-start: calc(-1 * var(--layout-gutter));
			}
		}
	}
}

#blog-sidebar, #blog-aside {
	position: sticky;
	top: 0;
	height: 100vh;
	height: 100dvh;
	min-width: 0;
	scrollbar-width: thin;
}

#blog-sidebar {
	grid-area: var(--layout-row) / 1;
}

#main-content {
	grid-area: var(--layout-row) / 2;
	/* 保留语义 main 和可见溢出，不影响正文内的 sticky 元素。 */
	min-width: 0;
	padding-top: 1.5rem;

	:root[data-article-transition] & { view-transition-name: article-body; }

	@media (max-width: 768px) {
		grid-column: 1;
		padding-top: 0.5rem;
	}
}

.blog-aside-track {
	display: contents;

	@media not (max-width: 1080px) {
		&:has(> #blog-aside:not(.is-empty)) {
			display: block;
			grid-area: var(--layout-row) / 3;
			align-self: stretch;
			min-width: 0;
			padding-top: 1.5rem;
		}
	}
}

#blog-root > .blog-footer {
	grid-area: calc(var(--layout-row) + 1) / 2 / auto / -1;
	min-width: 0;

	@media (max-width: 768px) {
		grid-column: 1 / -1;
	}
}
</style>
