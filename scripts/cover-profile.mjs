import { Buffer } from 'node:buffer'
import sharp from 'sharp'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const round = value => Math.round(value * 1000) / 1000
const finite = (value, min, max, fallback) => Number.isFinite(value) ? clamp(value, min, max) : fallback
const heroBackground = '#19151E'
function smooth(value) {
	const t = clamp(value, 0, 1)
	return t * t * t * (t * (t * 6 - 15) + 10)
}

export function coverOptions(value = {}) {
	return {
		sample: finite(value.sample, 0.08, 0.32, null),
		transition: finite(value.transition, 0.12, 0.32, null),
		focusX: finite(value.focusX, 0.05, 0.95, 0.5),
		focusY: finite(value.focusY, 0.05, 0.95, 0.5),
	}
}

/** Use one crop for both the clear artwork and its edge extensions. */
export async function frameCover(input, options = coverOptions()) {
	const metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata()
	const ratio = clamp(metadata.width / metadata.height, 1.4, 2.5)
	const width = Math.max(1, Math.min(metadata.width, Math.round(metadata.height * ratio)))
	const height = Math.max(1, Math.min(metadata.height, Math.round(metadata.width / ratio)))
	const left = clamp(Math.round(metadata.width * options.focusX - width / 2), 0, metadata.width - width)
	const top = clamp(Math.round(metadata.height * options.focusY - height / 2), 0, metadata.height - height)
	return sharp(input).extract({ left, top, width, height }).png().toBuffer()
}

export async function analyzeCover(input, options = coverOptions()) {
	const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
		.resize(96, 64, { fit: 'fill' })
		.removeAlpha()
		.toColourspace('srgb')
		.raw()
		.toBuffer({ resolveWithObject: true })
	const columns = Math.round(info.width * 0.32)
	const luminance = (x, y) => {
		const offset = (y * info.width + x) * info.channels
		return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
	}
	let gradient = 0
	let samples = 0
	const rows = []
	for (let y = 0; y < info.height; y++) {
		let sum = 0
		for (let x = 0; x < columns; x++) {
			const light = luminance(x, y)
			sum += light
			if (x) {
				gradient += Math.abs(light - luminance(x - 1, y))
				samples++
			}
			if (y) {
				gradient += Math.abs(light - luminance(x, y - 1))
				samples++
			}
		}
		rows.push(sum / columns)
	}
	const mean = rows.reduce((sum, value) => sum + value, 0) / rows.length
	const deviation = Math.sqrt(rows.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rows.length)
	const texture = clamp(gradient / samples / 25, 0, 1)
	const bands = clamp(deviation / 65, 0, 1)
	const sample = round(options.sample ?? clamp(0.12 + texture * 0.12 + bands * 0.08, 0.12, 0.3))
	const transition = round(options.transition ?? (0.15 + texture * 0.09))
	const fadeEnd = round(Math.min(0.045 + sample * 0.2 + transition, Math.max(0.16, options.focusX - 0.08)))
	return {
		sample,
		fadeStart: round(Math.max(0, fadeEnd - transition)),
		fadeEnd,
		blur: round(14 + bands * 8),
	}
}

/** Homepage's continuous edge stretch with spatially varying blur, at 100px height. */
export async function createCoverExtension(input, profile, { opaque = false } = {}) {
	profile ??= await analyzeCover(input)
	const metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata()
	const height = 100
	const width = Math.max(2, Math.round(metadata.width / metadata.height * height))
	const image = sharp(input).resize(width, height, { fit: 'fill' }).toColourspace('srgb')
	if (opaque)
		image.flatten({ background: heroBackground })
	const source = await image.ensureAlpha().raw().toBuffer()
	const outWidth = width * 2
	const padding = opaque ? 0 : 12
	const outHeight = height + padding * 2
	const plane = Buffer.alloc(outWidth * height * 4)
	const power = (1 + profile.sample) / profile.sample
	for (let x = 0; x < outWidth; x++) {
		const position = (x - width) / (width - 1)
		const mapped = position < profile.sample
			? profile.sample * Math.max(0, (position + 1) / (1 + profile.sample)) ** power
			: position
		const sx = clamp(mapped * (width - 1), 0, width - 1)
		const left = Math.floor(sx)
		const right = Math.min(width - 1, left + 1)
		const mix = sx - left
		for (let y = 0; y < height; y++) {
			for (let channel = 0; channel < 4; channel++) {
				plane[(y * outWidth + x) * 4 + channel] = Math.round(
					source[(y * width + left) * 4 + channel] * (1 - mix) + source[(y * width + right) * 4 + channel] * mix,
				)
			}
		}
	}
	const raw = { width: outWidth, height, channels: 4 }
	const radii = [0, 0.5, 1, 2, 3.5, 6, 10, 16, 24, 32]
	const levels = [plane]
	for (const radius of radii.slice(1))
		levels.push(await sharp(plane, { raw }).blur(radius).raw().toBuffer())
	const result = Buffer.alloc(outWidth * outHeight * 4)
	const sigma = height * 0.04
	const kernel = Array.from({ length: padding * 2 + 1 }, (_, i) => Math.exp(-0.5 * ((i - padding) / sigma) ** 2))
	const weight = kernel.reduce((sum, value) => sum + value, 0)
	const coverage = Array.from({ length: outHeight }, (_, y) => kernel.reduce((sum, value, i) => {
		const sourceY = y + i - padding
		return sum + (sourceY >= padding && sourceY < padding + height ? value : 0)
	}, 0) / weight)
	for (let x = 0; x < outWidth; x++) {
		const position = (x - width) / (width - 1)
		const clearAt = Math.max(profile.fadeEnd, profile.sample + 0.22)
		const radius = profile.blur * 1.3 * (1 - smooth((position + 0.85) / (clearAt + 0.85))) ** 0.65
		let upper = 1
		while (upper < radii.length - 1 && radius > radii[upper]) upper++
		const blend = clamp((radius - radii[upper - 1]) / (radii[upper] - radii[upper - 1]), 0, 1)
		const a = levels[upper - 1]
		const b = levels[upper]
		const horizontal = opaque ? 1 : smooth((position + 1) / 1.05) * smooth((1 - position) / 0.35)
		for (let y = 0; y < outHeight; y++) {
			const at = (y * outWidth + x) * 4
			const from = (clamp(y - padding, 0, height - 1) * outWidth + x) * 4
			const aa = a[from + 3] * (1 - blend)
			const ba = b[from + 3] * blend
			const alpha = aa + ba
			// Premultiplied interpolation prevents dark fringes in translucent pixels.
			for (let channel = 0; channel < 3; channel++)
				result[at + channel] = alpha ? Math.round((a[from + channel] * aa + b[from + channel] * ba) / alpha) : 0
			result[at + 3] = Math.round(alpha * horizontal * coverage[y])
		}
	}
	return sharp(result, { raw: { ...raw, height: outHeight } }).webp({ quality: 88, alphaQuality: 100 }).toBuffer()
}

