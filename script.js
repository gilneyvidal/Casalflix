// ===================================================================
// NOSSOFLIX - SCRIPT DO SITE PÚBLICO
// ===================================================================
const SUPABASE_URL = 'https://kghofwfkqkyqkqwlooub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaG9md2ZrcWt5cWtxd2xvb3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTMxMjMsImV4cCI6MjEwNDg4OTEyM30.g_ouJmp2nr194XV3uQr4c77QkNL1wJ-RealwNFWOJOE';
const BUCKET_NAME = 'midias-casal';
// ===================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Elementos ----
const splash = document.getElementById('splash');
const splashText = document.getElementById('splash-text');
const profileScreen = document.getElementById('profile-screen');
const profilesTitle = document.getElementById('profiles-title');
const profilesGrid = document.getElementById('profiles-grid');
const app = document.getElementById('app');

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
const headerUser = document.getElementById('header-user');
const headerAvatar = document.getElementById('header-avatar');

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];

// ---- Estado global ----
let allMedia = [];
let settingsData = null;
let profilesData = [];
let selectedProfile = null;

// ===================================================================
// INICIALIZAÇÃO
// ===================================================================
async function init() {
    // Carrega tudo em paralelo
    await Promise.all([
        loadSettings(),
        loadProfiles(),
        loadContent()
    ]);

    setupEventListeners();
    startFlow();
}

// ===================================================================
// FLUXO: SPLASH → PERFIS → APP
// ===================================================================
function startFlow() {
    const splashEnabled = settingsData?.splash_enabled !== false;
    const splashDuration = settingsData?.splash_duration || 3500;

    if (splashEnabled) {
        // Aplica texto personalizado
        splashText.textContent = settingsData?.splash_text || 'NOSSOFLIX';
        // Ajusta duração da animação CSS
        splashText.style.animationDuration = `${splashDuration}ms`;

        splash.classList.remove('hidden');
        profileScreen.classList.add('hidden');
        app.classList.add('hidden');

        // Depois do tempo do splash + fade-out, vai para os perfis
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.classList.add('hidden');
                showProfileScreen();
            }, 800);
        }, splashDuration);
    } else {
        splash.classList.add('hidden');
        showProfileScreen();
    }
}

function showProfileScreen() {
    profileScreen.classList.remove('hidden');
    app.classList.add('hidden');

    profilesTitle.textContent = settingsData?.profiles_title || 'Quem está assistindo?';

    profilesGrid.innerHTML = '';
    profilesData.forEach(profile => {
        profilesGrid.appendChild(createProfileCard(profile));
    });
}

function createProfileCard(profile) {
    const card = document.createElement('div');
    card.className = 'profile-card';

    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';

    if (profile.avatar_url) {
        const img = document.createElement('img');
        img.src = profile.avatar_url;
        img.alt = profile.name;
        avatar.appendChild(img);
    } else {
        avatar.textContent = (profile.name || '?').charAt(0);
    }

    const name = document.createElement('div');
    name.className = 'profile-name';
    name.textContent = profile.name;

    card.appendChild(avatar);
    card.appendChild(name);

    card.onclick = () => selectProfile(profile);
    return card;
}

function selectProfile(profile) {
    selectedProfile = profile;

    // Guarda na sessão
    try { sessionStorage.setItem('nossoflix_profile_id', profile.id); } catch (e) {}

    // Atualiza avatar no header
    headerAvatar.innerHTML = '';
    if (profile.avatar_url) {
        const img = document.createElement('img');
        img.src = profile.avatar_url;
        img.alt = profile.name;
        headerAvatar.appendChild(img);
    } else {
        headerAvatar.textContent = (profile.name || '?').charAt(0);
    }

    // Troca de tela
    profileScreen.classList.add('hidden');
    app.classList.remove('hidden');

    // Renderiza conteúdo
    renderHero();
    renderRows();

    // Sobe pro topo
    window.scrollTo(0, 0);
}

function backToProfiles() {
    closeModalHandler();
    selectedProfile = null;
    try { sessionStorage.removeItem('nossoflix_profile_id'); } catch (e) {}

    profileScreen.classList.remove('hidden');
    app.classList.add('hidden');
    window.scrollTo(0, 0);
}

// ===================================================================
// CONFIGURAÇÕES
// ===================================================================
async function loadSettings() {
    const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.warn('Configurações não carregadas:', error.message);
        return;
    }

    settingsData = data;

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
}

// ===================================================================
// PERFIS
// ===================================================================
async function loadProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('display_order', { ascending: true });

    if (error) {
        console.warn('Perfis não carregados:', error.message);
        profilesData = [];
        return;
    }
    profilesData = data || [];
}

// ===================================================================
// CONTEÚDO (mídias + categorias)
// ===================================================================
async function loadContent() {
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

    const { data: mediaItems } = await supabase
        .from('media_items')
        .select('*')
        .order('display_order', { ascending: true });

    const { data: files, error: fileError } = await supabase
        .storage.from(BUCKET_NAME)
        .list('', {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' }
        });

    if (fileError) {
        console.error('Erro ao listar arquivos:', fileError);
        return;
    }

    if (!files || files.length === 0) {
        allMedia = [];
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

    // Guarda categorias para renderRows
    window.__categories = categories || [];
}

// ===================================================================
// RENDER: HERO
// ===================================================================
function renderHero() {
    // Remove vídeo anterior do hero
    const oldVideo = heroSection.querySelector('.hero-bg-video');
    if (oldVideo) oldVideo.remove();

    if (allMedia.length === 0) {
        heroSection.style.backgroundImage = 'none';
        heroTitle.textContent = 'Adicione mídias!';
        heroDescription.textContent = 'Faça login no painel adm para enviar fotos e vídeos.';
        playHeroBtn.style.display = 'none';
        return;
    }

    let featured = allMedia.find(m => m.isFeatured) || allMedia[0];

    if (featured.isVideo) {
        heroSection.style.backgroundImage = 'none';
        const video = document.createElement('video');
        video.className = 'hero-bg-video';
        video.src = featured.url;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('muted', '');
        heroSection.insertBefore(video, heroSection.firstChild);
    } else {
        heroSection.style.backgroundImage = `url(${featured.url})`;
    }

    heroTitle.textContent = featured.title || 'Nossa História';
    heroDescription.textContent = featured.description
        || settingsData?.hero_description
        || 'Uma coleção das nossas melhores memórias.';

    playHeroBtn.style.display = 'inline-flex';
    playHeroBtn.onclick = () => openModal(featured);
}

// ===================================================================
// RENDER: FILEIRAS
// ===================================================================
function renderRows() {
    rowsContainer.innerHTML = '';

    const categories = window.__categories || [];

    if (allMedia.length === 0) {
        rowsContainer.innerHTML = '<p style="text-align:center;padding:50px;">Nenhuma mídia disponível.</p>';
        return;
    }

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
}

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

    headerUser.addEventListener('click', backToProfiles);
}

init();
