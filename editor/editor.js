let currentPostId = null;
let currentCover = '';
let allPosts = [];
let allImages = [];
let currentTab = 'edit';
let saveTimer = null;

// ===== Init =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    fetchPosts();
    loadCategoryDropdown();
    setupEditor();
}

async function loadCategoryDropdown() {
    try {
        const res = await fetch('/api/categories');
        const cats = await res.json();
        const sel = document.getElementById('categorySelect');
        const prev = sel.value;
        sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
        if (prev && cats.includes(prev)) sel.value = prev;
    } catch(e) {}
}

// ===== Navigation =====
function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function showListView() {
    setActiveNav('nav-posts');
    document.getElementById('list-view').style.display = '';
    document.getElementById('editor-view').style.display = 'none';
    fetchPosts();
}

// ===== Post List =====
async function fetchPosts() {
    try {
        const res = await fetch('/api/posts');
        allPosts = await res.json();
        renderList();
    } catch (e) {
        console.error('Failed to fetch posts', e);
    }
}

function renderList() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filtered = allPosts.filter(p => {
        if (!q) return true;
        return p.title?.toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
            (p.desc || '').toLowerCase().includes(q);
    });

    document.getElementById('list-stats').textContent =
        `共 ${filtered.length} 篇文章（${allPosts.filter(p => p.draft).length} 篇草稿）`;

    const container = document.getElementById('post-list');
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p>暂无文章</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const isDraft = p.draft;
        const tagsHtml = (p.tags || []).map(t =>
            `<span class="post-item-tag">${esc(t)}</span>`
        ).join('');
        return `
            <div class="post-item" onclick="editPost('${p.id}')">
                <div class="post-item-info">
                    <div class="post-item-title">${esc(p.title) || '（无标题）'}</div>
                    <div class="post-item-meta">
                        <span class="post-item-date">${esc(p.date)}</span>
                        ${tagsHtml}
                        <span class="post-item-status ${isDraft ? 'status-draft' : 'status-live'}">
                            ${isDraft ? '草稿' : '已发布'}
                        </span>
                    </div>
                </div>
                <div class="post-item-actions">
                    <button onclick="event.stopPropagation(); editPost('${p.id}')">编辑</button>
                    <button class="danger" onclick="event.stopPropagation(); deletePost('${p.id}')">删除</button>
                </div>
            </div>`;
    }).join('');
}

function esc(s) {
    s = s || '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== New / Edit Post =====
function newPost() {
    setActiveNav('nav-new');
    currentPostId = null;
    currentCover = '';
    document.getElementById('titleInput').value = '';
    document.getElementById('categorySelect').value = '开发日志';
    document.getElementById('tagsInput').value = '';
    document.getElementById('editorTextarea').value = '';
    document.getElementById('coverPreview').textContent = '';
    document.getElementById('coverLabel').textContent = '封面';
    document.getElementById('coverBtn').classList.remove('has-cover');
    document.getElementById('draft-badge').style.display = '';
    document.getElementById('published-badge').style.display = 'none';
    document.getElementById('coverHint').style.display = 'none';
    clearSaveDot();
    switchTab('edit');
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('editor-view').style.display = '';
    document.getElementById('titleInput').focus();
    window.scrollTo(0, 0);
}

async function editPost(id) {
    setActiveNav(null);
    try {
        const res = await fetch('/api/posts/' + id);
        if (!res.ok) return;
        const post = await res.json();
        currentPostId = post.id;
        currentCover = post.cover || '';
        document.getElementById('titleInput').value = post.title || '';
        document.getElementById('categorySelect').value = post.category || '开发日志';
        document.getElementById('tagsInput').value = (post.tags || []).join(', ');
        document.getElementById('editorTextarea').value = post.content || '';
        updateCoverUI();
        if (post.draft) {
            document.getElementById('draft-badge').style.display = '';
            document.getElementById('published-badge').style.display = 'none';
        } else {
            document.getElementById('draft-badge').style.display = 'none';
            document.getElementById('published-badge').style.display = '';
        }
        clearSaveDot();
        switchTab('edit');
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('editor-view').style.display = '';
        window.scrollTo(0, 0);
    } catch (e) {
        console.error('Failed to load post', e);
    }
}

function backToList() {
    document.getElementById('list-view').style.display = '';
    document.getElementById('editor-view').style.display = 'none';
    currentPostId = null;
    setActiveNav('nav-posts');
    fetchPosts();
}

// ===== Tabs =====
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.getElementById('edit-pane').style.display = tab === 'edit' ? '' : 'none';
    document.getElementById('preview-pane').style.display = tab === 'preview' ? '' : 'none';
    if (tab === 'preview') {
        const md = document.getElementById('editorTextarea').value;
        document.getElementById('previewBody').innerHTML = marked.parse(md);
    }
}

