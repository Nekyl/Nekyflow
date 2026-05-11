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
    // api_key is now handled by the worker proxy
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

  // === Anime (JP/CN/KR animation) ===

  async getAnimeMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getAnimeTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getTopRatedAnimeMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      with_original_language: 'ja|zh|ko',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 50,
      page,
    });
    return data.results;
  },

  async getTopRatedAnimeTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ja|zh|ko',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 50,
      page,
    });
    return data.results;
  },

  async getAnimeNowAiring(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      'air_date.gte': new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      'air_date.lte': new Date().toISOString().split('T')[0],
      page,
    });
    return data.results;
  },

  async getJapaneseAnimeMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getJapaneseAnimeTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getChineseAnimeTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'zh',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getAnimeTrendingTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      'air_date.gte': new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
      page,
    });
    return data.results;
  },

  async getKoreanAnimeTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getActionAnimeMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16,28',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getActionAnimeTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16,10759',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getDoramaTrendingTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      'air_date.gte': new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
      page,
    });
    return data.results;
  },

  async getDoramaNowAiring(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      'air_date.gte': new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      'air_date.lte': new Date().toISOString().split('T')[0],
      page,
    });
    return data.results;
  },

  // === Doramas (JP/CN/KR drama) ===

  async getDoramaTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getDoramaMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '18',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getTopRatedDoramaTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'ja|zh|ko',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 20,
      page,
    });
    return data.results;
  },

  async getKoreanDoramaTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getJapaneseDoramaTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getChineseDoramaTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18',
      with_original_language: 'zh',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getRomanceDoramaTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '18,10749',
      with_original_language: 'ja|zh|ko',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results;
  },

  async getKidsTrending(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      with_original_language: 'en|pt|es|fr|de|it',
      sort_by: 'popularity.desc',
      'air_date.gte': new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
      page,
    });
    return data.results;
  },

  async getKidsTrendingMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      with_original_language: 'en|pt|es|fr|de|it',
      sort_by: 'popularity.desc',
      'primary_release_date.gte': new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
      page,
    });
    return data.results;
  },

  // === Kids Animation (genre 16, excluding JP/CN/KR) ===

  async getKidsAnimationMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results.filter(m => !['ja', 'zh', 'ko'].includes(m.original_language));
  },

  async getKidsAnimationTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results.filter(t => !['ja', 'zh', 'ko'].includes(t.original_language));
  },

  async getTopRatedKidsMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 50,
      with_original_language: 'en|pt|es|fr|de|it',
      page,
    });
    return data.results;
  },

  async getTopRatedKidsTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 50,
      with_original_language: 'en|pt|es|fr|de|it',
      page,
    });
    return data.results;
  },

  async getFamilyMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '10751',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results.filter(m => !['ja', 'zh', 'ko'].includes(m.original_language));
  },

  async getFamilyTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '10751',
      sort_by: 'popularity.desc',
      page,
    });
    return data.results.filter(t => !['ja', 'zh', 'ko'].includes(t.original_language));
  },

  async getKidsAdventureMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16,12',
      sort_by: 'popularity.desc',
      with_original_language: 'en|pt|es|fr|de|it',
      page,
    });
    return data.results;
  },

  async getKidsComedyMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16,35',
      sort_by: 'popularity.desc',
      with_original_language: 'en|pt|es|fr|de|it',
      page,
    });
    return data.results;
  },

  async getKidsFantasyMovies(page = 1) {
    const data = await this._fetch('/discover/movie', {
      with_genres: '16,14',
      sort_by: 'popularity.desc',
      with_original_language: 'en|pt|es|fr|de|it',
      page,
    });
    return data.results;
  },

  async getKidsComedyTV(page = 1) {
    const data = await this._fetch('/discover/tv', {
      with_genres: '16,35',
      sort_by: 'popularity.desc',
      with_original_language: 'en|pt|es|fr|de|it',
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
