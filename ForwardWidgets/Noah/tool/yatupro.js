const TMDB_API_KEY = 'YOUR_TMDB_KEY_HERE'; // 替换成你自己的 TMDB Key
const MAX_CONCURRENT_REQUESTS = 5;

// 日期格式化
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 验证参数有效性
function validateParams(genre, startDate, days) {
    return genre && startDate instanceof Date && !isNaN(days);
}

// 判断某日期是否在范围内
function isDateInRange(itemDate, startDate, endDate) {
    return itemDate >= startDate && itemDate <= endDate;
}

// 抓取页面 HTML
async function fetchFinalItems(url) {
    try {
        const res = await Widget.http.get(url);
        return res.data;
    } catch (err) {
        console.error(`请求失败: ${url}`, err);
        return null;
    }
}

// 解析每日放送信息
function getItemInfos(html, genre, startDate, days) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = [];
    const tables = doc.querySelectorAll(`#${genre} table`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);

    tables.forEach((table) => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const dateText = cells[0].textContent.trim();
                const dateMatch = dateText.match(/(\d{1,2})月(\d{1,2})日/);
                if (dateMatch) {
                    const month = parseInt(dateMatch[1]);
                    const day = parseInt(dateMatch[2]);
                    const itemDate = new Date(startDate.getFullYear(), month - 1, day);
                    if (isDateInRange(itemDate, startDate, endDate)) {
                        const titleLinks = cells[1].querySelectorAll('a');
                        titleLinks.forEach((link) => {
                            const title = link.textContent.trim();
                            if (title) {
                                items.push({ title, date: formatDate(itemDate) });
                            }
                        });
                    }
                }
            }
        });
    });

    return items;
}

// 限制并发的 TMDB 请求执行器
async function concurrentMap(list, limit, asyncFn) {
    const results = [];
    let idx = 0;
    const workers = new Array(limit).fill(0).map(async () => {
        while (idx < list.length) {
            const current = idx++;
            try {
                results[current] = await asyncFn(list[current]);
            } catch (err) {
                console.warn(`任务 ${current} 失败`, err);
                results[current] = null;
            }
        }
    });
    await Promise.all(workers);
    return results;
}

// TMDB 查询函数
async function fetchTmdbData(title, genre) {
    try {
        const type = genre === 'p-dm' ? 'movie' : 'tv';
        const query = encodeURIComponent(title);
        const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&language=zh-CN&query=${query}`;
        const response = await Widget.http.get(url);
        const results = response?.data?.results;
        if (results && results.length > 0) {
            const item = results[0];
            return {
                title: item.title || item.name,
                overview: item.overview,
                release_date: item.release_date || item.first_air_date,
                tmdb_score: item.vote_average,
                tmdb_id: item.id,
                poster_url: item.poster_path
                    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                    : null,
            };
        }
    } catch (error) {
        console.warn(`TMDB 查询失败: ${title}`, error);
    }
    return null;
}

// 主流程函数
async function loadLatestItems(genre, startDateInput, days) {
    const startDate = new Date(startDateInput);
    if (!validateParams(genre, startDate, days)) {
        console.error('无效的参数');
        return [];
    }

    const url = `https://www.yatu.tv/play/dailyplay.html`;
    const html = await fetchFinalItems(url);
    if (!html) return [];

    const itemInfos = getItemInfos(html, genre, startDate, days);

    const enrichedItems = await concurrentMap(itemInfos, MAX_CONCURRENT_REQUESTS, async (itemInfo) => {
        const tmdbData = await fetchTmdbData(itemInfo.title, genre);
        return { ...itemInfo, tmdb: tmdbData };
    });

    return enrichedItems.filter(Boolean);
}

// 榜单解析（点击榜 / 评分榜）
function getClickItemInfos(html, tableId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = [];

    const table = doc.querySelector(`#${tableId}`);
    if (!table) return items;

    const rows = table.querySelectorAll('tr');
    rows.forEach((row) => {
        const link = row.querySelector('a');
        if (link) {
            const title = link.textContent.trim();
            if (title) items.push({ title });
        }
    });

    return items;
}

async function loadScoreItems(genre) {
    const url = `https://www.yatu.tv/play/rankingscore.html`;
    const html = await fetchFinalItems(url);
    if (!html) return [];

    const itemInfos = getClickItemInfos(html, genre);

    const enrichedItems = await concurrentMap(itemInfos, MAX_CONCURRENT_REQUESTS, async (itemInfo) => {
        const tmdbData = await fetchTmdbData(itemInfo.title, genre);
        return { ...itemInfo, tmdb: tmdbData };
    });

    return enrichedItems.filter(Boolean);
}

async function loadClickItems(genre) {
    const url = `https://www.yatu.tv/play/rankingclick.html`;
    const html = await fetchFinalItems(url);
    if (!html) return [];

    const itemInfos = getClickItemInfos(html, genre);

    const enrichedItems = await concurrentMap(itemInfos, MAX_CONCURRENT_REQUESTS, async (itemInfo) => {
        const tmdbData = await fetchTmdbData(itemInfo.title, genre);
        return { ...itemInfo, tmdb: tmdbData };
    });

    return enrichedItems.filter(Boolean);
}

// ✅ 示例调用
(async () => {
    const genre = 'p-dm'; // 'p-dm' 电影，'tv1' 动画
    const startDate = '2025-07-01';
    const days = 3;

    const items = await loadLatestItems(genre, startDate, days);
    console.log('📺 每日放送:', items);

    const scoreItems = await loadScoreItems(genre);
    console.log('🏆 评分榜:', scoreItems);

    const clickItems = await loadClickItems(genre);
    console.log('🔥 点击榜:', clickItems);
})();
