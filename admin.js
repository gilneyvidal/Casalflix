// ===================================================================
// NOSSOFLIX - SCRIPT DO PAINEL ADM (v2 - blindado)
// ===================================================================
const SUPABASE_URL = 'https://kghofwfkqkyqkqwlooub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaG9md2ZrcWt5cWtxd2xvb3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTMxMjMsImV4cCI6MjEwNDg4OTEyM30.g_ouJmp2nr194XV3uQr4c77QkNL1wJ-RealwNFWOJOE';
const BUCKET_NAME = 'midias-casal';
const AVATAR_BUCKET = 'avatars';
// ===================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

console.log('[ADM] Script carregado');

let supabase;
try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[ADM] Supabase client criado');
} catch (e) {
    console.error('[ADM] Falha ao criar client do Supabase:', e);
    alert('Erro ao conectar no Supabase. Verifique a URL e a chave.');
}

// ---- Helpers seguros ----
function $(id) { return document.getElementById(id); }
function safe(fn) {
    return async (...args) => {
        try { return await fn(...args); }
        catch (e) { console.error('[ADM] Erro:', e); }
    };
}

// ---- Elementos (pegos com segurança) ----
const loginScreen      = $('login-screen');
const adminPanel       = $('admin-panel');
const loginForm        = $('login-form');
const loginError       = $('login-error');
const logoutBtn        = $('logout-btn');
const userEmailEl      = $('user-email');

const uploadForm       = $('upload-form');
const fileInput        = $('file-input');
const uploadCategorySelect = $('upload-category');
const uploadTitlesInput= $('upload-titles');
const uploadBtn        = $('upload-btn');
const progressContainer= $('upload-progress');
const progressBar      = $('progress-bar');
const uploadStatus     = $('upload-status');

const mediaListContainer = $('media-list-container');
const categoriesList     = $('categories-list');
const categoryForm       = $('category-form');
const newCategoryName    = $('new-category-name');

const profilesList       = $('profiles-list');
const profileForm        = $('profile-form');
const newProfileName     = $('new-profile-name');

const splashForm         = $('splash-form');
const splashEnabledInput = $('splash-enabled');
const splashTextInput    = $('splash-text-input');
const splashDurationInput= $('splash-duration-input');
const splashStatus       = $('splash-status');

const settingsForm       = $('settings-form');
const settingsStatus     = $('settings-status');

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];
let categoriesCache = [];
let profilesCache = [];

// ===================================================================
// TELA: mostrar login / painel
// ===================================================================
function showAdminPanel(user) {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminPanel) adminPanel.classList.remove('hidden');
    if (userEmailEl) userEmailEl.textContent = user?.email || '';
    refreshAll();
}

function showLoginScreen() {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (adminPanel) adminPanel.classList.add('hidden');
}

// ===================================================================
// AUTENTICAÇÃO
// ===================================================================
async function initAuth() {
    // 1) Verifica sessão atual (mais confiável que depender só do evento)
    try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[ADM] Sessão inicial:', session ? 'autenticado' : 'anônimo');
        if (session) showAdminPanel(session.user);
        else showLoginScreen();
    } catch (e) {
        console.error('[ADM] Erro no getSession:', e);
        showLoginScreen();
    }

    // 2) Escuta mudanças (login/logout)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[ADM] onAuthStateChange:', event, session ? 'com sessão' : 'sem sessão');
        if (session) showAdminPanel(session.user);
        else showLoginScreen();
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('email').value.trim();
        const password = $('password').value;
        if (loginError) loginError.textContent = 'Entrando...';

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                if (loginError) loginError.textContent = 'Erro: ' + error.message;
                console.error('[ADM] Login falhou:', error);
            } else {
                if (loginError) loginError.textContent = '';
            }
        } catch (e) {
            if (loginError) loginError.textContent = 'Erro inesperado: ' + e.message;
            console.error('[ADM] Erro no login:', e);
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try { await supabase.auth.signOut(); }
        catch (e) { console.error(e); }
    });
}

// ===================================================================
// TABS
// ===================================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById('tab-' + btn.dataset.tab);
        if (target) target.classList.add('active');
    });
});

// ===================================================================
// REFRESH GERAL (cada etapa é isolada — uma falha não trava as outras)
// ===================================================================
async function refreshAll() {
    console.log('[ADM] refreshAll iniciado');
    await safe(loadCategories)();
    await safe(loadProfiles)();
    await safe(loadMediaList)();
    await safe(loadSettings)();
    console.log('[ADM] refreshAll concluído');
}

