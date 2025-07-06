// 雅图组件
WidgetMetadata = {
    id: "yatu",
    title: "雅图(每日放送+点播排行榜+评分排行榜)",
    modules: [
        {
            title: "每日放送",
            requiresWebView: false,
            functionName: "loadLatestItems",
            cacheDuration: 21600,
            params: [
                {
                    name: "genre",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "动漫",
                            value: "sin1",
                        },
                        {
                            title: "电影",
                            value: "sin2",
                        },
                        {
                            title: "电视剧",
                            value: "sin3",
                        },
                    ],
                },
                {
                    name: "start_date",
                    title: "开始日期：n天前（0表示今天，-1表示昨天）",
                    type: "input",
                    description: "0表示今天，-1表示昨天，未填写情况下接口不可用",
                    placeholders: [
                        {
                            title: "今天",
                            value: "0"
                        },
                        {
                            title: "昨天",
                            value: "-1"
                        },
                        {
                            title: "前天",
                            value: "-2"
                        },
                        {
                            title: "大前天",
                            value: "-3"
                        },
                    ]
                },
                {
                    name: "days",
                    title: "天数（从开始日期开始的后面m天的数据）",
                    type: "input",
                    description: "如：3，会返回从开始日期起的3天内的节目，未填写情况下接口不可用",
                    value: "1",
                    placeholders: [
                        {
                            title: "1",
                            value: "1"
                        },
                        {
                            title: "2",
                            value: "2"
                        },
                        {
                            title: "3",
                            value: "3"
                        },
                        {
                            title: "4",
                            value: "4"
                        },
                    ]
                },
            ],
        },
        {
            title: "点播排行榜",
            requiresWebView: false,
            functionName: "loadClickItems",
            cacheDuration: 21600,
            params: [
                {
                    name: "genre",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "连载动漫",
                            value: "dm-lz",
                        },
                        {
                            title: "剧场动漫",
                            value: "dm-jc",
                        },
                        {
                            title: "电影",
                            value: "dy",
                        },
                        {
                            title: "香港电影",
                            value: "dy-xianggan",
                        },
                        {
                            title: "欧美电影",
                            value: "dy-om",
                        },
                        {
                            title: "电视剧",
                            value: "tv",
                        },
                        {
                            title: "美剧",
                            value: "tv-meiju",
                        },
                        {
                            title: "综艺",
                            value: "tv-zy",
                        },
                    ],
                },
                {
                    name: "sort_by",
                    title: "时间",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "今日",
                            value: "db_lz1",
                        },
                        {
                            title: "本月",
                            value: "db_lz2",
                        },
                        {
                            title: "历史",
                            value: "db_lz3",
                        },
                    ],
                },
            ],
        },
        {
            title: "评分排行榜",
            requiresWebView: false,
            functionName: "loadScoreItems",
            cacheDuration: 86400,
            params: [
                {
                    name: "genre",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "动漫",
                            value: "p-dm",
                        },
                        {
                            title: "电影",
                            value: "p-dy",
                        },
                        {
                            title: "电视剧",
                            value: "p-tv",
                        },
                    ],
                },
                {
                    name: "sort_by",
                    title: "等级",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "非常好看",
                            value: "tv1",
                        },
                        {
                            title: "好看",
                            value: "tv2",
                        },
                        {
                            title: "一般",
                            value: "tv3",
                        },
                        {
                            title: "烂片",
                            value: "tv4",
                        },
                    ],
                },
            ],
        },
    ],
    version: "1.0.1",
    requiredVersion: "0.0.1",
    description: "按每日热点或排行获取影视雅图",
    author: "𝕏𝕚𝕪𝕦𝕝𝕚𝕦",
    site: "https://github.com/huangxd-/ForwardWidgets"
};

// 基础获取TMDB数据方法
async function fetchTmdbData(key, mediaType) {
    const tmdbResults = await Widget.tmdb.get(`/search/${mediaType}`, {
        params: {
            query: key,
            language: "zh_CN",
        }
    });
    //打印结果
    // console.log("搜索内容：" + key)
    // console.log("tmdbResults:" + JSON.stringify(tmdbResults, null, 2));
    // console.log("tmdbResults.total_results:" + tmdbResults.total_results);
    // console.log("tmdbResults.results[0]:" + tmdbResults.results[0]);
    return tmdbResults.results;
}

