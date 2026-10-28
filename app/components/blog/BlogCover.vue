<script setup lang="ts">
// 封面先于异步页面渲染；等页面注册插槽，避免水合时用空节点替换 SSR 封面。
const layoutSlots = useLayoutSlotProvider()
if (layoutSlots)
	await layoutSlots.ready
</script>

<template>
<slot />
</template>
