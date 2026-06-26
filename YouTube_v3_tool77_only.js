// @name YouTube
// @author OmniBox (tool77 Only)
// @description YouTube影视源，支持分组分类、二级筛选、搜索、播放列表，视频流通过 tool77.com 解析
// @dependencies: axios
// @version 3.0.0
// @changelog 仅使用 tool77.com 解析视频流 / 移除 InnerTube player 直链 / 保留搜索/分类优化

const axios = require("axios");
const OmniBox = require("omnibox_sdk");

// ==================== 配置层 ====================

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlS7RnOL8o9T-2pA0w8gNqQYAAA";
const INNERTUBE_CLIENT_VERSION = "2.20241201.00.00";

// tool77.com 第三方下载服务（来自油猴脚本）
const TOOL77_BASE = "https://www.tool77.com";
const TOOL77_LANG = "zh-CN";
const TOOL77_DOWNLOAD_PATH = "/v/downloader";

const CLIENT_WEB = {
    client: {
        clientName: "WEB",
        clientVersion: INNERTUBE_CLIENT_VERSION,
        hl: "zh-CN",
        gl: "CN",
    },
};

const DEFAULT_GL = process.env.YTB_GL || "CN";
const DEFAULT_HL = process.env.YTB_HL || "zh-CN";

const http = axios.create({
    timeout: 30000,
    headers: { "User-Agent": UA },
});

