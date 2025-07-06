// =============UserScript=============
// @name         Bangumi 热门榜单
// @version      2.0.0
// @description  获取Bangumi近期热门、每日放送数据，支持榜单筛选
// @author       Autism(原作者)，经二次优化图标后
// =============UserScript=============
// --- 核心配置 ---
const BASE_DATA_URL = "https://raw.githubusercontent.com/opix-maker/Forward/main";
const RECENT_DATA_URL = `${BASE_DATA_URL}/recent_data.json`;

// --- 动态年份生成 ---
const currentYear = new Date().getFullYear();
const startYear = 2025; 
const yearOptions = [];
for (let year = startYear; year >= 1940; year--) { 
    yearOptions.push({ title: `${year}`, value: `${year}` });
}

var WidgetMetadata = {
    id: "Bangumi_charts",
    title: "Bangumi 热门榜单",
    description: "获取Bangumi近期热门、每日放送数据，支持榜单筛选。",
    version: "1.0.1",
    author: "𝕏𝕚𝕪𝕦𝕝𝕚𝕦",
    site: "https://github.com/opix-maker/Forward",
    requiredVersion: "0.0.1",
    detailCacheDuration: 6000,
    modules: [
        {
            title: "近期热门",
            description: "按作品类型浏览近期热门内容 (固定按热度 trends 排序)",
            requiresWebView: false,
            functionName: "fetchRecentHot",
            cacheDuration: 500000,
            params: [
                { name: "category", title: "分类", type: "enumeration", value: "anime", enumOptions: [ { title: "动画", value: "anime" } ] },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "年度/季度榜单",
            description: "按年份、季度/全年及作品类型浏览排行",
            requiresWebView: false,
            functionName: "fetchAirtimeRanking",
            cacheDuration: 1000000,
            params: [
                { name: "category", title: "分类", type: "enumeration", value: "anime", enumOptions: [ { title: "动画", value: "anime" }, { title: "三次元", value: "real" } ] },
                { 
                    name: "year", 
                    title: "年份", 
                    type: "enumeration",
                    description: "选择一个年份进行浏览。", 
                    value: `${currentYear}`, // 默认值依然是当前年份
                    enumOptions: yearOptions // 使用新的年份列表
                },
                { name: "month", title: "月份/季度", type: "enumeration", value: "all", description: "选择全年或特定季度对应的月份。留空则为全年。", enumOptions: [ { title: "全年", value: "all" }, { title: "冬季 (1月)", value: "1" }, { title: "春季 (4月)", value: "4" }, { title: "夏季 (7月)", value: "7" }, { title: "秋季 (10月)", value: "10" } ] },
                { name: "sort", title: "排序方式", type: "enumeration", value: "collects", enumOptions: [ { title: "排名", value: "rank" }, { title: "热度", value: "trends" }, { title: "收藏数", value: "collects" }, { title: "发售日期", value: "date" }, { title: "名称", "value": "title" } ] },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        
        {
            title: "每日放送",
            description: "查看指定范围的放送（数据来自Bangumi API）",
            requiresWebView: false,
            functionName: "fetchDailyCalendarApi",
            cacheDuration: 20000,
            params: [
                {
                    name: "filterType",
                    title: "筛选范围",
                    type: "enumeration",
                    value: "today",
                    enumOptions: [
                        { title: "今日放送", value: "today" },
                        { title: "指定单日", value: "specific_day" },
                        { title: "本周一至四", value: "mon_thu" },
                        { title: "本周五至日", value: "fri_sun" },
                        { title: "整周放送", value: "all_week" }
                    ]
                },
                {
                    name: "specificWeekday",
                    title: "选择星期",
                    type: "enumeration",
                    value: "1",
                    description: "仅当筛选范围为“指定单日”时有效。",
                    enumOptions: [
                        { title: "星期一", value: "1" }, { title: "星期二", value: "2" },
                        { title: "星期三", value: "3" }, { title: "星期四", value: "4" },
                        { title: "星期五", value: "5" }, { title: "星期六", value: "6" },
                        { title: "星期日", value: "7" }
                    ],
                    belongTo: { paramName: "filterType", value: ["specific_day"] }
                },
                {
                    name: "dailySortOrder", title: "排序方式", type: "enumeration",
                    value: "popularity_rat_bgm",
                    description: "对每日放送结果进行排序",
                    enumOptions: [
                        { title: "热度(评分人数)", value: "popularity_rat_bgm" },
                        { title: "评分", value: "score_bgm_desc" },
                        { title: "放送日(更新日期)", value: "airdate_desc" },
                        { title: "默认", value: "default" }
                    ]
                },
                {
                    name: "dailyRegionFilter", title: "地区筛选", type: "enumeration", value: "all",
                    description: "筛选特定地区的放送内容 (主要依赖TMDB数据)",
                    enumOptions: [
                        { title: "全部地区", value: "all" },
                        { title: "日本", value: "JP" },
                        { title: "中国大陆", value: "CN" },
                        { title: "欧美", value: "US_EU" },
                        { title: "其他/未知", value: "OTHER" }
                    ]
                }
            ]
        }
    ]
};

// ... (所有后续函数，如 fetchAndCacheGlobalData, fetchAirtimeRanking 等，保持不变)
// --- 全局数据管理 ---
let globalData = null;
let dataFetchPromise = null;
const archiveFetchPromises = {};

async function fetchAndCacheGlobalData() {
    if (globalData) return globalData;
    if (dataFetchPromise) return await dataFetchPromise;

    dataFetchPromise = (async () => {
        console.log(`[BGM Widget v10.4] 开始获取近期数据...`);
        try {
            const response = await Widget.http.get(RECENT_DATA_URL, { headers: { 'Cache-Control': 'no-cache' } });
            globalData = response.data;
            globalData.dynamic = {};
            console.log(`[BGM Widget v10.4] 近期数据初始化完成。`);
            return globalData;
        } catch (e) {
            console.error("[BGM Widget v10.4] 获取近期数据失败! 将完全回退到动态模式。", e.message);
            globalData = { airtimeRanking: {}, recentHot: {}, dailyCalendar: {}, dynamic: {} };
            return globalData;
        }
    })();

    return await dataFetchPromise;
}

// --- 模块实现 ---

async function fetchRecentHot(params = {}) {
    await fetchAndCacheGlobalData();
    const category = "anime";
    const page = parseInt(params.page || "1", 10);
    const pages = globalData.recentHot?.[category] || [];
    return pages[page - 1] || [];
}

async function fetchAirtimeRanking(params = {}) {
    await fetchAndCacheGlobalData();
    const category = params.category || "anime";
    const year = params.year || `${new Date().getFullYear()}`;
    const month = params.month || "all";
    const sort = params.sort || "collects";
    const page = parseInt(params.page || "1", 10);

    const isArchiveYear = !globalData.airtimeRanking[category]?.[year];
    if (isArchiveYear) {
        if (!archiveFetchPromises[year]) {
            console.log(`[BGM Widget v10.4] 创建存档年份请求: ${year}`);
            archiveFetchPromises[year] = (async () => {
                try {
                    const archiveUrl = `${BASE_DATA_URL}/archive/${year}.json`;
                    const response = await Widget.http.get(archiveUrl, { headers: { 'Cache-Control': 'no-cache' } });
                    const archiveYearData = response.data;
                    if (!globalData.airtimeRanking[category]) globalData.airtimeRanking[category] = {};
                    globalData.airtimeRanking[category][year] = archiveYearData.airtimeRanking[category][year];
                    console.log(`[BGM Widget v10.4] 存档年份 ${year} 加载并合并成功。`);
                } catch (e) {
                    console.warn(`[BGM Widget v10.4] 按需加载存档 ${year} 失败: ${e.message}.`);
                    if (!globalData.airtimeRanking[category]) globalData.airtimeRanking[category] = {};
                    globalData.airtimeRanking[category][year] = 'failed'; 
                }
            })();
        }
        await archiveFetchPromises[year];
    }

    try {
        const pages = globalData.airtimeRanking[category][year][month][sort];
        if (pages && pages[page - 1]) {
            console.log(`[BGM Widget v10.4] 命中预构建数据: ${year}-${sort}-p${page}`);
            return pages[page - 1];
        }
    } catch (e) {}

    const dynamicKey = `airtime-${category}-${year}-${month}-${sort}-${page}`;
    if (globalData.dynamic[dynamicKey]) {
        console.log(`[BGM Widget v10.4] 命中动态缓存: ${year}-${sort}-p${page}`);
        return globalData.dynamic[dynamicKey];
    }
    console.log(`[BGM Widget v10.4] 未命中，启动动态获取: ${year}-${sort}-p${page}`);
    let url = `https://bgm.tv/${category}/browser/airtime/${year}/${month}?sort=${sort}&page=${page}`;
    const results = await DynamicDataProcessor.processBangumiPage(url, category);
    globalData.dynamic[dynamicKey] = results;
    return results;
}

async function fetchDailyCalendarApi(params = {}) {
    await fetchAndCacheGlobalData();
    let items = globalData.dailyCalendar?.all_week || [];
    if (items.length === 0 && !archiveFetchPromises['daily']) {
        console.log("[BGM Widget v10.4] 每日放送无预构建数据，尝试动态获取...");
        archiveFetchPromises['daily'] = (async () => {
            const dynamicItems = await DynamicDataProcessor.processDailyCalendar();
            if(!globalData.dailyCalendar) globalData.dailyCalendar = {};
            globalData.dailyCalendar.all_week = dynamicItems;
        })();
    }
    if (archiveFetchPromises['daily']) await archiveFetchPromises['daily'];
    
    items = globalData.dailyCalendar?.all_week || [];
    const { filterType = "today", specificWeekday = "1", dailySortOrder = "popularity_rat_bgm", dailyRegionFilter = "all" } = params;
    const JS_DAY_TO_BGM_API_ID = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
    const REGION_FILTER_US_EU_COUNTRIES = ["US", "GB", "FR", "DE", "CA", "AU", "ES", "IT"];
    let filteredByDay = [];
    if (filterType === "all_week") {
        filteredByDay = items;
    } else {
        const today = new Date();
        const currentJsDay = today.getDay();
        const targetBgmIds = new Set();
        switch (filterType) {
            case "today": targetBgmIds.add(JS_DAY_TO_BGM_API_ID[currentJsDay]); break;
            case "specific_day": targetBgmIds.add(parseInt(specificWeekday, 10)); break;
            case "mon_thu": [1, 2, 3, 4].forEach(id => targetBgmIds.add(id)); break;
            case "fri_sun": [5, 6, 7].forEach(id => targetBgmIds.add(id)); break;
        }
        filteredByDay = items.filter(item => item.bgm_weekday_id && targetBgmIds.has(item.bgm_weekday_id));
    }
    let filteredByRegion = filteredByDay;
    if (dailyRegionFilter !== "all") {
        filteredByRegion = filteredByDay.filter(item => {
            if (item.type !== "tmdb" || !item.tmdb_id) return dailyRegionFilter === "OTHER";
            const countries = item.tmdb_origin_countries || [];
            if (countries.length === 0) return dailyRegionFilter === "OTHER";
            if (dailyRegionFilter === "JP") return countries.includes("JP");
            if (dailyRegionFilter === "CN") return countries.includes("CN");
            if (dailyRegionFilter === "US_EU") return countries.some(c => REGION_FILTER_US_EU_COUNTRIES.includes(c));
            if (dailyRegionFilter === "OTHER") {
                const isJPCNUSEU = countries.includes("JP") || countries.includes("CN") || countries.some(c => REGION_FILTER_US_EU_COUNTRIES.includes(c));
                return !isJPCNUSEU;
            }
            return false;
        });
    }
    let sortedResults = [...filteredByRegion];
    if (dailySortOrder !== "default") {
        sortedResults.sort((a, b) => {
            if (dailySortOrder === "popularity_rat_bgm") return (b.bgm_rating_total || 0) - (a.bgm_rating_total || 0);
            if (dailySortOrder === "score_bgm_desc") return (b.bgm_score || 0) - (a.bgm_score || 0);
            if (dailySortOrder === "airdate_desc") {
                const dateA = a.releaseDate || a.bgm_air_date || 0;
                const dateB = b.releaseDate || b.bgm_air_date || 0;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            }
            return 0;
        });
    }
    return sortedResults;
}

const DynamicDataProcessor = (() => {
    const BGM_BASE_URL = "https://bgm.tv";
    const TMDB_ANIMATION_GENRE_ID = 16;
    const MAX_CONCURRENT_DETAILS_FETCH = 8;
    function normalizeTmdbQuery(query) { if (!query || typeof query !== 'string') return ""; return query.toLowerCase().trim().replace(/[\[\]【】（）()「」『』:：\-－_,\.・]/g, ' ').replace(/\s+/g, ' ').trim();}
    function parseDate(dateStr) { if (!dateStr || typeof dateStr !== 'string') return ''; dateStr = dateStr.trim(); let match; match = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/); if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`; match = dateStr.match(/^(\d{4})年(\d{1,2})月(?!日)/); if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-01`; match = dateStr.match(/^(\d{4})$/); if (match) return `${match[1]}-01-01`; return '';}
    function scoreTmdbResult(result, query, validYear) {
        let score = 0;
        const resultTitle = normalizeTmdbQuery(result.title || result.name);
        const queryLower = normalizeTmdbQuery(query);
        if (resultTitle === queryLower) score += 15;
        else if (resultTitle.includes(queryLower)) score += 7;
        if (validYear) {
            const resDate = result.release_date || result.first_air_date;
            if (resDate && resDate.startsWith(validYear)) score += 6;
        }
        score += Math.log10((result.popularity || 0) + 1) * 2.2;
        return score;
    }
    async function searchTmdb(originalTitle, chineseTitle, year) {
        let bestMatch = null;
        let maxScore = -1;
        const searchMediaType = 'tv';
        const query = chineseTitle || originalTitle;
        const response = await Widget.tmdb.get(`/search/${searchMediaType}`, { params: { query, language: "zh-CN", include_adult: false, year: year } });
        const results = response?.results || [];
        for (const result of results) {
            if (!(result.genre_ids && result.genre_ids.includes(TMDB_ANIMATION_GENRE_ID))) continue;
            const score = scoreTmdbResult(result, query, year);
            if (score > maxScore) {
                maxScore = score;
                bestMatch = result;
            }
        }
        return bestMatch;
    }
    function parseBangumiListItems(htmlContent) {
        const $ = Widget.html.load(htmlContent);
        const items = [];
        $('ul#browserItemList li.item').each((_, element) => {
            const $item = $(element);
            const id = $item.attr('id')?.substring(5);
            if (!id) return;
            const title = $item.find('h3 a.l').text().trim();
            let cover = $item.find('a.subjectCover img.cover').attr('src');
            if (cover?.startsWith('//')) cover = 'https:' + cover;
            const info = $item.find('p.info.tip').text().trim();
            const rating = $item.find('small.fade').text().trim();
            items.push({ id, title, cover, info, rating });
        });
        return items;
    }
    async function fetchItemDetails(item, category) {
        const yearMatch = item.info.match(/(\d{4})/);
        const year = yearMatch ? yearMatch[1] : '';
        const baseItem = {
            id: item.id, type: "link", title: item.title,
            posterPath: item.cover, releaseDate: parseDate(item.info),
            mediaType: category, rating: item.rating,
            description: item.info, link: `${BGM_BASE_URL}/subject/${item.id}`
        };
        const tmdbResult = await searchTmdb(item.title, null, year);
        if (tmdbResult) {
            baseItem.id = String(tmdbResult.id);
            baseItem.type = "tmdb";
            baseItem.title = tmdbResult.name || tmdbResult.title || baseItem.title;
            baseItem.posterPath = tmdbResult.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbResult.poster_path}` : baseItem.posterPath;
            baseItem.releaseDate = tmdbResult.first_air_date || tmdbResult.release_date || baseItem.releaseDate;
            baseItem.rating = tmdbResult.vote_average ? tmdbResult.vote_average.toFixed(1) : baseItem.rating;
            baseItem.description = tmdbResult.overview || baseItem.description;
            baseItem.link = null;
            baseItem.tmdb_id = String(tmdbResult.id);
            baseItem.tmdb_origin_countries = tmdbResult.origin_country || [];
        }
        return baseItem;
    }
    async function processBangumiPage(url, category) {
        try {
            const listHtmlResp = await Widget.http.get(url);
            const pendingItems = parseBangumiListItems(listHtmlResp.data);
            const results = [];
            for (let i = 0; i < pendingItems.length; i += MAX_CONCURRENT_DETAILS_FETCH) {
                const batch = pendingItems.slice(i, i + MAX_CONCURRENT_DETAILS_FETCH);
                const promises = batch.map(item => fetchItemDetails(item, category));
                const settled = await Promise.allSettled(promises);
                settled.forEach(res => {
                    if (res.status === 'fulfilled' && res.value) results.push(res.value);
                });
            }
            return results;
        } catch (error) {
            console.error(`[BGM Widget v10.4] 动态处理页面失败 (${url}): ${error.message}`);
            return [];
        }
    }
    async function processDailyCalendar() {
        try {
            const apiResponse = await Widget.http.get("https://api.bgm.tv/calendar");
            const allItems = [];
            apiResponse.data.forEach(dayData => {
                if (dayData.items) {
                    dayData.items.forEach(item => {
                        item.bgm_weekday_id = dayData.weekday?.id;
                        allItems.push(item);
                    });
                }
            });
            const enhancedItems = [];
            for (let i = 0; i < allItems.length; i += MAX_CONCURRENT_DETAILS_FETCH) {
                const batch = allItems.slice(i, i + MAX_CONCURRENT_DETAILS_FETCH);
                const promises = batch.map(async (item) => {
                    const baseItem = {
                        id: String(item.id), type: "link", title: item.name_cn || item.name,
                        posterPath: item.images?.large?.startsWith('//') ? 'https:' + item.images.large : item.images?.large,
                        releaseDate: item.air_date, mediaType: 'anime', rating: item.rating?.score?.toFixed(1) || "N/A",
                        description: `[${item.weekday?.cn || ''}] ${item.summary || ''}`.trim(),
                        link: item.url, bgm_id: String(item.id), bgm_score: item.rating?.score || 0,
                        bgm_rating_total: item.rating?.total || 0, bgm_weekday_id: item.bgm_weekday_id
                    };
                    const tmdbResult = await searchTmdb(item.name, item.name_cn, item.air_date?.substring(0, 4));
                    if (tmdbResult) {
                        baseItem.id = String(tmdbResult.id);
                        baseItem.type = "tmdb";
                        baseItem.title = tmdbResult.name || tmdbResult.title || baseItem.title;
                        baseItem.posterPath = tmdbResult.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbResult.poster_path}` : baseItem.posterPath;
                        baseItem.releaseDate = tmdbResult.first_air_date || tmdbResult.release_date || baseItem.releaseDate;
                        baseItem.rating = tmdbResult.vote_average ? tmdbResult.vote_average.toFixed(1) : baseItem.rating;
                        baseItem.description = tmdbResult.overview || baseItem.description;
                        baseItem.link = null;
                        baseItem.tmdb_id = String(tmdbResult.id);
                        baseItem.tmdb_origin_countries = tmdbResult.origin_country || [];
                    }
                    return baseItem;
                });
                const settled = await Promise.allSettled(promises);
                settled.forEach(res => {
                    if (res.status === 'fulfilled' && res.value) enhancedItems.push(res.value);
                });
            }
            return enhancedItems;
        } catch (error) {
            console.error(`[BGM Widget v10.4] 动态处理每日放送失败: ${error.message}`);
            return [];
        }
    }
    return { processBangumiPage, processDailyCalendar };
})();