// ===== Auto Save =====
function onEditorInput() {
    const dot = document.getElementById('saveDot');
    dot.classList.add('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const data = {
            postId: currentPostId,
            title: document.getElementById('titleInput').value,
            category: document.getElementById('categorySelect').value,
            tags: document.getElementById('tagsInput').value,
            content: document.getElementById('editorTextarea').value,
            cover: currentCover,
        };
        localStorage.setItem('editor_draft', JSON.stringify(data));
        dot.classList.remove('saving');
        document.getElementById('footerHint').textContent = '已自动保存到本地';
        setTimeout(() => {
            if (document.getElementById('footerHint').textContent === '已自动保存到本地') {
                document.getElementById('footerHint').textContent = '';
            }
        }, 2000);
    }, 1500);
}

function clearSaveDot() {
    document.getElementById('saveDot').classList.remove('saving');
}

// ===== Save / Publish =====
async function savePost(isDraft) {
    const title = document.getElementById('titleInput').value.trim();
    const category = document.getElementById('categorySelect').value;
    const tagsStr = document.getElementById('tagsInput').value.trim();
    const content = document.getElementById('editorTextarea').value;
    const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

    if (!title && !isDraft) {
        toast('请填写文章标题');
        return;
    }

    const body = { title, category, tags, content, cover: currentCover, draft: isDraft };

    try {
        if (currentPostId) {
            await fetch('/api/posts/' + currentPostId, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            toast(isDraft ? '草稿已保存' : '文章已更新');
        } else {
            const res = await fetch('/api/posts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            const data = await res.json();
            currentPostId = data.id;
            toast(isDraft ? '草稿已保存' : '文章已创建');
        }

        if (isDraft) {
            document.getElementById('draft-badge').style.display = '';
            document.getElementById('published-badge').style.display = 'none';
            localStorage.removeItem('editor_draft');
            document.getElementById('footerHint').textContent = '';
        } else {
            document.getElementById('draft-badge').style.display = 'none';
            document.getElementById('published-badge').style.display = '';
            localStorage.removeItem('editor_draft');
            document.getElementById('footerHint').textContent = '正在推送到 GitHub...';
            const msg = title || 'update blog';
            const pubRes = await fetch('/api/publish', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
            const result = await pubRes.json();
            if (result.ok) {
                toast('已发布并推送到 GitHub');
                document.getElementById('footerHint').textContent = '推送成功';
            } else {
                toast('Git 推送失败：' + (result.error || '未知错误'));
                document.getElementById('footerHint').textContent = '⚠ 推送失败，请检查 Git 配置';
            }
        }
    } catch (e) {
        toast('保存失败：' + e.message);
    }
}

// ===== Delete =====
async function deletePost(id) {
    if (!confirm('确定删除这篇文章？此操作不可撤销。')) return;
    try {
        await fetch('/api/posts/' + id, { method: 'DELETE' });
        toast('已删除');
        fetchPosts();
    } catch (e) {
        toast('删除失败');
    }
}

// ===== Image Upload =====
function setupEditor() {
    const area = document.getElementById('edit-pane');
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.background = 'rgba(0,68,204,0.02)'; });
    area.addEventListener('dragleave', () => { area.style.background = ''; });
    area.addEventListener('drop', async e => {
        e.preventDefault();
        area.style.background = '';
        for (const file of e.dataTransfer.files) {
            if (file.type.startsWith('image/')) await uploadImage(file);
        }
    });

    document.addEventListener('paste', async e => {
        for (const item of (e.clipboardData || {}).items || []) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                await uploadImage(item.getAsFile());
            }
        }
    });

    // Preview image click → lightbox
    document.getElementById('preview-pane').addEventListener('click', e => {
        if (e.target.tagName === 'IMG') {
            document.getElementById('lightboxImg').src = e.target.src;
            document.getElementById('lightbox').style.display = 'flex';
        }
    });
}

