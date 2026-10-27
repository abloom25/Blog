<script setup lang="ts">
import type { NuxtError } from '#app'
import { LayoutSlotsForward } from '#build/dxup/layouts.mjs'

defineProps<{
	error: NuxtError & { url?: string }
}>()
</script>

<template>
<NuxtLayout>
	<!-- error.vue 不参与 pages 的插槽转译，需要显式注册布局插槽。 -->
	<LayoutSlotsForward>
		<template #aside>
			<WidgetBlogLog />
		</template>

		<div class="app-error">
			<ZError
				:code="error.stack"
				:message="error.url"
				:title="`[${error.status}] ${error.message}`"
			>
				<template #operation>
					<ZButton text="返回主页" @click="clearError({ redirect: '/' })" />
					<ZButton text="尝试忽略" @click="clearError()" />
				</template>
			</ZError>
		</div>
	</LayoutSlotsForward>
</NuxtLayout>
</template>

<style scoped>
.app-error {
	margin: 1rem;
}
</style>
