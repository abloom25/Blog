import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { access, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { parseDocument } from 'yaml'
import { analyzeCover, coverOptions, createAmbientLight, createCoverExtension, createCoverHero, frameCover } from './cover-profile.mjs'

const recipe = 'homepage-edges-v4-light-ambience'
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16)
const running = new Map()
const exists = path => access(path).then(() => true, () => false)
const warn = message => console.warn(`[cover-media] ${message}`)

function containedPath(root, path) {
	const target = resolve(root, path)
	const segment = relative(root, target)
	if (segment === '..' || segment.startsWith(`..${sep}`) || isAbsolute(segment))
		throw new Error('Image path leaves its asset directory')
	return target
}

async function readJson(path, fallback) {
	try {
		return JSON.parse(await readFile(path, 'utf8'))
	}
	catch {
		return fallback
	}
}

async function writeChanged(path, value) {
	const buffer = typeof value === 'string' ? Buffer.from(value) : value
	try {
		if ((await readFile(path)).equals(buffer))
			return
	}
	catch {}
	await mkdir(dirname(path), { recursive: true })
	const temporary = `${path}.${process.pid}.tmp`
	await writeFile(temporary, buffer)
	await rename(temporary, path)
}

async function markdownFiles(directory) {
	const files = []
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name)
		if (entry.isDirectory())
			files.push(...await markdownFiles(path))
		else if (entry.isFile() && entry.name.endsWith('.md'))
			files.push(path)
	}
	return files.sort()
}

async function discoverCovers(root) {
	const sources = new Map()
	for (const file of await markdownFiles(join(root, 'content'))) {
		const markdown = await readFile(file, 'utf8')
		const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(markdown)?.[1]
		if (!frontmatter)
			continue
		try {
			const document = parseDocument(frontmatter)
			if (document.errors.length)
				throw document.errors[0]
			const metadata = document.toJS({ maxAliasCount: 50 })
			if (typeof metadata?.image === 'string' && metadata.image.trim())
				sources.set(metadata.image, file)
		}
		catch (error) {
			warn(`Skipped frontmatter in ${relative(root, file)}: ${error.message}`)
		}
	}
	return [...sources].sort(([a], [b]) => a.localeCompare(b))
}

async function fetchImage(source) {
	let target = new URL(source)
	const signal = AbortSignal.timeout(8000)
	for (let redirects = 0; redirects < 5; redirects++) {
		if (target.protocol !== 'https:' || target.username || target.password)
			throw new Error('Only HTTPS image URLs without credentials are supported')
		const response = await fetch(target, { redirect: 'manual', signal })
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get('location')
			await response.body?.cancel()
			if (!location)
				throw new Error('Image redirect has no destination')
			target = new URL(location, target)
			continue
		}
		if (!response.ok) {
			await response.body?.cancel()
			throw new Error(`HTTP ${response.status}`)
		}
		const maxBytes = 12 * 1024 * 1024
		if (Number(response.headers.get('content-length')) > maxBytes) {
			await response.body?.cancel()
			throw new Error('Image exceeds 12 MiB')
		}
		if (!response.body)
			throw new Error('Image response is empty')
		const reader = response.body.getReader()
		const chunks = []
		let size = 0
		try {
			for (;;) {
				const { done, value } = await reader.read()
				if (done)
					break
				size += value.length
				if (size > maxBytes)
					throw new Error('Image exceeds 12 MiB')
				chunks.push(value)
			}
		}
		finally {
			await reader.cancel().catch(() => {})
		}
		return Buffer.concat(chunks)
	}
	throw new Error('Too many image redirects')
}

/** Optional one-time bootstrap; normal dev/build never reads another project. */
async function seedImage(source, seedDirectory) {
	if (!seedDirectory)
		return null
	const manifest = await readJson(join(seedDirectory, 'data/media.json'), { images: {} })
	const entry = Object.entries(manifest.images).find(([key, value]) => value.kind === 'cover' && (key === source || key.startsWith(`${source}#profile=`)))?.[1]
	if (!entry)
		return null
	const options = coverOptions({ focusX: entry.profile?.focusX, focusY: entry.profile?.focusY })
	try {
		return { input: await readFile(join(seedDirectory, '.cache/media', `${hash(source)}.bin`)), options }
	}
	catch {
		const best = entry.variants?.toSorted((a, b) => b.width - a.width)[0]?.src ?? entry.src
		if (typeof best !== 'string' || !best.startsWith('/assets/'))
			return null
		return { input: await readFile(containedPath(seedDirectory, best.slice(1))), options }
	}
}

async function cachedAssetsExist(root, entry) {
	if (!entry || ![entry.src, entry.left, entry.right, entry.hero, entry.ambientLight].every(path => typeof path === 'string' && path.startsWith('/assets/covers/')))
		return false
	return (await Promise.all([entry.src, entry.left, entry.right, entry.hero, entry.ambientLight].map(path => exists(containedPath(join(root, 'public'), path.slice(1)))))).every(Boolean)
}