let lastUploadedImage = null;

async function uploadImage(file) {
    toast('上传并压缩中...');
    try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: form });
        const data = await res.json();
        if (data.path) {
            const ta = document.getElementById('editorTextarea');
            const mdImg = `![${file.name}](${data.path})`;
            ta.value = ta.value + '\n' + mdImg + '\n';
            ta.focus();
            ta.dispatchEvent(new Event('input'));
            lastUploadedImage = data.path;
            showCoverHint(data.path);
            toast('图片已上传（已压缩至 1600px）');
        } else {
            toast('上传失败');
        }
    } catch (e) {
        toast('上传失败：' + e.message);
    }
}

function showCoverHint(path) {
    const hint = document.getElementById('coverHint');
    hint.style.display = 'inline-flex';
    hint.title = path;
    clearTimeout(hint._timer);
    hint._timer = setTimeout(() => { hint.style.display = 'none'; }, 8000);
}

function setLastImageAsCover() {
    if (lastUploadedImage) {
        currentCover = lastUploadedImage;
        updateCoverUI();
        document.getElementById('coverHint').style.display = 'none';
        toast('已设为封面');
    }
}

async function uploadCoverFile(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    toast('上传封面中...');
    try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: form });
        const data = await res.json();
        if (data.path) {
            currentCover = data.path;
            updateCoverUI();
            closeCoverPicker();
            toast('封面上传成功');
        }
    } catch (e) {
        toast('上传失败');
    }
    input.value = '';
}

// ===== Cover Picker =====
async function openCoverPicker() {
    try {
        const res = await fetch('/api/images');
        allImages = await res.json();
        const grid = document.getElementById('cover-grid');
        if (allImages.length === 0) {
            grid.innerHTML = '<p style="color:#9ca3af;font-size:13px;grid-column:1/-1;">暂无图片，请先在文章中插入图片</p>';
        } else {
            grid.innerHTML = allImages.map(img =>
                `<img src="/${img}" class="${img === currentCover ? 'selected' : ''}"
                     onclick="selectCover('${img}')" title="${img}">`
            ).join('');
        }
        document.getElementById('cover-modal').style.display = '';
    } catch (e) {
        toast('加载图片列表失败');
    }
}

function selectCover(path) {
    currentCover = path;
    updateCoverUI();
    closeCoverPicker();
}

function clearCover() {
    currentCover = '';
    updateCoverUI();
    closeCoverPicker();
}

function closeCoverPicker() {
    document.getElementById('cover-modal').style.display = 'none';
}

function updateCoverUI() {
    const btn = document.getElementById('coverBtn');
    const label = document.getElementById('coverLabel');
    const preview = document.getElementById('coverPreview');
    if (currentCover) {
        btn.classList.add('has-cover');
        label.textContent = '封面 ✓';
        preview.textContent = currentCover;
    } else {
        btn.classList.remove('has-cover');
        label.textContent = '封面';
        preview.textContent = '';
    }
}

// ===== Toast =====
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._tid);
    el._tid = setTimeout(() => el.classList.remove('show'), 2500);
}

// ===== Category Manager =====

async function openCategoryManager() {
    setActiveNav('nav-categories');
    await renderCategoryManager();
    document.getElementById('category-modal').style.display = '';
}

let dragSrcIndex = null;

