// ===================================================================
// NOSSOFLIX - SCRIPT DO SITE PÚBLICO
// ===================================================================
// IMPORTANTE: substitua pelos seus dados do Supabase
// ===================================================================
const SUPABASE_URL = 'COLE_AQUI_A_SUA_PROJECT_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_A_SUA_CHAVE_ANON_PUBLIC';
const BUCKET_NAME = 'midias-casal';
// ===================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos
const rowsContainer = document.getElementById('rows-container');
const heroSection = document.getElementById('hero');
const heroTitle = document.getElementById('hero-title');
const heroDescription = document.getElementById('hero-description');
const playHeroBtn = document.getElementById('play-hero-btn');
const modal = document.getElementById('media-modal');
const modalBody = document.getElementById('modal-body');
const modalCaption = document.getElementById('modal-caption');
const closeModalBtn = document.getElementById('close-modal');
const siteLogo = document.getElementById('site-logo');
const footerText = document.getElementById('footer-text');
const header = document.querySelector('.header');

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];

// Estado global
let allMedia = [];

// ===================================================================
// INICIALIZAÇÃO
// ===================================================================
async function init() {
    await loadSettings();
    await loadContent();
    setupEventListeners();
}

// ===================================================================
// CARREGA CONFIGURAÇÕES
// ===================================================================
async function loadSettings() {
    const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.warn('Não foi possível carregar as configurações:', error.message);
        return;
    }

    if (data) {
        if (data.site_title) {
            siteLogo.textContent = data.site_title;
            document.title = data.site_title;
        }
        if (data.primary_color) {
            document.documentElement.style.setProperty('--primary-color', data.primary_color);
        }
        if (data.footer_text) {
            footerText.textContent = data.footer_text;
        }
        heroTitle.dataset.fallbackTitle = data.hero_title || '';
        heroDescription.dataset.fallbackDescription = data.hero_description || '';
    }
}

// ===================================================================
// CARREGA CONTEÚDO
// ===================================================================
async function loadContent() {
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

    if (catError) {
        console.error('Erro ao buscar categorias:', catError);
        return;
    }

    const { data: mediaItems, error: mediaError } = await supabase
        .from('media_items')
        .select('*')
        .order('display_order', { ascending: true });

    if (mediaError) {
        console.warn('Erro ao buscar metadados:', mediaError.message);
    }

    const { data: files, error: fileError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list('', {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' }
        });

    if (fileError) {
        console.error('Erro ao listar arquivos:', fileError);
        heroTitle.textContent = 'Ops! Algo deu errado.';
        heroDescription.textContent = 'Não foi possível carregar as mídias.';
        return;
    }

    if (!files || files.length === 0) {
        heroTitle.textContent = 'Adicione mídias!';
        heroDescription.textContent = 'Faça login no painel adm para enviar fotos e vídeos.';
        return;
    }

    const metaMap = {};
    (mediaItems || []).forEach(item => { metaMap[item.file_name] = item; });

    allMedia = files
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(file => {
            const { data: { publicUrl } } = supabase
                .storage.from(BUCKET_NAME).getPublicUrl(file.name);

            const ext = file.name.split('.').pop().toLowerCase();
            const isVideo = VIDEO_EXTENSIONS.includes(ext);
            const meta = metaMap[file.name] || {};

            return {
                name: file.name,
                url: publicUrl,
                isVideo,
                title: meta.display_title || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                description: meta.display_description || '',
                categoryId: meta.category_id || null,
                isFeatured: meta.is_featured || false,
                displayOrder: meta.display_order || 0
            };
        });

    renderHero();
    renderRows(categories || []);
}

// ===================================================================
// RENDERIZA O HERO
// ===================================================================
function renderHero() {
    if (allMedia.length === 0) return;

    let featured = allMedia.find(m => m.isFeatured);
    if (!featured) {
        featured = allMedia[Math.floor(Math.random() * allMedia.length)];
    }

    if (featured.isVideo) {
        heroSection.style.backgroundImage = 'none';
        heroSection.style.backgroundColor = '#141414';
    } else {
        heroSection.style.backgroundImage = `url(${featured.url})`;
    }

    heroTitle.textContent = featured.title
        || heroTitle.dataset.fallbackTitle
        || 'Nossa História';
    heroDescription.textContent = featured.description
        || heroDescription.dataset.fallbackDescription
        || 'Uma coleção das nossas melhores memórias.';

    playHeroBtn.style.display = 'inline-flex';
    playHeroBtn.onclick = () => openModal(featured);
}

// ===================================================================
// RENDERIZA FILEIRAS
// ===================================================================
function renderRows(categories) {
    rowsContainer.innerHTML = '';

    const groups = {};
    categories.forEach(cat => { groups[cat.id] = { cat, items: [] }; });
    groups['__none__'] = { cat: { name: 'Outras Memórias', display_order: 999 }, items: [] };

    allMedia.forEach(m => {
        if (m.categoryId && groups[m.categoryId]) {
            groups[m.categoryId].items.push(m);
        } else {
            groups['__none__'].items.push(m);
        }
    });

    const sortedGroups = Object.values(groups)
        .filter(g => g.items.length > 0)
        .sort((a, b) => (a.cat.display_order || 0) - (b.cat.display_order || 0));

    sortedGroups.forEach(group => {
        rowsContainer.appendChild(createRow(group.cat.name, group.items));
    });

    if (sortedGroups.length === 0) {
        rowsContainer.innerHTML = '<p style="text-align:center;padding:50px;">Nenhuma mídia disponível.</p>';
    }
}

// ===================================================================
// CRIA UMA FILEIRA
// ===================================================================
function createRow(title, items) {
    const row = document.createElement('div');
    row.className = 'row';

    const rowTitle = document.createElement('h3');
    rowTitle.className = 'row-title';
    rowTitle.textContent = title;
    row.appendChild(rowTitle);

    const postersContainer = document.createElement('div');
    postersContainer.className = 'row-posters';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'poster-card';
        card.onclick = () => openModal(item);

        const img = document.createElement('img');
        if (item.isVideo) {
            img.src = 'https://placehold.co/320x180/1a1a1a/e50914?text=%E2%96%B6+V%C3%ADdeo';
        } else {
            img.src = item.url;
        }
        img.alt = item.title;
        img.loading = 'lazy';

        const info = document.createElement('div');
        info.className = 'poster-info';
        const titleEl = document.createElement('div');
        titleEl.className = 'poster-title';
        titleEl.textContent = item.title;
        info.appendChild(titleEl);

        card.appendChild(img);
        card.appendChild(info);
        postersContainer.appendChild(card);
    });

    row.appendChild(postersContainer);
    return row;
}

// ===================================================================
// MODAL
// ===================================================================
function openModal(item) {
    modalBody.innerHTML = '';
    modalCaption.textContent = item.description || '';

    if (item.isVideo) {
        const video = document.createElement('video');
        video.src = item.url;
        video.controls = true;
        video.autoplay = true;
        modalBody.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = item.url;
        modalBody.appendChild(img);
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModalHandler() {
    modal.style.display = 'none';
    modalBody.innerHTML = '';
    modalCaption.textContent = '';
    document.body.style.overflow = '';
}

// ===================================================================
// EVENTOS
// ===================================================================
function setupEventListeners() {
    closeModalBtn.onclick = closeModalHandler;
    window.addEventListener('click', (e) => { if (e.target === modal) closeModalHandler(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModalHandler(); });

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
}

init();
