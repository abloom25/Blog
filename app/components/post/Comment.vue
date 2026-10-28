<script setup lang="tsx">
import type { TippyComponent } from 'vue-tippy'

const appConfig = useAppConfig()

const commentEl = useTemplateRef('comment')
const popoverEl = useTemplateRef<TippyComponent>('popover')
const popoverJumpTo = ref('')
const popoverInputEl = useTemplateRef('popover-input')
const showUndo = ref(false)

const popoverBind = ref<TippyComponent['$props']>({})

/** 评论区链接守卫 */
useEventListener(commentEl, 'click', (e) => {
	if (!(e.target instanceof Element))
		return

	if (e.target.matches('.tk-avatar-img'))
		e.stopPropagation()

	const popoverTarget = e.target.closest('a[target="_blank"]')
	if (!(popoverTarget instanceof HTMLAnchorElement))
		return

	e.preventDefault()
	popoverEl.value?.hide()

	popoverJumpTo.value = safelyDecodeUriComponent(popoverTarget.href)
	popoverBind.value = {
		getReferenceClientRect: () => popoverTarget.getBoundingClientRect(),
		triggerTarget: popoverTarget,
	}

	nextTick(checkUndoable)
	popoverEl.value?.show()
}, { capture: true })

function checkUndoable() {
	showUndo.value = popoverInputEl.value?.textContent !== popoverJumpTo.value
}

function undo() {
	if (!popoverInputEl.value)
		return
	popoverInputEl.value.textContent = popoverJumpTo.value
	checkUndoable()
}

function confirmOpen() {
	window.open(popoverInputEl.value?.textContent, '_blank')
}

onMounted(() => {
	window.twikoo?.init?.({
		envId: appConfig.twikoo?.envId,
		// twikoo 会把挂载后的元素变为 #twikoo
		el: '#twikoo',
	})
})
</script>

<template>
<section ref="comment" class="z-comment">
	<h3 class="text-creative">
		评论区
	</h3>

	<!-- interactive 默认会把气泡移动到 triggerTarget 的父元素上 -->
	<Tooltip
		ref="popover"
		v-bind="popoverBind"
		:append-to="() => commentEl!"
		interactive
		:aria="{ expanded: false }"
		trigger="focusin"
	>
		<template #content>
			<div class="popover-confirm">
				<span
					ref="popover-input"
					class="input"
					contenteditable="plaintext-only"
					spellcheck="false"
					@input="checkUndoable"
					@keydown.enter.prevent="confirmOpen"
					v-text="popoverJumpTo"
				/>

				<button
					v-if="showUndo"
					aria-label="恢复原始内容"
					@click="undo()"
				>
					<Icon name="tabler:arrow-back-up" />
				</button>

				<ZButton
					primary
					text="访问"
					@click="confirmOpen"
				/>
			</div>
		</template>
	</Tooltip>

	<div id="twikoo">
		<p>评论加载中...</p>
	</div>
</section>
</template>

<style scoped>
.z-comment {
	margin: 3rem 1rem;

	> h3 {
		margin-top: 3rem;
		font-size: 1.25rem;
	}
}

:deep() > [data-tippy-root] > .tippy-box {
	padding: 0;
}

.popover-confirm {
	display: flex;
	align-items: center;
	overflow-wrap: anywhere;

	> .input {
		min-width: 0;
		padding: 0.3em 0.6em;
		outline: none;
	}

	> button {
		flex-shrink: 0;
		align-self: stretch;
		padding: 0.3em;
		border-radius: 0 0.5em 0.5em 0;
	}
}

