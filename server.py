import json
import os
import subprocess
import re
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from PIL import Image

app = Flask(__name__, static_folder=None)

PROJECT_DIR = Path(__file__).parent.absolute()
DATA_JSON = PROJECT_DIR / 'data.json'
DATA_JS = PROJECT_DIR / 'data.js'
POSTS_DIR = PROJECT_DIR / 'posts'
IMAGES_DIR = PROJECT_DIR / 'images'
EDITOR_DIR = PROJECT_DIR / 'editor'
CATEGORIES_JSON = PROJECT_DIR / 'categories.json'

POSTS_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)


def load_metadata():
    with open(DATA_JSON, 'r') as f:
        return json.load(f)


def save_metadata(data):
    with open(DATA_JSON, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    cats = load_categories()
    with open(DATA_JS, 'w') as f:
        f.write('const CATEGORIES = ' + json.dumps(cats, ensure_ascii=False) + ';\n')
        f.write('const blogData = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')


def next_id(posts):
    nums = []
    for p in posts:
        m = re.search(r'post-(\d+)', p['id'])
        if m:
            nums.append(int(m.group(1)))
    return f'post-{max(nums) + 1}' if nums else 'post-1'


def format_date():
    return datetime.now().strftime('%b %d, %Y')


def git_commit_and_push(message):
    try:
        subprocess.run(['git', 'add', '-A'], cwd=PROJECT_DIR, check=True, capture_output=True)
        subprocess.run(['git', 'commit', '-m', message], cwd=PROJECT_DIR, check=True, capture_output=True)
        subprocess.run(['git', 'push', 'origin', 'main'], cwd=PROJECT_DIR, check=True, capture_output=True)
        return True, ''
    except subprocess.CalledProcessError as e:
        return False, e.stderr.decode()


def compress_image(filepath):
    img = Image.open(filepath)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    w, h = img.size
    short = min(w, h)
    if short > 1600:
        ratio = 1600 / short
        new_w = int(w * ratio)
        new_h = int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
    img.save(filepath, 'JPEG', quality=85, optimize=True)


def generate_desc(content, max_len=120):
    lines = content.strip().split('\n')
    text = ''
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#') or stripped.startswith('<') or stripped.startswith('![') or stripped == '':
            continue
        text = stripped
        break
    if len(text) > max_len:
        text = text[:max_len] + '...'
    return text


def load_categories():
    with open(CATEGORIES_JSON, 'r') as f:
        return json.load(f)


def save_categories(data):
    with open(CATEGORIES_JSON, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# --- API ---

@app.route('/api/categories')
def list_categories():
    return jsonify(load_categories())


@app.route('/api/categories', methods=['POST'])
def add_category():
    name = (request.json or {}).get('name', '').strip()
    cats = load_categories()
    if not name or name in cats:
        return jsonify({'error': '名称无效或已存在'}), 400
    cats.append(name)
    save_categories(cats)
    return jsonify(cats)


@app.route('/api/categories/<name>', methods=['PUT'])
def rename_category(name):
    new_name = (request.json or {}).get('name', '').strip()
    cats = load_categories()
    if name not in cats or not new_name or new_name in cats:
        return jsonify({'error': '名称无效或已存在'}), 400
    cats[cats.index(name)] = new_name
    save_categories(cats)
    # Update all posts with old category name
    posts = load_metadata()
    for p in posts:
        if p.get('category') == name:
            p['category'] = new_name
    save_metadata(posts)
    return jsonify(cats)


@app.route('/api/categories/reorder', methods=['POST'])
def reorder_categories():
    order = (request.json or {}).get('order', [])
    cats = load_categories()
    if set(order) != set(cats):
        return jsonify({'error': '排序列表与分类不匹配'}), 400
    save_categories(order)
    return jsonify(order)


@app.route('/api/categories/<name>', methods=['DELETE'])
def delete_category(name):
    cats = load_categories()
    if name not in cats:
        return jsonify({'error': '分类不存在'}), 404
    cats.remove(name)
    save_categories(cats)
    return jsonify(cats)


@app.route('/api/posts')
def list_posts():
    posts = load_metadata()
    posts.sort(key=lambda p: p.get('date', ''), reverse=True)
    return jsonify(posts)


@app.route('/api/posts/<post_id>')
def get_post(post_id):
    posts = load_metadata()
    post = next((p for p in posts if p['id'] == post_id), None)
    if not post:
        return jsonify({'error': 'not found'}), 404
    md_path = POSTS_DIR / f'{post_id}.md'
    content = ''
    if md_path.exists():
        content = md_path.read_text(encoding='utf-8')
    return jsonify({**post, 'content': content})


@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.json
    posts = load_metadata()
    post = {
        'id': next_id(posts),
        'title': data.get('title', ''),
        'date': format_date(),
        'category': data.get('category', '开发日志'),
        'tags': data.get('tags', []),
        'cover': data.get('cover', ''),
        'desc': generate_desc(data.get('content', '')),
        'draft': data.get('draft', True)
    }
    md_path = POSTS_DIR / f'{post["id"]}.md'
    md_path.write_text(data.get('content', ''), encoding='utf-8')
    posts.insert(0, post)
    save_metadata(posts)
    return jsonify(post)


@app.route('/api/posts/<post_id>', methods=['PUT'])
def update_post(post_id):
    data = request.json
    posts = load_metadata()
    post = next((p for p in posts if p['id'] == post_id), None)
    if not post:
        return jsonify({'error': 'not found'}), 404
    post['title'] = data.get('title', post['title'])
    post['category'] = data.get('category', post.get('category', '开发日志'))
    post['tags'] = data.get('tags', post['tags'])
    post['cover'] = data.get('cover', post['cover'])
    post['draft'] = data.get('draft', post['draft'])
    if 'content' in data:
        post['desc'] = generate_desc(data['content'])
        (POSTS_DIR / f'{post_id}.md').write_text(data['content'], encoding='utf-8')
    save_metadata(posts)
    return jsonify(post)


@app.route('/api/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    posts = load_metadata()
    post = next((p for p in posts if p['id'] == post_id), None)
    if not post:
        return jsonify({'error': 'not found'}), 404
    md_path = POSTS_DIR / f'{post_id}.md'
    if md_path.exists():
        md_path.unlink()
    posts = [p for p in posts if p['id'] != post_id]
    save_metadata(posts)
    return jsonify({'ok': True})


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    f = request.files.get('file')
    if not f:
        return jsonify({'error': 'no file'}), 400
    name = f.filename or 'image.jpg'
    stem, ext = os.path.splitext(name)
    name = f"{stem}{ext.lower()}"
    dest = IMAGES_DIR / name
    counter = 1
    while dest.exists():
        name = f"{stem}_{counter}{ext.lower()}"
        dest = IMAGES_DIR / name
        counter += 1
    f.save(str(dest))
    compress_image(str(dest))
    return jsonify({'path': f'images/{name}'})


@app.route('/api/publish', methods=['POST'])
def publish():
    data = request.json or {}
    msg = data.get('message', 'update blog')
    ok, err = git_commit_and_push(msg)
    if ok:
        return jsonify({'ok': True})
    return jsonify({'error': err}), 500


@app.route('/api/images')
def list_images():
    files = []
    for f in sorted(IMAGES_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif', '.webp'):
            files.append(f'images/{f.name}')
    return jsonify(files)


# --- Serve editor and blog ---

@app.route('/editor')
@app.route('/editor/')
def serve_editor():
    return send_from_directory(str(EDITOR_DIR), 'index.html')


@app.route('/editor/<path:filename>')
def serve_editor_static(filename):
    return send_from_directory(str(EDITOR_DIR), filename)


@app.route('/')
def serve_blog():
    return send_from_directory(str(PROJECT_DIR), 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(str(PROJECT_DIR), filename)


if __name__ == '__main__':
    print(f'Blog Editor running at http://localhost:8888/editor')
    print(f'Blog preview at http://localhost:8888/')
    app.run(host='0.0.0.0', port=8888, debug=True)
