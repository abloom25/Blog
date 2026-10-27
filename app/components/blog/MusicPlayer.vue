<script setup lang="ts">
import type { MusicTrack } from '~~/shared/types/music'

interface LyricLine {
	time: number
	text: string
	words: LyricWord[]
}

interface LyricWord {
	time: number
	text: string
}

const TRACK_INFO_DURATION = 4000
const lyricTimestampPattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g
const wordTimestampPattern = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g
const lyricCreditPattern = /^(?:作词|作曲|编曲|制作人|混音|母带|词|曲)\s*[:：]/
const instrumentalLyricPattern = /^纯音乐[，,、\s]*请欣赏[。！!]?$/

const appConfig = useAppConfig()
const audioEl = useTemplateRef('audio')

const { data: tracks, status } = await useFetch<MusicTrack[]>('/api/music', {
	default: () => [],
})

const currentIndex = ref(0)
const currentTime = ref(0)
const failedTrackCount = ref(0)
const isAudioLoading = ref(false)
const isHovered = ref(false)
const isInitialized = ref(false)
const isPlaying = ref(false)
const isUnavailable = ref(false)
const lyrics = ref<LyricLine[]>([])
const lyricsLoading = ref(false)
const showTrackInfo = ref(true)

let lyricAbortController: AbortController | undefined
let shuffledTrackIndexes: number[] = []
let shuffledTrackPosition = 0
let trackInfoTimer: ReturnType<typeof setTimeout> | undefined

const currentTrack = computed(() =>
	isInitialized.value ? tracks.value[currentIndex.value] : undefined,
)
const isLoading = computed(() => status.value === 'pending' || isAudioLoading.value)
const isPlaybackActive = computed(() => isPlaying.value || isAudioLoading.value)
const hasLyrics = computed(() => lyrics.value.length > 0)
const currentLyric = computed(() => {
	if (!lyrics.value.length)
		return undefined

	for (let index = lyrics.value.length - 1; index >= 0; index--) {
		if (lyrics.value[index]!.time <= currentTime.value)
			return lyrics.value[index]
	}

	return undefined
})
const displayTrackInfo = computed(() =>
	!isPlaying.value
	|| isHovered.value
	|| showTrackInfo.value
	|| lyricsLoading.value
	|| !hasLyrics.value
	|| !currentLyric.value,
)
const playerLabel = computed(() => {
	if (status.value === 'pending')
		return '正在加载歌单'
	if (status.value === 'error' || isUnavailable.value || !tracks.value.length)
		return '音乐暂时不可用'
	return currentTrack.value?.name || '音乐播放器'
})

onMounted(() => {
	initializeShuffledTracks()
	isInitialized.value = true
	applyVolume()
	revealTrackInfo()
	setupMediaSession()
})

onUnmounted(() => {
	lyricAbortController?.abort()
	clearTimeout(trackInfoTimer)
	clearMediaSession()
})

watch(currentTrack, () => {
	currentTime.value = 0
	revealTrackInfo()
	if (import.meta.client) {
		void loadLyrics()
		updateMediaMetadata(true)
	}
}, { flush: 'post' })

watch(isPlaybackActive, updateMediaPlaybackState)
watch([currentLyric, isPlaying], () => updateMediaMetadata())

function applyVolume() {
	if (audioEl.value)
		audioEl.value.volume = Math.min(1, Math.max(0, appConfig.music.defaultVolume))
}

function parseTimestamp(match: RegExpMatchArray) {
	const minutes = Number(match[1])
	const seconds = Number(match[2])
	const fraction = Number(`0.${match[3] || 0}`)
	return minutes * 60 + seconds + fraction
}

function removeTranslation(text: string) {
	if (!/[a-z]/i.test(text))
		return text

	const normalized = text.trimEnd()
	if (!normalized.endsWith(')') && !normalized.endsWith('）'))
		return text

	let depth = 0
	let openIndex = -1
	for (let index = normalized.length - 1; index >= 0; index--) {
		const character = normalized[index]
		if (character === ')' || character === '）')
			depth++
		else if (character === '(' || character === '（')
			depth--

		if (depth === 0) {
			openIndex = index
			break
		}
	}

	if (openIndex < 0)
		return text

	const translatedText = normalized.slice(openIndex + 1, -1)
	return /\p{Script=Han}/u.test(translatedText)
		? normalized.slice(0, openIndex).trim()
		: text
}