:deep(#twikoo) {
	margin: 2em 0;
	color: var(--c-text-1);

	/* Twikoo 的默认蓝色与 Element 表单颜色不跟随博客主题。 */
	.tk-comments .tk-sort-item,
	.tk-comments .tk-submit-action-icon,
	.tk-comments .tk-icon.__comments {
		color: var(--c-text-2);
	}

	.tk-comments .tk-sort-item:is(.__active, :hover, :focus),
	.tk-comments .tk-submit-action-icon:hover,
	.tk-comments .tk-action-link,
	.tk-comments .tk-actions button,
	.tk-comments .tk-nick-link:hover {
		color: var(--c-primary);
	}

	.tk-comments .tk-action-link .tk-action-icon,
	.tk-comments .tk-action-link .tk-action-icon-solid {
		color: inherit;
	}

	.tk-comments .tk-icon.__comments.__active {
		box-shadow: 0 0 0 0.2rem var(--c-primary-soft);
		background-color: var(--c-primary-soft);
		color: var(--c-primary);
	}

	.tk-comments :is(.tk-sort-item, .tk-action-link, .tk-actions button, .tk-submit-action-icon, .tk-icon.__comments):focus-visible {
		border-radius: 0.25rem;
		outline: 2px solid var(--c-primary);
		outline-offset: 4px;
	}

	/* 只覆盖公共评论表单，保留管理员面板自己的深色配色。 */
	.tk-comments {
		.el-input__inner,
		.el-textarea__inner {
			border-color: var(--c-border);
			background-color: var(--c-bg-2);
			color: var(--c-text-1);

			&::placeholder {
				opacity: 1;
				color: var(--c-text-2);
			}

			&:hover {
				border-color: var(--c-text-3);
			}

			&:focus {
				border-color: var(--c-primary);
			}
		}

		.el-input-group__prepend,
		.el-input-group__append {
			border-color: var(--c-border);
			background-color: var(--c-bg-soft);
			color: var(--c-text-2);
		}

		.el-textarea .el-input__count {
			background-color: transparent;
			color: var(--c-text-2);
		}

		.tk-meta-input .el-input input:invalid {
			border-color: var(--c-error);
		}

		.el-button {
			border-color: var(--c-border);
			background-color: var(--c-bg-2);
			color: var(--c-text-2);

			&.el-button--primary {
				border-color: var(--c-primary-soft);
				background-color: var(--c-primary-soft);
				color: var(--c-primary);
			}

			&.el-button--text {
				border-color: transparent;
				background-color: transparent;
				color: var(--c-primary);
			}

			&:not(:disabled, .is-disabled):is(:hover, :focus, :active) {
				border-color: var(--c-primary);
				background-color: var(--c-primary-soft);
				color: var(--c-primary);
			}

			&:focus-visible {
				outline: 2px solid var(--c-primary);
				outline-offset: 3px;
			}

			&:is(:disabled, .is-disabled) {
				border-color: var(--c-border);
				background-color: var(--c-bg-soft);
				color: var(--c-text-3);
				cursor: not-allowed;
			}
		}

		.el-input.is-disabled .el-input__inner,
		.el-textarea.is-disabled .el-textarea__inner {
			border-color: var(--c-border);
			background-color: var(--c-bg-soft);
			color: var(--c-text-3);
			cursor: not-allowed;
		}
	}

	.tk-admin-container {
		position: fixed;
		z-index: calc(var(--z-index-popover) + 1);
	}

	.tk-input {
		font-family: var(--font-monospace);
	}

	.tk-avatar {
		border-radius: 50%;

		@supports (corner-shape: squircle) {
			corner-shape: superellipse(1.2);
		}
	}

	.tk-avatar.tk-clickable {
		cursor: auto;
	}

	.tk-time {
		color: var(--c-text-3);
	}

	/* 防止 a 被 overflow hidden */
	.tk-content {
		margin: -0.2em;
		padding: 0.2em;
	}

	.tk-comments-title, .tk-nick {
		font-family: var(--font-creative);
	}

	.tk-owo-emotion {
		width: auto;
		height: 1.4em;
		vertical-align: text-bottom;
	}

	.tk-extras, .tk-footer {
		font-size: 0.7em;
		color: var(--c-text-3);
	}

	.tk-replies:not(.tk-replies-expand) {
		mask-image: linear-gradient(to top, transparent, #FFF 4em);
	}

	.tk-expand {
		border-radius: 0.5em;
		color: var(--c-text-2);
		transition: background-color 0.1s;

		&:hover,
		&:active {
			background-color: var(--c-bg-2);
			color: var(--c-text);
		}
	}

	.tippy-svg-arrow > svg {
		fill: inherit;
		width: auto;
		height: auto;
	}
}

:deep(:where(.tk-preview-container,.tk-content)) {
	pre {
		overflow: auto;
		border-radius: 0.5em;
		font-size: 0.85em;
	}

	a {
		margin: -0.1em -0.2em;
		padding: 0.1em 0.2em;
		background: linear-gradient(var(--c-primary-soft), var(--c-primary-soft)) no-repeat center bottom / 100% 0.1em;
		color: var(--c-primary);
		transition: all 0.2s;

		&:hover {
			border-radius: 0.3em;
			background-size: 100% 100%;
		}
	}

	p {
		margin: 0.2em 0;
	}

	img {
		border-radius: 0.5em;
	}

	menu, ol, ul {
		margin: 0.5em 0;
		padding-inline-start: 1.5em;
		font-size: 0.9rem;
		list-style: revert;

		> li {
			margin: 0.2em 0;

			&::marker {
				color: var(--c-primary);
			}
		}
	}

	blockquote {
		margin: 0.5em 0;
		padding: 0.2em 0.5em;
		border-inline-start: 4px solid var(--c-border);
		border-radius: 4px;
		background-color: var(--c-bg-2);
		font-size: 0.9em;
	}
}
</style>