async function httpWithRetry(config, maxRetries = 2) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await http(config);
        } catch (err) {
            lastError = err;
            if (i < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
    throw lastError;
}

async function postInnerTube(endpoint, payload) {
    const body = { context: CLIENT_WEB, ...payload };
    const resp = await axios.post(
        `https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_API_KEY}`,
        body,
        {
            headers: {
                "User-Agent": UA,
                "Content-Type": "application/json",
                "Origin": "https://www.youtube.com",
                "Referer": "https://www.youtube.com/",
            },
            timeout: 30000,
        }
    );
    return resp.data;
}

// ==================== 日志 ====================

function logInfo(msg, data) {
    OmniBox.log("info", `[YouTube] ${msg}${data ? `: ${JSON.stringify(data)}` : ""}`);
}
function logError(msg, err) {
    OmniBox.log("error", `[YouTube] ${msg}: ${err?.message || err}`);
}

// ==================== 分类体系 ====================

const defaultGroups = [
    { id: "group_drama", name: "电视剧", order: 1 },
    { id: "group_movie", name: "电影", order: 2 },
    { id: "group_variety", name: "综艺", order: 3 },
    { id: "group_anime", name: "动漫", order: 4 },
    { id: "group_doc", name: "纪录片", order: 5 },
    { id: "group_music", name: "音乐", order: 6 },
    { id: "group_short", name: "短剧", order: 7 },
];

const defaultCategories = [
    { id: "cat_cdrama", name: "中国电视", groupId: "group_drama", query: "中剧独播", type: "search", order: 1, playlistOnly: true },
    { id: "cat_movie", name: "中国电影", groupId: "group_movie", query: "最新电影", type: "search", order: 1, playlistOnly: false },
    { id: "cat_variety", name: "中国综艺", groupId: "group_variety", query: "喜剧综艺", type: "search", order: 1, playlistOnly: true },
    { id: "cat_anime", name: "中国动漫", groupId: "group_anime", query: "中国动漫", type: "search", order: 1, playlistOnly: true },
    { id: "cat_doc", name: "中国纪录", groupId: "group_doc", query: "中国纪录", type: "search", order: 1, playlistOnly: true },
    { id: "cat_music", name: "中国音乐", groupId: "group_music", query: "华语音乐", type: "search", order: 1, playlistOnly: false },
    { id: "cat_short", name: "中国短剧", groupId: "group_short", query: "中国短剧", type: "search", order: 1, playlistOnly: true },
];

const defaultFilters = [
    { id: "filter_action", name: "动作片", categoryId: "cat_movie", query: "动作电影", order: 1, playlistOnly: false },
    { id: "filter_scifi", name: "科幻片", categoryId: "cat_movie", query: "科幻电影", order: 2, playlistOnly: false },
    { id: "filter_romance", name: "爱情片", categoryId: "cat_movie", query: "爱情电影", order: 3, playlistOnly: false },
    { id: "filter_comedy", name: "喜剧片", categoryId: "cat_movie", query: "喜剧电影", order: 4, playlistOnly: false },
    { id: "filter_horror", name: "恐怖片", categoryId: "cat_movie", query: "恐怖电影", order: 5, playlistOnly: false },
    { id: "filter_thriller", name: "悬疑片", categoryId: "cat_movie", query: "悬疑电影", order: 6, playlistOnly: false },
    { id: "filter_cdrama_tencent", name: "腾讯【剧】", categoryId: "cat_cdrama", query: "腾讯电视剧", order: 1, playlistOnly: true },
    { id: "filter_cdrama_mgtv", name: "芒果【剧】", categoryId: "cat_cdrama", query: "芒果电视剧", order: 2, playlistOnly: true },
    { id: "filter_cdrama_iqiyi", name: "奇艺【剧】", categoryId: "cat_cdrama", query: "爱奇艺电视剧", order: 3, playlistOnly: true },
    { id: "filter_cdrama_youku", name: "优酷【剧】", categoryId: "cat_cdrama", query: "优酷电视剧", order: 4, playlistOnly: true },
    { id: "filter_cdrama_new", name: "华策【剧】", categoryId: "cat_cdrama", query: "华策影视官方频道", order: 5, playlistOnly: true },
    { id: "filter_doc_cctv", name: "CCTV纪录【记录】", categoryId: "cat_doc", query: "CCTV纪录", order: 1, playlistOnly: true },
    { id: "filter_doc_natgeo", name: "国家地理【记录】", categoryId: "cat_doc", query: "国家地理", order: 2, playlistOnly: true },
    { id: "filter_variety_tencent", name: "腾讯【综艺】", categoryId: "cat_variety", query: "腾讯综艺", order: 1, playlistOnly: true },
    { id: "filter_variety_mgtv", name: "芒果【综艺】", categoryId: "cat_variety", query: "芒果综艺", order: 2, playlistOnly: true },
    { id: "filter_variety_iqiyi", name: "奇艺【综艺】", categoryId: "cat_variety", query: "爱奇艺综艺", order: 3, playlistOnly: true },
    { id: "filter_variety_youku", name: "优酷【综艺】", categoryId: "cat_variety", query: "优酷综艺", order: 4, playlistOnly: true },
];

// ==================== 工具函数 ====================

function extractInitialData(html) {
    const match = html.match(/var ytInitialData = ({.+?});</s);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (e) {
        logError("解析 ytInitialData 失败", e);
        return null;
    }
}

// Token缓存
const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedToken(cacheKey) {
    const entry = tokenCache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.token;
    }
    tokenCache.delete(cacheKey);
    return null;
}

function setCachedToken(cacheKey, token) {
    tokenCache.set(cacheKey, { token, timestamp: Date.now() });
}

// ==================== 搜索核心 ====================

function parseSearchItems(items, options = {}) {
    const { includePlaylists = true, playlistOnly = false } = options;
    const results = [];
    let nextPageToken = "";

    const walk = (obj) => {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
            obj.forEach(walk);
            return;
        }

        if (!playlistOnly && obj.videoRenderer) {
            const v = obj.videoRenderer;
            results.push({
                vod_id: v.videoId,
                vod_name: v.title?.runs?.[0]?.text || "Unknown",
                vod_pic: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "",
                vod_remarks: v.lengthText?.simpleText || "",
            });
        }

        if (includePlaylists && (obj.playlistRenderer || (obj.lockupViewModel && obj.lockupViewModel.contentType === "LOCKUP_CONTENT_TYPE_PLAYLIST"))) {
            const pId = obj.playlistRenderer?.playlistId || obj.lockupViewModel?.contentId;
            const title = obj.playlistRenderer?.title?.simpleText || obj.lockupViewModel?.metadata?.lockupMetadataViewModel?.title?.content || "Unknown";
            if (pId) {
                results.push({
                    vod_id: pId,
                    vod_name: title,
                    vod_pic: obj.playlistRenderer?.thumbnails?.[0]?.thumbnails?.[0]?.url || obj.lockupViewModel?.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources?.[0]?.url || "",
                    vod_remarks: "播放列表",
                });
            }
        }

        if (obj.continuationItemRenderer) {
            nextPageToken = obj.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token || nextPageToken;
        }

        for (let k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                walk(obj[k]);
            }
        }
    };

    if (Array.isArray(items)) {
        items.forEach(walk);
    } else {
        walk(items);
    }

    return { results, nextPageToken };
}

