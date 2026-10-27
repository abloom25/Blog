import type { FeedEntry } from './app/types/feed'

const basicConfig = {
	title: '唤青映记',
	subtitle: 'Per aspera ad astra',
	// 长 description 利好于 SEO
	// TODO
	description: '',
	author: {
		name: 'Abloom | 唤青',
		avatar: 'https://avatars.githubusercontent.com/u/161844018?v=4',
		email: 'evereen2023@gmail.com',
		homepage: 'https://blog.abloom.site/',
	},
	copyright: {
		abbr: 'CC BY-NC-SA 4.0',
		name: '署名-非商业性使用-相同方式共享 4.0 国际',
		url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans',
	},
	favicon: '/icon.png',
	language: 'zh-CN',
	timeEstablished: '2024-12-07',
	timeZone: 'Asia/Shanghai',
	url: 'https://blog.abloom.site/',
	defaultCategory: '未分类',
}

// 存储 nuxt.config 和 app.config 共用的配置
// 此处为启动时需要的配置，启动后可变配置位于 app/app.config.ts
// @keep-sorted
const blogConfig = {
	...basicConfig,

	article: {
		categories: {
			[basicConfig.defaultCategory]: { icon: 'tabler:folder-open' },
			/** 编程：代码实现/工程实践/开发方法 */
			Nightlight: { icon: 'tabler:sparkles', color: '#C68C65' },
			开发: { icon: 'tabler:code', color: '#7777ff' },
			唤青映记: { icon: 'tabler:book-2', color: '#3ba' },
		},
		/** 文章版式，首个为默认版式 */
		types: {
			tech: {},
			story: {},
		},
		/** 分类排序方式，键为排序字段，值为显示名称 */
		order: {
			date: '创建日期',
			updated: '更新日期',
			// title: '标题',
		},
		/** 使用 pnpm new 新建文章时自动生成自定义链接（permalink/abbrlink） */
		useRandomPremalink: false,
		/** 隐藏基于文件路由（不是自定义链接）的 URL /post 路径前缀 */
		hidePostPrefix: true,
		/** 禁止搜索引擎收录的路径 */
		robotsNotIndex: ['/preview', '/previews/*'],
	},

	/** 博客 Atom 订阅源 */
	feed: {
		/** 订阅源最大文章数量 */
		limit: 50,
		/** 订阅源是否启用XSLT样式 */
		enableStyle: true,
	},

	/** 左侧栏音乐播放器 */
	music: {
		enabled: true,
		api: 'https://api.music.abloom.site/api',
		server: 'netease',
		type: 'playlist',
		id: '17390341309',
		defaultVolume: 0.6,
	},

	/** 向 <head> 中添加脚本 */
	scripts: [
		// TODO
		// 自己部署的 Umami 统计服务
		{ 'src': 'https://cloud.umami.is/script.js', 'data-website-id': 'edb4a9d1-6dd6-434f-813f-cec3e89338fc', 'defer': true },
		// // 自己网站的 Cloudflare Insights 统计服务
		// { 'src': 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': '{"token": "97a4fe32ed8240ac8284e9bffaf03962"}', 'defer': true },
		// Twikoo 评论系统
		{ src: 'https://s4.zstatic.net/npm/twikoo@1.7.20/dist/twikoo.min.js', defer: true },
	],

	/** 文章统计配置 */
	stats: {
		/**
		 * 统计范围，匹配 content 下不含扩展名的路径（stem）；空数组统计全部内容
		 * 使用 SQL LIKE 语法：% 匹配任意长度字符，_ 匹配单个字符
		 * 多个范围取并集，如 ['posts/%', 'book/%']
		 */
		includePaths: [] as string[],
	},

	/** 自己部署的 Twikoo 服务 */
	twikoo: {
		envId: 'https://twikoo-for-blog-9ch06lvnn-evereens-projects.vercel.app/',
		preload: 'https://twikoo-for-blog-9ch06lvnn-evereens-projects.vercel.app/',
	},
}

/** 用于生成 OPML 和友链页面配置 */
export const myFeed: FeedEntry = {
	author: blogConfig.author.name,
	sitenick: '唤青映记',
	title: blogConfig.title,
	desc: blogConfig.subtitle || blogConfig.description,
	link: blogConfig.url,
	feed: new URL('/atom.xml', blogConfig.url).toString(),
	icon: blogConfig.favicon,
	avatar: blogConfig.author.avatar,
	archs: ['Nuxt', 'Vercel'],
	date: blogConfig.timeEstablished,
	comment: '这是我自己',
}

export default blogConfig