function getItemInfos(data, startDateInput, days, genre) {
    let docId = Widget.dom.parse(data);

    let tables = Widget.dom.select(docId, `table#${genre}`);

    if (!tables || tables.length === 0) {
        console.error(`没有解析到相应table`);
        return null;
    }

    let tdElements = Widget.dom.select(tables[0], 'td');

    let today = new Date();
    let yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(today.getDate() - 2);

    function formatDate(date) {
        let year = date.getFullYear().toString().slice(2); // Get last two digits
        let month = date.getMonth() + 1; // Months are 0-based
        let day = date.getDate();
        return `${year}/${month}/${day}`;
    }

    let results = [];

    tdElements.forEach(td => {
        // Get all text content within the td
        let tdContent = Widget.dom.text(td).trim();

        // Find the span with style="color:#666666;" for time information
        let timeSpan = Widget.dom.select(td, 'span[style="color:#666666;"]')[0];
        let timeText = timeSpan ? Widget.dom.text(timeSpan).trim() : '';

        // Process timeText
        let processedTime = timeText;
        if (/^\d{1,2}:\d{2}:\d{2}$/.test(timeText)) {
            // If time is in hh:mm:ss format, use today's date
            processedTime = formatDate(today);
        } else if (timeText === '昨天') {
            // If time is "昨天", use yesterday's date
            processedTime = formatDate(yesterday);
        } else if (timeText === '前天') {
            // If time is "前天", use day before yesterday's date
            processedTime = formatDate(dayBeforeYesterday);
        }

        // Extract the link and title from the <a> tag
        let linkEl = Widget.dom.select(td, 'a')[0];
        let linkHref = linkEl ? Widget.dom.attr(linkEl, 'href') : '';
        let linkText = linkEl ? Widget.dom.text(linkEl).trim() : '';

        // Extract the episode information from the span (if exists)
        let episodeSpan = Widget.dom.select(td, 'span:not([style])')[0];
        let episodeText = episodeSpan ? Widget.dom.text(episodeSpan).trim() : '';

        results.push({
            title: linkText.replace(/ *第[^季]*季(?:~[^季]+季)?| *\d+~\d+季| *\d+季/, ''),
            link: linkHref,
            episodes: episodeText,
            time: processedTime,
            fullContent: tdContent
        });
    });

    console.log("results: ", results)

    today.setHours(0, 0, 0, 0); // 规范化时间

    // 计算开始和结束日期
    let startDate = new Date(today);
    startDate.setDate(today.getDate() + Number(startDateInput));
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + Number(days) - 1);
    endDate.setHours(0, 0, 0, 0);

    console.log("startDate: ", startDate);
    console.log("endDate: ", endDate);

    // 过滤结果
    return results.filter(item => {
        // 验证日期格式
        if (!item.time || !/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(item.time)) {
            return false;
        }

        // 解析日期，假设格式为 YY/MM/DD
        let [year, month, day] = item.time.split('/').map(Number);
        let currentYear = new Date().getFullYear();
        let century = Math.floor(currentYear / 100) * 100;
        // 如果年份小于等于当前年份的两位数，假设是 2000 年代
        let fullYear = year <= (currentYear % 100) ? century + year : century - 100 + year;
        let itemDate = new Date(fullYear, month - 1, day);

        // 检查日期有效性
        if (isNaN(itemDate)) return false;

        itemDate.setHours(0, 0, 0, 0);
        return itemDate >= startDate && itemDate <= endDate;
    });
}

async function loadLatestItems(params = {}) {
    try {
        const genre = params.genre || "";
        const startDateInput = params.start_date || "";
        const days = params.days || "";

        if (!genre || !startDateInput || !days) {
            throw new Error("必须提供分类、开始日期、天数");
        }

        const mediaTypeDict = {
            sin1: 'tv',
            sin2: 'movie',
            sin3: 'tv',
        };

        const response = await Widget.http.get("https://gist.githubusercontent.com/huangxd-/28a30eac8051ccb05a43c6f49a117286/raw/zuijin.asp", {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });

        console.log("请求结果:", response.data);

        const itemInfos = getItemInfos(response.data, startDateInput, days, genre);

        console.log("itemInfos:", itemInfos)

        const promises = itemInfos.map(async (itemInfo) => {
            // 模拟API请求
            const tmdbDatas = await fetchTmdbData(itemInfo.title, mediaTypeDict[genre])

            if (tmdbDatas.length !== 0) {
                return {
                    id: tmdbDatas[0].id,
                    type: "tmdb",
                    title: tmdbDatas[0].title ?? tmdbDatas[0].name,
                    description: tmdbDatas[0].overview,
                    releaseDate: tmdbDatas[0].release_date ?? tmdbDatas[0].first_air_date,
                    backdropPath: tmdbDatas[0].backdrop_path,
                    posterPath: tmdbDatas[0].poster_path,
                    rating: tmdbDatas[0].vote_average,
                    mediaType: mediaTypeDict[genre],
                };
            } else {
                return null;
            }
        });

        // 等待所有请求完成
        const items = (await Promise.all(promises)).filter(Boolean);

        console.log(items)

        return items;
    } catch (error) {
        console.error("处理失败:", error);
        throw error;
    }
}

