// js/ui.js
const UI = {
  createCard(item) {
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const title = item.title || item.name || 'Sem título';
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const poster = item.poster_path ? CONFIG.buildImageUrl(item.poster_path) : '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const typeIcon = mediaType === 'tv'
      ? '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
      : '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/></svg>';

    const isFav = APP.isFavorite(item.id, mediaType);
    const isInWl = APP.isInWatchlist(item.id, mediaType);

    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', mediaType);
    card._itemData = item;

    const seasonEp = (mediaType === 'tv' && item.number_of_seasons && item.number_of_episodes)
      ? `<span class="card-te">T${item.number_of_seasons} E${item.number_of_episodes}</span>`
      : '';

    card.innerHTML = `
      <div class="card-poster">
        ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : '<div class="card-placeholder">Sem imagem</div>'}
        <div class="card-rating">
          <svg class="icon-star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          ${rating}
        </div>
        <div class="card-actions">
          <button class="card-action-btn fav-btn ${isFav ? 'active' : ''}" title="Favorito" data-action="fav">
            <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="card-action-btn watchlist-btn ${isInWl ? 'active' : ''}" title="Minha Lista" data-action="watchlist">
            <svg viewBox="0 0 24 24" fill="${isInWl ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        <div class="card-overlay">
          <button class="card-play-btn" title="Assistir">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>
          </button>
        </div>
      </div>
      <div class="card-info">
        <span class="card-title">${title}</span>
        <span class="card-meta">${typeIcon} ${year} ${seasonEp}</span>
      </div>
    `;
    return card;
  },

  createPersonCard(item) {
    const name = item.name || 'Sem nome';
    const photo = item.profile_path ? CONFIG.buildImageUrl(item.profile_path, 'w185') : '';
    const knownFor = item.known_for
      ? item.known_for.slice(0, 3).map(k => k.title || k.name).join(', ')
      : '';

    const card = document.createElement('div');
    card.className = 'card person-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', 'person');
    card.innerHTML = `
      <div class="card-poster person-photo">
        ${photo
          ? `<img src="${photo}" alt="${name}" loading="lazy">`
          : '<div class="person-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>'
        }
      </div>
      <div class="card-info">
        <span class="card-title">${name}</span>
        ${knownFor ? `<span class="card-meta">${knownFor}</span>` : ''}
      </div>
    `;
    return card;
  },

  createRow(title, items, containerId, withActions = false, allowExpand = true) {
    const section = document.createElement('section');
    section.className = 'catalog-row';
    if (withActions) section.classList.add('history-row');

    // Store items data on section for expand/collapse
    section._items = items;
    section._containerId = containerId;

    const hasMany = allowExpand && items.length > 14;
    const actionsHTML = withActions
      ? '<div class="row-actions"><button class="btn-clear-all" id="btnClearAll">Limpar histórico</button></div>'
      : hasMany
        ? '<div class="row-actions"><button class="btn-expand-row" title="Ver tudo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button></div>'
        : '';

    section.innerHTML = `
      <div class="row-header">
        <h2 class="row-title">${title}</h2>
        ${actionsHTML}
      </div>
      <div class="carousel-wrapper">
        <button class="carousel-nav carousel-nav--left hidden" aria-label="Anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="carousel" id="${containerId}"></div>
        <button class="carousel-nav carousel-nav--right" aria-label="Próximo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>
    `;

    const carousel = section.querySelector('.carousel');
    items.filter(item => item.poster_path).forEach(item => carousel.appendChild(this.createCard(item)));

    // Fetch TV details in background and update cards
    this._fetchTVDetailsForCards(carousel);

    // Setup carousel navigation
    this._setupCarouselNav(section);

    // Expand / collapse button
    const expandBtn = section.querySelector('.btn-expand-row');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.toggleExpandRow(section));
    }

    return section;
  },

  async _fetchTVDetailsForCards(carousel) {
    const tvCards = carousel.querySelectorAll('.card[data-type="tv"]');
    if (!tvCards.length) return;

    const tvIds = Array.from(tvCards).map(card => card.getAttribute('data-id'));
    try {
      const details = await API.getTVDetailsBatch(tvIds);
      const detailsMap = new Map(details.map(d => [String(d.id), d]));

      tvCards.forEach(card => {
        const id = card.getAttribute('data-id');
        const detail = detailsMap.get(id);
        if (!detail) return;

        const meta = card.querySelector('.card-meta');
        if (!meta) return;

        const existing = meta.querySelector('.card-te');
        if (existing) return;

        if (detail.number_of_seasons && detail.number_of_episodes) {
          const span = document.createElement('span');
          span.className = 'card-te';
          span.textContent = `T${detail.number_of_seasons} E${detail.number_of_episodes}`;
          meta.appendChild(span);
        }
      });
    } catch {}
  },

  createHeroCarousel(items) {
    const section = document.createElement('section');
    section.className = 'hero-section';

    const slide1Bg = items[0]?.backdrop_path ? CONFIG.buildImageUrl(items[0].backdrop_path, 'original') : '';
    const slide2Bg = items[1]?.backdrop_path ? CONFIG.buildImageUrl(items[1].backdrop_path, 'original') : '';

    section.innerHTML = `
      <div class="hero-bg">
        <div class="hero-slide active" style="background-image:url('${slide1Bg}')"></div>
        <div class="hero-slide" style="background-image:url('${slide2Bg}')"></div>
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-content">
        <div class="hero-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Em Destaque</div>
        <h1 class="hero-title" id="heroTitle"></h1>
        <div class="hero-meta" id="heroMeta"></div>
        <p class="hero-description" id="heroDescription"></p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" id="heroPlayBtn"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="8,5 19,12 8,19"/></svg> Assistir</button>
          <button class="btn btn-secondary btn-lg" id="heroInfoBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Mais Info</button>
        </div>
        <div class="hero-indicators" id="heroIndicators"></div>
      </div>
    `;

    // Build indicators
    const indicators = section.querySelector('#heroIndicators');
    items.slice(0, 10).forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = `hero-indicator${i === 0 ? ' active' : ''}`;
      dot.dataset.index = i;
      indicators.appendChild(dot);
    });

    // Store state
    section._items = items;
    section._heroIndex = 0;
    section._heroInterval = null;

    // Fill first slide content
    this._updateHeroContent(section, items[0]);

    // Click handlers
    const playBtn = section.querySelector('#heroPlayBtn');
    const infoBtn = section.querySelector('#heroInfoBtn');
    if (playBtn) playBtn.addEventListener('click', () => {
      const item = items[section._heroIndex];
      if (item) {
        const mt = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        APP.showDetail(mt, item.id, null, item);
      }
    });
    if (infoBtn) infoBtn.addEventListener('click', () => {
      const item = items[section._heroIndex];
      if (item) {
        const mt = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        APP.showDetail(mt, item.id, null, item);
      }
    });

    // Indicator clicks
    indicators.addEventListener('click', (e) => {
      const dot = e.target.closest('.hero-indicator');
      if (dot) this._goToHeroSlide(section, parseInt(dot.dataset.index));
    });

    // Start auto-rotation
    this._startHeroRotation(section);

    return section;
  },

  _updateHeroContent(section, item) {
    if (!item) return;
    const title = item.title || item.name || '';
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const overview = item.overview || '';
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const typeLabel = mediaType === 'tv' ? 'Série' : 'Filme';

    const titleEl = section.querySelector('#heroTitle');
    const metaEl = section.querySelector('#heroMeta');
    const descEl = section.querySelector('#heroDescription');
    if (titleEl) titleEl.textContent = title;
    if (metaEl) metaEl.innerHTML = `
      <span class="hero-meta-item"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${rating}</span>
      ${year ? `<span class="hero-meta-item">${year}</span>` : ''}
      <span class="hero-type-badge">${typeLabel}</span>
    `;
    if (descEl) descEl.textContent = overview;
  },

  _goToHeroSlide(section, index) {
    const items = section._items;
    if (index >= items.length) index = 0;
    section._heroIndex = index;

    const slides = section.querySelectorAll('.hero-slide');
    const activeSlide = slides[0]?.classList.contains('active') ? slides[0] : slides[1];
    const inactiveSlide = activeSlide === slides[0] ? slides[1] : slides[0];

    const bg = items[index]?.backdrop_path ? CONFIG.buildImageUrl(items[index].backdrop_path, 'original') : '';
    inactiveSlide.style.backgroundImage = `url('${bg}')`;
    activeSlide.classList.remove('active');
    inactiveSlide.classList.add('active');

    this._updateHeroContent(section, items[index]);

    // Update indicators
    section.querySelectorAll('.hero-indicator').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    // Restart rotation
    this._startHeroRotation(section);
  },

  _startHeroRotation(section) {
    if (section._heroInterval) clearInterval(section._heroInterval);
    section._heroInterval = setInterval(() => {
      const next = (section._heroIndex + 1) % Math.min(section._items.length, 10);
      this._goToHeroSlide(section, next);
    }, 6000);
  },

  toggleExpandRow(section) {
    const items = section._items;
    if (!items) return;

    const wrapper = section.querySelector('.carousel-wrapper');
    const expandBtn = section.querySelector('.btn-expand-row');
    const isExpanded = section.classList.contains('row-expanded');

    if (isExpanded) {
      // Collapse: remove grid, rebuild carousel
      section.classList.remove('row-expanded');

      const grid = section.querySelector('.row-grid');
      if (grid) grid.remove();

      // Replace wrapper entirely to clear old listeners
      const newWrapper = document.createElement('div');
      newWrapper.className = 'carousel-wrapper';
      newWrapper.innerHTML = `
        <button class="carousel-nav carousel-nav--left hidden" aria-label="Anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="carousel" id="${section._containerId}"></div>
        <button class="carousel-nav carousel-nav--right" aria-label="Próximo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      `;
      wrapper.replaceWith(newWrapper);

      const carousel = newWrapper.querySelector('.carousel');
      items.filter(item => item.poster_path).forEach(item => carousel.appendChild(this.createCard(item)));
      this._fetchTVDetailsForCards(carousel);
      this._setupCarouselNav(newWrapper.closest('.catalog-row'));

      expandBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
      expandBtn.title = 'Ver tudo';
    } else {
      // Expand: hide carousel, show grid
      section.classList.add('row-expanded');
      wrapper.style.display = 'none';

      let grid = section.querySelector('.row-grid');
      if (grid) {
        grid.style.display = '';
      } else {
        grid = document.createElement('div');
        grid.className = 'row-grid';
        section.appendChild(grid);
      }
      grid.innerHTML = '';
      items.filter(item => item.poster_path).forEach(item => grid.appendChild(this.createCard(item)));
      this._fetchTVDetailsForCards(grid);

      expandBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      expandBtn.title = 'Fechar';
    }
  },

  /* --- Carousel navigation: arrows + wheel scroll --- */
  _setupCarouselNav(section) {
    const carousel = section.querySelector('.carousel');
    const leftBtn = section.querySelector('.carousel-nav--left');
    const rightBtn = section.querySelector('.carousel-nav--right');
    if (!carousel || !leftBtn || !rightBtn) return;

    const SCROLL_AMOUNT = 600; // px per click

    const updateArrows = () => {
      const { scrollLeft, scrollWidth, clientWidth } = carousel;
      leftBtn.classList.toggle('hidden', scrollLeft <= 5);
      rightBtn.classList.toggle('hidden', scrollLeft + clientWidth >= scrollWidth - 5);
    };

    leftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      carousel.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      carousel.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
    });

    carousel.addEventListener('scroll', updateArrows, { passive: true });

    // Mouse wheel horizontal scroll on desktop — smooth accumulated scrolling
    let wheelAccum = 0;
    let wheelRaf = null;
    carousel.addEventListener('wheel', (e) => {
      if (carousel.scrollWidth <= carousel.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        wheelAccum += e.deltaY * 1.5;
        if (!wheelRaf) {
          wheelRaf = requestAnimationFrame(() => {
            carousel.scrollLeft += wheelAccum;
            wheelAccum = 0;
            wheelRaf = null;
          });
        }
      }
    }, { passive: false });

    // Initial state
    requestAnimationFrame(updateArrows);
  },

  createHistoryCard(item) {
    const card = this.createCard(item);

    // Add three-dot menu button on the CARD root (not inside poster, which has overflow:hidden)
    const menuBtn = document.createElement('button');
    menuBtn.className = 'history-menu-btn';
    menuBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>';
    card.appendChild(menuBtn);

    // Store item data on button for removal
    menuBtn._itemId = item.id;
    menuBtn._itemType = item.media_type;
    menuBtn._card = card;

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Close any existing dropdown
      UI.closeAllDropdowns();

      // Toggle active state for visibility
      menuBtn.classList.add('active');

      // Create dropdown anchored to button's top-right, expanding left & down over the card
      const dropdown = document.createElement('div');
      dropdown.id = 'active-dropdown';
      dropdown.style.cssText = `
        position: fixed;
        z-index: 9999;
        background: rgba(20, 20, 20, 0.95);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 4px 0;
        min-width: 175px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        backdrop-filter: blur(16px);
        transform-origin: top right;
        animation: dropdownGrow 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      `;

      // Inject animation keyframes if not already present
      if (!document.getElementById('dropdown-keyframes')) {
        const style = document.createElement('style');
        style.id = 'dropdown-keyframes';
        style.textContent = `
          @keyframes dropdownGrow {
            from { opacity: 0; transform: scale(0.7); }
            to   { opacity: 1; transform: scale(1); }
          }
        `;
        document.head.appendChild(style);
      }

      const btn = document.createElement('button');
      btn.textContent = 'Remover do histórico';
      btn.style.cssText = `
        display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 16px;
        border: none; background: transparent; color: #fff;
        font-size: 13px; text-align: left; cursor: pointer; white-space: nowrap;
        transition: background 0.15s, color 0.15s;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(231,76,60,0.12)'; btn.style.color = '#e74c3c'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = '#fff'; });

      dropdown.appendChild(btn);

      // Position: top-right of dropdown aligns with bottom-right of the button
      const rect = menuBtn.getBoundingClientRect();
      let top = rect.bottom + 2;
      let right = window.innerWidth - rect.right;

      // Clamp so it doesn't go off-screen left (for first card on mobile)
      const dropdownWidth = 175;
      const leftEdge = window.innerWidth - right - dropdownWidth;
      if (leftEdge < 8) {
        right = window.innerWidth - dropdownWidth - 8;
      }

      // If it would go off bottom, show above button instead
      if (top + 50 > window.innerHeight) {
        top = rect.top - 50;
        dropdown.style.transformOrigin = 'bottom right';
      }

      dropdown.style.top = top + 'px';
      dropdown.style.right = right + 'px';

      document.body.appendChild(dropdown);

      // Track the associated button to remove active class on close
      dropdown._menuBtn = menuBtn;

      // Remove action
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        APP.removeFromHistory(item.id, item.media_type);
        card.remove();
        UI.closeAllDropdowns();
        if (APP.getHistory().length === 0) {
          const historyRow = document.querySelector('.history-row');
          if (historyRow) historyRow.remove();
        }
      });
    });

    return card;
  },

  closeAllDropdowns() {
    const dropdown = document.getElementById('active-dropdown');
    if (dropdown) {
      // Remove active class from associated button
      if (dropdown._menuBtn) {
        dropdown._menuBtn.classList.remove('active');
      }
      dropdown.remove();
    }
  },

  showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  },

  showError(container, message) {
    container.innerHTML = `<div class="error">${message}</div>`;
  },
};
