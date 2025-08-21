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

app.listen(port, () => {
    console.log(`Thaicard Store server running at http://localhost:${port}`);
});
