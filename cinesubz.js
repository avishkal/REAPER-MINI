const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "cinesubz",
    alias: ["cinetv", "cine", "cinesub"],
    desc: "Search and download movies or TV shows from CineSubz",
    category: "download",
    react: "🎥"
},
async (socket, msg, m, { from, args }) => {
    const sender = from;
    const DEFAULT_FOOTER = `\n\n> 𝚁𝙴𝙰𝙿𝙴𝚁-𝙼𝙳`;

    if (!args.length) {
        await socket.sendMessage(sender, {
            text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n🎬 *Example:*\n• .cinesubz Avatar\n• .cine Spider Man\n\n📝 _Please provide the Movie/Show name!_${DEFAULT_FOOTER}`
        }, { quoted: msg });
        return;
    }

    const cinesubQuery = args.join(' ');
    await socket.sendMessage(sender, { 
        text: `*( SEARCHING )*\n\n🎥 *Searching on Cinesubz...*`
    });

    const API_BASE = "https://api.chamindu.site/api/v1/movies/cinesubz";
    const API_KEY = "chama_api_c061426fd75a3e6acdd84a66a6c81e07"; 
    const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500";

    try {
        const [movieRes, tvRes] = await Promise.allSettled([
            axios.get(`\( {API_BASE}/search?q= \){encodeURIComponent(cinesubQuery)}&api_key=${API_KEY}`, { timeout: 15000 }),
            axios.get(`\( {API_BASE}/tv/search?q= \){encodeURIComponent(cinesubQuery)}&api_key=${API_KEY}`, { timeout: 15000 })
        ]);

        let resultsArray = [];

        const extractData = (res, isTv) => {
            if (res.status === "fulfilled" && res.value?.data) {
                const resData = res.value.data;
                const items = resData.result || resData.data || (Array.isArray(resData) ? resData : []);
                if (Array.isArray(items)) {
                    items.forEach(item => resultsArray.push({ ...item, isTv }));
                }
            }
        };

        extractData(movieRes, false);
        extractData(tvRes, true);

        if (!resultsArray || resultsArray.length === 0) {
            await socket.sendMessage(sender, {
                text: `*❪ NO RESULTS ❫*\n\n😞 *No Results Found!*\n\n🎬 *Query:* _\( {cinesubQuery}_\n💡 *Tip:* Movie/TV Series එකේ නම හරියටම Type කරන්න (උදා: Avatar, Newtopia) \){DEFAULT_FOOTER}`
            }, { quoted: msg });
            return;
        }

        const cinesubResults = resultsArray.slice(0, 15);
        
        let listText = `*REAPER-MD SEARCH*\n\n` +
            `*Entered Name ||* ${cinesubQuery}\n\n` +
            `*🔢 Reply below number*\n\n` +
            `*[Results from cinesubz.co]*\n\n`;

        cinesubResults.forEach((item, index) => {
            const num = index + 1;
            const title = item.title || item.name || "Movie/TV Show";
            const tag = item.isTv ? " (TV Series)" : "";
            listText += `🔸 *${num} ❯❯◦* \( {title} \){tag}\n`;
        });

        listText += DEFAULT_FOOTER;

        const sentMsg = await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const handleSelection = async ({ messages: replyMessages }) => {
            try {
                const replyMek = replyMessages[0];
                if (!replyMek?.message) return;

                const messageType = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text;
                const isReplyToSentMsg = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

                if (isReplyToSentMsg && sender === replyMek.key.remoteJid) {
                    const choice = parseInt(messageType) - 1;
                    if (isNaN(choice) || choice < 0 || choice >= cinesubResults.length) {
                        await socket.sendMessage(sender, { text: `*⚠️ Invalid number! Range: 1 - \( {cinesubResults.length}* \){DEFAULT_FOOTER}` }, { quoted: replyMek });
                        return;
                    }

                    socket.ev.off('messages.upsert', handleSelection);
                    const selectedItem = cinesubResults[choice];
                    const targetLink = selectedItem.link || selectedItem.url || selectedItem.id;

                    await socket.sendMessage(sender, { text: `*( FETCHING )*\n\n🎬 *Fetching Details...*` }, { quoted: replyMek });

                    let itemInfo = {};
                    let validDownloads = [];

                    try {
                        if (!selectedItem.isTv) {
                            const detailsResponse = await axios.get(`\( {API_BASE}/infodl?q= \){encodeURIComponent(targetLink)}&api_key=${API_KEY}`, { timeout: 20000 });
                            const detailsData = detailsResponse.data;
                            itemInfo = detailsData.result || detailsData.data || detailsData || {};

                            const rawDl = itemInfo.dl_links || itemInfo.downloads || itemInfo.download_links || itemInfo.links || [];
                            if (Array.isArray(rawDl)) {
                                rawDl.forEach(dl => {
                                    validDownloads.push({
                                        quality: dl.quality || dl.title || dl.resolution || "WEB-DL 720p",
                                        link: dl.link || dl.url || dl.download,
                                        size: dl.size || dl.filesize || ''
                                    });
                                });
                            }
                        } else {
                            const tvInfoResponse = await axios.get(`\( {API_BASE}/tv/info?q= \){encodeURIComponent(targetLink)}&api_key=${API_KEY}`, { timeout: 20000 });
                            const tvData = tvInfoResponse.data;
                            itemInfo = tvData.result || tvData.data || tvData || {};

                            const episodesList = itemInfo.episodes || itemInfo.dl_links || itemInfo.downloads || itemInfo.episodes_list || [];
                            if (Array.isArray(episodesList)) {
                                episodesList.forEach(ep => {
                                    validDownloads.push({
                                        quality: ep.title || ep.name || ep.episode || ep.quality || "Episode",
                                        link: ep.link || ep.url || ep.id,
                                        size: ep.size || ep.filesize || '',
                                        isTvEp: true
                                    });
                                });
                            }
                        }
                    } catch (fetchErr) {
                        console.error('Fetch Details Error:', fetchErr);
                        await socket.sendMessage(sender, { text: `*❌ Failed to fetch details from API!*${DEFAULT_FOOTER}` }, { quoted: replyMek });
                        return;
                    }

                    const titleText = itemInfo.title || selectedItem.title || selectedItem.name || "Movie/TV Show";
                    const rawPoster = itemInfo.image || itemInfo.thumbnail || itemInfo.poster || itemInfo.cover || selectedItem.image || selectedItem.thumbnail;
                    const posterUrl = (rawPoster && typeof rawPoster === 'string' && rawPoster.startsWith('http')) ? rawPoster : DEFAULT_IMAGE;

                    let formattedCast = 'N/A';
                    if (Array.isArray(itemInfo.cast)) {
                        formattedCast = itemInfo.cast.map(c => typeof c === 'object' ? (c.name || c.actor || c.character || '') : c).filter(Boolean).join(', ');
                    } else if (typeof itemInfo.cast === 'object' && itemInfo.cast !== null) {
                        formattedCast = itemInfo.cast.name || itemInfo.cast.actor || 'N/A';
                    } else if (itemInfo.cast) {
                        formattedCast = itemInfo.cast;
                    }

                    let formattedGenres = 'N/A';
                    if (Array.isArray(itemInfo.genres)) {
                        formattedGenres = itemInfo.genres.map(g => typeof g === 'object' ? (g.name || g.title || '') : g).filter(Boolean).join(', ');
                    } else if (itemInfo.genres) {
                        formattedGenres = itemInfo.genres;
                    }

                    const detailsCardText = `☘️ *Tɪᴛʟᴇ* ☛ *_${titleText}_*\n\n` +
                        `*▫️📅 𝗥ᴇʟᴇᴀꜱᴇ 𝗗ᴀᴛᴇ* ☛ *_${itemInfo.releaseDate || itemInfo.year || itemInfo.date || 'N/A'}_*\n` +
                        `*▫️🌎 𝗖ᴏᴜɴᴛʀʏ* ☛ *_${itemInfo.country || itemInfo.language || 'Sinhala Sub'}_*\n` +
                        `*▫️⏱️ 𝗗ᴜ𝗥ᴀᴛɪᴏɴ* ☛ *_${itemInfo.duration || itemInfo.runtime || itemInfo.status || 'N/A'}_*\n` +
                        `*▫️🎭 𝗚ᴇɴ𝗥ᴇꜱ* ☛ *_${formattedGenres}_*\n` +
                        `*▫️👨🏻‍💼 𝗗ɪ𝗥ᴇᴄᴛᴏ𝗥* ☛ *_${itemInfo.director || 'N/A'}_*\n` +
                        `*▫️🕵️‍♂️ 𝗖ᴀsᴛ* ☛ *_${formattedCast}_*\n\n` +
                        `*➟➟➟➟➟➟➟➟➟➟➟➟➟➟*\n` +
                        `*▫️🔗 𝗝ᴏɪɴ* ☛ *whatsapp.com/channel/0029VaeyMWv3QxRu4hA6c33Z*\n` +
                        `*➟➟➟➟➟➟➟➟➟➟➟➟➟➟*` +
                        DEFAULT_FOOTER;

                    try {
                        await socket.sendMessage(sender, {
                            image: { url: posterUrl },
                            caption: detailsCardText
                        }, { quoted: replyMek });
                    } catch (imgErr) {
                        console.error("Poster Error, Sending Text Only:", imgErr);
                        await socket.sendMessage(sender, { text: detailsCardText }, { quoted: replyMek });
                    }

                    if (!validDownloads || validDownloads.length === 0) {
                        await socket.sendMessage(sender, { text: `*⚠️ No download links found!*${DEFAULT_FOOTER}` }, { quoted: replyMek });
                        return;
                    }

                    const limitedDownloads = validDownloads.slice(0, 25);

                    let downloadOptionsText = `*Download..*\n\n` +
                        `🔢 *Reply below number*\n\n` +
                        `*[Direct Link]*\n\n`;

                    downloadOptionsText += limitedDownloads.map((dl, i) => {
                        const num = i + 1;
                        const qStr = dl.quality || `${num} Option`;
                        const sizeStr = dl.size ? ` : ${dl.size}` : '';
                        return `🔸 *${num} ❯❯◦* \( {qStr} \){sizeStr}`;
                    }).join('\n');

                    downloadOptionsText += DEFAULT_FOOTER;

                    const downloadOptionsMsg = await socket.sendMessage(sender, { text: downloadOptionsText }, { quoted: replyMek });
                    const optionsMsgID = downloadOptionsMsg.key.id;

                    const handleDownload = async ({ messages: downloadMessages }) => {
                        try {
                            const downloadMek = downloadMessages[0];
                            if (!downloadMek?.message) return;

                            const downloadChoice = downloadMek.message.conversation || downloadMek.message.extendedTextMessage?.text;
                            const isReplyToOptionsMsg = downloadMek.message.extendedTextMessage?.contextInfo?.stanzaId === optionsMsgID;

                            if (isReplyToOptionsMsg && sender === downloadMek.key.remoteJid) {
                                const choiceNum = parseInt(downloadChoice) - 1;
                                
                                if (isNaN(choiceNum) || choiceNum < 0 || choiceNum >= limitedDownloads.length) {
                                    await socket.sendMessage(sender, { text: `*⚠️ Wrong Number! Range: 1 - \( {limitedDownloads.length}* \){DEFAULT_FOOTER}` }, { quoted: downloadMek });
                                    return;
                                }

                                socket.ev.off('messages.upsert', handleDownload);

                                const selectedDownload = limitedDownloads[choiceNum];
                                await socket.sendMessage(sender, { react: { text: '📥', key: downloadMek.key } });

                                let finalDirectLink = selectedDownload.link || selectedDownload.url;

                                if (selectedDownload.isTvEp && finalDirectLink) {
                                    try {
                                        const epDlRes = await axios.get(`\( {API_BASE}/tv/dl?q= \){encodeURIComponent(finalDirect
