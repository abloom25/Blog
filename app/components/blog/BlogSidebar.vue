<script setup lang="ts">
const appConfig = useAppConfig()
const layoutStore = useLayoutStore()
const searchStore = useSearchStore()
</script>

<template>
<BlogMask
	:show="layoutStore.state === 'sidebar'"
	class="hide-above-mobile"
	@click="layoutStore.close()"
/>

<!-- 不能用 Transition 实现弹出收起动画，因为半宽屏状态始终显示 -->
<aside id="blog-sidebar" :class="{ show: layoutStore.state === 'sidebar' }" aria-label="博客导航">
	<BlogHeader class="sidebar-header" to="/" />

	<nav class="sidebar-nav" aria-label="主要导航">
		<button
			type="button"
			class="search-btn sidebar-nav-item"
			aria-label="搜索文章"
			:aria-expanded="layoutStore.state === 'search'"
			@click="layoutStore.toggle('search')"
		>
			<Icon name="tabler:search" />
			<span class="nav-text">{{ searchStore.label }}</span>
			<Key class="keycut" code="K" cmd prevent @press="layoutStore.toggle('search')" />
		</button>

		<template v-for="(group, groupIndex) in appConfig.nav" :key="groupIndex">
			<h3 v-if="group.title">
				{{ group.title }}
			</h3>

			<menu>
				<li v-for="(item, itemIndex) in group.items" :key="itemIndex">
					<UtilLink :to="item.url" class="sidebar-nav-item">
						<Icon :name="item.icon" />
						<span class="nav-text">{{ item.text }}</span>
						<Icon v-if="isExtLink(item.url)" class="external-tip" name="tabler:arrow-up-right" />
					</UtilLink>
				</li>
			</menu>
		</template>
	</nav>

	<footer class="sidebar-footer">
		<BlogMusicPlayer v-if="appConfig.music.enabled" />
		<div class="sidebar-utilities">
			<BlogThemeToggle />
			<ZIconNavList :list="appConfig.footer.iconNav" />
		</div>
	</footer>
</aside>
</template>

<style scoped>
#blog-sidebar {
	display: flex;
	flex-direction: column;
	gap: 0;
	overflow: auto;
	padding: 44px 20px 28px 8px;
	color: var(--c-text-2);
	overscroll-behavior: contain;

	> * {
		flex-shrink: 0;
	}

	@media not (max-width: 768px) {
		:root[data-article-transition] & { view-transition-name: article-navigation; }
	}

	@media (max-width: 768px) {
		position: fixed;
		visibility: hidden;
		inset-inline-start: 0;
		top: 0;
		width: 300px;
		height: 100dvh;
		max-width: calc(100% - 36px);
		padding: 32px 28px max(28px, env(safe-area-inset-bottom));
		border-inline-end: 1px solid var(--c-border);
		background-color: color-mix(in srgb, var(--c-bg) 92%, transparent);
		backdrop-filter: blur(24px);
		transform: var(--transform-start-far);
		transition: transform 0.3s var(--motion-easing, ease), visibility 0.3s;
		z-index: var(--z-index-popover);

		&.show {
			visibility: visible;
			box-shadow: 16px 0 70px #0002;
			transform: none;
		}
	}
}

.sidebar-nav {
	padding-bottom: 28px;
	font-size: 0.8rem;

	h3 {
		margin: 1.8rem 0 0.7rem 12px;
		font-size: 0.68rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		color: var(--c-text-3);
	}

	li {
		margin: 3px 0;
	}
}

.sidebar-nav-item {
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 42px;
	padding: 10px 12px;
	border-radius: 0.75rem;
	text-align: start;
	transition: color 0.2s, transform 0.3s var(--motion-easing, ease);

	&:hover,
	&.router-link-active {
		color: var(--c-text);
	}

	&.router-link-active::after {
		content: "";
		flex: 0 0 5px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		box-shadow: 0 0 12px color-mix(in srgb, var(--c-primary) 45%, transparent);
		background-color: var(--c-primary);
	}

	&:focus-visible {
		outline: 2px solid var(--c-primary);
		outline-offset: 3px;
	}

	> .iconify {
		font-size: 1.35em;
	}

	> .nav-text {
		flex-grow: 1;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	> .external-tip {
		opacity: 0.5;
		font-size: 1em;
	}
}

.search-btn {
	width: 100%;
	margin-bottom: 20px;
	border-bottom: 1px solid var(--c-border);
	color: var(--c-text-3);
	user-select: none;

	&:hover {
		color: var(--c-text);
	}

	.keycut {
		flex-shrink: 0;
		border-radius: 0.25rem;
		box-shadow: none;
		background: none;
		font-size: 0.65rem;
	}
}

.sidebar-footer {
	display: grid;
	gap: 16px;
	margin-top: auto;
	padding-top: 20px;
	font-size: 0.8rem;
	color: var(--c-text-2);
}

.sidebar-utilities {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;

	:deep(.theme-toggle) {
		margin: 0;
		border: 0;
		border-radius: 1rem;
		background: none;

		> button {
			padding: 7px 9px;
			border-radius: 1rem;
			box-shadow: none;
			background: none;

			&:hover,
			&.active {
				background: none;
				color: var(--c-primary);
			}
		}
	}

	:deep(menu) {
		gap: 4px;
		font-size: 0.95rem;
	}
}

@media (hover: hover) and (pointer: fine) {
	a.sidebar-nav-item:hover {
		transform: translateX(3px);
	}
}

@media (prefers-reduced-motion: reduce) {
	#blog-sidebar,
	.sidebar-nav-item {
		transition: none;
	}
}
</style>
