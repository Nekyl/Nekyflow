// js/config.js
const CONFIG = {
  TMDB_API_KEY: typeof window !== 'undefined' && window.TMDB_API_KEY
    ? window.TMDB_API_KEY
    : '',
  TMDB_BASE: 'https://api.themoviedb.org/3',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/',
  POSTER_SIZE: 'w342',
  BACKDROP_SIZE: 'original',
  PROFILE_SIZE: 'w185',

  buildImageUrl(path, size = null) {
    if (!path) return '';
    return `${this.IMAGE_BASE}${size || this.POSTER_SIZE}${path}`;
  },

  buildPlayUrl(imdbId, season = null, episode = null) {
    const themeColor = 'd4a746'; // App theme gold color to replace default purple
    if (season !== null && episode !== null) {
      return `https://streamimdb.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}&color=${themeColor}`;
    }
    return `https://streamimdb.me/embed/${imdbId}?color=${themeColor}`;
  }
};
