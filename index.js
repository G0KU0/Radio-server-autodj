const express = require('express');
const axios = require('axios');
const http = require('http');
const app = express();

const PRIMARY_URL = "https://s1.free-shoutcast.com/stream/18240";
const BACKUP_URL = "https://streaming-01.xtservers.com:7000/stream";

// Ellenőrizzük, hogy él-e a fő adás
async function getStreamUrl() {
    try {
        const response = await axios.head(PRIMARY_URL, { timeout: 2000 });
        return (response.status >= 200 && response.status < 400) ? PRIMARY_URL : BACKUP_URL;
    } catch (e) {
        return BACKUP_URL;
    }
}

app.get('/radio.mp3', async (req, res) => {
    const streamUrl = await getStreamUrl();
    
    res.setHeader('Content-Type', 'audio/mpeg');
    
    // Átküldjük a streamet a hallgatónak
    http.get(streamUrl, (streamRes) => {
        streamRes.pipe(res);
    }).on('error', (e) => {
        res.end();
    });
});

// Egy egyszerű fekete weboldal a lejátszóval
app.get('/', (req, res) => {
    res.send(`
        <body style="background:black;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
            <audio controls autoplay style="filter:invert(1);">
                <source src="/radio.mp3" type="audio/mpeg">
            </audio>
        </body>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rádió fut a ${PORT} porton`));
