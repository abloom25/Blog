import type { MusicTrack } from '../types/music'

interface MusicPlaylistConfig {
	api: string
	server: string
	type: string
	id: string
}

export function getMusicPlaylistUrl(config: MusicPlaylistConfig): string {
	const endpoint = new URL(config.api)
	if (!['http:', 'https:'].includes(endpoint.protocol))
		throw new Error('音乐 API 地址必须使用 HTTP 或 HTTPS')

	endpoint.searchParams.set('server', config.server)
	endpoint.searchParams.set('type', config.type)
	endpoint.searchParams.set('id', config.id)
	return endpoint.toString()
}

function getTrackText(...values: unknown[]): string | undefined {
	return values.find((value): value is string => typeof value === 'string' && !!value.trim())?.trim()
}

function getTrackUrl(value: unknown, endpoint: URL): string | undefined {
	if (typeof value !== 'string' || !value.trim())
		return undefined

	try {
		const url = new URL(value)
		if (!['http:', 'https:'].includes(url.protocol))
			return undefined

		// 旧 Meting 响应可能错误使用 HTTP；跟随已配置的 API 协议。
		if (endpoint.protocol === 'https:' && url.protocol === 'http:' && url.host === endpoint.host)
			url.protocol = 'https:'
		return url.toString()
	}
	catch {
		return undefined
	}
}

export function parseMusicPlaylist(data: unknown, api: string): MusicTrack[] {
	if (!Array.isArray(data))
		throw new Error('音乐 API 未返回有效歌单')

	const endpoint = new URL(api)
	const tracks = data.flatMap((item): MusicTrack[] => {
		if (!item || typeof item !== 'object' || Array.isArray(item))
			return []

		const entry = item as Record<string, unknown>
		const name = getTrackText(entry.title, entry.name)
		const artist = getTrackText(entry.author, entry.artist)
		const url = getTrackUrl(entry.url, endpoint)
		const pic = getTrackUrl(entry.pic, endpoint)
		const lrc = getTrackUrl(entry.lrc, endpoint)
		if (!name || !artist || !url || !pic || !lrc)
			return []

		return [{ name, artist, url, pic, lrc }]
	})

	if (!tracks.length)
		throw new Error('歌单暂时没有可播放的歌曲')

	return tracks
}
