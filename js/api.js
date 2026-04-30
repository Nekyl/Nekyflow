// js/api.js — TMDB API wrapper with caching
const API = {
  _cache: new Map(),

  // Cache config: TTL in milliseconds per endpoint type
  CACHE_TTL: {
    genres: 30 * 60 * 1000,      // 30 min
    people: 10 * 60 * 1000,      // 10 min
    reviews: 15 * 60 * 1000,     // 15 min
    details: 10 * 60 * 1000,     // 10 min
    default: 5 * 60 * 1000,      // 5 min
  },

  _cacheSet(key, data, ttl = API.CACHE_TTL.default) {
    try {
      const item = { data, timestamp: Date.now(), ttl };
      sessionStorage.setItem('api_cache_' + key, JSON.stringify(item));
    } catch { /* quota exceeded — skip cache */ }
  },

  _cacheGet(key) {
    try {
      const raw = sessionStorage.getItem('api_cache_' + key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (Date.now() - item.timestamp > item.ttl) {
        sessionStorage.removeItem('api_cache_' + key);
        return null;
      }
      return item.data;
    } catch { return null; }
  },

  clearCache() {
    try {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('api_cache_')) keys.push(k);
      }
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch {}
  },

  async _fetch(endpoint, params = {}) {
    const url = new URL(`${CONFIG.TMDB_BASE}${endpoint}`);
    url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);
    url.searchParams.set('language', 'pt-BR');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    // Check cache
    const cacheKey = btoa(url.pathname + url.search);
    const cached = this._cacheGet(cacheKey);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // Cache response
    this._cacheSet(cacheKey, data);

    return data;
  },

  // === Basic endpoints ===

  async getTrending(mediaType = 'all', timeWindow = 'week') {
    const data = await this._fetch(`/trending/${mediaType}/${timeWindow}`);
    return data.results;
  },

  async getPopularMovies(page = 1) {
    const data = await this._fetch('/movie/popular', { page });
    return data.results;
  },

  async getPopularTV(page = 1) {
    const data = await this._fetch('/tv/popular', { page });
    return data.results;
  },

  async getUpcomingMovies() {
    const data = await this._fetch('/movie/upcoming');
    return data.results;
  },

  async getTopRatedMovies() {
    const data = await this._fetch('/movie/top_rated');
    return data.results;
  },

  async getTopRatedTV() {
    const data = await this._fetch('/tv/top_rated');
    return data.results;
  },

  async getNowPlaying() {
    const data = await this._fetch('/movie/now_playing');
    return data.results;
  },

  async getOnAirTV() {
    const data = await this._fetch('/tv/on_the_air');
    return data.results;
  },

  // === Genres ===

  async getGenres(type = 'movie') {
    const data = await this._fetch(`/genre/${type}/list`, {}, 'genres');
    return data.genres;
  },

  // === Discover ===

  async getDiscover(type, params = {}) {
    const data = await this._fetch(`/discover/${type}`, params);
    return data;
  },

  // === By Genre ===

  async getMoviesByGenre(genreId, page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page,
    });
    return data;
  },

  async getTVByGenre(genreId, page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page,
    });
    return data;
  },

  /** Fetch all pages for a genre (capped at 5 pages = ~100 results) */
  async getAllMoviesByGenre(genreId, maxPages = 5) {
    let all = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await this._fetch('/discover/movie', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
      });
      all = all.concat(data.results);
      if (page >= data.total_pages) break;
    }
    return all;
  },

  /** Fetch all pages for a TV genre (capped at 5 pages = ~100 results) */
  async getAllTVByGenre(genreId, maxPages = 5) {
    let all = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await this._fetch('/discover/tv', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
      });
      all = all.concat(data.results);
      if (page >= data.total_pages) break;
    }
    return all;
  },

  // Fetch ALL pages for a genre (max 5 to avoid rate limits)
  async getAllMoviesByGenre(genreId, maxPages = 5) {
    let allResults = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await this._fetch('/discover/movie', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
      });
      allResults = allResults.concat(data.results);
      if (page >= data.total_pages) break;
    }
    return allResults;
  },

  async getAllTVByGenre(genreId, maxPages = 5) {
    let allResults = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await this._fetch('/discover/tv', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
      });
      allResults = allResults.concat(data.results);
      if (page >= data.total_pages) break;
    }
    return allResults;
  },

  // === By Language/Region ===

  async getBrazilianMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_original_language: 'pt',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getClassicMovies() {
    const year = new Date().getFullYear();
    const data = await this._fetch('/discover/movie', {
      primary_release_date_lte: '2000-12-31',
      sort_by: 'vote_average.desc',
      vote_count_gte: 50,
    });
    return data.results;
  },

  async getDocumentaryMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '99',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getAnimationMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getAnimationTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  // === Similar & Recommendations ===

  async getSimilar(type, id, page = 1) {
    const data = await this._fetch(`/${type}/${id}/similar`, { page });
    return data.results;
  },

  async getRecommendations(type, id, page = 1) {
    const data = await this._fetch(`/${type}/${id}/recommendations`, { page });
    return data.results;
  },

  // === Reviews ===

  async getReviews(type, id, page = 1) {
    const data = await this._fetch(`/${type}/${id}/reviews`, { page });
    return data;
  },

  // === People ===

  async getPopularPeople(page = 1) {
    const data = await this._fetch('/person/popular', { page });
    return data.results;
  },

  async getPersonDetails(id) {
    const data = await this._fetch(`/person/${id}`, {}, 'people');
    return data;
  },

  async getPersonCredits(id) {
    const data = await this._fetch(`/person/${id}/combined_credits`, {}, 'people');
    return data;
  },

  // === Search ===

  async search(query, page = 1) {
    const [movies, tv] = await Promise.all([
      this._fetch('/search/movie', { query, page }),
      this._fetch('/search/tv', { query, page }),
    ]);
    return [
      ...movies.results.map(r => ({ ...r, media_type: 'movie' })),
      ...tv.results.map(r => ({ ...r, media_type: 'tv' })),
    ].sort((a, b) => b.popularity - a.popularity);
  },

  async searchPeople(query, page = 1) {
    const data = await this._fetch('/search/person', { query, page });
    return data.results;
  },

  // === Details ===

  async getDetails(mediaType, id) {
    return this._fetch(`/${mediaType}/${id}`, {
      append_to_response: 'videos,credits,external_ids',
    });
  },

  async getImdbId(mediaType, id) {
    if (mediaType === 'tv') {
      const data = await this._fetch(`/tv/${id}/external_ids`);
      return data.imdb_id;
    }
    const data = await this._fetch(`/${mediaType}/${id}`);
    return data.imdb_id;
  },

  async getVideos(mediaType, id) {
    const data = await this._fetch(`/${mediaType}/${id}/videos`);
    return data.results.filter(v => v.site === 'YouTube' && v.type === 'Trailer');
  },
};