function parseWords(text: string) {
	const matches = Array.from(text.matchAll(wordTimestampPattern))
	if (!matches.length)
		return []

	return matches.flatMap((match, index) => {
		const start = match.index! + match[0].length
		const end = matches[index + 1]?.index ?? text.length
		const segment = text.slice(start, end)
		const normalized = removeTranslation(segment.trim())
		const word = normalized && /\s$/.test(segment) ? `${normalized} ` : normalized
		return word
			? [{ time: parseTimestamp(match), text: word }]
			: []
	})
}

function parseLyrics(source: string) {
	const parsed: LyricLine[] = []
	const usedTimestamps = new Set<number>()

	for (const rawLine of source.split(/\r?\n/)) {
		const lineMatches = Array.from(rawLine.matchAll(lyricTimestampPattern))
		if (!lineMatches.length)
			continue

		const textWithWordTimestamps = rawLine.replace(lyricTimestampPattern, '').trim()
		const words = parseWords(textWithWordTimestamps)
		const text = removeTranslation(textWithWordTimestamps.replace(wordTimestampPattern, '').trim())
		if (!text || lyricCreditPattern.test(text) || instrumentalLyricPattern.test(text))
			continue

		for (const match of lineMatches) {
			const time = parseTimestamp(match)
			const timestampKey = Math.round(time * 1000)
			// 同时间戳的后续行通常是翻译，播放器只展示原文。
			if (usedTimestamps.has(timestampKey))
				continue
			usedTimestamps.add(timestampKey)

			parsed.push({
				time,
				text,
				words,
			})
		}
	}

	return parsed.sort((a, b) => a.time - b.time)
}

async function loadLyrics() {
	lyricAbortController?.abort()
	lyrics.value = []

	const track = currentTrack.value
	if (!track?.lrc)
		return

	lyricAbortController = new AbortController()
	lyricsLoading.value = true
	try {
		const source = await $fetch<string>(track.lrc, {
			responseType: 'text',
			signal: lyricAbortController.signal,
		})
		lyrics.value = parseLyrics(source)
	}
	catch (error) {
		if (!isAbortError(error))
			console.warn('[music] 无法获取歌词', error)
	}
	finally {
		lyricsLoading.value = false
	}
}

function isAbortError(error: unknown): boolean {
	if (!error || typeof error !== 'object')
		return false

	const value = error as { name?: string, message?: string, cause?: unknown }
	return value.name === 'AbortError'
		|| value.message?.includes('signal is aborted') === true
		|| isAbortError(value.cause)
}

function revealTrackInfo() {
	showTrackInfo.value = true
	clearTimeout(trackInfoTimer)
	trackInfoTimer = setTimeout(() => {
		showTrackInfo.value = false
	}, TRACK_INFO_DURATION)
}

function shuffleTrackIndexes(excludeFirst?: number) {
	const indexes = Array.from({ length: tracks.value.length }, (_, index) => index)

	for (let index = indexes.length - 1; index > 0; index--) {
		const randomIndex = Math.floor(Math.random() * (index + 1))
		;[indexes[index], indexes[randomIndex]] = [indexes[randomIndex]!, indexes[index]!]
	}

	if (indexes.length > 1 && indexes[0] === excludeFirst) {
		const swapIndex = 1 + Math.floor(Math.random() * (indexes.length - 1))
		;[indexes[0], indexes[swapIndex]] = [indexes[swapIndex]!, indexes[0]!]
	}

	return indexes
}

function initializeShuffledTracks() {
	if (!tracks.value.length)
		return

	shuffledTrackIndexes = shuffleTrackIndexes()
	shuffledTrackPosition = 0
	currentIndex.value = shuffledTrackIndexes[0]!
}

