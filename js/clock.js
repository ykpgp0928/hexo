// --- 全局变量区 ---
let weatherInfo = "正在获取天气...";
let lastMinute = -1;
let isRefreshing = false; // 用于手动点击的UI锁
let isFetchingAPI = false; // ✨ 新增：用于底层网络请求的全局防抖锁

// --- 配置区 ---
const AMAP_KEY = "43a8a1d787b396a55f0123b8d414c89d";
const CACHE_KEY = "hexo_blog_weather_cache";
const CACHE_EXPIRE = 1000 * 60 * 60; // 1小时

// 1. 获取问候语
function getGreeting(hour) {
    if (hour >= 0 && hour < 6) return "夜深了，注意休息哦 🌙";
    if (hour >= 6 && hour < 9) return "早上好！新的一天开始了 ☀️";
    if (hour >= 9 && hour < 12) return "上午好，祝工作学习顺利 ☕";
    if (hour >= 12 && hour < 14) return "中午好，记得按时吃饭 🍚";
    if (hour >= 14 && hour < 18) return "下午好，喝杯下午茶吧 💪";
    if (hour >= 18 && hour < 22) return "晚上好，放松一下吧 🌟";
    return "夜深了，早点休息 😴";
}

// 2. 天气文字转 Emoji
function getWeatherIcon(weatherText) {
    if (weatherText.includes("晴")) return "☀️";
    if (weatherText.includes("多云")) return "⛅";
    if (weatherText.includes("阴")) return "☁️";
    if (weatherText.includes("雷")) return "⛈️";
    if (weatherText.includes("雨")) return "🌧️";
    if (weatherText.includes("雪")) return "❄️";
    if (weatherText.includes("雾") || weatherText.includes("霾")) return "🌫️";
    return "🌈";
}

// 3. 获取天气 (核心请求逻辑)
// 3. 获取天气 (增加超时阻断与请求锁)
async function fetchWeather() {
    // 拦截 1：未配置 Key
    if (AMAP_KEY === "你的高德API_KEY") {
        weatherInfo = "请配置高德API Key";
        return;
    }

    // 拦截 2：并发锁
    if (isFetchingAPI) return;

    // 拦截 3：缓存检查
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        const { info, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRE) {
            weatherInfo = info;
            return;
        }
    }

    isFetchingAPI = true;

    // ⏳ 新增：创建超时控制器 (设定 5 秒生死线)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        // 第一步：获取定位 (把 controller.signal 传给 fetch)
        const ipRes = await fetch(`https://restapi.amap.com/v3/ip?key=${AMAP_KEY}`, { signal: controller.signal });
        const ipData = await ipRes.json();

        if (ipData.status !== "1" || !ipData.adcode) throw new Error("定位失败");
        const city = ipData.city.length > 0 ? ipData.city : ipData.province;

        // 第二步：获取天气
        const weatherRes = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?city=${ipData.adcode}&key=${AMAP_KEY}`, { signal: controller.signal });
        const weatherData = await weatherRes.json();

        if (weatherData.status === "1" && weatherData.lives.length > 0) {
            const live = weatherData.lives[0];
            const icon = getWeatherIcon(live.weather);
            weatherInfo = `${icon} ${city} | ${live.weather} ${live.temperature}°C | 💧${live.humidity}%`;

            localStorage.setItem(CACHE_KEY, JSON.stringify({
                info: weatherInfo,
                timestamp: Date.now()
            }));
        }
    } catch (error) {
        // ✨ 新增：精准捕获超时异常
        if (error.name === 'AbortError') {
            console.warn("请求高德天气超时 (超过5秒)");
        } else {
            console.error("天气加载失败:", error);
        }

        // 失败后的降级策略：优先用旧缓存，没有则提示失败
        const oldCache = localStorage.getItem(CACHE_KEY);
        weatherInfo = oldCache ? JSON.parse(oldCache).info : "暂时无法获取天气";
    } finally {
        clearTimeout(timeoutId); // 🧹 极其重要：请求完成(无论成功失败)必须清空定时器，防止内存泄漏
        isFetchingAPI = false;   // 🔓 释放请求锁
    }
}

// 4. 手动触发刷新功能 (暴露给全局以供 onclick 调用)
window.forceRefreshWeather = async function() {
    if (isRefreshing) return; // 防止狂点
    isRefreshing = true;

    const weatherEl = document.getElementById("clk-weather");
    if (weatherEl) {
        weatherEl.innerHTML = `<span class="spin-icon">🔄</span> 刷新中...`;
        weatherEl.style.opacity = "0.7";
    }

    localStorage.removeItem(CACHE_KEY); // 清空旧缓存
    await fetchWeather(); // 重新拉取天气

    isRefreshing = false;
    if (weatherEl) {
        weatherEl.style.opacity = "1";
        weatherEl.innerText = weatherInfo; // 恢复正常文本
    }
}

// 5. 更新时钟 UI
// 5. 更新时钟 UI (修复冒号不对齐问题版)
function updateClock() {
    const clock = document.getElementById("custom-clock");
    if (!clock) return;

    // A. 仅初始化一次 DOM 结构
    if (!document.getElementById("clk-time-wrapper")) {
        clock.innerHTML = `
            <div class="clock-date" id="clk-date"></div>
            
            <div class="clock-time" id="clk-time-wrapper" style="transition: opacity 0.4s ease-in-out; display: flex; justify-content: center; align-items: center; width: 100%;">
                <span id="clk-hour" style="flex: 1; text-align: right;"></span>
                <span class="clock-colon" style="width: 24px; text-align: center; position: relative; top: -2px; flex-shrink: 0;">:</span>
                <span id="clk-min" style="flex: 1; text-align: left;"></span>
            </div>
            
            <div class="clock-greeting" id="clk-greeting"></div>
            <div class="clock-weather" id="clk-weather" onclick="forceRefreshWeather()" title="点击刷新天气"></div>
            <div class="clock-progress-bar" title="今日时间流逝进度"><div class="clock-progress-inner" id="clk-progress"></div></div>
        `;
    }

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // B. 更新天气文本 (不打断正在刷新的状态)
    const weatherEl = document.getElementById("clk-weather");
    if (weatherEl && weatherEl.innerText !== weatherInfo && !isRefreshing) {
        weatherEl.innerText = weatherInfo;
    }

    // C. 实时更新今日进度条 (平滑动画)
    const todayPassedSeconds = hour * 3600 + minute * 60 + second;
    const progressPercent = (todayPassedSeconds / 86400) * 100;
    const progressEl = document.getElementById("clk-progress");
    if (progressEl) {
        progressEl.style.width = progressPercent.toFixed(2) + "%";
    }

    // D. 分钟改变时的淡入淡出逻辑
    if (minute !== lastMinute) {
        const timeWrapper = document.getElementById("clk-time-wrapper");

        if (lastMinute !== -1) timeWrapper.style.opacity = 0;

        setTimeout(() => {
            document.getElementById("clk-hour").innerText = String(hour).padStart(2, "0");
            document.getElementById("clk-min").innerText = String(minute).padStart(2, "0");

            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const week = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getDay()];

            document.getElementById("clk-date").innerText = `${year}-${month}-${day} ${week}`;
            document.getElementById("clk-greeting").innerText = getGreeting(hour);

            timeWrapper.style.opacity = 1;
        }, lastMinute === -1 ? 0 : 400);

        lastMinute = minute;
    }
}

// 启动
fetchWeather().then(() => updateClock());
setInterval(updateClock, 1000);