import supabase from './supabaseClient.js';

const proyectosPerPage = 6;
let currentPage = 1;
let proyectos = [];
let filteredProjects = [];
let allSuggestions = [];
let selectedProjectId = null;
let proyectosLoaded = false;
let loadingProyectos = false;
let githubLoaded = false;

const radioStations = [
    { title: 'Neon Skies', artist: 'Neon Dreams FM', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { title: 'Pulsewave', artist: 'Pulsewave Station', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { title: 'Cyber Lounge', artist: 'Midnight Circuit', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { title: 'Night Drive', artist: 'Chrome Runner', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
    { title: 'Aurora Drift', artist: 'Holo Bloom', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { title: 'Synth Gardens', artist: 'Vapor Bloom', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' }
];

const radioState = {
    currentIndex: 0,
    isPlaying: false
};

const detailPlaceholder = `
    <div class="project-placeholder">
        <p>Selecciona un proyecto para ver su ficha completa.</p>
        <p>Encontrarás descripción, alternativas y enlaces directos.</p>
    </div>
`;

const HEARTBEAT_INTERVAL_MS = 14 * 60 * 60 * 1000; // 14 horas
const HEARTBEAT_TICK_MS = 15 * 60 * 1000; // comprobar cada 15 minutos
let lastSupabaseActivity = Date.now();
let heartbeatTimerId = null;

document.addEventListener('DOMContentLoaded', () => {
    setupNavToggle();
    wireSearchEvents();
    wireBrandingLink();
    window.showSection = showSection;
    buildSuggestionsSource();
    loadProyectosFromSupabase();
    initRadioPlayer();
        startSupabaseHeartbeatMonitor();
        handleInitialHash();
});

function wireBrandingLink() {
    const brandingLink = document.querySelector('.branding-link');
    if (!brandingLink) return;
    brandingLink.addEventListener('click', (event) => {
        event.preventDefault();
        resetToShowcase();
    });
}

function setupNavToggle() {
    const container = document.querySelector('header .container');
    const nav = document.querySelector('header nav');
    if (!container || !nav) return;
    if (container.querySelector('.nav-toggle')) return;

    const navToggle = document.createElement('button');
    navToggle.className = 'nav-toggle';
    navToggle.setAttribute('aria-label', 'Menú');
    navToggle.innerHTML = '<span></span><span></span><span></span>';
    container.prepend(navToggle);
    navToggle.addEventListener('click', () => {
        nav.classList.toggle('open');
        navToggle.classList.toggle('active');
    });
}

function wireSearchEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.search-btn');

    if (!searchInput) return;

    searchInput.addEventListener('input', filterProyectos);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterProyectos();
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', filterProyectos);
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-bar-wrapper')) {
            const suggestions = document.getElementById('searchSuggestions');
            if (suggestions) {
                suggestions.style.display = 'none';
            }
        }
    });
}

function markSupabaseActivity() {
    lastSupabaseActivity = Date.now();
}

function startSupabaseHeartbeatMonitor() {
    if (heartbeatTimerId || typeof window === 'undefined') return;
    heartbeatTimerId = window.setInterval(() => {
        const idleTime = Date.now() - lastSupabaseActivity;
        if (idleTime >= HEARTBEAT_INTERVAL_MS) {
            sendSupabaseHeartbeat();
        }
    }, HEARTBEAT_TICK_MS);
}

async function sendSupabaseHeartbeat() {
    if (!supabase) return;
    try {
        await supabase
            .from('proyectos')
            .select('id', { head: true, count: 'exact' });
    } catch (error) {
        console.warn('No se pudo enviar el heartbeat a Supabase:', error);
    } finally {
        markSupabaseActivity();
    }
}

function initRadioPlayer() {
    const audio = document.getElementById('radio-audio');
    const track = document.getElementById('player-track');
    const toggle = document.getElementById('player-toggle');
    const mute = document.getElementById('player-mute');
    const volume = document.getElementById('player-volume');
    const next = document.getElementById('player-next');

    if (!audio || !track || !toggle || !mute || !volume || !next || radioStations.length === 0) {
        return;
    }

    const applyStation = () => {
        const station = radioStations[radioState.currentIndex];
        track.textContent = `${station.artist} - ${station.title}`;
        audio.src = station.url;
        adjustMarquee();
        if (radioState.isPlaying) {
            audio.play().catch(() => {});
        }
    };

    const updateToggleIcon = () => {
        toggle.textContent = radioState.isPlaying ? '❚❚' : '▶';
    };

    const updateMuteIcon = () => {
        mute.textContent = (audio.muted || audio.volume === 0) ? '🔇' : '🔊';
    };

    volume.value = 0.7;
    audio.volume = 0.7;
    applyStation();
    updateToggleIcon();
    updateMuteIcon();

    toggle.addEventListener('click', () => {
        if (radioState.isPlaying) {
            audio.pause();
            radioState.isPlaying = false;
            updateToggleIcon();
            return;
        }
        audio.play()
            .then(() => {
                radioState.isPlaying = true;
                updateToggleIcon();
            })
            .catch(() => {
                radioState.isPlaying = false;
                updateToggleIcon();
            });
    });

    mute.addEventListener('click', () => {
        audio.muted = !audio.muted;
        updateMuteIcon();
    });

    volume.addEventListener('input', () => {
        audio.volume = Number(volume.value);
        if (audio.volume === 0) {
            audio.muted = true;
        } else if (audio.muted) {
            audio.muted = false;
        }
        updateMuteIcon();
    });

    next.addEventListener('click', () => {
        radioState.currentIndex = (radioState.currentIndex + 1) % radioStations.length;
        applyStation();
        if (!radioState.isPlaying) {
            radioState.isPlaying = true;
            audio.play().catch(() => {
                radioState.isPlaying = false;
            });
            updateToggleIcon();
        }
    });

    audio.addEventListener('ended', () => {
        radioState.currentIndex = (radioState.currentIndex + 1) % radioStations.length;
        applyStation();
    });
}

// Adjust marquee speed based on text length
function adjustMarquee() {
    const el = document.getElementById('player-track');
    if(!el) return;
    const len = el.textContent.length;
    const base = 14; // seconds
    const speed = Math.min(38, Math.max(base, len * 0.55));
    el.style.animationDuration = speed + 's';
}


async function loadProyectosFromSupabase() {
    if (loadingProyectos || proyectosLoaded) return;
    const proyectosList = document.getElementById('proyectos-list');
    loadingProyectos = true;
    let attemptedSupabaseFetch = false;

    if (proyectosList) {
        proyectosList.innerHTML = '<p class="loading">Cargando proyectos...</p>';
    }

    if (!supabase) {
        if (proyectosList) {
            proyectosList.innerHTML = '<p class="no-results">Configura Supabase para mostrar los proyectos.</p>';
        }
        loadingProyectos = false;
        return;
    }

    try {
        attemptedSupabaseFetch = true;
        const { data, error } = await supabase
            .from('proyectos')
            .select('id, links, titles, img, description, password, additional, alternatives, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        proyectos = Array.isArray(data) ? data.map(normalizeProject) : [];
        filteredProjects = [...proyectos];
        proyectosLoaded = true;
        currentPage = 1;
        selectedProjectId = null;
        buildSuggestionsSource();
        clearProjectDetail();
        renderProyectos();
    } catch (error) {
        console.error('Error al cargar proyectos desde Supabase:', error);
        if (proyectosList) {
            proyectosList.innerHTML = '<p class="no-results">No se pudieron cargar los proyectos.</p>';
        }
    } finally {
        loadingProyectos = false;
        if (attemptedSupabaseFetch) {
            markSupabaseActivity();
        }
    }
}

function normalizeProject(row) {
    return {
        ...row,
        links: Array.isArray(row.links) ? row.links : [],
        titles: Array.isArray(row.titles) ? row.titles : [],
        description: row.description || '',
        password: row.password || '',
        additional: row.additional || '',
        alternatives: coerceArray(row.alternatives)
    };
}

function renderProyectos() {
    const proyectosList = document.getElementById('proyectos-list');
    if (!proyectosList) return;

    proyectosList.innerHTML = '';

    if (!proyectosLoaded) {
        proyectosList.innerHTML = '<p class="loading">Cargando proyectos...</p>';
        return;
    }

    const start = (currentPage - 1) * proyectosPerPage;
    const end = start + proyectosPerPage;
    const proyectosToShow = filteredProjects.slice(start, end);

    if (proyectosToShow.length === 0) {
        proyectosList.innerHTML = '<p class="no-results">no se encontraron proyectos</p>';
        renderPagination();
        clearProjectDetail();
        return;
    }

    proyectosToShow.forEach((proyecto) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'project-card';
        const displayName = (proyecto.description || 'Proyecto').replace(/\.$/, '');
        const projectId = getProjectId(proyecto);
        card.dataset.projectId = projectId;
        card.setAttribute('aria-label', displayName);
        card.innerHTML = `
            <div class="thumb">
                <img src="${proyecto.img}" alt="${displayName}">
            </div>
            <div class="project-summary">
                <h3>${displayName}</h3>
            </div>
        `;
        card.addEventListener('click', () => selectProject(projectId));
        proyectosList.appendChild(card);
    });

    renderPagination();
    highlightSelectedProjectCard();
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    pagination.innerHTML = '';

    const totalPages = Math.ceil(filteredProjects.length / proyectosPerPage) || 1;

    for (let page = 1; page <= totalPages; page++) {
        const a = document.createElement('a');
        a.href = '#';
        a.innerText = String(page);
        a.className = page === currentPage ? 'active' : '';
        a.onclick = (e) => {
            e.preventDefault();
            currentPage = page;
            renderProyectos();
        };
        pagination.appendChild(a);
    }
}

function highlightSelectedProjectCard() {
    const cards = document.querySelectorAll('#proyectos-list .project-card');
    cards.forEach((card) => {
        const isSelected = card.dataset.projectId === selectedProjectId;
        card.classList.toggle('selected', isSelected);
        card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function populateProjectDetail(project) {
    const detail = document.getElementById('project-detail');
    if (!detail) return;

    if (!project) {
        detail.innerHTML = detailPlaceholder;
        detail.classList.remove('active');
        return;
    }

    const displayName = (project.description || 'Proyecto').replace(/\.$/, '');
    const passwordHtml = project.password ? `<p class="detail-password"><strong>Contraseña:</strong> ${project.password}</p>` : '';
    const summaryHtml = project.additional
        ? `<p class="project-summary-text">${formatMultilineText(project.additional)}</p>`
        : '<p class="project-summary-text project-empty">Sin descripción adicional.</p>';
    const alternativesHtml = renderAlternatives(project.alternatives);
    const downloadsHtml = renderDownloadButtons(project);

    detail.innerHTML = `
        <article class="project-shell">
            <div class="project-hero">
                <img src="${project.img}" alt="${displayName}">
            </div>
            <div class="project-headline">
                <span class="player-label">Proyecto seleccionado</span>
                <h3>${displayName}</h3>
                ${summaryHtml}
            </div>
            <section class="project-pane">
                <h4>Alternativas</h4>
                ${alternativesHtml}
            </section>
            ${passwordHtml ? `<section class="project-pane">${passwordHtml}</section>` : ''}
            <section class="project-pane">
                <h4>Descargas</h4>
                ${downloadsHtml}
            </section>
        </article>
    `;
    detail.classList.add('active');
}

function selectProject(projectId) {
    const project = proyectos.find((p) => getProjectId(p) === String(projectId));
    if (!project) return;
    selectedProjectId = String(projectId);
    populateProjectDetail(project);
    highlightSelectedProjectCard();
    const detail = document.getElementById('project-detail');
    if (detail) {
        detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        detail.focus({ preventScroll: true });
        window.location.hash = 'project-detail';
    }
}

function clearProjectDetail() {
    selectedProjectId = null;
    const detail = document.getElementById('project-detail');
    if (!detail) return;
    detail.innerHTML = detailPlaceholder;
    detail.classList.remove('active');
    highlightSelectedProjectCard();
}

async function loadGithubProjects() {
    if (githubLoaded) return;
    const container = document.getElementById('github-projects');
    if (!container) return;
    container.innerHTML = '';
    try {
        const res = await fetch('https://api.github.com/users/Allhein/repos?sort=updated&per_page=30');
        const repos = await res.json();
        repos.forEach((repo) => {
            const imgSrc = (repo.owner && repo.owner.avatar_url) ? repo.owner.avatar_url : '/Assets/capibara.jpg';
            const desc = (repo.description || 'Sin descripción').slice(0, 110);
            const lang = repo.language ? `Lenguaje: ${repo.language}` : '';
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${imgSrc}" alt="${repo.name}">
                <div class="card-content">
                    <h3 class="card-title">${repo.name}</h3>
                    <p class="card-desc">${desc}</p>
                    <p class="card-meta">${lang}</p>
                    <div class="card-links">
                        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">Ver repo</a>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
        githubLoaded = true;
    } catch (e) {
        container.innerHTML = '<p>No se pudieron cargar los repositorios.</p>';
    }
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach((section) => {
        section.classList.remove('active');
    });

    const sectionToShow = document.getElementById(sectionId);
    if (!sectionToShow) return;
    sectionToShow.classList.add('active');

    if (sectionId === 'proyectos') {
        if (!proyectosLoaded && !loadingProyectos) {
            loadProyectosFromSupabase();
        } else {
            renderProyectos();
        }
    }

    if (sectionId === 'blog') {
        loadGithubProjects();
    }

    const showcase = document.getElementById('showcase');
    if (showcase) {
        showcase.style.display = 'none';
    }

    window.location.hash = sectionId;
}

function resetToShowcase(options = {}) {
    const { updateHash = true } = options;
    const sections = document.querySelectorAll('.section');
    sections.forEach((section) => section.classList.remove('active'));

    const showcase = document.getElementById('showcase');
    if (showcase) {
        showcase.style.display = '';
        showcase.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (updateHash) {
        window.location.hash = 'showcase';
    }
}

function handleInitialHash() {
    const resolved = resolveHash(window.location.hash);
    if (!resolved || resolved === 'showcase') {
        resetToShowcase({ updateHash: false });
        return;
    }

    const targetSection = document.getElementById(resolved);
    if (targetSection && targetSection.classList.contains('section')) {
        showSection(resolved);
    } else {
        resetToShowcase({ updateHash: false });
    }
}

function resolveHash(rawHash) {
    const clean = (rawHash || '').replace(/^#/, '');
    if (!clean) return '';
    const lower = clean.toLowerCase();
    if (lower === 'bienvenido' || lower === 'bien-venido') return 'Bien-venido';
    if (lower === 'proyectos') return 'proyectos';
    if (lower === 'blog') return 'blog';
    if (lower === 'contacto') return 'contacto';
    if (lower === 'showcase') return 'showcase';
    return clean;
}

function filterProyectos() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    const term = input.value.toLowerCase().trim();

    if (!term) {
        filteredProjects = [...proyectos];
    } else {
        filteredProjects = proyectos.filter((p) => {
            const desc = (p.description || '').toLowerCase();
            const titles = Array.isArray(p.titles) ? p.titles.join(' ').toLowerCase() : '';
            return desc.includes(term) || titles.includes(term);
        });
    }

    currentPage = 1;
    clearProjectDetail();
    renderProyectos();
    updateSuggestions(term);
}

function buildSuggestionsSource() {
    const set = new Set();
    proyectos.forEach((p) => {
        const cleanedDescription = (p.description || '').replace(/\.$/, '').trim();
        if (cleanedDescription) set.add(cleanedDescription);
        if (Array.isArray(p.titles)) {
            p.titles.forEach((title) => {
                const cleanedTitle = (title || '').trim();
                if (cleanedTitle) set.add(cleanedTitle);
            });
        }
    });
    allSuggestions = Array.from(set);
}

function updateSuggestions(term) {
    const box = document.getElementById('searchSuggestions');
    if (!box) return;

    if (!term) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
    }

    const matches = allSuggestions
        .filter((s) => s.toLowerCase().includes(term))
        .slice(0, 5);

    if (matches.length === 0) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
    }

    box.innerHTML = matches
        .map((m) => `<div class="suggestion" role="option">${m}</div>`)
        .join('');
    box.style.display = 'block';

    [...box.children].forEach((child) => {
        child.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            if (!searchInput) return;
            searchInput.value = child.textContent || '';
            box.style.display = 'none';
            filterProyectos();
        });
    });
}

function renderAlternatives(alternatives = []) {
    if (!alternatives.length) {
        return '<p class="project-empty">No hay alternativas registradas.</p>';
    }
    const items = alternatives
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
    return `<ul class="project-alternatives">${items}</ul>`;
}

function renderDownloadButtons(project) {
    const links = Array.isArray(project.links) ? project.links : [];
    if (!links.length) {
        return '<p class="project-empty">Sin enlaces disponibles.</p>';
    }
    const titles = Array.isArray(project.titles) ? project.titles : [];
    const buttons = links
        .map((href, idx) => {
            const label = titles[idx] ? titles[idx] : `Enlace ${idx + 1}`;
            return `<a href="${href}" class="mini-btn" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
        })
        .join('');
    return `<div class="detail-actions">${buttons}</div>`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatMultilineText(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
}

function coerceArray(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string' ? item.trim() !== '' : Boolean(item));
    }
    if (typeof value === 'string') {
        return value
            .split(/\r?\n|[,;|]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    return [];
}

function getProjectId(project) {
    if (project && project.id != null) {
        return String(project.id);
    }
    if (project && project.img) {
        return String(project.img);
    }
    if (project && project.description) {
        return String(project.description);
    }
    return 'proyecto-sin-id';
}
