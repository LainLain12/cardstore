const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

const imagesDir = path.join(__dirname, 'images');
const dailyDir = path.join(imagesDir, 'daily');
const historyDir = path.join(imagesDir, 'history');

// NOTE: static serving moved below route definitions so dynamic routes like
// /image-page/* are handled first (prevents static middleware from shadowing them)

// API endpoint to get the gallery data
app.get('/api/images', (req, res) => {
    function getSubdirectories(dir) {
        try {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
            return [];
        }
    }

    function getFiles(dir) {
        try {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { withFileTypes: true })
                .filter(dirent => dirent.isFile() && /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(dirent.name))
                .map(dirent => dirent.name);
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
            return [];
        }
    }

    const dailyFolders = getSubdirectories(dailyDir);
    const historyFolders = getSubdirectories(historyDir);

    const data = {
        daily: {},
        history: {}
    };

    dailyFolders.forEach(folder => {
        data.daily[folder] = getFiles(path.join(dailyDir, folder));
    });

    historyFolders.forEach(folder => {
        data.history[folder] = getFiles(path.join(historyDir, folder));
    });

    res.json(data);
});

// Dynamic route for generating a shareable page for a single image
// use a named wildcard parameter to avoid path-to-regexp parsing errors
app.get(/^\/image-page\/(.*)$/, (req, res) => {
    try {
        const raw = req.params && req.params[0] ? req.params[0] : '';
        const host = req.get('host');
        const protocol = req.protocol;

    // decode the incoming path (client used encodeURIComponent), then normalize
        let decoded = '';
        try {
            decoded = decodeURIComponent(raw);
        } catch (e) {
            decoded = raw;
        }

    // Diagnostic logging to help debug redirect issues
    console.log('[image-page] raw=', raw);
    console.log('[image-page] decoded=', decoded);

        // Normalize and prevent backpath traversal
        const normalized = path.normalize(decoded);

        // Resolve to absolute path and ensure it lives inside the images directory
        const absolute = path.resolve(__dirname, normalized);
        const imagesRoot = path.resolve(imagesDir);
        if (!absolute.startsWith(imagesRoot + path.sep) && absolute !== imagesRoot) {
            // invalid path
            return res.status(404).send('Image not found');
        }

        // Must be a file
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
            return res.status(404).send('Image not found');
        }

        // Build URL path with forward slashes and encode (preserve slashes)
        const urlPath = normalized.split(path.sep).join('/');
        const fullImageUrl = `${protocol}://${host}/${encodeURI(urlPath)}`;
        const pageUrl = `${protocol}://${host}/image-page/${encodeURIComponent(urlPath)}`;

        // Determine list of images in the same folder for the thumbnail carousel
        const folderAbsolute = path.dirname(absolute);
        let filesInFolder = [];
        try {
            filesInFolder = fs.readdirSync(folderAbsolute)
                .filter(name => /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(name))
                .sort();
        } catch (err) {
            filesInFolder = [path.basename(absolute)];
        }

        const folderUrlPath = path.relative(__dirname, folderAbsolute).split(path.sep).join('/');
        const urls = filesInFolder.map(fname => `/${encodeURI(folderUrlPath + '/' + fname)}`);

    // compute the initial URL path for the image shown on page load
    const serverInitialUrl = '/' + encodeURI(path.relative(__dirname, absolute).split(path.sep).join('/'));

    const html = `<!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Thaicard Store Image</title>
            <meta property="og:title" content="Thaicard Store Image">
            <meta property="og:description" content="Check out this image from Thaicard Store.">
            <meta property="og:image" content="${fullImageUrl}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:type" content="website">
            <meta name="twitter:card" content="summary_large_image">
            <style>
                body { margin:0; font-family: Arial, Helvetica, sans-serif; background:#111; color:#fff; display:flex; flex-direction:column; height:100vh; }
                .topbar { height:50px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; background:rgba(0,0,0,0.6); }
                .topbar a { color:#fff; text-decoration:none; font-size:18px; padding:8px; }
                .main { flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                /* image area: full height minus topbar(50) and footer(50) => 100 total */
                .main img { max-width:100%; max-height:calc(100vh - 100px); object-fit:contain; }
                .footer { height:50px; background:rgba(0,0,0,0.6); display:flex; align-items:center; }
                .thumb-strip { display:flex; overflow-x:auto; gap:8px; padding:6px; align-items:center; scroll-snap-type:x mandatory; width:100%; }
                .thumb-strip img { width:42px; height:42px; object-fit:cover; border-radius:6px; cursor:pointer; scroll-snap-align:center; border:2px solid transparent; }
                .thumb-strip img.selected { border-color:#0a3330; }
            </style>
        </head>
        <body>
            <div class="topbar">
                <a id="back-btn" href="${protocol}://${host}">&#8592; Back</a>
                <a id="close-btn" href="${protocol}://${host}">&#10005;</a>
            </div>
            <div class="main">
                <img id="bigimg" src="${fullImageUrl}" alt="Preview">
            </div>
            <div class="footer">
                <div class="thumb-strip" id="thumb-strip" role="list"></div>
            </div>

            <script>
                const images = ${JSON.stringify(urls)};
                const big = document.getElementById('bigimg');
                const thumbStrip = document.getElementById('thumb-strip');

                function setMain(url) {
                    big.src = url;
                    // update selected thumb and ensure it's visible
                    const imgs = Array.from(thumbStrip.children);
                    imgs.forEach(img => img.classList.toggle('selected', img.dataset.url === url));
                    const sel = imgs.find(i => i.dataset.url === url);
                    if (sel) sel.scrollIntoView({behavior:'smooth', inline:'center'});
                }

                images.forEach(u => {
                    const img = document.createElement('img');
                    img.dataset.url = u;
                    img.src = u;
                    img.addEventListener('click', () => setMain(u));
                    thumbStrip.appendChild(img);
                });

                // highlight the currently loaded image
                const initialUrl = '${serverInitialUrl}';
                setTimeout(() => setMain(initialUrl), 10);

                // touch swipe on big image to navigate
                let startX = 0;
                big.addEventListener('touchstart', (e) => startX = e.touches[0].clientX);
                big.addEventListener('touchend', (e) => {
                    const dx = e.changedTouches[0].clientX - startX;
                    if (Math.abs(dx) > 40) {
                        const imgs = Array.from(thumbStrip.querySelectorAll('img'));
                        const currentIndex = imgs.findIndex(i => i.classList.contains('selected'));
                        const next = dx > 0 ? Math.max(0, currentIndex - 1) : Math.min(imgs.length - 1, currentIndex + 1);
                        if (imgs[next]) imgs[next].click();
                    }
                });
            </script>
        </body>
        </html>`;

        res.send(html);
    } catch (err) {
        console.error('Error building image share page:', err);
        res.status(500).send('Server error');
    }
});

// Serve static files from the root directory (html, css, js, images)
app.use(express.static(__dirname));

app.listen(port, () => {
    console.log(`Thaicard Store server running at http://localhost:${port}`);
});