async function renderCategoryManager() {
    const res = await fetch('/api/categories');
    const cats = await res.json();
    const list = document.getElementById('category-list');
    list.innerHTML = cats.map((c, i) => `
        <div class="cat-item" id="cat-item-${escAttr(c)}"
             draggable="true"
             ondragstart="onDragStart(event, ${i})"
             ondragover="onDragOver(event)"
             ondragleave="onDragLeave(event)"
             ondrop="onDrop(event, ${i})"
             ondragend="onDragEnd(event)">
            <div class="drag-handle" title="拖拽排序">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
                </svg>
            </div>
            <span class="cat-name">${esc(c)}</span>
            <div class="cat-actions" id="cat-act-${escAttr(c)}">
                <button onclick="startRename('${escAttr(c)}')">重命名</button>
                <button class="del-cat" onclick="deleteCategory('${escAttr(c)}')">删除</button>
            </div>
        </div>
    `).join('');
}

function onDragStart(e, index) {
    dragSrcIndex = index;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.currentTarget;
    if (!item.classList.contains('dragging')) {
        item.classList.add('drag-over');
    }
}

function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e, dropIndex) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;

    try {
        const res = await fetch('/api/categories');
        const cats = await res.json();
        const [moved] = cats.splice(dragSrcIndex, 1);
        cats.splice(dropIndex, 0, moved);
        await fetch('/api/categories/reorder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: cats })
        });
        await renderCategoryManager();
        await loadCategoryDropdown();
        toast('排序已更新');
    } catch (e) {
        toast('排序失败');
    }
    dragSrcIndex = null;
}

function onDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('drag-over'));
    dragSrcIndex = null;
}

function escAttr(s) { return (s||'').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

async function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const name = input.value.trim();
    if (!name) return;
    const res = await fetch('/api/categories', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name})
    });
    if (!res.ok) { toast('名称无效或已存在'); return; }
    input.value = '';
    toast('分类已添加');
    await renderCategoryManager();
    await loadCategoryDropdown();
}

function startRename(name) {
    const item = document.getElementById('cat-item-' + name);
    const oldName = item.querySelector('.cat-name').textContent;
    item.innerHTML = `
        <div class="cat-edit-row">
            <input type="text" id="rename-${name}" value="${esc(oldName)}">
            <button class="confirm-btn" onclick="confirmRename('${name}')">确认</button>
            <button class="cancel-btn" onclick="cancelRename('${name}')" data-orig="${esc(oldName)}">取消</button>
        </div>
    `;
}

function cancelRename(name) {
    renderCategoryManager();
}

async function confirmRename(oldName) {
    const input = document.getElementById('rename-' + oldName);
    const newName = input.value.trim();
    if (!newName) return;
    const res = await fetch('/api/categories/' + encodeURIComponent(oldName), {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: newName})
    });
    if (!res.ok) { toast('重命名失败'); return; }
    toast('分类已重命名');
    await renderCategoryManager();
    await loadCategoryDropdown();
}

async function deleteCategory(name) {
    if (!confirm(`确定删除分类「${name}」？已在该分类的文章不受影响。`)) return;
    const res = await fetch('/api/categories/' + encodeURIComponent(name), { method: 'DELETE' });
    if (!res.ok) { toast('删除失败'); return; }
    toast('分类已删除');
    await renderCategoryManager();
    await loadCategoryDropdown();
}

function closeCategoryManager() {
    document.getElementById('category-modal').style.display = 'none';
}

// ===== Sync to GitHub =====
async function syncToGitHub() {
    const btn = document.getElementById('nav-sync');
    const label = document.getElementById('sync-label');
    const origText = label.textContent;

    btn.style.pointerEvents = 'none';
    label.textContent = '推送中...';
    btn.classList.add('syncing');

    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '同步更新' })
        });
        const result = await res.json();
        if (result.ok) {
            label.textContent = '已同步 ✓';
            toast('已推送到 GitHub');
        } else {
            label.textContent = '推送失败';
            toast('推送失败：' + (result.error || '未知错误'));
        }
    } catch (e) {
        label.textContent = '推送失败';
        toast('推送失败：' + e.message);
    }

    btn.classList.remove('syncing');
    btn.style.pointerEvents = '';
    setTimeout(() => { if (label.textContent !== '推送中...') label.textContent = origText; }, 3000);
}