function getClickItemInfos(data, typ) {
    let docId = Widget.dom.parse(data);

    let tables = Widget.dom.select(docId, `table#${typ}`);

    if (!tables || tables.length === 0) {
        console.error(`没有解析到相应table`);
        return null;
    }

    return [...new Set(
        Array.from(
            Widget.dom.select(tables[0], 'a[target="_blank"]')
        ).map(a => Widget.dom.text(a).trim().replace(/ *第[^季]*季(?:~[^季]+季)?| *\d+~\d+季| *\d+季/, ''))
    )];
}

async function fetchFinalItems(genre, typ, mediaTypeDict, suffixDict) {
    const response = await Widget.http.get(`https://gist.githubusercontent.com/huangxd-/28a30eac8051ccb05a43c6f49a117286/raw/${genre}.${suffixDict[genre]}`, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
    });

    console.log("请求结果:", response.data);

    const itemInfos = getClickItemInfos(response.data, typ);

    console.log("itemInfos:", itemInfos)

    const promises = itemInfos.map(async (title) => {
        // 模拟API请求
        const tmdbDatas = await fetchTmdbData(title, mediaTypeDict[genre])

        if (tmdbDatas.length !== 0) {
            return {
                id: tmdbDatas[0].id,
                type: "tmdb",
                title: tmdbDatas[0].title ?? tmdbDatas[0].name,
                description: tmdbDatas[0].overview,
                releaseDate: tmdbDatas[0].release_date ?? tmdbDatas[0].first_air_date,
                backdropPath: tmdbDatas[0].backdrop_path,
                posterPath: tmdbDatas[0].poster_path,
                rating: tmdbDatas[0].vote_average,
                mediaType: mediaTypeDict[genre],
            };
        } else {
            return null;
        }
    });

    // 等待所有请求完成
    const items = (await Promise.all(promises)).filter(Boolean);

    console.log(items)
    return items;
}

async function loadClickItems(params = {}) {
    try {
        const genre = params.genre || "";
        const typ = params.sort_by || "";

        if (!genre || !typ) {
            throw new Error("必须提供分类、时间");
        }

        const mediaTypeDict = {
            'dm-lz': 'tv',
            'dm-jc': 'movie',
            'dy': 'movie',
            'dy-xianggan': 'movie',
            'dy-om': 'movie',
            'tv': 'tv',
            'tv-meiju': 'tv',
            'tv-zy': 'tv',
        };

        const suffixDict = {
            'dm-lz': 'htm',
            'dm-jc': 'htm',
            'dy': 'htm',
            'dy-xianggan': 'html',
            'dy-om': 'htm',
            'tv': 'htm',
            'tv-meiju': 'html',
            'tv-zy': 'htm',
        };

        return await fetchFinalItems(genre, typ, mediaTypeDict, suffixDict);
    } catch (error) {
        console.error("处理失败:", error);
        throw error;
    }
}

async function loadScoreItems(params = {}) {
    try {
        const genre = params.genre || "";
        const typ = params.sort_by || "";

        if (!genre || !typ) {
            throw new Error("必须提供分类、等级");
        }

        const mediaTypeDict = {
            'p-dm': 'tv',
            'p-dy': 'movie',
            'p-tv': 'tv',
        };

        const suffixDict = {
            'p-dm': 'htm',
            'p-dy': 'htm',
            'p-tv': 'htm',
        };

        return await fetchFinalItems(genre, typ, mediaTypeDict, suffixDict);
    } catch (error) {
        console.error("处理失败:", error);
        throw error;
    }
}
