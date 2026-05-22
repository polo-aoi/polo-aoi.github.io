const container = document.getElementById('posts-container');

let currentCategory = null;

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const catParam = urlParams.get('category');

    if (catParam) {
        currentCategory = catParam;
        renderCategoryPage(catParam);
    } else {
        currentCategory = null;
        renderHome();
    }

    if (postId) openArticle(postId);
}

function getPublishedPosts() {
    return blogData.filter(p => !p.draft);
}

// ===== Homepage: Accordion =====

let expandedCat = null;

function getCategories() {
    return CATEGORIES;
}

function renderHome() {
    container.innerHTML = '';
    const published = getPublishedPosts();

    published.sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return diff !== 0 ? diff : 0;
    });

    const cats = getCategories();

    cats.forEach(cat => {
        const posts = published.filter(p => (p.category || '未分类') === cat);
        if (posts.length === 0) return;
        const latest = posts.slice(0, 3);
        const hasMore = posts.length > 3;

        const section = document.createElement('div');
        section.className = 'accordion-section';
        section.id = 'acc-' + cat;

        const isOpen = expandedCat === cat;

        section.innerHTML = `
            <div class="accordion-head" onclick="toggleAccordion('${escHtml(cat)}')">
                <span class="accordion-arrow">${isOpen ? '▼' : '▶'}</span>
                <span class="accordion-title">${escHtml(cat)}</span>
                <span class="accordion-count">${posts.length} 篇</span>
            </div>
            <div class="accordion-body" style="${isOpen ? '' : 'display:none;'}">
                ${latest.map(post => renderCard(post)).join('')}
                ${hasMore ? `<div class="accordion-more" onclick="event.stopPropagation();goCategory('${escHtml(cat)}')">展开全部 ${posts.length} 篇 →</div>` : ''}
            </div>
        `;
        container.appendChild(section);
    });
}

function toggleAccordion(cat) {
    expandedCat = expandedCat === cat ? null : cat;
    renderHome();
    const el = document.getElementById('acc-' + cat);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCard(post) {
    let tagsHTML = (post.tags || []).map(t => `<span class="card-tag">${t}</span>`).join('');
    let imgHTML = post.cover ? `<img src="${post.cover}" class="post-cover-thumb" loading="lazy" onerror="this.style.display='none'">` : '';

    return `
        <div class="post-card" onclick="onCardClick('${post.id}')">
            <div class="card-header-row">
                <span class="post-meta">${post.date}</span>
                ${tagsHTML}
            </div>
            <h3 class="post-title">${escHtml(post.title)}</h3>
            ${imgHTML}
            <div class="post-excerpt">${escHtml(post.desc || '')}</div>
            <span class="read-more-btn">Read Article</span>
        </div>
    `;
}

function goCategory(cat) {
    window.history.pushState({ category: cat }, '', '?category=' + cat);
    currentCategory = cat;
    renderCategoryPage(cat);
    window.scrollTo(0, 0);
}

// ===== Category Page =====

function renderCategoryPage(cat) {
    const published = getPublishedPosts();
    const posts = published.filter(p => p.category === cat);

    posts.sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return diff !== 0 ? diff : 0;
    });

    container.innerHTML = `
        <div class="category-page-head">
            <button class="back-btn" onclick="backToHome()">← 返回首页</button>
            <span class="cat-page-title">${cat}</span>
            <span class="cat-page-count">${posts.length} 篇</span>
        </div>
        ${posts.length === 0 ? '<div class="empty-msg">暂无文章</div>' : posts.map(post => renderCard(post)).join('')}
    `;
}

function backToHome() {
    window.history.pushState({}, '', window.location.pathname);
    currentCategory = null;
    renderHome();
}

// ===== Search =====

function handleSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!query) {
        if (currentCategory) {
            renderCategoryPage(currentCategory);
        } else {
            renderHome();
        }
        return;
    }

    const published = getPublishedPosts();
    const filtered = published.filter(post => {
        const plainContent = stripHtml(marked.parse(post.desc || '')).toLowerCase();
        return post.title.toLowerCase().includes(query) ||
            post.date.toLowerCase().includes(query) ||
            plainContent.includes(query);
    });

    container.innerHTML = filtered.length === 0
        ? '<div class="empty-msg">No matches found.</div>'
        : filtered.map(post => renderCard(post, query)).join('');
}

function onCardClick(id) {
    window.history.pushState({ postId: id }, '', '?post=' + id);
    openArticle(id);
}

// ===== Article Reader =====

async function openArticle(id) {
    const post = blogData.find(p => p.id === id);
    if (!post) return;
    try {
        const resp = await fetch('posts/' + post.id + '.md');
        const md = await resp.text();
        document.getElementById('reader-body').innerHTML = marked.parse(md);
    } catch (e) {
        document.getElementById('reader-body').innerHTML = '<p style="color:#888;">无法加载文章内容</p>';
    }
    document.getElementById('article-reader').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.getElementById('article-reader').scrollTop = 0;
}

function closeArticle() {
    window.history.pushState({}, '', window.location.pathname);
    document.getElementById('article-reader').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ===== Helpers =====

function escHtml(s) {
    s = s || '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripHtml(html) {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function getSmartSnippet(fullText, keyword) {
    const lowerText = fullText.toLowerCase();
    const lowerKey = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKey);
    if (index === -1) return null;
    const start = Math.max(0, index - 20);
    const end = Math.min(fullText.length, index + lowerKey.length + 50);
    let snippet = fullText.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < fullText.length) snippet = snippet + '...';
    const regex = new RegExp(`(${keyword})`, 'gi');
    return snippet.replace(regex, '<span class="search-highlight">$1</span>');
}

// ===== Popstate =====

window.onpopstate = function (event) {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const catParam = urlParams.get('category');

    if (postId) {
        openArticle(postId);
    } else if (catParam) {
        currentCategory = catParam;
        renderCategoryPage(catParam);
        document.getElementById('article-reader').style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        currentCategory = null;
        document.getElementById('article-reader').style.display = 'none';
        document.body.style.overflow = 'auto';
        renderHome();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