// ===================================================================
// CATEGORIAS
// ===================================================================
async function loadCategories() {
    const { data, error } = await supabase
        .from('categories').select('*').order('display_order', { ascending: true });

    if (error) {
        console.error('[ADM] Erro categorias:', error);
        return;
    }

    categoriesCache = data || [];

    if (uploadCategorySelect) {
        uploadCategorySelect.innerHTML = '<option value="">— Sem categoria —</option>';
        categoriesCache.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            uploadCategorySelect.appendChild(opt);
        });
    }

    if (categoriesList) {
        categoriesList.innerHTML = '';
        categoriesCache.forEach(cat => {
            const row = document.createElement('div');
            row.className = 'category-row';
            row.innerHTML = `
                <input type="text" value="${cat.name}" data-id="${cat.id}">
                <button class="btn-small btn-save">Salvar</button>
                <button class="btn-small btn-delete">Excluir</button>
            `;
            row.querySelector('.btn-save').onclick = async () => {
                const newName = row.querySelector('input').value.trim();
                if (!newName) return;
                const { error } = await supabase.from('categories').update({ name: newName }).eq('id', cat.id);
                if (error) alert('Erro: ' + error.message);
                else { await loadCategories(); await loadMediaList(); }
            };
            row.querySelector('.btn-delete').onclick = async () => {
                if (!confirm(`Excluir a categoria "${cat.name}"?`)) return;
                const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                if (error) alert('Erro: ' + error.message);
                else { await loadCategories(); await loadMediaList(); }
            };
            categoriesList.appendChild(row);
        });
    }
}

if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newCategoryName.value.trim();
        if (!name) return;
        const last = categoriesCache[categoriesCache.length - 1];
        const order = (last ? last.display_order : 0) + 1;
        const { error } = await supabase.from('categories').insert({ name, display_order: order });
        if (error) alert('Erro: ' + error.message);
        else { newCategoryName.value = ''; await loadCategories(); }
    });
}