/** One opaque banner: continuous diffuse pixels on the left, original artwork on the right. */
export async function createCoverHero(input, leftProfile) {
	leftProfile ??= await analyzeCover(input)
	const clear = await sharp(input).resize({ width: 1440, withoutEnlargement: true }).flatten({ background: heroBackground }).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
	const { width, height } = clear.info
	const span = Math.max(0.01, leftProfile.fadeEnd - leftProfile.fadeStart)
	for (let x = 0; x < width; x++) {
		const opacity = smooth((x / Math.max(1, width - 1) - leftProfile.fadeStart) / span)
		for (let y = 0; y < height; y++)
			clear.data[(y * width + x) * 4 + 3] = Math.round(255 * opacity)
	}
	const extension = await createCoverExtension(input, leftProfile, { opaque: true })
	// Both layers share the same crop and scale. No image is mirrored to move the artwork.
	const background = await sharp(extension).resize(width * 2, height, { fit: 'fill' }).png().toBuffer()
	return sharp(background)
		.composite([{ input: clear.data, raw: { width, height, channels: 4 }, left: width, top: 0 }])
		.flatten({ background: heroBackground })
		.webp({ quality: 88 })
		.toBuffer({ resolveWithObject: true })
}

function linearToSrgb(value) {
	const channel = clamp(value, 0, 1)
	return Math.round(255 * (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055))
}

function oklabToLinear(lightness, a, b) {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	]
}

/** Bright, softly colored ambience derived from the artwork, never from the dark hero. */
export async function createAmbientLight(input) {
	const { data, info } = await sharp(input).resize({ width: 480, withoutEnlargement: true }).flatten({ background: '#FFFFFF' }).blur(32).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true })
	const linear = Array.from({ length: 256 }, (_, value) => {
		const channel = value / 255
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
	})
	for (let at = 0; at < data.length; at += 3) {
		const r = linear[data[at]]
		const g = linear[data[at + 1]]
		const b = linear[data[at + 2]]
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
		const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
		const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
		const colorB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
		const chroma = Math.hypot(a, colorB)
		// Near-black or gray artwork becomes clean off-white, not a muddy gray veil.
		const targetLightness = chroma < 0.008 ? 0.97 + lightness * 0.015 : 0.945 + lightness * 0.02
		const scale = chroma ? Math.min(0.65, 0.052 / chroma) : 0
		let rgb = oklabToLinear(targetLightness, a * scale, colorB * scale)
		if (rgb.some(channel => channel < 0 || channel > 1)) {
			// Preserve hue and lightness while fitting pastel colors into the sRGB gamut.
			let low = 0
			let high = scale
			for (let iteration = 0; iteration < 10; iteration++) {
				const candidate = (low + high) / 2
				const channels = oklabToLinear(targetLightness, a * candidate, colorB * candidate)
				if (channels.every(channel => channel >= 0 && channel <= 1))
					low = candidate
				else
					high = candidate
			}
			rgb = oklabToLinear(targetLightness, a * low, colorB * low)
		}
		for (let channel = 0; channel < 3; channel++)
			data[at + channel] = linearToSrgb(rgb[channel])
	}
	return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
		.webp({ quality: 90 })
		.toBuffer({ resolveWithObject: true })
}