function getNextShuffledTrackIndex() {
	if (!tracks.value.length)
		return

	if (shuffledTrackIndexes.length !== tracks.value.length)
		initializeShuffledTracks()

	shuffledTrackPosition++
	if (shuffledTrackPosition >= shuffledTrackIndexes.length) {
		shuffledTrackIndexes = shuffleTrackIndexes(currentIndex.value)
		shuffledTrackPosition = 0
	}

	return shuffledTrackIndexes[shuffledTrackPosition]
}

function getPreviousShuffledTrackIndex() {
	if (!tracks.value.length)
		return

	if (shuffledTrackIndexes.length !== tracks.value.length)
		initializeShuffledTracks()

	if (shuffledTrackPosition > 0) {
		shuffledTrackPosition--
		return shuffledTrackIndexes[shuffledTrackPosition]
	}

	const previousIndexes = shuffleTrackIndexes(currentIndex.value)
	const previousIndex = previousIndexes[0]!
	shuffledTrackIndexes = [
		previousIndex,
		currentIndex.value,
		...previousIndexes.slice(1).filter(index => index !== currentIndex.value),
	]
	shuffledTrackPosition = 0
	return previousIndex
}

async function play() {
	const audio = audioEl.value
	if (!audio || !currentTrack.value || isUnavailable.value)
		return

	isAudioLoading.value = true
	try {
		await audio.play()
		isPlaying.value = true
		isAudioLoading.value = false
		failedTrackCount.value = 0
	}
	catch (error) {
		isAudioLoading.value = false
		if (error instanceof DOMException && ['AbortError', 'NotAllowedError'].includes(error.name))
			return
		handleTrackError()
	}
}

function pause() {
	audioEl.value?.pause()
	isAudioLoading.value = false
	isPlaying.value = false
}

function togglePlayback() {
	if (isPlaybackActive.value)
		pause()
	else
		void play()
}

async function nextTrack(continuePlaying = isPlaybackActive.value) {
	if (!tracks.value.length)
		return

	if (document.activeElement instanceof HTMLElement)
		document.activeElement.blur()

	await switchTrack(getNextShuffledTrackIndex(), continuePlaying)
}

async function previousTrack(continuePlaying = isPlaybackActive.value) {
	const audio = audioEl.value
	if (!tracks.value.length || !audio)
		return

	if (audio.currentTime > 3) {
		audio.currentTime = 0
		currentTime.value = 0
		updateMediaPositionState()
		return
	}

	await switchTrack(getPreviousShuffledTrackIndex(), continuePlaying)
}

async function switchTrack(index: number | undefined, continuePlaying: boolean) {
	if (index === undefined)
		return

	audioEl.value?.pause()
	isPlaying.value = false
	isAudioLoading.value = continuePlaying
	currentIndex.value = index

	await nextTick()
	applyVolume()
	audioEl.value?.load()
	if (continuePlaying)
		void play()
}

function setupMediaSession() {
	if (!('mediaSession' in navigator) || !('MediaMetadata' in window))
		return

	updateMediaMetadata()
	updateMediaPlaybackState()

	const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
		play: () => void play(),
		pause,
		stop: () => {
			pause()
			seekTo(0)
		},
		nexttrack: () => void nextTrack(),
		previoustrack: () => void previousTrack(),
		seekbackward: details => seekBy(-(details.seekOffset ?? 10)),
		seekforward: details => seekBy(details.seekOffset ?? 10),
		seekto: (details) => {
			if (details.seekTime !== undefined)
				seekTo(details.seekTime, details.fastSeek)
		},
	}

	for (const [action, handler] of Object.entries(handlers)) {
		try {
			navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler)
		}
		catch {
			// 部分浏览器只实现了 Media Session 的一部分操作。
		}
	}
}

function clearMediaSession() {
	if (!('mediaSession' in navigator))
		return

	navigator.mediaSession.metadata = null
	navigator.mediaSession.playbackState = 'none'
}