async function searchVideos(query, page = 1, options = {}) {
    const {
        includePlaylists = true,
        filterSp = "",
        playlistOnly = false,
        gl = DEFAULT_GL,
        hl = DEFAULT_HL,
    } = options;

    const isTokenPage = typeof page === "string" && page.length > 20;
    const isNumericPage = (p) => {
        const n = Number(p);
        return Number.isInteger(n) && n >= 1;
    };

    try {
        if (isTokenPage) {
            logInfo("搜索(续页Token)", { query, token: page.substring(0, 20) + "..." });
            const resp = await postInnerTube("search", { continuation: page });
            const contItems = resp.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems;
            const { results, nextPageToken } = parseSearchItems(contItems, { includePlaylists, playlistOnly });
            return { list: results, token: nextPageToken };
        }

        const pageNum = isNumericPage(page) ? Number(page) : 1;

        let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=${gl}&hl=${hl}`;
        if (playlistOnly) {
            url += "&sp=EgIQAw%253D%253D";
        } else if (filterSp) {
            url += `&sp=${filterSp}`;
        }

        const cacheKey = `${query}_${gl}_${hl}_${playlistOnly}_${filterSp}`;

        if (pageNum === 1) {
            logInfo("搜索请求(第1页)", { url, gl, hl });
            const response = await httpWithRetry({ method: "get", url });
            const data = extractInitialData(response.data);
            if (!data) return { list: [], token: "" };

            const items = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
            const { results, nextPageToken } = parseSearchItems(items, { includePlaylists, playlistOnly });

            if (nextPageToken) {
                setCachedToken(cacheKey, nextPageToken);
            }

            logInfo("搜索完成", { query, count: results.length, hasToken: !!nextPageToken });
            return { list: results, token: nextPageToken };
        }

        let currentToken = getCachedToken(cacheKey);
        if (!currentToken) {
            logInfo("Token缓存未命中，获取第1页", { query });
            const response = await httpWithRetry({ method: "get", url });
            const data = extractInitialData(response.data);
            if (!data) return { list: [], token: "" };

            const items = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
            const { results: firstResults, nextPageToken } = parseSearchItems(items, { includePlaylists, playlistOnly });
            if (nextPageToken) {
                setCachedToken(cacheKey, nextPageToken);
                currentToken = nextPageToken;
            }
            if (pageNum === 1) {
                return { list: firstResults, token: nextPageToken };
            }
        }

        let results = [];
        let token = currentToken;
        for (let i = 2; i <= pageNum && token; i++) {
            const resp = await postInnerTube("search", { continuation: token });
            const contItems = resp.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems;
            const parsed = parseSearchItems(contItems, { includePlaylists, playlistOnly });
            results = parsed.results;
            token = parsed.nextPageToken;
            if (token) {
                setCachedToken(cacheKey, token);
            }
        }

        logInfo("搜索完成(翻页)", { query, page: pageNum, count: results.length });
        return { list: results, token };
    } catch (error) {
        logError("搜索请求失败", error);
        return { list: [], token: "" };
    }
}

// ==================== 播放列表解析 ====================

function parsePlaylistVideos(initialData) {
    const episodes = [];
    if (!initialData) return { episodes: [], token: "" };

    const playlistContents =
        initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents ||
        initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
        [];

    let continuationToken = "";

    for (const item of playlistContents) {
        const renderer = item.playlistVideoRenderer || item.richItemRenderer?.content?.videoRenderer;
        if (renderer) {
            const videoId = renderer.videoId;
            if (videoId) {
                const name = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || `第${episodes.length + 1}集`;
                const lengthText = renderer.lengthText?.simpleText || renderer.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || "";
                episodes.push({
                    name: lengthText ? `${name} [${lengthText}]` : name,
                    playId: `https://www.youtube.com/watch?v=${videoId}`,
                });
            }
        }

        const token = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        if (token) continuationToken = token;
    }

    return { episodes, token: continuationToken };
}

