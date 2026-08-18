function runtime() {

    const start = new Date("2026/05/16 12:09:12");

    const now = new Date();

    const diff = now - start;

    const day = Math.floor(diff / 86400000);

    const hour = Math.floor(diff / 3600000) % 24;

    const min = Math.floor(diff / 60000) % 60;

    const sec = Math.floor(diff / 1000) % 60;


    const text =
        `本站已运行 ${day} 天 ${hour} 小时 ${min} 分 ${sec} 秒`;


    const el = document.getElementById("runtime");

    if (el) {
        el.innerHTML = text;
    }

}


setInterval(runtime,1000);

runtime();