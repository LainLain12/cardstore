const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

const imagesDir = path.join(__dirname, 'images');
const dailyDir = path.join(imagesDir, 'daily');
const historyDir = path.join(imagesDir, 'history');

// Serve static files from the root directory (html, css, js, images)
app.use(express.static(__dirname));

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
        const imagePath = req.params && req.params[0] ? req.params[0] : '';
        const host = req.get('host');
        const protocol = req.protocol;
        const fullImageUrl = `${protocol}://${host}/${imagePath}`;
        const pageUrl = `${protocol}://${host}${req.originalUrl}`;

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
            <meta http-equiv="refresh" content="0;url=${protocol}://${host}">
        </head>
        <body>
            <p>If you are not redirected automatically, <a href="${protocol}://${host}">click here</a>.</p>
        </body>
        </html>`;

        res.send(html);
});

app.listen(port, () => {
    console.log(`Thaicard Store server running at http://localhost:${port}`);
});
