import type { MusicTrack } from '~~/shared/types/music'
import blogConfig from '~~/blog.config'
import { getMusicPlaylistUrl, parseMusicPlaylist } from '~~/shared/utils/music'

export default defineEventHandler(async (event): Promise<MusicTrack[]> => {
	setResponseHeader(event, 'Cache-Control', 'no-store')
	if (!blogConfig.music.enabled)
		return []

	try {
		const data = await $fetch<unknown>(getMusicPlaylistUrl(blogConfig.music), {
			// 本地开发请求同源接口时，用博客自身的来源访问受来源限制的 API。
			headers: { Referer: blogConfig.url },
			timeout: 10_000,
			retry: 1,
		})
		return parseMusicPlaylist(data, blogConfig.music.api)
	}
	catch (error) {
		console.warn('[music] 无法获取 Meting 歌单', error)
		throw createError({ statusCode: 502, statusMessage: 'Music playlist is unavailable' })
	}
})