// ===================================================================
// PERFIS
// ===================================================================
async function loadProfiles() {
    const { data, error } = await supabase
        .from('profiles').select('*').order('display_order', { ascending: true });

    if (error) {
        console.warn('[ADM] Perfis indisponíveis (rode a migração SQL):', error.message);
        if (profilesList) {
            profilesList.innerHTML = '<p style="color:#e50914;">⚠️ Tabela "profiles" não encontrada. Rode o SQL de migração no Supabase.</p>';
        }
        return;
    }

    profilesCache = data || [];
    if (!profilesList) return;
    profilesList.innerHTML = '';

    profilesCache.forEach(profile => {
        const item = document.createElement('div');
        item.className = 'profile-admin-item';

        const avatar = document.createElement('label');
        avatar.className = 'profile-admin-avatar';
        if (profile.avatar_url) {
            const img = document.createElement('img');
            img.src = profile.avatar_url;
            img.alt = profile.name;
            avatar.appendChild(img);
        } else {
            avatar.textContent = (profile.name || '?').charAt(0);
        }
        const hint = document.createElement('div');
        hint.className = 'overlay-hint';
        hint.textContent = 'Trocar foto';
        avatar.appendChild(hint);

        const fileInputEl = document.createElement('input');
        fileInputEl.type = 'file';
        fileInputEl.accept = 'image/*';
        fileInputEl.addEventListener('change', (e) => uploadAvatar(profile, e.target.files[0]));
        avatar.appendChild(fileInputEl);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = profile.name;
        nameInput.placeholder = 'Nome do perfil';

        const actions = document.createElement('div');
        actions.className = 'actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-small btn-save';
        saveBtn.textContent = 'Salvar';
        saveBtn.onclick = async () => {
            const newName = nameInput.value.trim();
            if (!newName) return;
            const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', profile.id);
            if (error) alert('Erro: ' + error.message);
            else await loadProfiles();
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-small btn-delete';
        delBtn.textContent = 'Excluir';
        delBtn.onclick = async () => {
            if (profilesCache.length <= 1) { alert('É preciso ter pelo menos 1 perfil.'); return; }
            if (!confirm(`Excluir o perfil "${profile.name}"?`)) return;
            const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
            if (error) alert('Erro: ' + error.message);
            else await loadProfiles();
        };

        actions.appendChild(saveBtn);
        actions.appendChild(delBtn);
        item.appendChild(avatar);
        item.appendChild(nameInput);
        item.appendChild(actions);
        profilesList.appendChild(item);
    });
}

async function uploadAvatar(profile, file) {
    if (!file) return;
    try {
        const ext = file.name.split('.').pop();
        const uniqueName = `${profile.id}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(uniqueName, file, { cacheControl: '3600', upsert: true });

        if (uploadError) { alert('Erro ao enviar avatar: ' + uploadError.message); return; }

        const { data: { publicUrl } } = supabase.storage
            .from(AVATAR_BUCKET).getPublicUrl(uniqueName);

        const { error: updateError } = await supabase
            .from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);

        if (updateError) { alert('Erro ao salvar avatar: ' + updateError.message); return; }
        await loadProfiles();
    } catch (e) {
        alert('Erro inesperado: ' + e.message);
        console.error(e);
    }
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newProfileName.value.trim();
        if (!name) return;
        const last = profilesCache[profilesCache.length - 1];
        const order = (last ? last.display_order : 0) + 1;
        const { error } = await supabase.from('profiles').insert({ name, display_order: order });
        if (error) alert('Erro: ' + error.message);
        else { newProfileName.value = ''; await loadProfiles(); }
    });
}

// ===================================================================
// SPLASH
// ===================================================================
if (splashForm) {
    splashForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            splash_enabled: splashEnabledInput.checked,
            splash_text: splashTextInput.value.trim() || 'NOSSOFLIX',
            splash_duration: parseInt(splashDurationInput.value, 10) || 3500
        };
        const { error } = await supabase.from('site_settings').update(payload).eq('id', 1);
        if (error) splashStatus.textContent = '❌ ' + error.message;
        else {
            splashStatus.textContent = '✅ Abertura salva!';
            setTimeout(() => splashStatus.textContent = '', 3000);
        }
    });
}

// ===================================================================
// UPLOAD
// ===================================================================
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const files = Array.from(fileInput.files);
        if (!files.length) return;

        const categoryId = uploadCategorySelect.value || null;
        const titlesRaw = uploadTitlesInput.value.split(',').map(t => t.trim());

        uploadBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        uploadStatus.textContent = `Enviando ${files.length} arquivo(s)...`;

        let ok = 0, fail = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split('.').pop();
            const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const customTitle = titlesRaw[i] || '';

            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(uniqueName, file, { cacheControl: '3600', upsert: false });

            if (uploadError) { console.error(uploadError); fail++; }
            else {
                const { error: metaError } = await supabase.from('media_items').insert({
                    file_name: uniqueName,
                    display_title: customTitle || null,
                    category_id: categoryId,
                    display_order: 0
                });
                if (metaError) console.warn('Metadados:', metaError.message);
                ok++;
            }
            progressBar.style.width = `${((i + 1) / files.length) * 100}%`;
        }

        uploadBtn.disabled = false;
        progressContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        uploadStatus.textContent = fail === 0
            ? `✅ ${ok} arquivo(s) enviado(s)!`
            : `⚠️ ${ok} enviado(s), ${fail} com erro.`;
        fileInput.value = '';
        uploadTitlesInput.value = '';
        await loadMediaList();
    });
}

// ===================================================================
// LISTA DE MÍDIAS
// ===================================================================
async function loadMediaList() {
    if (!mediaListContainer) return;
    mediaListContainer.innerHTML = '<p>Carregando mídias...</p>';

    const { data: files, error } = await supabase.storage.from(BUCKET_NAME)
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) { mediaListContainer.innerHTML = '<p>Erro ao carregar as mídias.</p>'; return; }
    if (!files || files.length === 0) { mediaListContainer.innerHTML = '<p>Nenhuma mídia enviada ainda.</p>'; return; }

    const { data: mediaItems } = await supabase.from('media_items').select('*');
    const metaMap = {};
    (mediaItems || []).forEach(m => { metaMap[m.file_name] = m; });

    mediaListContainer.innerHTML = '';

    files.filter(f => f.name && !f.name.startsWith('.')).forEach(file => {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(file.name);
        const ext = file.name.split('.').pop().toLowerCase();
        const isVideo = VIDEO_EXTENSIONS.includes(ext);
        const meta = metaMap[file.name] || {};

        const item = document.createElement('div');
        item.className = 'media-item';

        const preview = document.createElement('div');
        preview.className = 'media-preview';
        if (isVideo) preview.innerHTML = `<video src="${publicUrl}" muted preload="metadata"></video>`;
        else preview.innerHTML = `<img src="${publicUrl}" alt="" loading="lazy">`;

        if (meta.is_featured) {
            const badge = document.createElement('span');
            badge.className = 'featured-badge';
            badge.textContent = '★ DESTAQUE';
            preview.appendChild(badge);
        }
        item.appendChild(preview);

        const body = document.createElement('div');
        body.className = 'media-body';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Título amigável';
        titleInput.value = meta.display_title || '';
        body.appendChild(titleInput);

        const catSelect = document.createElement('select');
        catSelect.innerHTML = '<option value="">— Sem categoria —</option>';
        categoriesCache.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            if (meta.category_id === cat.id) opt.selected = true;
            catSelect.appendChild(opt);
        });
        body.appendChild(catSelect);

        const featuredLabel = document.createElement('label');
        featuredLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:0.8rem;color:#aaa;cursor:pointer;';
        const featuredCheck = document.createElement('input');
        featuredCheck.type = 'checkbox';
        featuredCheck.checked = !!meta.is_featured;
        featuredLabel.appendChild(featuredCheck);
        featuredLabel.appendChild(document.createTextNode('★ Destaque do hero (só 1)'));
        body.appendChild(featuredLabel);

        const fileNameEl = document.createElement('div');
        fileNameEl.className = 'file-name';
        fileNameEl.textContent = file.name;
        body.appendChild(fileNameEl);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-small btn-save';
        saveBtn.textContent = 'Salvar';
        saveBtn.onclick = () => saveMediaMeta(file.name, {
            display_title: titleInput.value.trim() || null,
            category_id: catSelect.value || null,
            is_featured: featuredCheck.checked,
            exists: !!meta.file_name
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-small btn-delete';
        deleteBtn.textContent = 'Excluir';
        deleteBtn.onclick = () => deleteMedia(file.name);

        actions.appendChild(saveBtn);
        actions.appendChild(deleteBtn);
        body.appendChild(actions);

        item.appendChild(body);
        mediaListContainer.appendChild(item);
    });
}

async function saveMediaMeta(fileName, data) {
    const exists = data.exists;
    delete data.exists;

    if (data.is_featured) {
        await supabase.from('media_items').update({ is_featured: false }).neq('file_name', fileName);
    }

    let error;
    if (exists) ({ error } = await supabase.from('media_items').update(data).eq('file_name', fileName));
    else ({ error } = await supabase.from('media_items').insert({ file_name: fileName, ...data }));

    if (error) alert('Erro ao salvar: ' + error.message);
    else await loadMediaList();
}

async function deleteMedia(fileName) {
    if (!confirm(`Excluir "${fileName}"?\nIrreversível.`)) return;
    const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([fileName]);
    if (storageError) { alert('Erro: ' + storageError.message); return; }
    await supabase.from('media_items').delete().eq('file_name', fileName);
    await loadMediaList();
}

// ===================================================================
// CONFIGURAÇÕES GERAIS
// ===================================================================
async function loadSettings() {
    const { data, error } = await supabase
        .from('site_settings').select('*').eq('id', 1).single();

    if (error) {
        console.warn('[ADM] Configurações indisponíveis:', error.message);
        return;
    }

    const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ''; };
    set('site-title', data.site_title);
    set('hero-title-text', data.hero_title);
    set('hero-description-text', data.hero_description);
    set('profiles-title', data.profiles_title);
    set('primary-color', data.primary_color || '#e50914');
    set('footer-text-input', data.footer_text);

    if (splashEnabledInput) splashEnabledInput.checked = data.splash_enabled !== false;
    if (splashTextInput) splashTextInput.value = data.splash_text || 'NOSSOFLIX';
    if (splashDurationInput) splashDurationInput.value = data.splash_duration || 3500;
}

if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            site_title: $('site-title').value.trim(),
            hero_title: $('hero-title-text').value.trim(),
            hero_description: $('hero-description-text').value.trim(),
            profiles_title: $('profiles-title').value.trim() || 'Quem está assistindo?',
            primary_color: $('primary-color').value,
            footer_text: $('footer-text-input').value.trim()
        };

        const { error } = await supabase.from('site_settings').update(payload).eq('id', 1);
        if (error) settingsStatus.textContent = '❌ ' + error.message;
        else {
            settingsStatus.textContent = '✅ Salvo!';
            setTimeout(() => settingsStatus.textContent = '', 3000);
        }
    });
}

// ===================================================================
// START
// ===================================================================
console.log('[ADM] Iniciando autenticação...');
initAuth();

