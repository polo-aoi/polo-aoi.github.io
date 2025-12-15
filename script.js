const container = document.getElementById('posts-container');
const tagPanel = document.getElementById('tagPanel');
const tagGrid = document.getElementById('tagGrid');
const filterBtn = document.getElementById('filterBtn');
const filterBtnText = document.getElementById('filterBtnText');

let currentTag = 'All'; 
let isPanelOpen = false;

function init() {
    // 排序逻辑：优先按日期降序，如果日期相同，保持数组原顺序
    blogData.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        const diff = timeB - timeA;
        return diff !== 0 ? diff : 0;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const tagParam = urlParams.get('tag');

    renderTagMenu();

    if (tagParam) {
        filterByTag(tagParam, false);
    } else {
        renderPosts(blogData);
    }

    if (postId) openArticle(postId);
}

function toggleTagPanel() {
    isPanelOpen = !isPanelOpen;
    tagPanel.style.display = isPanelOpen ? 'block' : 'none';
    if(isPanelOpen) {
        filterBtn.style.borderColor = 'var(--primary)';
    } else {
        if(currentTag === 'All') filterBtn.style.borderColor = 'var(--line-color)';
    }
}

function renderTagMenu() {
    const allTags = new Set();
    blogData.forEach(post => {
        if(post.tags) post.tags.forEach(t => allTags.add(t));
    });
    const tagsArray = ['All', ...Array.from(allTags)];
    tagGrid.innerHTML = tagsArray.map(tag => `
        <button class="tag-option ${tag === currentTag ? 'selected' : ''}" onclick="selectTag('${tag}')">${tag}</button>
    `).join('');
}

function selectTag(tag) {
    toggleTagPanel();
    filterByTag(tag, true);
}

function filterByTag(tag, updateUrl = true) {
    currentTag = tag;
    filterBtnText.innerText = tag === 'All' ? 'Tags' : tag;
    if (tag !== 'All') filterBtn.classList.add('active');
    else filterBtn.classList.remove('active');

    const options = document.getElementsByClassName('tag-option');
    Array.from(options).forEach(opt => {
        if(opt.innerText === tag) opt.classList.add('selected');
        else opt.classList.remove('selected');
    });

    if (updateUrl) {
        const newUrl = tag === 'All' ? window.location.pathname : '?tag=' + tag;
        window.history.pushState({ tag: tag }, '', newUrl);
    }

    // 调用统一的筛选函数
    filterPostsCombined();
}

// 将搜索逻辑和标签逻辑合并
function filterPostsCombined() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    
    let filtered = blogData;

    // 1. 先筛选标签
    if (currentTag !== 'All') {
        filtered = filtered.filter(post => post.tags && post.tags.includes(currentTag));
    }

    // 2. 再筛选搜索词
    if (query) {
        filtered = filtered.filter(post => {
            // 这里我们检索原始内容（Markdown），并尝试移除标签符号影响
            const plainContent = stripHtml(marked.parse(post.content)).toLowerCase();
            return post.title.toLowerCase().includes(query) || 
                   post.date.toLowerCase().includes(query) || 
                   post.desc.toLowerCase().includes(query) ||
                   plainContent.includes(query);
        });
    }

    renderPosts(filtered, query);
}

function renderPosts(data, highlightKeyword = null) {
    container.innerHTML = "";
    if(data.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#999; margin-top:50px;">No matches found.</div>`;
        return;
    }

    data.forEach(post => {
        let displayDesc = post.desc;
        let imgHTML = '';
        let tagsHTML = '';
        
        if (post.tags) {
            tagsHTML = post.tags.map(t => `<span class="card-tag">${t}</span>`).join('');
        }

        if (highlightKeyword) {
            // 搜索时，先用 marked 把 markdown 转成 html，再剥离标签取纯文本，最后高亮
            const htmlContent = marked.parse(post.content);
            const plainText = stripHtml(htmlContent);
            const snippet = getSmartSnippet(plainText, highlightKeyword);
            if (snippet) displayDesc = snippet; 
        }

        if (post.cover && post.cover !== "") {
            imgHTML = `<img src="${post.cover}" class="post-cover-thumb" loading="lazy" onerror="this.style.display='none'">`;
        }

        const cardHTML = `
            <div class="post-card" onclick="onCardClick('${post.id}')">
                <div class="card-header-row">
                    <span class="post-meta">${post.date}</span>
                    ${tagsHTML}
                </div>
                <h3 class="post-title">${post.title}</h3>
                ${imgHTML}
                <div class="post-excerpt">${displayDesc}</div>
                <span class="read-more-btn">Read Article</span>
            </div>
        `;
        container.innerHTML += cardHTML;
    });
}

function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function getSmartSnippet(fullText, keyword) {
    const lowerText = fullText.toLowerCase();
    const lowerKey = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKey);
    if (index === -1) return null;
    const start = Math.max(0, index - 20);
    const end = Math.min(fullText.length, index + lowerKey.length + 50);
    let snippet = fullText.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < fullText.length) snippet = snippet + "...";
    const regex = new RegExp(`(${keyword})`, 'gi');
    return snippet.replace(regex, '<span class="search-highlight">$1</span>');
}

function handleSearch() {
    filterPostsCombined();
}

function onCardClick(id) {
    window.history.pushState({ postId: id }, '', '?post=' + id);
    openArticle(id);
}

function openArticle(id) {
    const post = blogData.find(p => p.id === id);
    if(post) {
        // ✨✨✨ 核心：Markdown 解析 ✨✨✨
        // 这一步把 # Title 变成了 <h1>Title</h1>
        document.getElementById('reader-body').innerHTML = marked.parse(post.content);
        
        document.getElementById('article-reader').style.display = 'block';
        document.body.style.overflow = 'hidden';
        document.getElementById('article-reader').scrollTop = 0;
    }
}

function closeArticle() {
    window.history.pushState({}, '', window.location.pathname);
    document.getElementById('article-reader').style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onpopstate = function(event) {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    const tagParam = urlParams.get('tag');

    if (postId) openArticle(postId); 
    else if (tagParam) {
        document.getElementById('article-reader').style.display = 'none';
        filterByTag(tagParam, false);
    } else {
        document.getElementById('article-reader').style.display = 'none';
        document.body.style.overflow = 'auto';
        filterByTag('All', false);
    }
};

window.onload = init;