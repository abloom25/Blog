<script setup lang="ts">
const route = useRoute()
const contentPath = useContentPath().value

const { data: post } = await useAsyncData(
	`content:${contentPath}`,
	() => queryCollection('content').path(contentPath).first(),
)

const excerpt = computed(() => post.value?.description || '')
const asideWidgetNames = computed<WidgetName[]>(() => {
	if (!post.value)
		return ['blog-log']
	return (post.value.meta?.aside as WidgetName[] | undefined) ?? ['toc']
})
const { widgets } = useWidgets(asideWidgetNames)

if (post.value) {
	useSeoMeta({
		title: post.value.title,
		ogType: 'article',
		ogImage: post.value.image,
		description: post.value.description,
	})
}
else {
	const event = useRequestEvent()
	event && setResponseStatus(event, 404)
	route.meta.title = '404'
}
</script>

<template>
<template #cover>
	<div v-if="post?.image" class="post-masthead">
		<PostCover class="post-backdrop" :src="post.image" banner ambient aria-hidden="true" />
		<PostHeader v-bind="post" />
		<PostExcerpt v-if="excerpt" class="cover-excerpt" :excerpt />
	</div>
</template>

<template #aside>
	<!-- 每篇文章拥有独立的目录状态，并在具名插槽内自然入场。 -->
	<component :is="widget.comp" v-for="widget in widgets" :key="`${post?.path ?? route.path}:${widget.name}`" />
</template>

<template v-if="post">
	<PostHeader v-if="!post.image" v-bind="post" />
	<PostExcerpt v-if="excerpt && !post.image" :excerpt />
	<!-- 正文使用纯透明度入场，保证 URL 锚点和目录测量不受位移影响。 -->
	<ContentRenderer
		class="article"
		data-transition-enter
		:class="getPostTypeClassName(post?.type, { prefix: 'md' })"
		:value="post"
		tag="article"
	/>

	<PostFooter v-bind="post" />
	<PostSurround />
	<PostComment />
</template>

<ZError
	v-else
	icon="line-md:document-delete-twotone"
	title="内容为空或页面不存在"
/>
</template>

<style scoped>
.post-backdrop {
	position: fixed;
	opacity: 0.22;
	inset: -5rem;
	width: calc(100% + 10rem);
	height: calc(100dvh + 10rem);
	filter: blur(72px) saturate(1.25) brightness(0.72);
	pointer-events: none;
	z-index: -1;

	:root.light & {
		opacity: 0.14;
		filter: blur(72px) saturate(0.65);

		&.is-ambient {
			opacity: 1;
			filter: none;
		}
	}
}
</style>