async function generate(root, { seedDirectory, force = false } = {}) {
	const outputDirectory = join(root, 'public/assets/covers')
	const indexPath = join(outputDirectory, 'index.json')
	const oldIndex = await readJson(indexPath, { entries: {} })
	const previous = await readJson(join(root, 'app/assets/cover-media.json'), {})
	const index = { recipe, entries: {} }
	const manifest = {}
	const sources = await discoverCovers(root)
	for (const [source, markdown] of sources) {
		const cached = oldIndex.entries[source]
		const previousEntry = previous[source]
		try {
			const remote = /^https?:\/\//.test(source)
			const localPath = remote
				? null
				: source.startsWith('/')
					? containedPath(join(root, 'public'), source.slice(1))
					: containedPath(root, relative(root, resolve(dirname(markdown), source)))
			const localStat = localPath ? await stat(localPath) : null
			const stamp = localStat ? `${localStat.size}:${localStat.mtimeMs}` : source
			const validPrevious = await cachedAssetsExist(root, previousEntry)
			if (!force && cached?.stamp === stamp && cached.recipe === recipe && validPrevious) {
				index.entries[source] = cached
				manifest[source] = previousEntry
				continue
			}
			if (!force && cached?.retryAfter > Date.now()) {
				index.entries[source] = cached
				if (validPrevious)
					manifest[source] = previousEntry
				continue
			}
			let input
			let options = coverOptions({ focusX: cached?.options?.focusX, focusY: cached?.options?.focusY })
			const sourceName = `source-${hash(source)}.webp`
			const sourcePath = join(outputDirectory, sourceName)
			if (remote && !force && await exists(sourcePath)) {
				input = await readFile(sourcePath)
			}
			else {
				const seed = remote && !force ? await seedImage(source, seedDirectory).catch(() => null) : null
				if (seed) {
					input = seed.input
					options = seed.options
				}
				else {
					input = remote ? await fetchImage(source) : await readFile(localPath)
				}
				// A portable local source lets later recipe upgrades work without the external origin.
				input = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 94, alphaQuality: 100 }).toBuffer()
				await writeChanged(sourcePath, input)
			}
			const framed = await frameCover(input, options)
			const clear = await sharp(framed).resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toBuffer({ resolveWithObject: true })
			const leftProfile = await analyzeCover(framed, options)
			const flipped = await sharp(framed).flop().png().toBuffer()
			const rightProfile = await analyzeCover(flipped, { ...options, focusX: 1 - options.focusX })
			const left = await createCoverExtension(framed, leftProfile)
			// Restore orientation after sampling the opposite edge; subjects are never mirrored.
			const right = await sharp(await createCoverExtension(flipped, rightProfile)).flop().webp({ quality: 88, alphaQuality: 100 }).toBuffer()
			const hero = await createCoverHero(framed, leftProfile)
			const ambientLight = await createAmbientLight(framed)
			const name = hash(Buffer.concat([Buffer.from(`${recipe}:${JSON.stringify(options)}:`), input]))
			const paths = { src: `${name}-clear.webp`, left: `${name}-left.webp`, right: `${name}-right.webp`, hero: `${name}-hero.webp`, ambientLight: `${name}-ambient-light.webp` }
			await Promise.all(Object.entries({ src: clear.data, left, right, hero: hero.data, ambientLight: ambientLight.data }).map(([key, data]) => writeChanged(join(outputDirectory, paths[key]), data)))
			manifest[source] = {
				src: `/assets/covers/${paths.src}`,
				left: `/assets/covers/${paths.left}`,
				right: `/assets/covers/${paths.right}`,
				hero: `/assets/covers/${paths.hero}`,
				ambientLight: `/assets/covers/${paths.ambientLight}`,
				width: clear.info.width,
				height: clear.info.height,
				heroWidth: hero.info.width,
				heroHeight: hero.info.height,
				ambientLightWidth: ambientLight.info.width,
				ambientLightHeight: ambientLight.info.height,
				fadeStart: leftProfile.fadeStart,
				fadeEnd: leftProfile.fadeEnd,
				rightFadeStart: rightProfile.fadeStart,
				rightFadeEnd: rightProfile.fadeEnd,
			}
			index.entries[source] = { recipe, stamp, options, source: sourceName }
		}
		catch (error) {
			warn(`Could not prepare ${source}: ${error.message}. The original cover remains available.`)
			index.entries[source] = { ...cached, retryAfter: Date.now() + 10 * 60 * 1000 }
			if (await cachedAssetsExist(root, previousEntry))
				manifest[source] = previousEntry
		}
	}
	await writeChanged(indexPath, JSON.stringify(index, null, 2))
	await writeChanged(join(root, 'app/assets/cover-media.json'), JSON.stringify(manifest, null, 2))
	return manifest
}

export function prepareCoverMedia({ root = projectRoot, seedDirectory, force = false } = {}) {
	const directory = resolve(root)
	if (!running.has(directory)) {
		const task = generate(directory, { seedDirectory, force }).finally(() => running.delete(directory))
		running.set(directory, task)
	}
	return running.get(directory)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const seedIndex = process.argv.indexOf('--seed')
	const manifest = await prepareCoverMedia({
		seedDirectory: seedIndex >= 0 ? resolve(process.argv[seedIndex + 1]) : undefined,
		force: process.argv.includes('--force'),
	})
	console.info(`[cover-media] ${Object.keys(manifest).length} covers ready`)
}