function updateMediaMetadata(clearPosition = false) {
	const track = currentTrack.value
	if (!track || !('mediaSession' in navigator) || !('MediaMetadata' in window))
		return

	const lockScreenLyric = isPlaying.value ? currentLyric.value?.text : undefined
	navigator.mediaSession.metadata = new MediaMetadata({
		title: lockScreenLyric || track.name,
		artist: lockScreenLyric ? `${track.name} · ${track.artist}` : track.artist,
		album: lockScreenLyric ? appConfig.title : `${appConfig.title} · ${track.name}`,
		artwork: [{ src: track.pic }],
	})

	if (clearPosition) {
		try {
			navigator.mediaSession.setPositionState()
		}
		catch {
			// 旧版浏览器可能不支持清空系统媒体进度。
		}
	}
}

function updateMediaPlaybackState() {
	if (!('mediaSession' in navigator))
		return

	navigator.mediaSession.playbackState = isPlaybackActive.value ? 'playing' : 'paused'
}

function updateMediaPositionState() {
	const audio = audioEl.value
	if (!audio || !('mediaSession' in navigator))
		return

	if (!Number.isFinite(audio.duration) || audio.duration <= 0)
		return

	try {
		navigator.mediaSession.setPositionState({
			duration: audio.duration,
			playbackRate: audio.playbackRate,
			position: Math.min(Math.max(audio.currentTime, 0), audio.duration),
		})
	}
	catch {
		// 音频切换期间 duration 与 currentTime 可能短暂不同步。
	}
}

function seekBy(offset: number) {
	const audio = audioEl.value
	if (!audio)
		return

	seekTo(audio.currentTime + offset)
}

function seekTo(time: number, fastSeek = false) {
	const audio = audioEl.value
	if (!audio || !Number.isFinite(audio.duration))
		return

	const position = Math.min(Math.max(time, 0), audio.duration)
	if (fastSeek && 'fastSeek' in audio)
		audio.fastSeek(position)
	else
		audio.currentTime = position

	currentTime.value = position
	updateMediaPositionState()
}

function handleTrackError() {
	if (!tracks.value.length || isUnavailable.value)
		return

	failedTrackCount.value++
	if (failedTrackCount.value >= tracks.value.length) {
		pause()
		isAudioLoading.value = false
		isUnavailable.value = true
		return
	}

	void nextTrack(true)
}

function updateCurrentTime(event: Event) {
	currentTime.value = (event.currentTarget as HTMLAudioElement).currentTime
	updateMediaPositionState()
}

function handleLoadedMetadata() {
	applyVolume()
	updateMediaPositionState()
}
</script>

<template>
<section
	class="music-player"
	:class="{ playing: isPlaybackActive }"
	:aria-label="playerLabel"
	@mouseenter="isHovered = true"
	@mouseleave="isHovered = false"
>
	<audio
		v-if="currentTrack"
		ref="audio"
		:src="currentTrack.url"
		preload="metadata"
		@canplay="isAudioLoading = false"
		@ended="nextTrack(true)"
		@error="handleTrackError"
		@durationchange="updateMediaPositionState"
		@loadedmetadata="handleLoadedMetadata"
		@loadstart="isAudioLoading = isPlaying"
		@pause="isPlaying = false"
		@playing="isPlaying = true"
		@ratechange="updateMediaPositionState"
		@timeupdate="updateCurrentTime"
	/>

	<div class="cover-wrap">
		<img
			v-if="currentTrack"
			class="cover"
			:src="currentTrack.pic"
			:alt="`${currentTrack.name} 封面`"
			width="40"
			height="40"
			loading="lazy"
			referrerpolicy="no-referrer"
		>
		<Icon v-else :name="isLoading ? 'line-md:loading-loop' : 'tabler:music-off'" />
	</div>

	<div class="display" aria-live="polite">
		<Transition name="display-swap" mode="out-in">
			<div v-if="displayTrackInfo" key="track" class="track-info">
				<strong :title="currentTrack?.name">{{ currentTrack?.name || playerLabel }}</strong>
				<span :title="currentTrack?.artist">{{ currentTrack?.artist || 'Meting' }}</span>
			</div>
			<div v-else key="lyric" class="lyric-window">
				<Transition name="lyric-scroll" mode="out-in">
					<p
						v-if="currentLyric"
						:key="currentLyric.time"
						class="lyric"
						:title="currentLyric.text"
					>
						<template v-if="currentLyric.words.length">
							<span
								v-for="word in currentLyric.words"
								:key="`${word.time}-${word.text}`"
								:class="{ active: word.time <= currentTime }"
							>{{ word.text }}</span>
						</template>
						<template v-else>
							{{ currentLyric.text }}
						</template>
					</p>
				</Transition>
			</div>
		</Transition>
	</div>

	<div class="controls">
		<button
			v-tip="isPlaybackActive ? '暂停' : '播放'"
			class="play-button"
			:aria-label="isPlaybackActive ? '暂停' : '播放'"
			:disabled="!currentTrack || isUnavailable"
			@click="togglePlayback"
		>
			<Icon
				:name="status === 'pending'
					? 'line-md:loading-loop'
					: isPlaybackActive ? 'tabler:player-pause' : 'tabler:player-play'"
			/>
		</button>

		<button
			v-tip="'下一首'"
			aria-label="下一首"
			:disabled="!currentTrack || isUnavailable"
			@click="nextTrack()"
		>
			<Icon name="tabler:player-skip-forward" />
		</button>
	</div>
