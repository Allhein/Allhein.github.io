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

const detailPlaceholder = '<div class="project-placeholder">Selecciona un proyecto para ver los detalles.</div>';

document.addEventListener('DOMContentLoaded', () => {
    setupNavToggle();
    wireSearchEvents();
    window.showSection = showSection;
    buildSuggestionsSource();
    loadProyectosFromSupabase();
});

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

async function loadProyectosFromSupabase() {
    if (loadingProyectos || proyectosLoaded) return;
    const proyectosList = document.getElementById('proyectos-list');
    loadingProyectos = true;

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
        const { data, error } = await supabase
            .from('proyectos')
            .select('id, links, titles, img, description, password, additional, created_at')
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
    }
}

function normalizeProject(row) {
    return {
        ...row,
        links: Array.isArray(row.links) ? row.links : [],
        titles: Array.isArray(row.titles) ? row.titles : [],
        description: row.description || '',
        password: row.password || '',
        additional: row.additional || ''
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
    const passwordHtml = project.password ? `<p class="detail-password">${project.password}</p>` : '';
    const additionalHtml = project.additional ? `<div class="detail-additional">${project.additional}</div>` : '';
    const linksHtml = (project.links || [])
        .map((href, idx) => {
            const label = (project.titles && project.titles[idx]) ? project.titles[idx] : `Enlace ${idx + 1}`;
            return `<a href="${href}" class="mini-btn" target="_blank" rel="noopener">${label}</a>`;
        })
        .join('');
    const actionsHtml = linksHtml ? `<div class="detail-actions">${linksHtml}</div>` : '';

    detail.innerHTML = `
        <div class="project-detail-card">
            <div class="detail-thumb">
                <img src="${project.img}" alt="${displayName}">
            </div>
            <div class="detail-body">
                <h3>${displayName}</h3>
                ${additionalHtml}
                ${passwordHtml}
                ${actionsHtml}
            </div>
        </div>
    `;
    detail.classList.add('active');
}

function selectProject(projectId) {
    const project = proyectos.find((p) => getProjectId(p) === String(projectId));
    if (!project) return;
    selectedProjectId = String(projectId);
    populateProjectDetail(project);
    highlightSelectedProjectCard();
    if (window.matchMedia('(max-width: 1100px)').matches) {
        const detail = document.getElementById('project-detail');
        if (detail) {
            detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
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
