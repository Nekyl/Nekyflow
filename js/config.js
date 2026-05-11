// js/config.js
const CONFIG = {
  TMDB_BASE: 'https://nekyflow-proxy.nekyll.workers.dev/3',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/',

  POSTER_SIZE: 'w342',
  BACKDROP_SIZE: 'original',
  PROFILE_SIZE: 'w185',

  buildImageUrl(path, size = null) {
    if (!path) return '';
    return `${this.IMAGE_BASE}${size || this.POSTER_SIZE}${path}`;
  },

  buildPlayUrl(imdbId, season = null, episode = null) {
    if (season !== null && episode !== null) {
      return `https://embedplayapi.top/embed/${imdbId}/${season}/${episode}`;
    }
    return `https://embedplayapi.top/embed/${imdbId}`;
  },

};
