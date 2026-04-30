// js/app.js
const APP = {
  currentPage: 'home',
  searchTimeout: null,
  _isExitingPlayer: false,
  _modalHistoryLen: 0,       // history.length when modal was opened
  _playerHideHandler: null,  // bound reference for hide-controls handlers
  _playerOpened: false,      // true if pushState for player was already done

  /* --- Watch History (localStorage) --- */
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem('nekyflix_history') || '[]');
    } catch { return []; }
  },

  addToHistory(item) {
    const history = this.getHistory();
    history.unshift({
      id: item.id,
      media_type: item.media_type,
      title: item.title || item.name,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      release_date: item.release_date || '',
      first_air_date: item.first_air_date || '',
      vote_average: item.vote_average || 0,
      timestamp: Date.now(),
    });
    // Deduplicate by id+type, keep last 20
    const seen = new Set();
    const deduped = history.filter(h => {
      const key = `${h.type}:${h.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
    localStorage.setItem('nekyflix_history', JSON.stringify(deduped));
  },

  removeFromHistory(id, mediaType) {
    const history = this.getHistory().filter(h => !(h.id === id && h.media_type === mediaType));
    localStorage.setItem('nekyflix_history', JSON.stringify(history));
  },

  clearHistory() {
    localStorage.removeItem('nekyflix_history');
    const row = document.getElementById('mainContent')?.querySelector('.catalog-row');
    if (row) row.remove();
  },

  /* --- Favorites & Watchlist (localStorage) --- */
  getFavorites() {
    try { return JSON.parse(localStorage.getItem('nekyflix_favorites') || '[]'); }
    catch { return []; }
  },

  isFavorite(id, mediaType) {
    return this.getFavorites().some(f => f.id === id && f.media_type === mediaType);
  },

  toggleFavorite(item) {
    const list = this.getFavorites();
    const idx = list.findIndex(f => f.id === item.id && f.media_type === item.media_type);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({ id: item.id, media_type: item.media_type, title: item.title || item.name, poster_path: item.poster_path, vote_average: item.vote_average, added_at: Date.now() });
    }
    localStorage.setItem('nekyflix_favorites', JSON.stringify(list));
  },

  getWatchlist() {
    try { return JSON.parse(localStorage.getItem('nekyflix_watchlist') || '[]'); }
    catch { return []; }
  },

  isInWatchlist(id, mediaType) {
    return this.getWatchlist().some(w => w.id === id && w.media_type === mediaType);
  },

  toggleWatchlist(item) {
    const list = this.getWatchlist();
    const idx = list.findIndex(w => w.id === item.id && w.media_type === item.media_type);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({ id: item.id, media_type: item.media_type, title: item.title || item.name, poster_path: item.poster_path, vote_average: item.vote_average, added_at: Date.now() });
    }
    localStorage.setItem('nekyflix_watchlist', JSON.stringify(list));
  },

  /* --- Watched Episodes/Movies (localStorage) --- */
  getWatchedHistory() {
    try {
      return JSON.parse(localStorage.getItem('nekyflix_watched') || '{}');
    } catch { return {}; }
  },

  markWatched(imdbId, season, episode) {
    if (!imdbId) return;
    const history = this.getWatchedHistory();
    const key = season !== undefined ? `${imdbId}_S${season}E${episode}` : imdbId;
    history[key] = true;
    localStorage.setItem('nekyflix_watched', JSON.stringify(history));
  },

  isWatched(imdbId, season, episode) {
    if (!imdbId) return false;
    const history = this.getWatchedHistory();
    const key = season !== undefined ? `${imdbId}_S${season}E${episode}` : imdbId;
    return !!history[key];
  },

  refreshHistoryRow() {
    const history = this.getHistory()
      .filter(h => Date.now() - h.timestamp < 7 * 24 * 3600 * 1000)
      .map(h => ({
        ...h,
        media_type: h.media_type || h.type,
        poster_path: h.poster_path || h.poster,
        first_air_date: h.first_air_date || '',
        release_date: h.release_date || '',
        vote_average: h.vote_average || 0,
      }));

    const main = document.getElementById('mainContent');
    const existingRow = main.querySelector('.history-row');

    if (history.length > 0) {
      if (existingRow) {
        // Rebuild just the carousel content
        const carousel = existingRow.querySelector('.carousel');
        carousel.innerHTML = '';
        history.forEach(item => carousel.appendChild(UI.createHistoryCard(item)));
        // Re-setup carousel nav arrows after content rebuild
        UI._setupCarouselNav(existingRow);
      } else {
        // Create history row before first catalog row
        const row = UI.createRow('Continuar Assistindo', history, 'row-history', true);
        const carousel = row.querySelector('.carousel');
        carousel.innerHTML = '';
        history.forEach(item => carousel.appendChild(UI.createHistoryCard(item)));
        const firstRow = main.querySelector('.catalog-row');
        if (firstRow) {
          main.insertBefore(row, firstRow);
        } else {
          main.appendChild(row);
        }
        // Setup nav after inserting into DOM
        UI._setupCarouselNav(row);
      }
    } else if (existingRow) {
      existingRow.remove();
    }
  },

  /* --- Page Renderers --- */
  async renderHome() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    // Watch history - normalize old entries
    const history = this.getHistory()
      .filter(h => Date.now() - h.timestamp < 7 * 24 * 3600 * 1000)
      .map(h => ({
        ...h,
        media_type: h.media_type || h.type,
        poster_path: h.poster_path || h.poster,
        first_air_date: h.first_air_date || '',
        release_date: h.release_date || '',
        vote_average: h.vote_average || 0,
      }));
    if (history.length > 0) {
      const row = UI.createRow('Continuar Assistindo', history, 'row-history', true);
      // Replace cards with history cards (menu buttons)
      const carousel = row.querySelector('.carousel');
      carousel.innerHTML = '';
      history.forEach(item => carousel.appendChild(UI.createHistoryCard(item)));
      main.appendChild(row);
    }

    // Trending
    try {
      const trending = await API.getTrending('all', 'week');
      main.appendChild(UI.createRow('Em Alta', trending, 'row-trending'));
    } catch (e) { /* skip silently */ }

    // Most Watched (movies)
    try {
      const popular = await API.getPopularMovies();
      main.appendChild(UI.createRow('Mais Assistidos', popular, 'row-popular-movies'));
    } catch (e) { /* skip */ }

    // New Releases
    try {
      const upcoming = await API.getUpcomingMovies();
      main.appendChild(UI.createRow('Novidades', upcoming, 'row-upcoming'));
    } catch (e) { /* skip */ }

    // IMDb Popular (trending day as proxy)
    try {
      const trendingDay = await API.getTrending('all', 'day');
      main.appendChild(UI.createRow('Populares no IMDb', trendingDay, 'row-imdb-popular'));
    } catch (e) { /* skip */ }

    // Documentaries
    try {
      const docs = await API.getDocumentaryMovies();
      main.appendChild(UI.createRow('Documentários', docs, 'row-docs', false, true));
    } catch (e) {}

    // Classics
    try {
      const classics = await API.getClassicMovies();
      main.appendChild(UI.createRow('Clássicos', classics, 'row-classics', false, true));
    } catch (e) {}

    // Brazilian Cinema
    try {
      const br = await API.getBrazilianMovies();
      main.appendChild(UI.createRow('Cinema Brasileiro', br, 'row-br', false, true));
    } catch (e) {}
  },

  async renderMovies() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const trending = await API.getTrending('movie', 'week');
      main.appendChild(UI.createRow('Em Alta em Filmes', trending, 'row-trending-movies'));
    } catch (e) {}

    try {
      const nowPlaying = await API.getNowPlaying();
      main.appendChild(UI.createRow('Em Cartaz', nowPlaying, 'row-now-playing'));
    } catch (e) {}

    try {
      const topRated = await API.getTopRatedMovies();
      main.appendChild(UI.createRow('Mais Bem Avaliados', topRated, 'row-top-movies'));
    } catch (e) {}

    try {
      const popular = await API.getPopularMovies();
      main.appendChild(UI.createRow('Populares', popular, 'row-pop-movies'));
    } catch (e) {}
  },

  async renderTV() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const trending = await API.getTrending('tv', 'week');
      main.appendChild(UI.createRow('Em Alta em Séries', trending, 'row-trending-tv'));
    } catch (e) {}

    try {
      const onAir = await API.getOnAirTV();
      main.appendChild(UI.createRow('No Ar', onAir, 'row-on-air'));
    } catch (e) {}

    try {
      const topRated = await API.getTopRatedTV();
      main.appendChild(UI.createRow('Séries Aclamadas', topRated, 'row-top-tv'));
    } catch (e) {}

    try {
      const popular = await API.getPopularTV();
      main.appendChild(UI.createRow('Populares', popular, 'row-pop-tv'));
    } catch (e) {}
  },

  async renderAnimation() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const animMovies = await API.getAnimationMovies();
      main.appendChild(UI.createRow('Filmes de Animação', animMovies, 'row-anim-movies'));
    } catch (e) {}

    try {
      const animTV = await API.getAnimationTV();
      main.appendChild(UI.createRow('Séries de Animação', animTV, 'row-anim-tv'));
    } catch (e) {}

    try {
      const trending = await API.getTrending('movie', 'week');
      const animOnly = trending.filter(t => t.genre_ids && t.genre_ids.includes(16));
      if (animOnly.length > 0) {
        main.appendChild(UI.createRow('Animação em Alta', animOnly, 'row-anim-trending'));
      }
    } catch (e) {}
  },

  /* --- Favorites Page --- */
  async renderFavorites() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    const favorites = this.getFavorites();
    if (favorites.length === 0) {
      main.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text-muted)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom:16px;color:var(--text-muted);opacity:0.4"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><p style="font-size:16px">Nenhum favorito ainda</p><p style="font-size:13px;margin-top:4px">Clique no coração nos cards para adicionar</p></div>';
      return;
    }

    main.appendChild(UI.createRow('Seus Favoritos', favorites, 'row-favorites'));
  },

  /* --- Watchlist Page --- */
  async renderWatchlist() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    const watchlist = this.getWatchlist();
    if (watchlist.length === 0) {
      main.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text-muted)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom:16px;color:var(--text-muted);opacity:0.4"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><p style="font-size:16px">Sua lista está vazia</p><p style="font-size:13px;margin-top:4px">Clique no + nos cards para adicionar</p></div>';
      return;
    }

    main.appendChild(UI.createRow('Minha Lista', watchlist, 'row-watchlist'));
  },

  async renderSearch(query) {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    if (!query.trim()) {
      this.renderHome();
      return;
    }

    const header = document.createElement('div');
    header.className = 'search-results';
    header.innerHTML = `<h2>Resultados para "${query}"</h2>`;
    main.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'search-grid';
    main.appendChild(grid);

    try {
      const [results, people] = await Promise.all([
        API.search(query),
        API.searchPeople(query),
      ]);

      const totalResults = results.length + (people?.length || 0);
      if (totalResults === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0;">Nenhum resultado encontrado.</p>';
        return;
      }

      // People results first
      if (people?.length > 0) {
        const peopleSection = document.createElement('div');
        peopleSection.innerHTML = '<h3 style="font-size:16px;margin-bottom:12px;color:var(--gold)">Pessoas</h3>';
        main.appendChild(peopleSection);
        people.slice(0, 10).forEach(item => grid.appendChild(UI.createPersonCard(item)));
      }

      // Movie/TV results
      results.forEach(item => grid.appendChild(UI.createCard(item)));
    } catch (e) {
      grid.innerHTML = '<p style="color: #e74c3c;">Erro na busca.</p>';
    }
  },

  /* --- Detail Modal --- */
  async showDetail(mediaType, id, element, itemData = null) {
    const root = document.getElementById('modalRoot');

    // Add to history with full item data
    if (itemData) {
      this.addToHistory(itemData);
    }

    try {
      const details = await API.getDetails(mediaType, id);
      const imdbId = mediaType === 'tv' ? details.external_ids?.imdb_id : details.imdb_id;
      const trailers = details.videos?.results.filter(v => v.site === 'YouTube' && v.type === 'Trailer') || [];
      const cast = details.credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || '';

      const title = details.title || details.name;
      const year = (details.release_date || details.first_air_date || '').substring(0, 4);
      const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
      const runtime = mediaType === 'movie' && details.runtime ? `${details.runtime} min` : '';
      const seasons = mediaType === 'tv' ? details.seasons?.filter(s => s.season_number > 0) || [] : [];
      const overview = details.overview || 'Sinopse não disponível.';
      const backdrop = details.backdrop_path ? CONFIG.buildImageUrl(details.backdrop_path, 'original') : '';

      let trailerHTML = '';
      if (trailers.length > 0) {
        trailerHTML = `
          <div class="modal-trailer">
            <h3>Trailer</h3>
            <div class="trailer-container">
              <iframe src="https://www.youtube.com/embed/${trailers[0].key}?rel=0" allowfullscreen allow="autoplay"></iframe>
            </div>
          </div>
        `;
      }

      let seasonsHTML = '';
      if (seasons.length > 0) {
        const seasonBtns = seasons.map(s =>
          `<button class="season-btn" data-season="${s.season_number}" data-id="${id}" data-imdb="${imdbId || ''}">${s.season_number === 0 ? 'Especiais' : 'T' + s.season_number}</button>`
        ).join('');
        seasonsHTML = `
          <div class="modal-seasons">
            <h3>Temporadas</h3>
            <div class="season-list" id="seasonList">${seasonBtns}</div>
            <div class="episode-list" id="episodeList"></div>
          </div>
        `;
      }

      const playBtnHTML = imdbId
        ? `<button class="backdrop-play" title="Assistir">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>
          </button>`
        : '';

      const isFav = this.isFavorite(id, mediaType);
      const isInWl = this.isInWatchlist(id, mediaType);
      const favClass = `modal-action-btn modal-fav-btn ${isFav ? 'active' : ''}`;
      const wlClass = `modal-action-btn modal-wl-btn ${isInWl ? 'active' : ''}`;

      root.innerHTML = `
        <div class="modal-overlay" id="modalOverlay">
          <div class="modal">
            <button class="modal-close" id="modalClose">
              <svg class="icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            ${backdrop ? `<div class="modal-backdrop"><img src="${backdrop}" alt="">${playBtnHTML}<div class="modal-backdrop-gradient"></div></div>` : ''}
            <div class="modal-body">
              <div class="modal-title-row">
                <span class="modal-title">${title}</span>
                ${year ? `<span class="modal-year">${year}</span>` : ''}
                <span class="modal-rating">
                  <svg class="icon-star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ${rating}
                </span>
                <span class="modal-type-badge">${mediaType === 'tv' ? 'Série' : 'Filme'}</span>
              </div>
              <div class="modal-actions-row">
                <button class="${favClass}" data-action="modal-fav" title="Favorito">
                  <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
                <button class="${wlClass}" data-action="modal-wl" title="Minha Lista">
                  <svg viewBox="0 0 24 24" fill="${isInWl ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </button>
              </div>
              <div class="modal-meta">
                ${runtime ? `<span>${runtime}</span>` : ''}
                ${seasons.length ? `<span>${seasons.length} temporada(s)</span>` : ''}
                ${cast ? `<span>Elenco: ${cast}</span>` : ''}
              </div>
              <p class="modal-overview">${overview}</p>
              ${trailerHTML}
              ${seasonsHTML}
            </div>
          </div>
        </div>
      `;

      // Wire events
      document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          this.closeModal();
        }
      });
      document.getElementById('modalClose').addEventListener('click', () => this.closeModal());

      // Modal fav/wl buttons
      const modalFavBtn = document.querySelector('[data-action="modal-fav"]');
      if (modalFavBtn) {
        modalFavBtn.addEventListener('click', () => {
          this.toggleFavorite({ id, media_type: mediaType, title, poster_path: details.poster_path, vote_average: details.vote_average });
          modalFavBtn.classList.toggle('active');
          const svg = modalFavBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', modalFavBtn.classList.contains('active') ? 'currentColor' : 'none');
        });
      }
      const modalWlBtn = document.querySelector('[data-action="modal-wl"]');
      if (modalWlBtn) {
        modalWlBtn.addEventListener('click', () => {
          this.toggleWatchlist({ id, media_type: mediaType, title, poster_path: details.poster_path, vote_average: details.vote_average });
          modalWlBtn.classList.toggle('active');
          const svg = modalWlBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', modalWlBtn.classList.contains('active') ? 'currentColor' : 'none');
        });
      }

      // Season buttons — pass imdb for direct episode links
      document.querySelectorAll('.season-btn').forEach(btn => {
        btn.addEventListener('click', () => this.loadSeason(btn.dataset.id, btn.dataset.season, btn.dataset.imdb));
      });

      // Escape key
      document.addEventListener('keydown', this._escapeHandler);

      // Push to browser history so back button/gesture closes modal instead of leaving page
      APP._modalHistoryLen = history.length;
      history.pushState({ modal: true }, '');
      window.addEventListener('popstate', this._popHandler);

      // Lock body scroll on mobile to prevent swipe-back
      document.body.style.overflow = 'hidden';

      // Backdrop play button
      const backdropPlayBtn = document.querySelector('.backdrop-play');
      if (backdropPlayBtn) {
        backdropPlayBtn.addEventListener('click', async (e) => {
          APP.smartPlay(mediaType, id, imdbId, title, e.currentTarget, seasons);
        });
      }

      // Load recommendations & similar async
      this.loadModalExtras(mediaType, id);

      this.updateScroll();
    } catch (e) {
      root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal"><button class="modal-close" id="modalClose"><svg class="icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><div class="modal-body"><p class="error">Erro ao carregar detalhes.</p></div></div></div>`;
      document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
      APP._modalHistoryLen = history.length;
      history.pushState({ modal: true }, '');
      window.addEventListener('popstate', this._popHandler);
      this.updateScroll();
    }
  },

  closeModal(fromHistory = false) {
    document.getElementById('modalRoot').innerHTML = '';
    document.removeEventListener('keydown', this._escapeHandler);
    window.removeEventListener('popstate', this._popHandler);
    this.updateScroll();
    if (!fromHistory) {
      history.back();
    }
    // Refresh history row with latest data
    this.refreshHistoryRow();
  },

  _escapeHandler(e) {
    // Only close modal if player is not open
    if (e.key === 'Escape' && !document.getElementById('playerOverlay')) {
      APP.closeModal();
    }
  },

  _popHandler(e) {
    // If we're in the middle of a player history jump, skip modal close
    if (APP._blockCloseModal) return;

    // If we are returning to a state that is NOT the modal, close the modal
    if (!e || !e.state || !e.state.modal) {
      APP.closeModal(true);
    }
  },

  /* --- Smart Play Logic --- */
  async smartPlay(mediaType, id, imdbId, title, btnElement = null, seasons = []) {
    if (mediaType === 'movie') {
      if (imdbId) APP.markWatched(imdbId);
      APP.playVideo(CONFIG.buildPlayUrl(imdbId), { type: 'movie', id, imdbId, title });
    } else if (mediaType === 'tv') {
      let originalHTML = '';
      if (btnElement) {
        originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = '<div class="loading-spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto;"></div>';
      }
      
      const history = APP.getWatchedHistory();
      let maxS = 0, maxE = 0;
      for (const key in history) {
        if (key.startsWith(`${imdbId}_S`)) {
          const match = key.match(/_S(\d+)E(\d+)/);
          if (match) {
            const s = parseInt(match[1]);
            const e = parseInt(match[2]);
            if (s > maxS || (s === maxS && e > maxE)) {
              maxS = s;
              maxE = e;
            }
          }
        }
      }
      
      let targetS = maxS || 1;
      let targetE = maxE ? maxE + 1 : 1;
      let eps = [];
      
      try {
        let seasonData = await API._fetch(`/tv/${id}/season/${targetS}`);
        eps = seasonData.episodes || [];
        
        if (targetE > eps.length && maxE > 0) {
          targetS++;
          targetE = 1;
          try {
            seasonData = await API._fetch(`/tv/${id}/season/${targetS}`);
            eps = seasonData.episodes || [];
          } catch (err) {
            // No next season, replay last
            targetS = maxS;
            targetE = maxE;
            seasonData = await API._fetch(`/tv/${id}/season/${targetS}`);
            eps = seasonData.episodes || [];
          }
        }
        
        APP.markWatched(imdbId, targetS, targetE);
        
        APP.playVideo(CONFIG.buildPlayUrl(imdbId, targetS, targetE), {
          type: 'tv',
          seriesId: id,
          seriesImdbId: imdbId,
          season: targetS,
          episode: targetE,
          episodeData: eps.find(ep => ep.episode_number === targetE),
          episodes: eps,
          seasons: seasons,
          seriesTitle: title
        });
        
        if (document.getElementById('modalOverlay')) {
          APP.loadSeason(id, targetS, imdbId);
        }
      } catch (err) {
        console.error(err);
        APP.playVideo(CONFIG.buildPlayUrl(imdbId, 1, 1), { 
          type: 'tv', 
          seriesId: id, 
          seriesImdbId: imdbId, 
          season: 1, 
          episode: 1, 
          episodes: [], 
          seasons: seasons, 
          seriesTitle: title 
        });
      } finally {
        if (btnElement) btnElement.innerHTML = originalHTML;
      }
    }
  },

  /* --- Video Player --- */
  playVideo(url, context = null) {
    const root = document.getElementById('playerRoot');
    this.currentPlayContext = context;
    
    // Build context UI if it's a TV series
    let controlsHTML = '';
    if (context && context.type === 'tv') {
      const hasNextEpisode = context.episode < context.episodes.length;
      const hasNextSeason = context.seasons && context.season < context.seasons.length;
      
      let nextBtnHTML = '';
      if (hasNextEpisode || hasNextSeason) {
        nextBtnHTML = `
          <button class="player-top-action" id="playerNextBtn" title="Próximo Episódio">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            <span class="hide-mobile">Próximo</span>
          </button>
        `;
      }
      
      const seasonTabsHTML = context.seasons && context.seasons.length > 1 ? `
        <div class="panel-seasons">
          ${context.seasons.map(s => {
            const num = s.season_number;
            const label = context.seasons.length >= 10 ? `T${String(num).padStart(2, '0')}` : `T${num}`;
            return `<button class="season-tab ${num === context.season ? 'active' : ''}" data-season="${num}">${label}</button>`;
          }).join('')}
        </div>
      ` : '';

      controlsHTML = `
        <div class="player-controls" id="playerControls">
          <div class="player-header">
            <div class="player-header-left">
              <button class="player-back" id="playerClose" title="Voltar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <div class="player-title-info">
                <span class="player-series-title">${context.seriesTitle || ''}</span>
                <span class="player-ep-title">T${context.season}:E${context.episode} - ${context.episodeData?.name || `Episódio ${context.episode}`}</span>
              </div>
            </div>
            <div class="player-header-right">
              ${nextBtnHTML}
              <button class="player-top-action" id="playerFullscreenBtn" title="Tela Cheia">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                <span class="hide-mobile">Tela Cheia</span>
              </button>
              <button class="player-top-action" id="playerEpisodesBtn" title="Episódios">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
                <span class="hide-mobile">Episódios</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="player-episodes-panel" id="playerEpisodesPanel">
          <div class="panel-header">
            <h3>Episódios</h3>
            <button class="panel-close" id="panelClose">&times;</button>
          </div>
          ${seasonTabsHTML}
          <div class="panel-list">
            ${context.episodes.map(ep => {
              const isCurrent = ep.episode_number === context.episode;
              const isWatched = APP.isWatched(context.seriesImdbId, context.season, ep.episode_number);
              return `
              <div class="panel-ep-item ${isCurrent ? 'current' : ''} ${isWatched ? 'watched' : ''}" data-ep="${ep.episode_number}">
                <span class="panel-ep-num">${ep.episode_number}</span>
                <span class="panel-ep-name">${ep.name || 'Episódio ' + ep.episode_number}</span>
                ${isWatched ? '<span class="panel-ep-watched">✓</span>' : ''}
              </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      // Movie or fallback UI
      controlsHTML = `
        <div class="player-controls" id="playerControls">
          <div class="player-header">
            <div class="player-header-left">
              <button class="player-back" id="playerClose">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <div class="player-title-info">
                <span class="player-ep-title">${context?.title || ''}</span>
              </div>
            </div>
            <div class="player-header-right">
              <button class="player-top-action" id="playerFullscreenBtn" title="Tela Cheia">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                <span class="hide-mobile">Tela Cheia</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="player-overlay" id="playerOverlay">
        ${controlsHTML}
        <div class="player-click-shield" id="playerShield" style="position:absolute;inset:0;z-index:3008;pointer-events:none;"></div>
        <iframe class="player-iframe" src="${url}" allow="autoplay"></iframe>
      </div>
    `;

    // Events
    document.getElementById('playerClose').addEventListener('click', () => {
      APP.closePlayer();
    });
    
    // Hover logic to show/hide controls — bound handler for proper cleanup
    if (APP._hideControlsTimeout) clearTimeout(APP._hideControlsTimeout);

    const controls = document.getElementById('playerControls');
    const shield = document.getElementById('playerShield');
    const overlay = document.getElementById('playerOverlay');
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    APP._playerHideHandler = () => {
      controls.classList.remove('hidden');
      if (shield && isTouch) shield.style.pointerEvents = 'none';

      clearTimeout(APP._hideControlsTimeout);
      APP._hideControlsTimeout = setTimeout(() => {
        if (!document.getElementById('playerEpisodesPanel')?.classList.contains('open')) {
          controls.classList.add('hidden');
          if (shield && isTouch) shield.style.pointerEvents = 'auto';
        }
      }, 3000);
    };

    overlay.addEventListener('mousemove', APP._playerHideHandler);
    overlay.addEventListener('click', APP._playerHideHandler);
    overlay.addEventListener('touchstart', APP._playerHideHandler);
    APP._playerHideHandler();

    // Fullscreen Logic
    const fsBtn = document.getElementById('playerFullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        const fRoot = document.getElementById('playerRoot');
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (fRoot.requestFullscreen) {
            fRoot.requestFullscreen().catch(()=>{});
          } else if (fRoot.webkitRequestFullscreen) {
            fRoot.webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      });
    }

    // Context Events
    if (context && context.type === 'tv') {
      const nextBtn = document.getElementById('playerNextBtn');
      if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
          let s = context.season;
          let e = context.episode + 1;
          let eps = context.episodes;

          // Check if we need to jump to next season
          if (e > eps.length) {
            if (context.seasons && s < context.seasons.length) {
              s++;
              e = 1;
              nextBtn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div>';
              try {
                const data = await API._fetch(`/tv/${context.seriesId}/season/${s}`);
                eps = data.episodes || [];
              } catch (err) {
                console.error('Error loading next season:', err);
                return;
              }
            } else {
              return; // No more episodes or seasons
            }
          }

          APP.markWatched(context.seriesImdbId, s, e);
          const nextUrl = CONFIG.buildPlayUrl(context.seriesImdbId, s, e);
          APP.playVideo(nextUrl, { 
            ...context, 
            season: s, 
            episode: e, 
            episodes: eps,
            episodeData: eps.find(ep => ep.episode_number === e) 
          });
        });
      }

      const panel = document.getElementById('playerEpisodesPanel');
      const epsBtn = document.getElementById('playerEpisodesBtn');
      if (epsBtn) {
        epsBtn.addEventListener('click', () => panel.classList.toggle('open'));
      }
      document.getElementById('panelClose')?.addEventListener('click', () => panel.classList.remove('open'));

      // Panel episode clicks
      panel?.querySelectorAll('.panel-ep-item').forEach(item => {
        item.addEventListener('click', () => {
          const e = parseInt(item.dataset.ep);
          if (e !== context.episode) {
            APP.markWatched(context.seriesImdbId, context.season, e);
            const nextUrl = CONFIG.buildPlayUrl(context.seriesImdbId, context.season, e);
            APP.playVideo(nextUrl, { ...context, episode: e, episodeData: context.episodes.find(ep => ep.episode_number === e) });
          }
        });
      });

      // Season tab clicks
      panel?.querySelectorAll('.season-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
          const s = parseInt(tab.dataset.season);
          if (s === context.season) return;
          
          tab.innerHTML = '<div class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;"></div>';
          try {
            const data = await API._fetch(`/tv/${context.seriesId}/season/${s}`);
            const eps = data.episodes || [];
            APP.playVideo(CONFIG.buildPlayUrl(context.seriesImdbId, s, 1), {
              ...context,
              season: s,
              episode: 1,
              episodeData: eps[0],
              episodes: eps
            });
          } catch(e) {
            tab.textContent = tab.dataset.season;
          }
        });
      });

      // Mouse wheel horizontal scroll for seasons
      const seasonsContainer = panel?.querySelector('.panel-seasons');
      if (seasonsContainer) {
        seasonsContainer.addEventListener('wheel', (e) => {
          if (e.deltaY !== 0) {
            e.preventDefault();
            seasonsContainer.scrollLeft += e.deltaY;
          }
        });
      }
    }

    // First time opening player: pushState. Subsequent episode swaps: replaceState
    // so back button always goes straight to the modal, not through every episode
    document.addEventListener('keydown', this._playerEscapeHandler);

    if (!APP._playerOpened) {
      APP._playerOpened = true;
      history.pushState({ player: true }, '');
    } else {
      history.replaceState({ player: true }, '');
    }

    window.addEventListener('popstate', this._playerPopHandler);
    this.updateScroll();
  },

  closePlayer(fromHistory = false) {
    const root = document.getElementById('playerRoot');
    if (!root.innerHTML && !fromHistory) return;

    root.innerHTML = '';
    document.removeEventListener('keydown', this._playerEscapeHandler);
    window.removeEventListener('popstate', this._playerPopHandler);

    // Clean up hide-controls listeners
    if (APP._hideControlsTimeout) {
      clearTimeout(APP._hideControlsTimeout);
      APP._hideControlsTimeout = null;
    }
    APP._playerHideHandler = null;

    // Explicit exit fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(()=>{});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }

    if (!fromHistory) {
      // Only one pushState exists for the player (episode swaps use replaceState)
      // So a single history.back() goes directly to the modal state
      APP._isExitingPlayer = true;
      APP._blockCloseModal = true;
      APP._playerOpened = false;
      history.back();
    } else {
      APP._isExitingPlayer = false;
      APP._blockCloseModal = false;

      // Reopen modal if it somehow closed
      if (!document.getElementById('modalOverlay') && this.currentPlayContext) {
        const ctx = this.currentPlayContext;
        const mediaType = ctx.type === 'tv' ? 'tv' : 'movie';
        const id = mediaType === 'tv' ? ctx.seriesId : ctx.id;
        if (id) {
          this.showDetail(mediaType, id);
        }
      }
      this.updateScroll();
    }

    this.updateScroll();
  },

  updateScroll() {
    const hasModal = !!document.getElementById('modalOverlay');
    const hasPlayer = !!document.getElementById('playerOverlay');
    document.body.style.overflow = (hasModal || hasPlayer) ? 'hidden' : '';
  },

  _playerEscapeHandler(e) {
    if (e.key === 'Escape') APP.closePlayer();
  },

  _playerPopHandler(e) {
    // Only one pushState exists for the player, so this always means "go back to modal"
    if (APP._isExitingPlayer) return; // Already handling in closePlayer
    APP.closePlayer(true);
  },

  async loadModalExtras(mediaType, id) {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return;

    let extrasContainer = document.getElementById('modalExtras');
    if (!extrasContainer) {
      extrasContainer = document.createElement('div');
      extrasContainer.id = 'modalExtras';
      modalBody.appendChild(extrasContainer);
    }

    // Fetch both in parallel
    const [similar, recommendations] = await Promise.allSettled([
      API.getSimilar(mediaType, id),
      API.getRecommendations(mediaType, id),
    ]);

    const similarResults = similar.status === 'fulfilled' ? similar.value : [];
    const recResults = recommendations.status === 'fulfilled' ? recommendations.value : [];

    if (similarResults.length > 0) {
      const row = UI.createRow('Títulos Semelhantes', similarResults, 'row-similar', false, false);
      extrasContainer.appendChild(row);
    }

    if (recResults.length > 0) {
      const row = UI.createRow('Recomendados Para Você', recResults, 'row-recommendations', false, false);
      extrasContainer.appendChild(row);
    }

    if (similarResults.length === 0 && recResults.length === 0) {
      // Remove empty container
      extrasContainer.remove();
    }

    this.updateScroll();
  },

  async loadSeason(seriesId, seasonNum, seriesImdbId) {
    const list = document.getElementById('episodeList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    // Update active button
    document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.season-btn[data-season="${seasonNum}"]`)?.classList.add('active');

    // If we don't have the series IMDb ID yet, fetch it
    if (!seriesImdbId) {
      try {
        seriesImdbId = await API.getImdbId('tv', seriesId);
      } catch (e) {}
    }

    try {
      const data = await API._fetch(`/tv/${seriesId}/season/${seasonNum}`);
      const episodes = data.episodes || [];
      const seriesTitle = document.querySelector('.modal-title')?.textContent || '';

      list.innerHTML = episodes.map(ep => {
        const thumb = ep.still_path ? CONFIG.buildImageUrl(ep.still_path, 'w185') : '';
        const desc = ep.overview || '';
        const isWatched = APP.isWatched(seriesImdbId, seasonNum, ep.episode_number);
        return `
        <div class="episode-item ${isWatched ? 'watched' : ''}" data-season="${seasonNum}" data-episode="${ep.episode_number}">
          <span class="episode-num">${ep.episode_number}</span>
          <div class="episode-still">
            ${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : ''}
            ${isWatched ? '<span class="watched-badge">Assistido</span>' : ''}
          </div>
          <div class="episode-info">
            <span class="episode-title">${ep.name || `Episódio ${ep.episode_number}`}</span>
            ${desc ? `<span class="episode-desc">${desc}</span>` : ''}
            <span class="episode-runtime">${ep.runtime ? ep.runtime + ' min' : ''}</span>
          </div>
        </div>
      `}).join('');

      // Episode click -> play directly via streamimdb.me with season/episode
      list.querySelectorAll('.episode-item').forEach(item => {
        item.addEventListener('click', () => {
          if (seriesImdbId) {
            const s = parseInt(item.dataset.season);
            const e = parseInt(item.dataset.episode);
            
            // Mark as watched
            APP.markWatched(seriesImdbId, s, e);
            item.classList.add('watched');
            if (!item.querySelector('.watched-badge')) {
              item.querySelector('.episode-still').insertAdjacentHTML('beforeend', '<span class="watched-badge">Assistido</span>');
            }

            const epData = episodes.find(ep => ep.episode_number === e);
            
            APP.playVideo(CONFIG.buildPlayUrl(seriesImdbId, s, e), {
              type: 'tv',
              seriesId,
              seriesImdbId,
              season: s,
              episode: e,
              episodeData: epData,
              episodes: episodes,
              seriesTitle: seriesTitle
            });
          }
        });
      });
    } catch (e) {
      list.innerHTML = '<p class="error">Erro ao carregar episódios.</p>';
    }
  },

  /* --- Genres --- */
  setupGenresToggle() {
    const toggle = document.getElementById('genresToggle');
    const panel = document.getElementById('genresPanel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      toggle.classList.toggle('open');
      if (!isOpen) {
        setTimeout(() => {
          document.addEventListener('click', this._closeGenresHandler, { once: true });
        }, 0);
      }
    });
  },

  async initGenres() {
    const movieCol = document.getElementById('genresMovie');
    const tvCol = document.getElementById('genresTV');
    if (!movieCol || !tvCol) return;

    try {
      const [movieGenres, tvGenres] = await Promise.all([
        API.getGenres('movie'),
        API.getGenres('tv'),
      ]);

      movieCol.innerHTML = '<div class="genres-column-title">Filmes</div>';
      tvCol.innerHTML = '<div class="genres-column-title">Séries</div>';

      movieGenres.forEach(g => {
        const pill = document.createElement('button');
        pill.className = 'genre-pill';
        pill.textContent = g.name;
        pill.addEventListener('click', () => this.navigateTo('genre', { id: g.id, name: g.name }));
        movieCol.appendChild(pill);
      });

      tvGenres.forEach(g => {
        const pill = document.createElement('button');
        pill.className = 'genre-pill';
        pill.textContent = g.name;
        pill.addEventListener('click', () => this.navigateTo('genre', { id: g.id, name: g.name }));
        tvCol.appendChild(pill);
      });
    } catch (e) {
      console.error('Error loading genres:', e);
    }
  },

  closeGenres() {
    const panel = document.getElementById('genresPanel');
    const toggle = document.getElementById('genresToggle');
    if (panel) panel.classList.add('hidden');
    if (toggle) toggle.classList.remove('open');
  },

  _closeGenresHandler(e) {
    const panel = document.getElementById('genresPanel');
    const toggle = document.getElementById('genresToggle');
    if (panel && toggle && !e.target.closest('.genres-dropdown')) {
      panel.classList.add('hidden');
      toggle.classList.remove('open');
    }
  },

  /* --- Navigation --- */
  navigateTo(page, params = {}) {
    this.currentPage = page;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.page === page);
    });

    // Close genres dropdown on any navigation
    this.closeGenres();

    switch (page) {
      case 'home': this.renderHome(); break;
      case 'movies': this.renderMovies(); break;
      case 'tv': this.renderTV(); break;
      case 'animation': this.renderAnimation(); break;
      case 'genre': this.renderGenre(params.id, params.name); break;
      case 'people': this.renderPeople(); break;
      case 'person': this.renderPerson(params.id); break;
      case 'favorites': this.renderFavorites(); break;
      case 'watchlist': this.renderWatchlist(); break;
    }
  },

  /* --- Genre Page --- */
  async renderGenre(genreId, genreName) {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const movies = await API.getAllMoviesByGenre(genreId, 5);
      if (movies.length > 0) {
        main.appendChild(UI.createRow(`${genreName} — Filmes`, movies, `row-genre-movies-${genreId}`, false, true));
      }
    } catch (e) {
      console.error('Genre movies error:', e);
    }

    try {
      const tvShows = await API.getAllTVByGenre(genreId, 5);
      if (tvShows.length > 0) {
        main.appendChild(UI.createRow(`${genreName} — Séries`, tvShows, `row-genre-tv-${genreId}`, false, true));
      }
    } catch (e) {
      console.error('Genre TV error:', e);
    }
  },

  /* --- People Discovery --- */
  async renderPeople() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const people = await API.getPopularPeople();
      const section = UI.createRow('Pessoas Populares', [], 'row-popular-people');
      const carousel = section.querySelector('.carousel');
      carousel.innerHTML = '';
      people.forEach(item => carousel.appendChild(UI.createPersonCard(item)));
      main.appendChild(section);
    } catch (e) {}
  },

  /* --- Person Detail --- */
  async renderPerson(personId) {
    const root = document.getElementById('modalRoot');

    try {
      const [person, credits] = await Promise.all([
        API.getPersonDetails(personId),
        API.getPersonCredits(personId),
      ]);

      const bio = person.biography || 'Biografia não disponível.';
      const photo = person.profile_path ? CONFIG.buildImageUrl(person.profile_path, 'w300') : '';
      const knownFor = person.known_for_department || '';

      // Get acting credits (top 20 by popularity)
      const acting = credits.cast
        .filter(c => c.poster_path || c.backdrop_path)
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 20);

      const photoHTML = photo
        ? `<div class="person-photo"><img src="${photo}" alt="${person.name}"></div>`
        : `<div class="person-photo person-photo--placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`;

      root.innerHTML = `
        <div class="modal-overlay" id="modalOverlay">
          <div class="modal">
            <button class="modal-close" id="modalClose">
              <svg class="icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="person-header">
              ${photoHTML}
              <div class="person-info">
                <h2 class="person-name">${person.name}</h2>
                ${person.birthday ? `<span class="person-meta">${person.birthday}${person.deathday ? ' — ' + person.deathday : ''}</span>` : ''}
                ${knownFor ? `<span class="person-meta">Conhecido por: ${knownFor}</span>` : ''}
              </div>
            </div>
            <div class="modal-body">
              <p class="modal-overview">${bio}</p>
              ${acting.length > 0 ? '<h3 style="font-size:18px;margin:20px 0 12px;color:var(--text-primary)">Filmografia</h3>' : ''}
            </div>
          </div>
        </div>
      `;

      // Add filmography grid
      if (acting.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'search-grid person-filmography';
        acting.forEach(item => {
          const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
          grid.appendChild(UI.createCard({ ...item, media_type }));
        });
        root.querySelector('.modal-body').appendChild(grid);
      }

      // Wire events
      document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) this.closeModal();
      });
      document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
      document.addEventListener('keydown', this._escapeHandler);
      document.body.style.overflow = 'hidden';
    } catch (e) {
      root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal"><button class="modal-close" id="modalClose"><svg class="icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><div class="modal-body"><p class="error">Erro ao carregar pessoa.</p></div></div></div>`;
      document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    }

    APP._modalHistoryLen = history.length;
    history.pushState({ modal: true }, '');
    window.addEventListener('popstate', this._popHandler);
  },

  /* --- Expanded Catalogs --- */
  async renderDocumentaries() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const docs = await API.getDocumentaryMovies();
      main.appendChild(UI.createRow('Documentários', docs, 'row-docs', false, true));
    } catch (e) {}
  },

  async renderBrazilian() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const br = await API.getBrazilianMovies();
      main.appendChild(UI.createRow('Cinema Brasileiro', br, 'row-br', false, true));
    } catch (e) {}
  },

  async renderClassics() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';

    try {
      const classics = await API.getClassicMovies();
      main.appendChild(UI.createRow('Clássicos', classics, 'row-classics', false, true));
    } catch (e) {}
  },

  /* --- Init --- */
  async init() {
    // Mark initial home state for player tunnelling
    if (!history.state) {
      history.replaceState({ home: true }, '');
    }

    // Nav tabs
    document.querySelectorAll('.nav-tab:not(.genres-toggle)').forEach(tab => {
      tab.addEventListener('click', () => this.navigateTo(tab.dataset.page));
    });

    // Genres dropdown
    this.setupGenresToggle();
    this.initGenres();

    // Logo -> home
    document.getElementById('logo').addEventListener('click', () => this.navigateTo('home'));

    // Search with debounce
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.renderSearch(e.target.value);
      }, 400);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.searchTimeout);
        this.renderSearch(e.target.value);
      }
    });

    // Card clicks (delegated)
    document.getElementById('mainContent').addEventListener('click', async (e) => {
      // Ignore clicks on carousel navigation arrows
      if (e.target.closest('.carousel-nav')) return;

      // Close dropdowns when clicking outside
      if (!e.target.closest('.history-menu-btn') && !e.target.closest('#active-dropdown')) {
        UI.closeAllDropdowns();
      }

      // Ignore clicks on history menu button (handled by its own listener)
      if (e.target.closest('.history-menu-btn')) return;

      // Fav button
      const favBtn = e.target.closest('[data-action="fav"]');
      if (favBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = favBtn.closest('.card');
        if (card && card._itemData) {
          const item = { ...card._itemData, media_type: card._itemData.media_type || card.dataset.type };
          this.toggleFavorite(item);
          favBtn.classList.toggle('active');
          const svg = favBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', favBtn.classList.contains('active') ? 'currentColor' : 'none');
        }
        return;
      }

      // Watchlist button
      const wlBtn = e.target.closest('[data-action="watchlist"]');
      if (wlBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = wlBtn.closest('.card');
        if (card && card._itemData) {
          const item = { ...card._itemData, media_type: card._itemData.media_type || card.dataset.type };
          this.toggleWatchlist(item);
          wlBtn.classList.toggle('active');
          const svg = wlBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', wlBtn.classList.contains('active') ? 'currentColor' : 'none');
        }
        return;
      }

      // Play button — open playimdb directly
      const playBtn = e.target.closest('.card-play-btn');
      if (playBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = playBtn.closest('.card');
        if (card) {
          const mediaType = card.dataset.type;
          const id = card.dataset.id;
          const titleElement = card.querySelector('.card-title');
          const title = titleElement ? titleElement.textContent : '';
          try {
            const imdbId = await API.getImdbId(mediaType, id);
            if (imdbId) {
              const details = mediaType === 'tv' ? await API.getDetails(mediaType, id) : null;
              const seasons = details ? (details.seasons?.filter(s => s.season_number > 0) || []) : [];
              APP.smartPlay(mediaType, id, imdbId, title, playBtn, seasons);
            }
          } catch (err) {
            console.error('Error getting IMDb ID:', err);
          }
        }
        return;
      }

      // Card click — open detail modal
      const card = e.target.closest('.card');
      if (card) {
        e.preventDefault();
        const type = card.dataset.type;
        const id = parseInt(card.dataset.id);
        if (type === 'person') {
          this.navigateTo('person', { id });
          return;
        }
        const itemData = card._itemData || { id, media_type: type };
        if (id && type) this.showDetail(type, id, card, itemData);
        return;
      }

      // Clear history button
      if (e.target.closest('#btnClearAll')) {
        this.clearHistory();
        return;
      }
    });

    // Header scroll effect + close dropdowns on scroll
    window.addEventListener('scroll', () => {
      document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
      UI.closeAllDropdowns();
    }, { passive: true });

    // Close dropdowns on touch outside
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.history-menu-btn') && !e.target.closest('#active-dropdown')) {
        UI.closeAllDropdowns();
      }
    }, { passive: true });

    // Card clicks inside modal (extras: similar & recommendations)
    document.getElementById('modalRoot').addEventListener('click', async (e) => {
      if (e.target.closest('.carousel-nav')) return;
      if (!e.target.closest('.history-menu-btn') && !e.target.closest('#active-dropdown')) {
        UI.closeAllDropdowns();
      }
      if (e.target.closest('.history-menu-btn')) return;

      // Fav button (modal)
      const favBtn = e.target.closest('[data-action="fav"]');
      if (favBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = favBtn.closest('.card');
        if (card && card._itemData) {
          const item = { ...card._itemData, media_type: card._itemData.media_type || card.dataset.type };
          this.toggleFavorite(item);
          favBtn.classList.toggle('active');
          const svg = favBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', favBtn.classList.contains('active') ? 'currentColor' : 'none');
        }
        return;
      }

      // Watchlist button (modal)
      const wlBtn = e.target.closest('[data-action="watchlist"]');
      if (wlBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = wlBtn.closest('.card');
        if (card && card._itemData) {
          const item = { ...card._itemData, media_type: card._itemData.media_type || card.dataset.type };
          this.toggleWatchlist(item);
          wlBtn.classList.toggle('active');
          const svg = wlBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', wlBtn.classList.contains('active') ? 'currentColor' : 'none');
        }
        return;
      }

      const playBtn = e.target.closest('.card-play-btn');
      if (playBtn) {
        e.stopPropagation();
        e.preventDefault();
        const card = playBtn.closest('.card');
        if (card) {
          const mediaType = card.dataset.type;
          const id = card.dataset.id;
          const titleEl = card.querySelector('.card-title');
          const title = titleEl ? titleEl.textContent : '';
          try {
            const imdbId = await API.getImdbId(mediaType, id);
            if (imdbId) {
              const details = mediaType === 'tv' ? await API.getDetails(mediaType, id) : null;
              const seasons = details ? (details.seasons?.filter(s => s.season_number > 0) || []) : [];
              APP.smartPlay(mediaType, id, imdbId, title, playBtn, seasons);
            }
          } catch (err) {
            console.error('Error getting IMDb ID:', err);
          }
        }
        return;
      }

      const card = e.target.closest('.card');
      if (card) {
        e.preventDefault();
        const type = card.dataset.type;
        const id = parseInt(card.dataset.id);
        if (type === 'person') {
          this.navigateTo('person', { id });
          return;
        }
        const itemData = card._itemData || { id, media_type: type };
        if (id && type) {
          this.showDetail(type, id, card, itemData);
        }
        return;
      }
    });

    // Initial render
    this.navigateTo('home');
  },
};

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => { await APP.init(); });
} else {
  APP.init();
}