</section>
</template>

<style scoped>
.music-player {
	display: flex;
	align-items: center;
	gap: 0.55em;
	min-width: 0;
	padding: 0.45em 0.55em;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	background-color: var(--c-bg-2);
	text-align: start;
}

.cover-wrap {
	display: grid;
	flex: 0 0 2.5em;
	place-items: center;
	overflow: hidden;
	aspect-ratio: 1;
	border-radius: 0.65rem;
	background-color: var(--c-bg-soft);
	color: var(--c-text-3);
}

.cover {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.display {
	flex: 1 1 auto;
	overflow: hidden;
	min-width: 0;
	line-height: 1.25;
}

.track-info {
	display: grid;
	min-width: 0;

	> strong, > span {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	> strong {
		font-size: 0.9em;
		color: var(--c-text-1);
	}

	> span {
		font-size: 0.72em;
		color: var(--c-text-3);
	}
}

.lyric-window {
	overflow: hidden;
	max-height: 2.5em;
}

.lyric {
	display: -webkit-box;
	overflow: hidden;
	font-size: 0.8em;
	font-weight: 600;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	line-height: 1.25;
	white-space: normal;
	text-overflow: ellipsis;
	color: var(--c-text-2);
	-webkit-box-orient: vertical;

	> span {
		transition: color 0.15s, opacity 0.15s;

		&:not(.active) {
			opacity: 0.45;
		}

		&.active {
			color: var(--c-primary);
		}
	}
}

.controls {
	display: flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 0.1em;
	overflow: hidden;
	opacity: 1;
	max-width: 5em;
	transition: max-width 0.15s, opacity 0.15s, transform 0.15s;

	button {
		padding: 0.4em;
		border-radius: 50%;
		color: var(--c-text-2);
		transition: color 0.1s, background-color 0.2s, transform 0.1s;

		&:hover:not(:disabled) {
			background-color: var(--c-bg-soft);
			color: var(--c-text-1);
		}

		&:active:not(:disabled) {
			transform: scale(0.9);
		}

		&:disabled {
			opacity: 0.35;
		}
	}
}

.music-player.playing:not(:hover) .controls {
	opacity: 0;
	max-width: 0;
	transform: translateX(0.25em);
	pointer-events: none;
}

.display-swap-enter-active,
.display-swap-leave-active {
	transition: opacity 0.15s, transform 0.15s;
}

.display-swap-enter-from {
	opacity: 0;
	transform: translateY(0.3em);
}

.display-swap-leave-to {
	opacity: 0;
	transform: translateY(-0.3em);
}

.lyric-scroll-enter-active,
.lyric-scroll-leave-active {
	transition: opacity 0.25s, transform 0.25s;
}

.lyric-scroll-enter-from {
	opacity: 0;
	transform: translateY(100%);
}

.lyric-scroll-leave-to {
	opacity: 0;
	transform: translateY(-100%);
}

@media (prefers-reduced-motion: reduce) {
	.controls,
	.display-swap-enter-active,
	.display-swap-leave-active,
	.lyric-scroll-enter-active,
	.lyric-scroll-leave-active {
		transition: none;
	}
}
</style>
