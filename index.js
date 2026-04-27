const express = require('express');
const http = require('http');
const https = require('https');
const app = express();

const PRIMARY_URL = "https://s1.free-shoutcast.com/stream/18240";
const BACKUP_URL = "https://streaming-01.xtservers.com:7000/stream";

// Ide gyűjtjük a hallgatókat (Winamp, xat, web)
let clients = new Set();
let currentSourceUrl = null;
let sourceRequest = null;

// Ez a függvény küldi a zenét minden csatlakozott hallgatónak
function broadcast(chunk) {
    for (let client of clients) {
        client.write(chunk);
    }
}

// Ez a függvény csatlakozik rá a zene forrására (Élő vagy AutoDJ)
function connectToStream(url) {
    if (sourceRequest) {
        sourceRequest.destroy(); // Megállítjuk a korábbi letöltést
    }
    
    currentSourceUrl = url;
    console.log("Aktív forrás mostantól:", url === PRIMARY_URL ? "ÉLŐ ADÁS" : "AUTODJ");

    const client = url.startsWith('https') ? https : http;
    
    sourceRequest = client.get(url, (res) => {
        // Ahogy jön a zene másodpercenként, azonnal küldjük tovább a hallgatóknak
        res.on('data', (chunk) => {
            broadcast(chunk);
        });

        // Ha véget ér a zene (pl. megszakad az adás)
        res.on('end', () => {
            if (url === PRIMARY_URL) {
                console.log("Élő adás megszakadt! Váltás AutoDJ-re...");
                connectToStream(BACKUP_URL);
            }
        });
    }).on('error', (err) => {
        // Ha hiba van a kapcsolódással
        if (url === PRIMARY_URL) {
            console.log("Élő adás nem elérhető! Váltás AutoDJ-re...");
            connectToStream(BACKUP_URL);
        }
    });
}

// Indításkor megpróbálunk az élőre csatlakozni
connectToStream(PRIMARY_URL);

// HÁTTÉR-FIGYELŐ: 5 másodpercenként nézi, hogy visszatért-e az élő adás
setInterval(() => {
    // Csak akkor ellenőrizzük, ha épp az AutoDJ szól
    if (currentSourceUrl !== PRIMARY_URL) {
        const client = PRIMARY_URL.startsWith('https') ? https : http;
        client.get(PRIMARY_URL, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                console.log("Az Élő adás visszatért! Visszakapcsolás...");
                res.destroy(); // Csak ellenőriztük, most bontjuk
                connectToStream(PRIMARY_URL); // Éles váltás!
            } else {
                res.destroy();
            }
        }).on('error', () => {
            // Még offline, marad az AutoDJ
        });
    }
}, 5000); // 5000 milliszekundum = 5 másodperc


// --- WEBOLDAL ÉS VÉGPONTOK ---

// 1. Ébrentartó az UptimeRobotnak
app.get('/health', (req, res) => {
    res.status(200).send('Szerver OK!');
});

// 2. A fő MP3 link (Ezt tedd a Winampba és a xat.com-ra)
app.get('/radio.mp3', (req, res) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Hozzáadjuk a hallgatót a listához
    clients.add(res);

    // Ha a hallgató bezárja a Winampot / kilép a webről, levesszük a listáról
    req.on('close', () => {
        clients.delete(res);
    });
});

// 3. A Fekete Weboldal
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
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`A szünetmentes rádió elindult a ${PORT} porton!`));
