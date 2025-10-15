// Constantes de fetch
export const ARTICLE_FETCH_LIMIT = 2000;

// Catégories exclues des stats ET du fil principal
export const EXCLUDED_CATEGORIES_STATS = [
  'ConseilDesMinistres',
  'GazetteOfficielle', 
  'Gouvernement',
  'AssembleeNationale',
  'Politique',
  'Actualités',
  'Outaouais',
  'Sports'
];

// Catégories exclues SEULEMENT du fil principal
export const EXCLUDED_CATEGORIES_FEED = ['Politique'];

// Clés localStorage
export const STORAGE_KEY_SCAN_HOURS = 'firewatch_last_scan_hours';
export const STORAGE_KEY_LAST_SCAN = 'firewatch_last_auto_scan';

// Délais et timeouts
export const RATE_LIMIT_DELAY = 2000; // 2 secondes entre rafraîchissements
export const AUTO_SCAN_DELAY = 1000; // 1 seconde avant auto-scan
export const PERIODIC_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Valeurs par défaut
export const DEFAULT_DISPLAY_HOURS = 48;

// ✅ HELPERS de filtrage temporel
export const isArticleInTimeRange = (article, hours) => {
  if (!article.publication_date) return false;
  
  try {
    const now = new Date();
    const pubDate = new Date(article.publication_date);
    const diffInHours = (now - pubDate) / (1000 * 60 * 60);
    return diffInHours <= hours;
  } catch (e) {
    return false;
  }
};

export const filterArticlesByTime = (articles, hours) => {
  return articles.filter(article => isArticleInTimeRange(article, hours));
};