async function fetchPlaylistEpisodes(playlistId, maxCount = 200) {
    try {
        const url = `https://www.youtube.com/playlist?list=${playlistId}`;
        const response = await httpWithRetry({ method: "get", url });
        const data = extractInitialData(response.data);
        const { episodes, token } = parsePlaylistVideos(data);

        if (token && episodes.length < maxCount) {
            const moreEpisodes = await fetchPlaylistContinuation(token, maxCount - episodes.length);
            episodes.push(...moreEpisodes);
        }

        return episodes;
    } catch (e) {
        logError("获取播放列表集数失败", e);
        return [];
    }
}

async function fetchPlaylistContinuation(token, maxCount) {
    const episodes = [];
    let currentToken = token;

    while (currentToken && episodes.length < maxCount) {
        try {
            const resp = await postInnerTube("browse", { continuation: currentToken });
            const contItems = resp.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];

            let nextToken = "";
            for (const item of contItems) {
                const renderer = item.playlistVideoRenderer || item.richItemRenderer?.content?.videoRenderer;
                if (renderer && renderer.videoId) {
                    const name = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || `第${episodes.length + 1}集`;
                    const lengthText = renderer.lengthText?.simpleText || renderer.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || "";
                    episodes.push({
                        name: lengthText ? `${name} [${lengthText}]` : name,
                        playId: `https://www.youtube.com/watch?v=${renderer.videoId}`,
                    });
                    if (episodes.length >= maxCount) break;
                }

                const t = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
                if (t) nextToken = t;
            }
            currentToken = nextToken;
        } catch (e) {
            logError("获取播放列表续页失败", e);
            break;
        }
    }

    return episodes;
}

// ==================== 视频流解析 (仅 tool77.com) ====================

// 对应油猴脚本 CommonUtils.downloaderEvent (第249-252行)
// const durl = "https://www.tool77.com/" + CommonUtils.getSupportedLang() + "/v/downloader?url=" + encodeURIComponent(url);
async function fetchVideoStreams(videoId) {
    try {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const tool77Url = `${TOOL77_BASE}/${TOOL77_LANG}${TOOL77_DOWNLOAD_PATH}?url=${encodeURIComponent(watchUrl)}`;

        logInfo("tool77.com解析请求", { videoId, tool77Url: tool77Url.substring(0, 80) + "..." });

        // 返回 tool77.com 下载页面 URL
        return [{
            name: "tool77下载 [HD]",
            url: tool77Url,
            quality: "HD",
        }];
    } catch (e) {
        logError("tool77.com解析失败", e);
        return [];
    }
}

// ==================== OmniBox 接口层 ====================

async function home(params = {}) {
    const groups = defaultGroups;
    const categories = defaultCategories;
    const filters = defaultFilters;

    const sortedGroups = [...groups].sort((a, b) => a.order - b.order);
    const classList = [];
    for (const group of sortedGroups) {
        const groupCats = categories.filter(c => c.groupId === group.id).sort((a, b) => a.order - b.order);
        groupCats.forEach(cat => {
            classList.push({ type_id: cat.id, type_name: cat.name });
        });
    }

    const filtersObj = {};
    categories.forEach(cat => {
        const catFilters = filters.filter(f => f.categoryId === cat.id).sort((a, b) => a.order - b.order);
        if (catFilters.length > 0) {
            const values = [{ name: "全部", value: "" }, ...catFilters.map(f => ({ name: f.name, value: f.id }))];
            filtersObj[cat.id] = [{
                key: "filter",
                name: "筛选",
                init: "",
                value: values,
            }];
        }
    });

    let list = [];
    try {
        const res = await searchVideos(defaultCategories[0].query, 1, {
            includePlaylists: true,
            playlistOnly: defaultCategories[0].playlistOnly,
            gl: DEFAULT_GL,
            hl: DEFAULT_HL,
        });
        list = res.list.slice(0, 20);
    } catch (e) {
        logError("首页推荐获取失败", e);
    }

    return { class: classList, filters: filtersObj, list };
}

