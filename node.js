const axios = require('axios');
const cheerio = require('cheerio');

const FLOAT_API = 'http://localhost:3000';
const { DISCORD_WEBHOOK, PAGES, CHECK_INTERVAL_SECONDS } = require('./snipeConfig');

const checkedLinks = new Set();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

async function fetchPage(url, retries = 3) {
    const noCacheUrl = `${url}?_=${Date.now()}`;
    try {
        const res = await axios.get(noCacheUrl, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        return res.data;
    } catch (err) {
        if (err.response && err.response.status === 429) {
            console.warn(`429 Too Many Requests for ${url}. Waiting 2 minutes...`);
            await delay(2 * 60 * 1000);
            return fetchPage(url, retries);
        } else if (retries > 0) {
            console.warn(`Failed to fetch ${url}, retries left: ${retries}. Error: ${err.message}`);
            await delay(5000);
            return fetchPage(url, retries - 1);
        } else {
            throw new Error(`Failed to fetch ${url} after multiple attempts: ${err.message}`);
        }
    }
}

function extractInspectLinks(html) {
    const $ = cheerio.load(html);
    const links = new Set();
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('steam://rungame/730/76561202255233023/+csgo_econ_action_preview')) {
            links.add(href);
        }
    });
    return [...links];
}

async function getFloat(link) {
    try {
        const res = await axios.get(FLOAT_API, { params: { url: link } });
        return res.data.iteminfo;
    } catch (err) {
        console.error(`Failed to get float for ${link}:`, err.message);
        return null;
    }
}

function getMarketPageURL(item) {
    const base = 'https://steamcommunity.com/market/listings/730/';
    const name = encodeURIComponent(item.full_item_name);
    return `${base}${name}`;
}

async function sendDiscordNotification(item) {
    const pageUrl = getMarketPageURL(item);
    const message = {
        content: `**Item: ${item.full_item_name}**\nFloat: ${item.floatvalue}\n${pageUrl}`
    };

    try {
        await axios.post(DISCORD_WEBHOOK, message);
    } catch (err) {
        console.error('Failed to send Discord message:', err.message);
    }
}

async function checkPages() {
    try {
        for (const page of PAGES) {
            let html;
            try {
                html = await fetchPage(page.url);
            } catch (err) {
                console.error(`Skipping page ${page.url} due to fetch errors:`, err.message);
                continue;
            }

            const links = extractInspectLinks(html);
            console.log(`Found ${links.length} unique links on ${page.url}`);

            let newLinks = links.filter(link => !checkedLinks.has(link));
            if (newLinks.length === 0) {
                console.log(`No new links found for ${page.url}`);
                continue;
            }

            newLinks = newLinks.slice(0, 10);

            for (const link of newLinks) {
                checkedLinks.add(link);

                let info;
                try {
                    info = await getFloat(link);
                } catch (err) {
                    console.error(`Error getting float for ${link}:`, err.message);
                    continue;
                }

                if (info) {
                    if (info.floatvalue <= page.maxFloat) {
                        try {
                            await sendDiscordNotification(info);
                        } catch (err) {
                            console.error(`Failed to notify Discord for ${info.full_item_name}:`, err.message);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('Unexpected error in checkPages:', err.message);
    }
}

// Run
checkPages().catch(err => console.error('Initial checkPages error:', err.message));

// Checks
setInterval(async () => {
    try {
        await checkPages();
    } catch (err) {
        console.error('Error in interval checkPages:', err.message);
    }
}, CHECK_INTERVAL_SECONDS * 1000);
