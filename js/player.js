// js/player.js — Custom HLS player with TMDB subtitles
const CUSTOM_PLAYER = {
  hls: null,
  videoEl: null,

  _proxyUrl(url) {
    // If running via local proxy server, wrap stream URLs
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      if (url.includes('neonhorizonworkshops.com') || url.includes('tmstr')) {
        // base64url encoding (standard, no padding)
        const encoded = btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return '/proxy/' + encoded;
      }
    }
    return url;
  },

  async init(streamUrl, context = null) {
    const root = document.getElementById('playerRoot');

    // Route stream through proxy if needed
    streamUrl = this._proxyUrl(streamUrl);

    // Build controls HTML
    let controlsHTML = '';
    if (context && context.type === 'tv') {
      controlsHTML = this._buildTVControls(context);
    } else {
      controlsHTML = this._buildMovieControls(context);
    }

    root.innerHTML = `
      <div class="player-overlay" id="playerOverlay">
        ${controlsHTML}
        <video id="customVideo" style="position:absolute;inset:0;width:100%;height:100%;background:#000;" autoplay></video>
      </div>
    `;

    this.videoEl = document.getElementById('customVideo');

    // Initialize HLS.js
    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      this.hls.loadSource(streamUrl);
      this.hls.attachMedia(this.videoEl);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.videoEl.play().catch(() => {});
      });
      // Debug: log errors
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.log('[HLS Error]', data.type, data.details, data.fatal ? 'FATAL' : 'non-fatal');
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS] Fatal network error — stream may have expired');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS] Fatal media error');
              break;
          }
        }
      });
    } else if (this.videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      this.videoEl.src = streamUrl;
      this.videoEl.addEventListener('loadedmetadata', () => {
        this.videoEl.play().catch(() => {});
      });
    }

    // Load subtitles from TMDB
    if (context) {
      this.loadSubtitles(context);
    }

    // Wire controls
    this._wireControls(context);
    this._wireHideControls();

    APP.currentPlayContext = context;
    APP.updateScroll();
  },

  async loadSubtitles(context) {
    const { type, id, imdbId } = context;
    const mediaType = type === 'tv' ? 'tv' : 'movie';
    const realId = type === 'tv' && id ? id : id;

    try {
      const details = await API.getDetails(mediaType, realId);
      const videos = details.videos?.results || [];

      // Filter PT-BR subtitles from TMDB
      const subtitles = videos
        .filter(v => v.iso_639_1 === 'pt' && (v.type === 'Subtitle' || v.site === 'OpenSubtitles'))
        .map(v => ({
          name: v.name || 'Legendas PT-BR',
          lang: v.iso_639_1,
          key: v.key,
          site: v.site,
        }));

      if (subtitles.length > 0) {
        this.addSubtitles(subtitles);
      }
    } catch (e) {
      console.log('Could not load subtitles:', e);
    }
  },

  addSubtitles(subtitles) {
    if (!this.videoEl) return;

    subtitles.forEach((sub, i) => {
      // Try to fetch VTT from TMDB (if they provide it)
      // TMDB doesn't host subtitles directly, but we can try
      // For now, we'll note them in the UI
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = sub.name;
      track.srclang = sub.lang;
      track.mode = i === 0 ? 'showing' : 'hidden'; // First one ON by default
      this.videoEl.appendChild(track);
    });

    // If no real subtitle files, create a note in the UI
    const controls = document.getElementById('playerControls');
    if (controls && subtitles.length > 0) {
      const subNote = document.createElement('div');
      subNote.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);padding:8px 16px;border-radius:4px;color:#D4A746;font-size:12px;pointer-events:none;z-index:3015;';
      subNote.textContent = `${subtitles.length} legenda(s) PT-BR disponível(is) via TMDB`;
      // Only show briefly
      setTimeout(() => subNote.remove(), 3000);
      controls.appendChild(subNote);
    }
  },

  _buildTVControls(context) {
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

    return `
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
        <div class="player-bottom-bar">
          <input type="range" class="player-progress" id="playerProgress" min="0" max="100" value="0" step="0.1">
          <div class="player-controls-bottom">
            <div class="player-controls-left">
              <button class="player-ctrl-btn" id="playerPlayPauseBtn" title="Play/Pause">
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </button>
              <button class="player-ctrl-btn" id="playerRewindBtn" title="-10s">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">10</text></svg>
              </button>
              <button class="player-ctrl-btn" id="playerForwardBtn" title="+10s">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">10</text></svg>
              </button>
              <div class="player-volume" id="playerVolume">
                <button class="player-ctrl-btn" id="playerVolumeBtn" title="Volume">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5z"/></svg>
                </button>
                <input type="range" class="player-volume-slider" id="playerVolumeSlider" min="0" max="1" step="0.05" value="1">
              </div>
              <span class="player-time" id="playerTime">00:00 / 00:00</span>
            </div>
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
  },

  _buildMovieControls(context) {
    return `
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
        <div class="player-bottom-bar">
          <input type="range" class="player-progress" id="playerProgress" min="0" max="100" value="0" step="0.1">
          <div class="player-controls-bottom">
            <div class="player-controls-left">
              <button class="player-ctrl-btn" id="playerPlayPauseBtn" title="Play/Pause">
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </button>
              <button class="player-ctrl-btn" id="playerRewindBtn" title="-10s">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">10</text></svg>
              </button>
              <button class="player-ctrl-btn" id="playerForwardBtn" title="+10s">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">10</text></svg>
              </button>
              <div class="player-volume" id="playerVolume">
                <button class="player-ctrl-btn" id="playerVolumeBtn" title="Volume">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5z"/></svg>
                </button>
                <input type="range" class="player-volume-slider" id="playerVolumeSlider" min="0" max="1" step="0.05" value="1">
              </div>
              <span class="player-time" id="playerTime">00:00 / 00:00</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _wireControls(context) {
    const closeBtn = document.getElementById('playerClose');
    if (closeBtn) closeBtn.addEventListener('click', () => APP.closePlayer());

    // Fullscreen
    const fsBtn = document.getElementById('playerFullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        const fRoot = document.getElementById('playerRoot');
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          (fRoot.requestFullscreen || fRoot.webkitRequestFullscreen || (() => {})).call(fRoot)?.catch?.(() => {});
        } else {
          (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
        }
      });
    }

    // === Video Controls ===
    const video = this.videoEl;
    if (!video) return;

    const playPauseBtn = document.getElementById('playerPlayPauseBtn');
    const rewindBtn = document.getElementById('playerRewindBtn');
    const forwardBtn = document.getElementById('playerForwardBtn');
    const volumeBtn = document.getElementById('playerVolumeBtn');
    const volumeSlider = document.getElementById('playerVolumeSlider');
    const progress = document.getElementById('playerProgress');
    const timeDisplay = document.getElementById('playerTime');

    const fmt = (s) => {
      if (!isFinite(s)) return '00:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    };

    const updatePlayPauseIcon = () => {
      if (!playPauseBtn) return;
      playPauseBtn.innerHTML = video.paused
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    };

    const updateTime = () => {
      if (!timeDisplay) return;
      const current = fmt(video.currentTime);
      const total = fmt(video.duration);
      timeDisplay.textContent = `${current} / ${total}`;
    };

    const updateProgress = () => {
      if (!progress || !isFinite(video.duration)) return;
      progress.value = (video.currentTime / video.duration) * 100;
    };

    // Play/Pause
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        video.paused ? video.play().catch(() => {}) : video.pause();
      });
    }
    video.addEventListener('play', updatePlayPauseIcon);
    video.addEventListener('pause', updatePlayPauseIcon);
    // Double-click video to toggle play/pause
    video.addEventListener('dblclick', () => {
      video.paused ? video.play().catch(() => {}) : video.pause();
    });

    // Click video (single) to show controls
    video.addEventListener('click', () => {
      const controls = document.getElementById('playerControls');
      if (controls) controls.classList.remove('hidden');
    });

    // Rewind / Forward
    if (rewindBtn) rewindBtn.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
    if (forwardBtn) forwardBtn.addEventListener('click', () => { video.currentTime = Math.min(video.duration, video.currentTime + 10); });

    // Keyboard shortcuts
    const onKey = (e) => {
      if (!video) return;
      switch(e.key) {
        case ' ':
        case 'k': e.preventDefault(); video.paused ? video.play().catch(()=>{}) : video.pause(); break;
        case 'ArrowLeft': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
        case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); break;
        case 'm':
          if (volumeSlider) {
            video.muted = !video.muted;
            volumeSlider.value = video.muted ? 0 : video.volume;
          }
          break;
      }
    };
    document.getElementById('playerOverlay')?.addEventListener('keydown', onKey);

    // Volume
    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        if (volumeSlider) volumeSlider.value = video.muted ? 0 : video.volume;
      });
    }
    if (volumeSlider) {
      volumeSlider.addEventListener('input', () => {
        video.volume = parseFloat(volumeSlider.value);
        video.muted = video.volume === 0;
      });
    }

    // Progress seek
    let seeking = false;
    if (progress) {
      progress.addEventListener('input', () => { seeking = true; });
      progress.addEventListener('change', () => {
        if (isFinite(video.duration)) {
          video.currentTime = (progress.value / 100) * video.duration;
        }
        seeking = false;
      });
    }

    // Update loop
    video.addEventListener('timeupdate', () => {
      updateTime();
      if (!seeking) updateProgress();
    });
    video.addEventListener('loadedmetadata', () => {
      updateTime();
    });
    updatePlayPauseIcon();

    // TV controls
    if (context && context.type === 'tv') {
      const nextBtn = document.getElementById('playerNextBtn');
      if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
          let s = context.season;
          let e = context.episode + 1;
          let eps = context.episodes;

          if (e > eps.length) {
            if (context.seasons && s < context.seasons.length) {
              s++;
              e = 1;
              try {
                const data = await API._fetch(`/tv/${context.seriesId}/season/${s}`);
                eps = data.episodes || [];
              } catch { return; }
            } else {
              return;
            }
          }

          APP.markWatched(context.seriesImdbId, s, e);
          const newContext = { ...context, season: s, episode: e, episodes: eps, episodeData: eps.find(ep => ep.episode_number === e) };
          this.destroy();
          const newUrl = CONFIG.buildPlayUrl(context.seriesImdbId, s, e);
          APP.playVideo(newUrl, newContext);
        });
      }

      const panel = document.getElementById('playerEpisodesPanel');
      const epsBtn = document.getElementById('playerEpisodesBtn');
      if (epsBtn) {
        epsBtn.addEventListener('click', () => panel.classList.toggle('open'));
      }
      document.getElementById('panelClose')?.addEventListener('click', () => panel.classList.remove('open'));

      panel?.querySelectorAll('.panel-ep-item').forEach(item => {
        item.addEventListener('click', () => {
          const ep = parseInt(item.dataset.ep);
          if (ep !== context.episode) {
            APP.markWatched(context.seriesImdbId, context.season, ep);
            const newContext = { ...context, episode: ep, episodeData: context.episodes.find(e => e.episode_number === ep) };
            const newUrl = CONFIG.buildPlayUrl(context.seriesImdbId, context.season, ep);
            this.destroy();
            APP.playVideo(newUrl, newContext);
          }
        });
      });

      panel?.querySelectorAll('.season-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
          const s = parseInt(tab.dataset.season);
          if (s === context.season) return;
          try {
            const data = await API._fetch(`/tv/${context.seriesId}/season/${s}`);
            const eps = data.episodes || [];
            const newContext = { ...context, season: s, episode: 1, episodeData: eps[0], episodes: eps };
            const newUrl = CONFIG.buildPlayUrl(context.seriesImdbId, s, 1);
            this.destroy();
            APP.playVideo(newUrl, newContext);
          } catch {}
        });
      });

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
  },

  _wireHideControls() {
    const controls = document.getElementById('playerControls');
    if (!controls) return;

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const overlay = document.getElementById('playerOverlay');
    let timeout;

    const show = () => {
      controls.classList.remove('hidden');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const panel = document.getElementById('playerEpisodesPanel');
        if (!panel?.classList.contains('open')) {
          controls.classList.add('hidden');
        }
      }, 3000);
    };

    overlay.addEventListener('mousemove', show);
    overlay.addEventListener('click', show);
    overlay.addEventListener('touchstart', show, { passive: true });
    show();
  },

  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
      this.videoEl = null;
    }
    APP.currentPlayContext = null;
  },
};
