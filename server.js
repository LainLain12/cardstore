const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// If you're running behind a reverse proxy (nginx) that terminates TLS,
// enable trust proxy so req.protocol reflects the original protocol (https).
app.set('trust proxy', true);

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
    // ensure the share preview page is not cached by browsers or proxies
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
        const raw = req.params && req.params[0] ? req.params[0] : '';
    const host = req.get('host');
    // Prefer X-Forwarded-Proto when present (helps when behind TLS-terminating proxy)
    const protoHeader = (req.headers && req.headers['x-forwarded-proto']) ? String(req.headers['x-forwarded-proto']).split(',')[0] : null;
    const protocol = protoHeader || req.protocol;
    // Log User-Agent for diagnosis (useful to see which crawler requested the page)
    console.log('[image-page] UA=', req.headers['user-agent']);

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

        // If the client requested the path-encoded form (contains %2F), some proxies
        // or messengers may rewrite or redirect those requests. Redirect such requests
        // to the safer query-style URL which is less likely to be altered: /image?img=...
        try {
            const rawRequest = req.originalUrl || req.url || '';
            if (rawRequest.includes('%2F')) {
                const safe = `/image?img=${encodeURIComponent(urlPath)}`;
                console.log('[image-page] redirecting encoded-path request to', safe);
                return res.redirect(302, safe);
            }
        } catch (e) {
            // ignore
        }

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
            <meta property="og:image:secure_url" content="${fullImageUrl}">
            <meta name="twitter:image" content="${fullImageUrl}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:type" content="website">
            <meta name="twitter:card" content="summary_large_image">
            <style>
                body { margin:0; font-family: Arial, Helvetica, sans-serif; background:#111; color:#fff; display:flex; flex-direction:column; height:100vh; }
                .topbar { height:50px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; background:rgba(0,0,0,0.6); }
                .topbar a { color:#fff; text-decoration:none; font-size:18px; padding:8px; }
                .main { flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                .control-row { height:50px; display:flex; align-items:center; background:rgba(0,0,0,0.6); }
                .control-row a { color:#fff; text-decoration:none; font-weight:bold; }
                /* image area: full height minus topbar(50) and footer(50) => 100 total */
                .main img { display:block; margin:0 auto; max-width:100%; max-height:calc(100vh - 100px); object-fit:contain; object-position:center center; }
                .footer { height:50px; background:rgba(0,0,0,0.6); display:flex; align-items:center; }
                .thumb-strip { display:flex; overflow-x:auto; gap:8px; padding:6px; align-items:center; scroll-snap-type:x mandatory; width:100%; }
                .thumb-strip img { width:42px; height:42px; object-fit:cover; border-radius:6px; cursor:pointer; scroll-snap-align:center; border:2px solid transparent; }
                .thumb-strip img.selected { border-color:#0a3330; }
            </style>
        </head>
        <body>
            <div class="topbar">
                <a id="back-btn" href="${protocol}://${host}">&#8592;</a>
                <a id="close-btn" href="${protocol}://${host}">&#10005;</a>
            </div>
                <div class="control-row">
                    <!-- control row kept minimal; actions are placed beside the thumbnail carousel below -->
                </div>
            <div class="main">
                <img id="bigimg" src="${fullImageUrl}" alt="Preview">
            </div>
                <div class="footer">
                    <div class="thumb-strip-container" style="width:100%; display:flex; align-items:center;">
                        <a id="save-link" class="icon-btn save-btn" href="${fullImageUrl}" download title="Save" style="margin-left:8px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 20h14v-2H5v2zm7-18L5.33 9h3.84v6h6.66V9h3.84L12 2z"/></svg>
                        </a>
                        <div style="flex:1; overflow:hidden;">
                            <div class="thumb-strip" id="thumb-strip" role="list"></div>
                        </div>
                        <a id="copy-link" class="icon-btn copy-link-btn" href="#" title="Copy link" style="margin-right:8px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        </a>
                    </div>
                </div>

            <script>
                const images = ${JSON.stringify(urls)};
                const big = document.getElementById('bigimg');
                const thumbStrip = document.getElementById('thumb-strip');

                images.forEach((u) => {
                    const thumb = document.createElement('img');
                    thumb.dataset.url = u;
                    thumb.src = u;
                    thumb.addEventListener('click', () => {
                        big.src = u;
                        Array.from(thumbStrip.children).forEach(t => t.classList.toggle('selected', t.dataset.url === u));
                    });
                    thumbStrip.appendChild(thumb);
                });

                // highlight the currently loaded image
                const initialUrl = '${serverInitialUrl}';
                setTimeout(() => { big.src = initialUrl; Array.from(thumbStrip.children).forEach(t => t.classList.toggle('selected', t.dataset.url === initialUrl)); }, 10);

                // Wire copy/save controls: copy the share page URL to clipboard
                const copyBtn = document.getElementById('copy-link');
                if (copyBtn) {
                    copyBtn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        navigator.clipboard.writeText('${pageUrl}').catch(()=>{});
                    });
                }

                // No small-text footer controls; actions are handled by the icon buttons flanking the carousel.
            </script>
        </body>
        </html>`;

        res.send(html);
    } catch (err) {
        console.error('Error building image share page:', err);
        res.status(500).send('Server error');
    }
});

// Fallback share route that accepts an image path as a query parameter.
// Some crawlers normalize encoded slashes (%2F) and may not request the
// path-encoded route correctly — this route is a safe alternative to share
// as: /image?img=images/daily/folder/photo.jpg
app.get('/image', (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const raw = req.query && req.query.img ? String(req.query.img) : '';
        console.log('[image-fallback] raw=', raw, ' headers=', JSON.stringify(req.headers || {}));

        // decode then normalize
        let decoded = '';
        try { decoded = decodeURIComponent(raw); } catch (e) { decoded = raw; }
        const normalized = path.normalize(decoded);

        const absolute = path.resolve(__dirname, normalized);
        const imagesRoot = path.resolve(imagesDir);
        if (!absolute.startsWith(imagesRoot + path.sep) && absolute !== imagesRoot) {
            return res.status(404).send('Image not found');
        }
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
            return res.status(404).send('Image not found');
        }

    const host = req.get('host');
    const protoHeader = (req.headers && req.headers['x-forwarded-proto']) ? String(req.headers['x-forwarded-proto']).split(',')[0] : null;
    const protocol = protoHeader || req.protocol;
    console.log('[image-fallback] UA=', req.headers['user-agent']);
        const urlPath = normalized.split(path.sep).join('/');
        const fullImageUrl = `${protocol}://${host}/${encodeURI(urlPath)}`;
        const pageUrl = `${protocol}://${host}/image?img=${encodeURIComponent(urlPath)}`;

        // reuse thumbnail enumeration logic
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

        // render the exact same HTML as the /image-page route (simplified here)
        const serverInitialUrl = '/' + encodeURI(path.relative(__dirname, absolute).split(path.sep).join('/'));
        const html = `<!doctype html><html><head>
            <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Thaicard Store Image</title>
            <meta property="og:title" content="Thaicard Store Image">
            <meta property="og:description" content="Check out this image from Thaicard Store.">
            <meta property="og:image" content="${fullImageUrl}">
            <meta property="og:image:secure_url" content="${fullImageUrl}">
            <meta name="twitter:image" content="${fullImageUrl}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:type" content="website">
            <meta name="twitter:card" content="summary_large_image">
        </head><body>
        <p>This is a share page for an image. If you see this text it's OK — scrapers read OG meta above.</p>
        </body></html>`;

        res.send(html);
    } catch (err) {
        console.error('Error building fallback image page:', err);
        res.status(500).send('Server error');
    }
});

// Serve images with conservative caching so updated images appear promptly.
// In production you may want long-lived caching with versioned filenames instead.
app.use('/images', express.static(path.join(__dirname, 'images'), {
    setHeaders: (res, filePath) => {
        // For image files, instruct browsers to validate on each request (no aggressive caching)
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
}));

// Serve other static files (HTML/CSS/JS) with default behavior. If you want
// cache control here too, adjust options or add routes for specific assets.
app.use(express.static(__dirname));

app.listen(port, () => {
    console.log(`Thaicard Store server running at http://localhost:${port}`);
});