async function category(params = {}) {
    const categoryId = params.categoryId || params.type_id || "";
    const page = params.page || "1";

    const filters = params.filters || params.extend || {};
    const filterValue = filters.filter || params.filter || "";
    const sp = filters.sp || params.sp || "";
    const gl = filters.gl || params.gl || DEFAULT_GL;
    const hl = filters.hl || params.hl || DEFAULT_HL;

    logInfo("分类加载", { categoryId, page, filter: filterValue, sp, gl, hl });

    const category = defaultCategories.find(c => c.id === categoryId);
    if (!category) return { list: [], page: 1, pagecount: 1, limit: 20, total: 0 };

    let query = category.query;
    let playlistOnly = category.playlistOnly || false;

    if (filterValue && filterValue !== "") {
        const selectedFilter = defaultFilters.find(f => f.id === filterValue && f.categoryId === categoryId);
        if (selectedFilter) {
            query = selectedFilter.query || filterValue;
            playlistOnly = selectedFilter.playlistOnly || false;
        } else {
            query = filterValue;
        }
    }

    const res = await searchVideos(query, page, {
        includePlaylists: true,
        filterSp: sp || "",
        playlistOnly,
        gl,
        hl,
    });

    const pageNum = typeof page === "string" && page.length > 20 ? 1 : Number(page) || 1;

    return {
        list: res.list,
        page: pageNum,
        pagecount: res.token ? 999 : pageNum,
        limit: 20,
        total: res.list.length,
    };
}

async function detail(params = {}) {
    const videoId = params.videoId || params.vod_id || "";
    if (!videoId) return { list: [] };

    logInfo("详情加载", { videoId });

    const isPlaylist = videoId.startsWith("PL") || videoId.startsWith("VL") || videoId.startsWith("OLAK") || videoId.startsWith("RD");
    let title = isPlaylist ? "YouTube播放列表" : "YouTube视频";
    let thumb = isPlaylist ? "" : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    let desc = "";
    let episodeCount = 0;

    if (isPlaylist) {
        try {
            const url = `https://www.youtube.com/playlist?list=${videoId}`;
            const response = await httpWithRetry({ method: "get", url });
            const data = extractInitialData(response.data);
            if (data?.metadata?.playlistMetadataRenderer) {
                title = data.metadata.playlistMetadataRenderer.title || title;
            }
            const headerRenderer = data?.header?.playlistHeaderRenderer;
            if (headerRenderer) {
                desc = headerRenderer.descriptionText?.simpleText || headerRenderer.secondSubtitle?.simpleText || "";
                thumb = headerRenderer.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || thumb;
            }
        } catch (e) {
            logError("获取播放列表详情失败", e);
        }
    } else {
        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await httpWithRetry({ method: "get", url });
            const data = extractInitialData(response.data);
            if (data?.contents?.twoColumnWatchNextResults?.results?.results?.contents) {
                const contents = data.contents.twoColumnWatchNextResults.results.results.contents;
                for (const item of contents) {
                    if (item.videoPrimaryInfoRenderer) {
                        title = item.videoPrimaryInfoRenderer.title?.runs?.[0]?.text || title;
                    }
                    if (item.videoSecondaryInfoRenderer) {
                        desc = item.videoSecondaryInfoRenderer.description?.bodyText?.simpleText ||
                               item.videoSecondaryInfoRenderer.attributedDescriptionBodyText?.content || "";
                    }
                }
            }
        } catch (e) {
            logError("获取视频详情失败", e);
        }
    }

    let playSources = [];
    if (isPlaylist) {
        const episodes = await fetchPlaylistEpisodes(videoId);
        episodeCount = episodes.length;
        playSources = [{
            name: "YouTube",
            episodes: episodes.length > 0 ? episodes : [{ name: "播放列表", playId: `https://www.youtube.com/playlist?list=${videoId}` }],
        }];
    } else {
        const playUrl = `https://www.youtube.com/watch?v=${videoId}`;
        playSources = [{
            name: "YouTube",
            episodes: [{ name: "播放", playId: playUrl }],
        }];
    }

    return {
        list: [{
            vod_id: videoId,
            vod_name: title,
            vod_pic: thumb,
            vod_remarks: isPlaylist ? (episodeCount > 0 ? `共${episodeCount}集` : "播放列表") : "视频",
            vod_content: desc,
            vod_play_sources: playSources,
        }],
    };
}

