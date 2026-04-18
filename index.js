const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const app = express();

// A két rádió linkje
const PRIMARY_URL = "https://s1.free-shoutcast.com/stream/18240";
const BACKUP_URL = "https://streaming-01.xtservers.com:7000/stream";

// 1. ÁLLAPOT ELLENŐRZŐ (UptimeRobot-hoz)
// Ezt a linket rakd be az UptimeRobotba: https://radio-server-autodj.onrender.com/health
app.get('/health', (req, res) => {
    res.status(200).send('A szerver online és ébren van!');
});

// 2. A RÁDIÓ STREAM (Winamp-hoz, xat.com-hoz és a lejátszóhoz)
// Link: https://radio-server-autodj.onrender.com/radio.mp3
app.get('/radio.mp3', async (req, res) => {
    let streamUrl = BACKUP_URL;

    try {
        // Megnézzük, él-e az elsődleges adás (3 másodperces időkorlát)
        const response = await axios.head(PRIMARY_URL, { timeout: 3000 });
        if (response.status >= 200 && response.status < 400) {
            streamUrl = PRIMARY_URL;
        }
    } catch (e) {
        // Ha hiba van, marad a BACKUP_URL
        streamUrl = BACKUP_URL;
    }

    // Kiválasztjuk a megfelelő modult (http vagy https) a link alapján
    const client = streamUrl.startsWith('https') ? https : http;

    // Fejlécek beállítása a folyamatos lejátszáshoz
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // A stream átküldése a hallgatónak
    client.get(streamUrl, (streamRes) => {
        streamRes.pipe(res);
    }).on('error', (err) => {
        console.error("Stream hiba:", err.message);
        res.end();
    });
});

// 3. A WEBOLDAL (Fekete háttér, középen a lejátszóval)
// Link: https://radio-server-autodj.onrender.com
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="hu">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Radio Player</title>
            <style>
                body {
                    background-color: #000;
                    margin: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    overflow: hidden;
                }
                audio {
                    filter: invert(100%) brightness(1.5);
                    width: 300px;
                }
            </style>
        </head>
        <body>
            <audio id="player" controls autoplay>
                <source src="/radio.mp3" type="audio/mpeg">
            </audio>

            <script>
                const player = document.getElementById('player');
                
                // Ha megszakadna a zene, 2 másodperc múlva automatikusan újraindítja
                player.onerror = function() {
                    console.log("Adás megszakadt, újracsatlakozás...");
                    setTimeout(() => {
                        player.src = "/radio.mp3?t=" + Date.now();
                        player.load();
                        player.play();
                    }, 2000);
                };

                // 20 másodpercenként "láthatatlanul" frissíti a forrást, 
                // hogy ha visszajött az élő adás, átváltson rá
                setInterval(() => {
                    fetch('/radio.mp3', { method: 'HEAD' }).then(() => {
                        // Itt nem kell tenni semmit, a szerver oldali proxy 
                        // a következő kérésnél már a jót fogja adni.
                    });
                }, 20000);
            </script>
        </body>
        </html>
    `);
});

// Szerver indítása (Render.com porton)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log("Rádió szerver sikeresen elindult!");
    console.log("Port: " + PORT);
    console.log("-----------------------------------------");
});
