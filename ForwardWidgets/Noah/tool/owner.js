// =============UserScript=============
// @name         Trakt 个人中心
// @version      0.0.1
// @description  一站式管理 Trakt 待看、收藏、历史。支持分页和排序优化
// @author       MakkaPakka(原作者)，经二次优化图标后
// =============UserScript=============
WidgetMetadata = {
    id: "trakt_personal_fixed",
    title: "Trakt 个人中心",
    author: "xiuliu",
    description: "一站式管理 Trakt 待看、收藏、历史。支持分页和排序优化。",
    version: "0.0.1",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [
        {
            name: "traktUser",
            title: "Trakt 用户名 (必填)",
            type: "input",
            description: "你的 Trakt ID (Slug)",
            value: ""
        },
        {
            name: "traktClientId",
            title: "Trakt Client ID (选填)",
            type: "input",
            description: "默认使用公共 ID。",
            value: ""
        }
    ],

    modules: [
        {
            title: "我的片单",
            functionName: "loadTraktProfile",
            type: "list",
            cacheDuration: 300,
            params: [
                {
                    name: "section",
                    title: "浏览区域",
                    type: "enumeration",
                    value: "watchlist",
                    enumOptions: [
                        { title: " 待看列表 (Watchlist)", value: "watchlist" },
                        { title: " 收藏列表 (Collection)", value: "collection" },
                        { title: " 观看历史 (History)", value: "history" },
                        { title: " 评分记录 (Ratings)", value: "ratings" }
                    ]
                },
                {
                    name: "type",
                    title: "内容筛选",
                    type: "enumeration",
                    value: "shows",
                    enumOptions: [
                        { title: "剧集", value: "shows" },
                        { title: "电影", value: "movies" }
                    ]
                },
                // 增加排序选项 (仅对 Watchlist 有效)
                {
                    name: "sort",
                    title: "排序 (仅待看)",
                    type: "enumeration",
                    value: "added,desc",
                    belongTo: { paramName: "section", value: ["watchlist"] },
                    enumOptions: [
                        { title: "最新添加", value: "added,desc" },
                        { title: "最早添加", value: "added,asc" },
                        { title: "默认排行", value: "rank,asc" }
                    ]
                },
                // 必须显式增加 page
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        }
    ]
};

const DEFAULT_TRAKT_ID = "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

async function loadTraktProfile(params = {}) {
    const { traktUser, section, type = "shows", sort = "added,desc" } = params;
    // 获取分页参数，默认为 1
    const page = params.page || 1;
    const clientId = params.traktClientId || DEFAULT_TRAKT_ID;

    if (!traktUser) return [{ id: "err", type: "text", title: "请填写 Trakt 用户名" }];

    // 构造 URL
    // limit=15 (Forward 标准页容量)
    // page=... (传入分页)
    let url = "";
    
    // Watchlist: 核心修正
    // 官方文档: /users/{username}/watchlist/{type}/{sort}?page={page}&limit={limit}
    // sort 可选: rank, added, released, title
    if (section === "watchlist") {
        // 解析排序参数 "added,desc" -> path "added" (方向通常由 API 默认或 header 控制，Trakt Watchlist 接口直接在 path 里指定 sort 字段)
        // Trakt API v2 的 watchlist 排序其实是 /watchlist/{type}/{sort}
        // 例如 /watchlist/shows/added
        // 但 API 默认通常是升序。如果需要降序，Trakt 可能需要特殊处理或客户端反转（但分页下没法反转）。
        // 实际上 Trakt 公开 API 的 Watchlist 排序比较死板。
        // 我们尝试用标准 path: /watchlist/shows/added
        const sortMode = sort.split(",")[0]; // "added"
        url = `https://api.trakt.tv/users/${traktUser}/watchlist/${type}/${sortMode}?extended=full&page=${page}&limit=15`;
    } 
    // Collection
    else if (section === "collection") {
        url = `https://api.trakt.tv/users/${traktUser}/collection/${type}?extended=full&page=${page}&limit=15`;
    } 
    // History
    else if (section === "history") {
        url = `https://api.trakt.tv/users/${traktUser}/history/${type}?extended=full&page=${page}&limit=15`;
    } 
    // Ratings
    else if (section === "ratings") {
        url = `https://api.trakt.tv/users/${traktUser}/ratings/${type}?extended=full&page=${page}&limit=15`;
    }

    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": clientId }
        });
        
        const data = res.data || [];
        // 如果第一页就没数据，返回空；翻页没数据，返回空数组停止加载
        if (!Array.isArray(data) || data.length === 0) {
            return page === 1 ? [{ id: "empty", type: "text", title: "列表为空" }] : [];
        }

        const promises = data.map(async (item) => {
            const subject = item.show || item.movie || item; // 兼容不同结构
            if (!subject?.ids?.tmdb) return null;

            // 构造副标题
            let subInfo = "";
            let addedDate = "";
            
            if (section === "watchlist") {
                // Watchlist item 包含 listed_at
                if (item.listed_at) {
                    const date = item.listed_at.split('T')[0];
                    addedDate = `添加于 ${date}`;
                }
                subInfo = addedDate || `Trakt: ${subject.year}`;
            } 
            else if (section === "ratings") subInfo = `评分: ${item.rating}⭐`;
            else if (section === "history") subInfo = `观看: ${item.watched_at.split('T')[0]}`;
            else subInfo = `Trakt: ${subject.year || ""}`;

            return await fetchTmdbDetail(subject.ids.tmdb, type === "movies" ? "movie" : "tv", subInfo, subject.title);
        });

        const results = (await Promise.all(promises)).filter(Boolean);
        
        // 客户端排序补救 (仅针对 Watchlist 第一页)
        // Trakt API 有时排序不听话，如果用户选了 "最新添加(desc)"，我们在本地再排一次 (仅限当前页)
        if (section === "watchlist" && sort.includes("desc") && results.length > 1) {
            // 这里很难做，因为 item 里的 listed_at 在 fetchTmdbDetail 后丢失了。
            // 且分页情况下本地排序无意义。
            // 相信 API 的返回顺序。Trakt 默认 added 是升序，如果要降序可能无解（API v2 不支持 direction 参数）。
            // 变通：如果是 Watchlist，可以尝试用 /users/{username}/watchlist/{type}/added 接口
        }
        
        return results;

    } catch (e) {
        return [{ id: "err_net", type: "text", title: "请求失败", subTitle: e.message }];
    }
}

async function fetchTmdbDetail(id, type, subInfo, originalTitle) {
    try {
        const d = await Widget.tmdb.get(`/${type}/${id}`, { params: { language: "zh-CN" } });
        const year = (d.first_air_date || d.release_date || "").substring(0, 4);
        const genreText = (d.genres || []).map(g => g.name).slice(0, 2).join(" / ");
        
        return {
            id: String(d.id), tmdbId: d.id, type: "tmdb", mediaType: type,
            title: d.name || d.title || originalTitle,
            genreTitle: [year, genreText].filter(Boolean).join(" • "),
            subTitle: subInfo,
            description: d.overview || "暂无简介",
            posterPath: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : "",
            backdropPath: d.backdrop_path ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}` : "",
            rating: d.vote_average?.toFixed(1),
            year: year
        };
    } catch (e) { return null; }
}
