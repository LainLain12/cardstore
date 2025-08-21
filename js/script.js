document.addEventListener('DOMContentLoaded', function() {
    const dailyContent = document.getElementById('daily-content');
    const historyContent = document.getElementById('history-content');

    fetch('/api/images')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const dailyFolders = Object.keys(data.daily);
            const historyFolders = Object.keys(data.history);
            const allImages = { ...data.daily, ...data.history };

            function createImageGrid(folder, basePath, images) {
                const grid = document.createElement('div');
                grid.className = 'image-grid';
                const imageList = images[folder] || [];

                if (imageList.length === 0) {
                    grid.innerHTML = '<p>No images found in this category.</p>';
                    return grid;
                }

                imageList.forEach(imageName => {
                    const card = document.createElement('div');
                    card.className = 'image-card';
                    const img = document.createElement('img');
                    const imagePath = `${basePath}/${folder}/${imageName}`;
                    img.src = imagePath;
                    img.onerror = () => {
                        img.src = `https://placehold.co/300x400?text=${imageName.replace(/\.[^/.]+$/, "")}`;
                    };
                    card.appendChild(img);
                    grid.appendChild(card);
                });
                return grid;
            }

            function showImages(container, folder, loadFunction, basePath, images) {
                container.innerHTML = '';
                createBackButton(container, loadFunction);
                const grid = createImageGrid(folder, basePath, images);
                container.appendChild(grid);
            }

            function createBackButton(container, loadFunction) {
                const button = document.createElement('button');
                button.className = 'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect back-button';
                button.innerHTML = '<i class="material-icons">arrow_back</i> Back';
                button.addEventListener('click', () => {
                    loadFunction();
                });
                container.prepend(button);
            }

            function loadDailyTabs() {
                dailyContent.innerHTML = '';
                if (dailyFolders.length === 0) {
                    dailyContent.innerHTML = '<p>No daily categories found.</p>';
                    return;
                }

                const tabsContainer = document.createElement('div');
                tabsContainer.className = 'mdl-tabs mdl-js-tabs mdl-js-ripple-effect';
                
                const tabBar = document.createElement('div');
                tabBar.className = 'mdl-tabs__tab-bar';
                tabsContainer.appendChild(tabBar);

                dailyFolders.forEach((folder, index) => {
                    const panelId = `daily-panel-${folder.replace(/\s+/g, '-').toLowerCase()}`;
                    
                    const tabLink = document.createElement('a');
                    tabLink.href = `#${panelId}`;
                    tabLink.className = 'mdl-tabs__tab';
                    if (index === 0) tabLink.classList.add('is-active');
                    tabLink.textContent = folder;
                    tabBar.appendChild(tabLink);

                    const tabPanel = document.createElement('div');
                    tabPanel.className = 'mdl-tabs__panel';
                    if (index === 0) tabPanel.classList.add('is-active');
                    tabPanel.id = panelId;
                    
                    const grid = createImageGrid(folder, 'images/daily', allImages);
                    tabPanel.appendChild(grid);
                    tabsContainer.appendChild(tabPanel);
                });

                dailyContent.appendChild(tabsContainer);

                // Let MDL know about the new components
                if (window.componentHandler) {
                    componentHandler.upgradeElement(tabsContainer);
                }
            }

            function loadHistoryFolders() {
                historyContent.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'folder-grid';
                historyFolders.forEach(folder => {
                    const card = document.createElement('div');
                    card.className = 'folder-card';
                    card.innerHTML = `
                        <i class="material-icons">folder</i>
                        <p>${folder}</p>
                    `;
                    card.addEventListener('click', () => showImages(historyContent, folder, loadHistoryFolders, 'images/history', allImages));
                    grid.appendChild(card);
                });
                historyContent.appendChild(grid);
            }

            // Initial load
            loadDailyTabs();
            loadHistoryFolders();
        })
        .catch(error => {
            console.error('Error loading gallery data:', error);
            const errorMessage = '<p>Could not load gallery data. Please ensure you are running this on a web server and have run the `node generate-data.js` script.</p>';
            dailyContent.innerHTML = errorMessage;
            historyContent.innerHTML = errorMessage;
        });
});
