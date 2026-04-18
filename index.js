const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https'); // Behoztuk a HTTPS támogatást
const app = express();

const PRIMARY_URL = "https://s1.free-shoutcast.com/stream/18240";
const BACKUP_URL = "https://streaming-01.xtservers.com:7000/stream";

// Függvény, ami eldönti, melyik stream él
async function getStreamUrl() {
    try {
        // Az axios szerencsére alapból tudja az HTTPS-t, így az ellenőrzés jó lesz
        const response = await axios.head(PRIMARY_URL, { timeout: 3000 });
        return (response.status >= 200 && response.status < 400) ? PRIMARY_URL : BACKUP_URL;
    } catch (e) {
        return BACKUP_URL;
    }
}

app.get('/radio.mp3', async (req, res) => {
    const streamUrl = await getStreamUrl();
    
    // Kiválasztjuk, hogy a http vagy az https modult használjuk a link alapján
    const client = streamUrl.startsWith('https') ? https : http;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // A kiválasztott modullal kérjük le a zenét
    client.get(streamUrl, (streamRes) => {
        streamRes.pipe(res);
    }).on('error', (e) => {
        console.error("Hiba a stream továbbításakor:", e.message);
        res.end();
    });
});

// A fekete hátterű weboldal, amit kértél (pont úgy néz ki, mint az MP3 szerver)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Radio Player</title>
            <style>
                body {
                    background-color: #0e0e0e;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                audio {
                    filter: invert(100%) brightness(1.5);
                    width: 90%;
                    max-width: 400px;
                }
            </style>
        </head>
        <body>
            <audio id="player" controls autoplay>
                <source src="/radio.mp3" type="audio/mpeg">
            </audio>
            <script>
                const player = document.getElementById('player');
                // Ha elakadna, 3 másodperc múlva újra próbálkozik
                player.onerror = () => {
                    setTimeout(() => {
                        player.src = "/radio.mp3?t=" + Date.now();
                        player.load();
                        player.play();
                    }, 3000);
                };
            </script>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Rádió fut a ${PORT} porton`));
