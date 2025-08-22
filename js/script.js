document.addEventListener('DOMContentLoaded', function() {
    const dailyContent = document.getElementById('daily-content');
    const historyContent = document.getElementById('history-content');
    const headerEl = document.querySelector('.mdl-layout__header');


    // Enforce fixed logo size to 52x24 (small) as requested.
    function adjustLogoSize() {
        const logo = document.querySelector('.logo');
        if (!logo) return;
        logo.style.width = '52px';
        logo.style.height = '24px';
        logo.style.objectFit = 'contain';
    }

    // Apply fixed sizing once and on resize/orientation to ensure consistency
    window.addEventListener('resize', adjustLogoSize);
    window.addEventListener('orientationchange', adjustLogoSize);
    const initLogo = document.querySelector('.logo');
    if (initLogo) initLogo.addEventListener('load', adjustLogoSize);
    adjustLogoSize();
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalClose = modal.querySelector('.close-button');

    // Close modal when close button clicked - prefer going back in history so we return to previous tab/state
    modalClose.addEventListener('click', () => {
        if (window.history && window.history.length > 1) {
            try { window.history.back(); return; } catch (e) { /* fallback */ }
        }
        // fallback to root if no history entry to go back to
        window.location.href = '/';
    });

    // Close modal when clicking outside the image
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modalImage.src = '';
            document.body.style.overflow = ''; // restore scroll
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
                modalImage.src = '';
            }
        }
    });

    // Modal-level copy/save hooks
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.id === 'modal-copy') {
            e.preventDefault(); e.stopPropagation();
            const toCopy = target.dataset && target.dataset.pageUrl ? target.dataset.pageUrl : null;
            if (toCopy) { navigator.clipboard.writeText(toCopy).catch(()=>{}); }
        }
        if (target && target.id === 'modal-save') {
            // let the anchor behave as download by default
        }
    });

    // delegated handler for icon buttons (modal footer and in-grid small buttons)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.icon-btn');
        if (!btn) return;
        // handle copy buttons
        if (btn.classList.contains('copy-link-btn')) {
            e.preventDefault(); e.stopPropagation();
            // modal copy has dataset.pageUrl, grid copy triggers navigation already
            const toCopy = btn.dataset && btn.dataset.pageUrl ? btn.dataset.pageUrl : null;
            if (toCopy) {
                navigator.clipboard.writeText(toCopy).catch(()=>{});
            } else {
                // fallback: try to derive from nearest image
                const modalImage = document.getElementById('modal-image');
                if (modalImage && modalImage.src) {
                    const p = `${window.location.origin}/image-page/${encodeURIComponent(modalImage.src)}`;
                    navigator.clipboard.writeText(p).catch(()=>{});
                }
            }
            return;
        }
        // save/download buttons: default anchor download should work; prevent modal open
        if (btn.classList.contains('save-btn')) {
            e.stopPropagation();
            // no extra logic; anchor download will trigger
            return;
        }
    });

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

                    // Share button area
                    const shareArea = document.createElement('div');
                    shareArea.style.marginTop = '8px';
                    shareArea.style.display = 'flex';
                    shareArea.style.justifyContent = 'center';
                    shareArea.style.gap = '8px';

                    const pageUrl = `${window.location.origin}/image-page/${encodeURIComponent(imagePath)}`;

                    // Save and Copy text buttons (main grid previous style)
                    const save = document.createElement('a');
                    save.href = imagePath;
                    save.download = imageName || '';
                    save.textContent = 'Save';
                    save.className = 'save-btn';
                    save.style.padding = '6px 10px';
                    save.style.borderRadius = '4px';
                    save.style.color = '#fff';
                    // prevent clicks on the save link from opening the modal
                    save.addEventListener('click', (ev) => { ev.stopPropagation(); });

                    const copy = document.createElement('a');
                    copy.href = '#';
                    copy.textContent = 'Copy';
                    copy.className = 'copy-link-btn';
                    copy.style.padding = '6px 10px';
                    copy.style.borderRadius = '4px';
                    copy.style.color = '#fff';
                    copy.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // copy the share-page URL only (do not open modal)
                        navigator.clipboard.writeText(pageUrl).catch(()=>{});
                    });

                    shareArea.appendChild(save);
                    shareArea.appendChild(copy);
                    card.appendChild(shareArea);

                    // open modal helper - show a large image and thumbnail footer for navigation
                    function openModalWithImage(initialSrc) {
                        const modal = document.getElementById('image-modal');
                        const modalImage = document.getElementById('modal-image');
                        const shareButtonsContainer = document.getElementById('share-buttons');
                        const thumbStrip = document.getElementById('thumb-strip');

                        // Build list of thumbnails: other images in the same folder
                        const thumblist = imageList.map(name => `${basePath}/${folder}/${name}`);

                        let currentIndex = Math.max(0, thumblist.indexOf(initialSrc));

                        function showMain(src, index) {
                            // update modal image (single image view)
                            modalImage.src = src;
                            // update modal icon buttons (beside footer)
                            const modalSave = document.getElementById('modal-save');
                            const modalCopy = document.getElementById('modal-copy');
                            if (modalSave) { modalSave.href = src; modalSave.setAttribute('download', ''); }
                            if (modalCopy) { modalCopy.dataset.pageUrl = `${window.location.origin}/image-page/${encodeURIComponent(src)}`; }
                            // update share buttons container too for backward compatibility
                            const pageUrlModal = `${window.location.origin}/image-page/${encodeURIComponent(src)}`;
                            // keep legacy container hidden but populated for compatibility
                            shareButtonsContainer.innerHTML = `
                                <a href="${src}" download class="save-btn" id="save-btn-modal" style="display:none">Save</a>
                                <a href="#" id="copy-link-modal" class="copy-link-btn" data-page-url="${pageUrlModal}" style="display:none">Copy</a>
                            `;
                            // Attach a single delegated listener if not already present
                            if (!shareButtonsContainer._copyListenerAttached) {
                                shareButtonsContainer.addEventListener('click', (ev) => {
                                    const target = ev.target;
                                    if (target && target.id === 'copy-link-modal') {
                                        ev.preventDefault(); ev.stopPropagation();
                                        const toCopy = target.getAttribute('data-page-url');
                                        if (toCopy) {
                                            navigator.clipboard.writeText(toCopy).catch(()=>{});
                                        }
                                    }
                                });
                                shareButtonsContainer._copyListenerAttached = true;
                            }

                            // highlight thumbnail and update currentIndex
                            const imgs = Array.from(thumbStrip.querySelectorAll('img'));
                            imgs.forEach((i, idx) => {
                                i.classList.toggle('selected', i.src === src);
                                if (i.src === src) currentIndex = idx;
                            });
                            // ensure the selected thumbnail is centered
                            const sel = imgs[currentIndex];
                            if (sel) sel.scrollIntoView({behavior:'smooth', inline:'center'});
                        }

                        // populate thumbnail strip and set modal image
                        thumbStrip.innerHTML = '';
                        thumblist.forEach((src, idx) => {
                            const t = document.createElement('img');
                            t.src = src;
                            t.addEventListener('click', (ev) => { ev.stopPropagation(); showMain(src, idx); t.scrollIntoView({behavior:'smooth', inline:'center'}); });
                            t.dataset.url = src;
                            thumbStrip.appendChild(t);
                        });

                        // open modal and show initial image
                        modal.style.display = 'block';
                        // prevent background scroll while modal is open
                        document.body.style.overflow = 'hidden';
                        const startIndex = Math.max(0, thumblist.indexOf(initialSrc));
                        showMain(initialSrc, startIndex);
                    }

                    // Clicking a grid image should generate the share link and forward to the standalone preview page
                    card.addEventListener('click', () => {
                        const pageUrl = `${window.location.origin}/image-page/${encodeURIComponent(imagePath)}`;
                        // Navigate to the share page so other users hitting this URL see the same big-image + footer view
                        window.location.href = pageUrl;
                    });

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
                    // If the URL fragment matches this panel, make it active. Otherwise default to first.
                    const currentHash = (window.location.hash || '').replace('#', '');
                    if (currentHash === panelId) {
                        tabLink.classList.add('is-active');
                    } else if (index === 0 && !tabBar.querySelector('.is-active')) {
                        tabLink.classList.add('is-active');
                    }
                    tabLink.textContent = folder;
                    tabBar.appendChild(tabLink);

                    const tabPanel = document.createElement('div');
                    tabPanel.className = 'mdl-tabs__panel';
                    if (currentHash === panelId) {
                        tabPanel.classList.add('is-active');
                    } else if (index === 0 && !tabsContainer.querySelector('.mdl-tabs__panel.is-active')) {
                        tabPanel.classList.add('is-active');
                    }
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
