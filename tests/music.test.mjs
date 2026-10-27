import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getMusicPlaylistUrl, parseMusicPlaylist } from '../shared/utils/music.ts'

const api = 'https://music.example.com/api'
const track = {
	title: ' Song ',
	author: ' Artist ',
	url: 'http://music.example.com/api?type=url&id=1',
	pic: 'https://images.example.com/cover.jpg',
	lrc: 'http://music.example.com/api?type=lrc&id=1',
}

test('builds a playlist URL without losing configured query parameters', () => {
	const url = new URL(getMusicPlaylistUrl({ api: `${api}?quality=high&id=old`, server: 'netease', type: 'playlist', id: '123' }))
	assert.equal(url.searchParams.get('quality'), 'high')
	assert.equal(url.searchParams.get('id'), '123')
	assert.equal(url.searchParams.get('server'), 'netease')
	assert.equal(url.searchParams.get('type'), 'playlist')
	assert.throws(() => getMusicPlaylistUrl({ api: 'file:///music', server: 'netease', type: 'playlist', id: '123' }))
})

test('normalizes Meting fields and upgrades old URLs on the HTTPS API host', () => {
	assert.deepEqual(parseMusicPlaylist([track], api), [{
		name: 'Song',
		artist: 'Artist',
		url: 'https://music.example.com/api?type=url&id=1',
		pic: track.pic,
		lrc: 'https://music.example.com/api?type=lrc&id=1',
	}])
})

test('accepts the existing same-origin endpoint format', () => {
	const normalized = { name: 'Song', artist: 'Artist', url: track.url, pic: track.pic, lrc: track.lrc }
	assert.equal(parseMusicPlaylist([normalized], api)[0].name, 'Song')
	assert.equal(parseMusicPlaylist([{ ...normalized, title: '', author: '' }], api)[0].artist, 'Artist')
})

test('does not rewrite unrelated hosts or deliberately configured HTTP endpoints', () => {
	const other = { ...track, url: 'http://audio.example.com/song.mp3' }
	assert.equal(parseMusicPlaylist([other], api)[0].url, other.url)
	assert.equal(parseMusicPlaylist([track], 'http://music.example.com/api')[0].url, track.url)
})

test('rejects error objects, empty playlists and invalid records instead of caching success', () => {
	for (const value of [{ success: false, error: 'Forbidden' }, null, [], [null], [{ ...track, url: 'javascript:alert(1)' }]])
		assert.throws(() => parseMusicPlaylist(value, api))
	assert.equal(parseMusicPlaylist([null, { ...track, url: 'invalid' }, track], api).length, 1)
})