async function search(params = {}) {
    const keyword = params.keyword || params.wd || "";
    const page = params.page || "1";

    const filters = params.filters || params.extend || {};
    const filterValue = filters.filter || params.filter || "";
    const sp = filters.sp || params.sp || "";
    const gl = filters.gl || params.gl || DEFAULT_GL;
    const hl = filters.hl || params.hl || DEFAULT_HL;

    logInfo("搜索开始", { keyword, page, filter: filterValue, sp, gl, hl });

    let query = keyword;
    let playlistOnly = false;
    if (filterValue && filterValue !== "") {
        const selectedFilter = defaultFilters.find(f => f.id === filterValue);
        if (selectedFilter) {
            query = selectedFilter.query || filterValue;
            playlistOnly = selectedFilter.playlistOnly || false;
        } else {
            query = filterValue;
        }
    }

    const res = await searchVideos(query, page, {
        includePlaylists: true,
        filterSp: sp || "",
        playlistOnly,
        gl,
        hl,
    });

    const pageNum = typeof page === "string" && page.length > 20 ? 1 : Number(page) || 1;

    logInfo("搜索结果", { count: res.list.length, hasToken: !!res.token });

    return {
        list: res.list,
        page: pageNum,
        pagecount: res.token ? 999 : pageNum,
        limit: 20,
        total: res.list.length,
    };
}

// 播放解析: 仅 tool77.com
async function play(params = {}) {
    const playId = params.playId || params.id || "";
    const flag = params.flag || "";

    if (!playId) return { urls: [], parse: 1, flag };

    logInfo("播放解析", { playId });

    let vid = playId;

    // 处理URL格式
    if (vid.startsWith("http")) {
        if (vid.includes("/playlist?list=")) {
            return {
                urls: [{ name: "YouTube播放列表", url: vid }],
                parse: 0,
                header: { "User-Agent": UA },
                flag,
            };
        }

        const urlMatch = vid.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (urlMatch && urlMatch[1]) {
            vid = urlMatch[1];
        } else {
            return {
                urls: [{ name: "播放", url: vid }],
                parse: 0,
                header: { "User-Agent": UA },
                flag,
            };
        }
    }

    // 播放列表ID
    if (vid.startsWith("PL") || vid.startsWith("VL") || vid.startsWith("OLAK") || vid.startsWith("RD")) {
        const url = `https://www.youtube.com/playlist?list=${vid}`;
        return {
            urls: [{ name: "YouTube播放列表", url }],
            parse: 0,
            header: { "User-Agent": UA },
            flag,
        };
    }

    // 非法视频ID
    if (!/^[a-zA-Z0-9_-]{11}$/.test(vid)) {
        return {
            urls: [{ name: "播放", url: vid }],
            parse: 0,
            header: { "User-Agent": UA },
            flag,
        };
    }

    // 仅使用 tool77.com 解析
    try {
        const streams = await fetchVideoStreams(vid);
        if (streams.length > 0) {
            const urls = streams.map(s => ({ name: s.name, url: s.url }));
            logInfo("tool77.com解析成功", { videoId: vid, url: urls[0]?.url.substring(0, 80) + "..." });
            return {
                urls,
                parse: 1, // tool77.com 返回网页，需要解析器处理
                header: { "User-Agent": UA },
                flag,
            };
        }
    } catch (e) {
        logError("tool77.com解析失败", e);
    }

    // 回退: watch URL
    const watchUrl = `https://www.youtube.com/watch?v=${vid}`;
    logInfo("回退watch URL", { vid });
    return {
        urls: [{ name: "YouTube", url: watchUrl }],
        parse: 0,
        header: { "User-Agent": UA },
        flag,
    };
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);