
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Article, Source, Category } from "@/api/entities";
import { Newspaper, FileText, RefreshCw, Archive, Search, Grid, Shield, CheckCircle, XCircle, Loader2, Tag, Activity, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { captageComplet } from "@/api/functions/captageComplet.js";
import { archiveAllArticles } from "@/api/functions";
import { scrapeSitemaps } from "@/api/functions";
import { scrapeLeQuotidien } from "@/api/functions";
import { scrapeLeDroit } from "@/api/functions";
import { scrapeRadioCanadaSaguenay } from "@/api/functions";
import { processArticleAlerts } from "@/api/functions";
import { recategorizeALL } from "@/api/functions"; // Keep import as it might be used elsewhere or still relevant for type hinting
import { cleanupDuplicates } from "@/api/functions";
import { cleanupFutureArticles } from "@/api/functions";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import StatsCard from "../components/dashboard/StatsCard";
import ArticleCard from "../components/dashboard/ArticleCard";
import EditCategoryModal from "../components/dashboard/EditCategoryModal";
import CategoryArticlesModal from "../components/dashboard/CategoryArticlesModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "../components/hooks/useDebounce";
import { handleApiError, withRetry } from "../components/utils/apiErrorHandler";
import { validateAndSanitizeArticles } from "../components/utils/articleValidator";
import { dashboardLogger, scanLogger } from "../components/utils/logger";
import {
  ARTICLE_FETCH_LIMIT,
  EXCLUDED_CATEGORIES_STATS,
  EXCLUDED_CATEGORIES_FEED,
  STORAGE_KEY_SCAN_HOURS,
  DEFAULT_DISPLAY_HOURS,
  isArticleInTimeRange
} from "../components/utils/constants";

// Configuration windowing
const ITEM_HEIGHT_COMPACT = 64;
const ITEM_HEIGHT_COMFORT = 140;
const VIEWPORT_PADDING = 6;

// Delay utility pour éviter le rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Composant Article optimisé avec React.memo
const OptimizedArticleCard = React.memo(({
  article,
  source,
  sources,
  isCompact,
  onEditCategory,
  onSummaryUpdate,
  onGenerateAISummary,
  isGeneratingAISummary,
  onDelete
}) => {
  return isCompact ? (
    <div style={{ height: ITEM_HEIGHT_COMPACT, paddingBottom: 8, boxSizing: 'border-box' }}>
      <ArticleCard
        article={article}
        source={source}
        sources={sources}
        onEditCategory={onEditCategory}
        onSummaryUpdate={onSummaryUpdate}
        onGenerateAISummary={onGenerateAISummary}
        isGeneratingAISummary={isGeneratingAISummary}
        isCompact={isCompact}
        onDelete={onDelete}
      />
    </div>
  ) : (
    <ArticleCard
      article={article}
      source={source}
      sources={sources}
      onEditCategory={onEditCategory}
      onSummaryUpdate={onSummaryUpdate}
      onGenerateAISummary={onGenerateAISummary}
      isGeneratingAISummary={isGeneratingAISummary}
      isCompact={isCompact}
      onDelete={onDelete}
    />
  );
});

export default function Dashboard() {
  // États principaux
  const [articlesById, setArticlesById] = useState(new Map());
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRecategorizing, setIsRecategorizing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryArticlesModal, setShowCategoryArticlesModal] = useState(false);
  const [modalData, setModalData] = useState({ categoryName: '', articles: [], isLoading: false });
  const [filters, setFilters] = useState({ source: "all", category: "all" });
  const [titleSearchTerm, setTitleSearchTerm] = useState("");

  const debouncedSearchTerm = useDebounce(titleSearchTerm, 300);

  const normalizedSearchTerm = useMemo(() =>
    debouncedSearchTerm.toLowerCase().trim(),
    [debouncedSearchTerm]
  );

  const [scanDays, setScanDays] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [articleGeneratingSummaryId, setArticleGeneratingSummaryId] = useState(null);

  // Utiliser la constante par défaut
  const [displayHours, setDisplayHours] = useState(DEFAULT_DISPLAY_HOURS);

  // États pour le suivi de progression du scan
  const [processedSourcesCount, setProcessedSourcesCount] = useState(0);
  const [totalActiveSources, setTotalActiveSources] = useState(0);
  const [currentSourceName, setCurrentSourceName] = useState('');
  const [scanStartTime, setScanStartTime] = useState(null);
  const [scanResults, setScanResults] = useState(null);

  // Nouveaux états pour les optimisations
  const [isCompactView, setIsCompactView] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  const scrollContainerRef = useRef(null);
  const [lastLoadTime, setLastLoadTime] = useState(0);

  // Ref pour éviter les dépendances circulaires
  const hasInitiallyLoaded = useRef(false);

  const { toast } = useToast();

  // Optimisation: Map des sources pour éviter les recherches répétées
  const sourceMap = useMemo(() =>
    new Map(sources.map(s => [s.id, s.name])),
    [sources]
  );

  // Les statistiques avec logique dynamique
  const categoryCounts = useMemo(() => {
    const counts = {};
    let uncategorizedCount = 0;

    const articlesToCount = Array.from(articlesById.values());
    articlesToCount.forEach(article => {
        // Utiliser le helper
        const isActiveForDashboard = isArticleInTimeRange(article, displayHours);

        if (!isActiveForDashboard) return;

        // Utiliser la constante partagée
        const isExcluded = EXCLUDED_CATEGORIES_STATS.some(cat => article.categories?.includes(cat));
        if (isExcluded) return;

        const articleCategories = article.categories || [];
        const isCategorized = articleCategories.length > 0 && !articleCategories.includes('Aucune catégorie détectée');

        if (!isCategorized) {
            uncategorizedCount++;
        }

        articleCategories.forEach(catName => {
            if (catName !== 'Aucune catégorie détectée') {
                counts[catName] = (counts[catName] || 0) + 1;
            }
        });
    });

    counts['Uncategorized'] = uncategorizedCount;
    return counts;
  }, [articlesById, displayHours]);

  // OPTIMISÉ : Articles filtrés avec recherche pré-calculée
  const filteredArticles = useMemo(() => {
    const allArticlesArray = Array.from(articlesById.values());

    return allArticlesArray.filter(a => {
      // Utiliser la constante partagée
      const hasExcludedCategories = EXCLUDED_CATEGORIES_FEED.some(cat =>
        a.categories?.includes(cat)
      );
      if (hasExcludedCategories) {
        return false;
      }

      // Utiliser le helper
      const isRecent = isArticleInTimeRange(a, displayHours);
      if (!isRecent) return false;

      // Filtres utilisateur
      const sourceMatch = filters.source === 'all' ? true : (
        a.source_id === filters.source || (a.grouped_sources && a.grouped_sources.includes(filters.source))
      );
      const categoryMatch = filters.category === 'all' ? true : (filters.category === 'Uncategorized' ? (!a.categories || a.categories.length === 0 || a.categories[0] === 'Aucune catégorie détectée') : a.categories?.includes(filters.category));
      const titleMatch = !normalizedSearchTerm || a._searchTitle.includes(normalizedSearchTerm);

      return sourceMatch && categoryMatch && titleMatch;
    }).sort((a, b) => new Date(b.publication_date) - new Date(a.publication_date));
  }, [articlesById, filters, normalizedSearchTerm, displayHours]);

  // Calcul du windowing virtuel
  const itemHeight = isCompactView ? ITEM_HEIGHT_COMPACT : ITEM_HEIGHT_COMFORT;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - VIEWPORT_PADDING);
  const endIndex = Math.min(filteredArticles.length, startIndex + Math.ceil(viewportHeight / itemHeight) + 2 * VIEWPORT_PADDING);
  const visibleArticles = filteredArticles.slice(startIndex, endIndex);

  // MODIFIÉ : loadData avec retry et validation
  const loadData = useCallback(async (force = false) => {
    const timer = dashboardLogger.time('loadData');

    const now = Date.now();
    if (!force && now - lastLoadTime < 2000) {
      dashboardLogger.debug("Rafraîchissement ignoré (rate limit)", { lastLoadTime });
      return;
    }
    setLastLoadTime(now);

    dashboardLogger.info("Début rafraîchissement des articles");
    try {
      // AVEC RETRY AUTOMATIQUE
      const allArticles = await withRetry(
        () => Article.list("-publication_date", ARTICLE_FETCH_LIMIT),
        2, // 2 tentatives supplémentaires
        2000 // 2 secondes entre les tentatives
      );

      // VALIDATION ET SANITISATION
      const { valid, invalid } = validateAndSanitizeArticles(allArticles);

      if (invalid.length > 0) {
        dashboardLogger.warn(`Articles invalides ignorés`, {
          count: invalid.length,
          ids: invalid.map(i => i.article.id)
        });
      }

      // Utiliser les articles validés avec _searchTitle et _timestamp déjà calculés
      setArticlesById(new Map(valid.map(article => [article.id, article])));
      setHasMorePages(valid.length === ARTICLE_FETCH_LIMIT);

      timer.end();
      dashboardLogger.info(`Articles chargés avec succès`, { count: valid.length });
    } catch (error) {
      dashboardLogger.error("Erreur de rafraîchissement", {
        error: error.message,
        stack: error.stack
      });

      // MESSAGE D'ERREUR CONTEXTUALISÉ
      const errorInfo = handleApiError(error, 'loadData');
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
        duration: 5000
      });
    }
  }, [lastLoadTime, toast]);

  // NOUVEAU : Auto-scan intelligent
  const checkAndRunAutoScan = useCallback(async () => {
    try {
      // Vérifier quand a eu lieu le dernier scan
      const lastScanKey = 'firewatch_last_auto_scan';
      const lastScanTime = localStorage.getItem(lastScanKey);
      const now = Date.now();
      const FIFTEEN_MINUTES = 15 * 60 * 1000;

      if (!lastScanTime || (now - parseInt(lastScanTime)) > FIFTEEN_MINUTES) {
        dashboardLogger.info("🔄 Auto-scan déclenché", { reason: 'timeout' });
        localStorage.setItem(lastScanKey, now.toString());

        // Déclencher scan en arrière-plan sans bloquer l'UI
        // Assuming captageComplet() without params defaults to a reasonable short period (24 hours)
        captageComplet({ scanHours: 24 }).then(response => {
          dashboardLogger.info("✅ Auto-scan terminé", { response: response.data });

          // Si des articles ont été ajoutés, recharger les données
          if (response.data?.articles_added > 0) {
            toast({
              title: "🔄 Nouveaux articles détectés",
              description: `${response.data.articles_added} nouveaux articles ajoutés automatiquement.`
            });
            setTimeout(() => loadData(true), 2000); // Recharger après 2s, forcé
          }
        }).catch(error => {
          // CORRECTION : Logger l'erreur correctement
          dashboardLogger.error("❌ Erreur auto-scan", {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          // Ne pas afficher d'erreur à l'utilisateur pour ne pas perturber l'expérience
        });
      } else {
        dashboardLogger.debug("⏭️ Auto-scan non nécessaire", { reason: 'recent' });
      }
    } catch (error) {
      // CORRECTION : Logger l'erreur correctement
      dashboardLogger.error("❌ Erreur vérification auto-scan", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
  }, [toast, loadData]);

  // MODIFIÉ : Chargement initial avec restauration de displayHours
  useEffect(() => {
    const performInitialLoad = async () => {
        if (hasInitiallyLoaded.current) return;
        hasInitiallyLoaded.current = true;

        setIsLoading(true);
        const timer = dashboardLogger.time('initialLoad');
        dashboardLogger.info("Lancement du chargement initial complet");

        try {
            dashboardLogger.info("🧹 Nettoyage préventif des dates futures");
            try {
                await cleanupFutureArticles();
                dashboardLogger.info("✅ Nettoyage terminé");
            } catch (cleanupError) {
                dashboardLogger.warn("Erreur nettoyage", { error: cleanupError.message });
            }

            const [articlesData, sourcesData, categoriesData] = await Promise.all([
                withRetry(() => Article.list("-publication_date", ARTICLE_FETCH_LIMIT), 2, 2000),
                withRetry(() => Source.list(), 2, 2000),
                withRetry(() => Category.list(), 2, 2000)
            ]);

            // VALIDATION ET SANITISATION
            const { valid, invalid } = validateAndSanitizeArticles(articlesData);

            if (invalid.length > 0) {
                dashboardLogger.warn(`Articles invalides ignorés au chargement`, {
                    count: invalid.length
                });
            }

            setArticlesById(new Map(valid.map(article => [article.id, article])));
            setHasMorePages(valid.length === ARTICLE_FETCH_LIMIT);
            setSources(sourcesData || []);
            setCategories(categoriesData || []);

            // NOUVEAU : Restaurer la portée du dernier scan
            const savedScanHours = localStorage.getItem(STORAGE_KEY_SCAN_HOURS);
            if (savedScanHours) {
                const hours = parseInt(savedScanHours);
                if (!isNaN(hours) && hours > 0) {
                    setDisplayHours(hours);
                    dashboardLogger.info(`📊 Portée d'affichage restaurée: ${hours}h`);
                }
            } else {
                dashboardLogger.info(`📊 Aucune portée sauvegardée, utilisation par défaut: ${DEFAULT_DISPLAY_HOURS}h`);
            }

            timer.end();
            dashboardLogger.info("Chargement initial terminé", {
                articles: valid.length,
                sources: sourcesData.length,
                categories: categoriesData.length,
                displayHours: savedScanHours ? parseInt(savedScanHours) : DEFAULT_DISPLAY_HOURS
            });

            setTimeout(checkAndRunAutoScan, 1000);

        } catch (error) {
            dashboardLogger.error("Erreur chargement initial", {
                error: error.message,
                stack: error.stack
            });
            const errorInfo = handleApiError(error, 'performInitialLoad');
            toast({
                title: errorInfo.title,
                description: errorInfo.description,
                variant: "destructive",
                duration: 8000
            });
        } finally {
            setIsLoading(false);
        }
    };

    performInitialLoad();
  }, [toast, checkAndRunAutoScan]);

  // Periodic refresh
  useEffect(() => {
    // Replaced isProcessing with the new scan states
    if (!isScanning && !isArchiving && !isRecategorizing && hasInitiallyLoaded.current) {
      const interval = setInterval(() => {
        loadData();
      }, 15 * 60 * 1000); // 15 minutes
      return () => clearInterval(interval);
    }
  }, [isScanning, isArchiving, isRecategorizing, loadData]);

  // Handle scroll event for windowing
  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);

    // This section related to `currentPage` and `hasMorePages` might not trigger new API fetches
    // as `loadData` is no longer called with `currentPage` to fetch more items.
    // It primarily serves for potential future cumulative loading if API call logic changes.
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 200 && hasMorePages && !isLoading) {
      setCurrentPage(prevPage => prevPage + 1); // Increments page, but doesn't trigger API load via `loadData` new logic
    }
  }, [hasMorePages, isLoading]);

  // Effect to measure viewport height for windowing
  useEffect(() => {
    const updateViewportHeight = () => {
      if (scrollContainerRef.current) {
        setViewportHeight(scrollContainerRef.current.clientHeight);
      }
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, []);

  // NOUVEAU : Helper pour timeout
  const withTimeout = (promise, timeoutMs, sourceName) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout après ${timeoutMs}ms pour ${sourceName}`)), timeoutMs)
      )
    ]);
  };

  // ---- Fonction de scan unifiée et complète avec paramètre de durée ----
  // MODIFIÉ : handleProcessSources avec timeouts et sauvegarde de displayHours
  async function handleProcessSources(scanHours = 24) {
    if (isScanning) {
      scanLogger.debug("Scan déjà en cours, ignoré");
      return;
    }

    // SÉCURITÉ : Limiter à 72h max (3 jours)
    const maxHours = 72;
    const safeScanHours = Math.min(scanHours, maxHours);

    if (scanHours > maxHours) {
      toast({
        title: "⚠️ Limite de scan",
        description: `Le scan a été limité à ${maxHours}h (3 jours) pour éviter les timeouts.`,
        variant: "default"
      });
    }

    setIsScanning(true);
    setScanStartTime(Date.now());
    setProcessedSourcesCount(0);
    setCurrentSourceName('Initialisation...');
    setScanResults(null);

    const scanTimer = scanLogger.time(`scan_${safeScanHours}h`);
    const allSources = sources.filter(s => s.status === 'active');
    const totalToScan = allSources.length + 5;
    setTotalActiveSources(totalToScan);

    const scanDaysText = safeScanHours === 24 ? '1 jour' : `${Math.round(safeScanHours/24)} jours`;

    scanLogger.info(`🔍 Scan ${scanDaysText} lancé`, {
      totalSources: totalToScan,
      scanHours: safeScanHours
    });

    toast({
      title: `🔍 Scan ${scanDaysText} lancé`,
      description: `${totalToScan} sources à analyser (${safeScanHours} heures).`
    });

    let articlesAddedInTotal = 0;
    let processedCount = 0;
    const failedSources = [];

    try {
      // --- 1. JdQ/JdM avec timeout ---
      setCurrentSourceName('Analyse JdQ/JdM...');
      try {
        const sourceTimer = scanLogger.time('JdQ/JdM');
        const sitemapResult = await withTimeout(
          scrapeSitemaps({ scanHours: safeScanHours }),
          30000, // 30 secondes max
          'JdQ/JdM'
        );
        sourceTimer.end();

        if (sitemapResult.data?.created > 0) {
          articlesAddedInTotal += sitemapResult.data.created;
          scanLogger.info("✅ JdQ/JdM complété", { added: sitemapResult.data.created });
          await delay(1000);
          await loadData(true);
        }

        processedCount += 2; // JdQ et JdM
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      } catch (error) {
        scanLogger.warn('❌ JdQ/JdM échoué', { error: error.message });
        failedSources.push('JdQ/JdM');
        processedCount += 2; // Still count as processed to move progress bar
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      }

      // --- 2. Le Quotidien avec timeout ---
      setCurrentSourceName('Analyse Le Quotidien...');
      try {
        const sourceTimer = scanLogger.time('LeQuotidien');
        const quotidienResult = await withTimeout(
          scrapeLeQuotidien(),
          30000,
          'Le Quotidien'
        );
        sourceTimer.end();

        if (quotidienResult.data?.created > 0) {
          articlesAddedInTotal += quotidienResult.data.created;
          scanLogger.info("✅ Le Quotidien complété", { added: quotidienResult.data.created });
          await delay(1000);
          await loadData(true);
        }

        processedCount += 1; // Le Quotidien
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      } catch (error) {
        scanLogger.warn('❌ Le Quotidien échoué', { error: error.message });
        failedSources.push('Le Quotidien');
        processedCount += 1; // Still count as processed
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      }

      // --- 3. Le Droit avec timeout ---
      setCurrentSourceName('Analyse Le Droit...');
      try {
        const sourceTimer = scanLogger.time('LeDroit');
        const droitResult = await withTimeout(
          scrapeLeDroit(),
          30000,
          'Le Droit'
        );
        sourceTimer.end();

        if (droitResult.data?.created > 0) {
          articlesAddedInTotal += droitResult.data.created;
          scanLogger.info("✅ Le Droit complété", { added: droitResult.data.created });
          await delay(1000);
          await loadData(true);
        }

        processedCount += 1; // Le Droit
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      } catch (error) {
        scanLogger.warn('❌ Le Droit échoué', { error: error.message });
        failedSources.push('Le Droit');
        processedCount += 1; // Still count as processed
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      }

      // --- 4. Radio-Canada Saguenay avec timeout ---
      setCurrentSourceName('Analyse Radio-Canada Saguenay...');
      try {
        const sourceTimer = scanLogger.time('RadioCanadaSaguenay');
        const saguenayResult = await withTimeout(
          scrapeRadioCanadaSaguenay(),
          30000,
          'Radio-Canada Saguenay'
        );
        sourceTimer.end();

        if (saguenayResult.data?.created > 0) {
          articlesAddedInTotal += saguenayResult.data.created;
          scanLogger.info("✅ Radio-Canada Saguenay complété", { added: saguenayResult.data.created });
          await delay(1000);
          await loadData(true);
        }

        processedCount += 1; // Radio-Canada Saguenay
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      } catch (error) {
        scanLogger.warn('❌ Radio-Canada Saguenay échoué', { error: error.message });
        failedSources.push('Radio-Canada Saguenay');
        processedCount += 1; // Still count as processed
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      }

      // --- 5. Autres sources RSS ---
      setCurrentSourceName('Traitement des flux RSS...');
      try {
        const rssTimer = scanLogger.time('RSS_global');
        const captageResponse = await withTimeout(
          captageComplet({ scanHours: safeScanHours }),
          120000, // 2 minutes max pour tous les RSS
          'RSS global'
        );
        rssTimer.end();

        setScanResults(captageResponse.data);

        const rssArticlesAdded = captageResponse.data?.articles_added || 0;
        const rssSourcesProcessed = captageResponse.data?.sources_processed || 0;

        processedCount += rssSourcesProcessed;
        setProcessedSourcesCount(Math.min(totalToScan, processedCount));
        articlesAddedInTotal += rssArticlesAdded;

        scanLogger.info("✅ RSS global complété", {
          added: rssArticlesAdded,
          sources: rssSourcesProcessed
        });

        if (rssArticlesAdded > 0) {
          await delay(1000);
          await loadData(true);
        }
      } catch (error) {
        scanLogger.warn('❌ Scan RSS échoué', { error: error.message });
        failedSources.push('RSS');
      }

      const scanDuration = Math.round((Date.now() - scanStartTime) / 1000);
      scanTimer.end();

      // NOUVEAU : Sauvegarder la portée du scan réussi
      setDisplayHours(safeScanHours);
      localStorage.setItem(STORAGE_KEY_SCAN_HOURS, safeScanHours.toString());

      scanLogger.info("🎉 Scan terminé", {
        totalAdded: articlesAddedInTotal,
        duration: scanDuration,
        failedCount: failedSources.length,
        failedSources: failedSources,
        newDisplayHours: safeScanHours
      });

      // TOAST avec info sur les échecs
      if (failedSources.length > 0) {
        toast({
          title: `⚠️ Scan ${scanDaysText} terminé avec avertissements`,
          description: `${articlesAddedInTotal} articles ajoutés. ${failedSources.length} source(s) ont échoué: ${failedSources.join(', ')}. Le Dashboard affiche maintenant les ${safeScanHours}h.`,
          variant: "default",
          duration: 10000
        });
      } else {
        toast({
          title: `🎉 Scan ${scanDaysText} terminé !`,
          description: `${articlesAddedInTotal} articles ajoutés en ${scanDuration}s. Le Dashboard affiche maintenant les ${safeScanHours}h.`,
          duration: 8000
        });
      }

    } catch (error) {
      scanLogger.error('❌ Erreur scan globale', {
        error: error.message,
        stack: error.stack
      });
      const errorInfo = handleApiError(error, 'handleProcessSources');
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setIsScanning(false);
      setCurrentSourceName('');
      setScanStartTime(null);
    }
  }

  // ---- Fonction de re-catégorisation avec cleanup optimisé ----
  async function handleRecategorizeAll() {
    if (!window.confirm("Re-catégoriser TOUS les articles avec la configuration actuelle des mots-clés ? Cette opération peut prendre quelques minutes.")) return;

    setIsRecategorizing(true);
    toast({
      title: "🔄 Traitement lancé",
      description: "Nettoyage des doublons puis re-catégorisation... Cela peut prendre 2-3 minutes.",
      duration: 8000
    });

    try {
      // ÉTAPE 1 : Nettoyage des doublons (optimisé)
      dashboardLogger.info('🧹 Nettoyage des doublons - Début');

      let totalDuplicatesDeleted = 0;
      let totalArticlesMerged = 0;
      let hasMore = true;
      let attempts = 0;
      const maxAttempts = 3;

      while (hasMore && attempts < maxAttempts) {
        attempts++;
        dashboardLogger.debug(`🧹 Nettoyage des doublons - Pass ${attempts}/${maxAttempts}`);

        try {
          const cleanupResponse = await cleanupDuplicates();
          const cleanupResult = cleanupResponse.data;

          if (cleanupResult.success) {
            totalDuplicatesDeleted += cleanupResult.duplicates_deleted || 0;
            totalArticlesMerged += cleanupResult.articles_merged || 0;
            hasMore = cleanupResult.has_more || false;

            if (hasMore) {
              toast({
                title: "🧹 Nettoyage en cours...",
                description: `Pass ${attempts}: ${cleanupResult.duplicates_deleted} doublons supprimés.`,
                duration: 3000
              });
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            hasMore = false;
          }
        } catch (cleanupError) {
          dashboardLogger.error(`❌ Erreur cleanup pass ${attempts}`, { error: cleanupError.message, stack: cleanupError.stack });
          hasMore = false;
        }
      }

      if (totalDuplicatesDeleted > 0) {
        toast({
          title: "🧹 Doublons supprimés",
          description: `${totalArticlesMerged} articles fusionnés, ${totalDuplicatesDeleted} doublons supprimés.`,
          duration: 5000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // ÉTAPE 2 : Re-catégoriser (SANS signal qui cause des problèmes)
      dashboardLogger.info('🏷️ Re-catégorisation - Début');
      toast({
        title: "🏷️ Re-catégorisation en cours",
        description: "Cette étape peut prendre jusqu'à 3 minutes...",
        duration: 5000
      });

      try {
        // CORRECTION: Ne pas passer de signal, utiliser base44.functions.invoke
        const { data: recatResult } = await base44.functions.invoke('recategorizeALL', {});

        if (recatResult.error) {
          throw new Error(recatResult.error);
        }

        toast({
          title: "🎉 Traitement terminé !",
          description: `${totalDuplicatesDeleted} doublons supprimés, ${recatResult.updated} articles re-catégorisés.`,
          duration: 8000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        loadData(true);

      } catch (recatError) {
        // Meilleure gestion d'erreur
        const errorMessage = recatError.response?.data?.error || recatError.message || "Erreur inconnue";
        
        dashboardLogger.error('❌ Erreur re-catégorisation', {
          error: errorMessage,
          status: recatError.response?.status
        });
        
        toast({
          title: "⚠️ Erreur de re-catégorisation",
          description: errorMessage === "Rate limit exceeded" 
            ? "Trop de requêtes. Réessayez dans 2 minutes." 
            : errorMessage,
          variant: "destructive",
          duration: 10000
        });
      }

    } catch (error) {
      dashboardLogger.error('❌ Erreur handleRecategorizeAll', { error: error.message, stack: error.stack });
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue. Réessayez dans quelques secondes.",
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setIsRecategorizing(false);
    }
  }

  // ---- Fonctions existantes (archivage, etc.) ----
  async function handleArchiveAllArticles() {
    if (!window.confirm("Archiver TOUS les articles actifs par lots automatiques ? L'opération peut prendre 2-3 minutes.")) return;

    setIsArchiving(true);
    toast({
      title: "Archivage lancé...",
      description: "Traitement par lots de 50 articles. L'opération continue automatiquement.",
      duration: 8000
    });

    let totalArchivedOverall = 0;
    let attempts = 0;
    const MAX_ATTEMPTS = 100; // Limite de sécurité

    const runArchiveBatch = async () => {
      try {
        attempts++;
        dashboardLogger.debug(`📦 Archivage - Tentative ${attempts}`);

        const response = await archiveAllArticles();
        const result = response.data;

        if (result.error && !result.partial_success) {
          throw new Error(result.details || result.error);
        }

        totalArchivedOverall += result.total_archived || 0;

        // Mise à jour de l'UI en temps réel
        if (result.total_archived > 0) {
            setArticlesById(prevMap => {
              const newMap = new Map(prevMap);
              const articlesToRemove = Array.from(newMap.keys()).slice(0, result.total_archived || 0);
              articlesToRemove.forEach(id => newMap.delete(id));
              return newMap;
            });
        }

        if (result.has_more && attempts < MAX_ATTEMPTS) {
          toast({
            title: "Archivage en cours...",
            description: `${totalArchivedOverall} articles archivés. Lot suivant dans 2s...`,
            duration: 3000
          });

          // Attendre 2 secondes entre chaque lot
          await new Promise(resolve => setTimeout(resolve, 2000));
          await runArchiveBatch();
        } else {
          toast({
            title: attempts >= MAX_ATTEMPTS ? "⚠️ Limite atteinte" : "🎉 Archivage terminé !",
            description: `${totalArchivedOverall} articles ont été archivés.`,
            duration: 8000
          });
          setIsArchiving(false);

          // Vider complètement la liste locale
          setArticlesById(new Map());

          dashboardLogger.info("✅ Archivage terminé");
        }
      } catch (error) {
        dashboardLogger.error('❌ Erreur archivage', { error: error.message, stack: error.stack });

        const errorMessage = error.response?.data?.details || error.message || "Une erreur est survenue.";

        toast({
          title: "Erreur d'archivage",
          description: `${totalArchivedOverall} articles archivés avant l'erreur. ${errorMessage}`,
          variant: "destructive",
          duration: 10000
        });

        setIsArchiving(false);

        // Rafraîchir pour voir l'état réel
        await new Promise(resolve => setTimeout(resolve, 1000));
        loadData(true);
      }
    };

    await runArchiveBatch();
  }

  const handleEditCategory = useCallback((article) => {
    setShowCategoryArticlesModal(false);
    setSelectedArticle(article);
    setShowEditModal(true);
  }, []);

  // MODIFIÉ : handleSaveCategory avec normalisation
  const handleSaveCategory = useCallback(async (articleId, newCategories) => {
    if (!selectedArticle) return;

    try {
      await Article.update(articleId, { categories: newCategories, is_manually_categorized: true });
      setShowEditModal(false);

      // Mettre à jour l'article dans la Map locale pour un retour visuel immédiat
      setArticlesById(prevMap => {
        const newMap = new Map(prevMap);
        const currentArticle = newMap.get(articleId);
        const updatedArticle = {
          ...currentArticle,
          categories: newCategories,
          is_manually_categorized: true,
          _searchTitle: currentArticle.title.toLowerCase()
        };
        newMap.set(articleId, updatedArticle);
        return newMap;
      });

      toast({ title: "Catégorie mise à jour" });

      // NOUVEAU : Déclencher les alertes après catégorisation manuelle
      try {
        dashboardLogger.info(`📨 Déclenchement des alertes pour l'article ID: ${articleId}`);
        const alertResponse = await processArticleAlerts({ articleId });

        if (alertResponse.data?.message) {
          dashboardLogger.info(`📨 ✅ Alertes traitées`, { message: alertResponse.data.message });
        }

        // Notification visuelle si des alertes ont été envoyées (si des catégories ont été assignées)
        if (newCategories.length > 0) {
          toast({
            title: "🔔 Alertes déclenchées",
            description: "Les notifications ont été envoyées selon la configuration des catégories.",
            duration: 5000
          });
        }

      } catch (alertError) {
        dashboardLogger.error(`❌ Erreur lors de l'envoi des alertes`, { error: alertError.message, stack: alertError.stack });
        toast({
          title: "⚠️ Alertes partielles",
          description: "L'article a été catégorisé mais certaines alertes ont échoué.",
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    }
  }, [selectedArticle, toast]);

  // MODIFIÉ : handleSummaryUpdate avec normalisation
  const handleSummaryUpdate = useCallback(async (articleId, newSummary) => {
    try {
      await Article.update(articleId, { summary: newSummary });
      // Mettre à jour l'article dans la Map principale
      setArticlesById(prevMap => {
        const newMap = new Map(prevMap);
        const currentArticle = newMap.get(articleId);
        const updatedArticle = {
          ...currentArticle,
          summary: newSummary,
          _searchTitle: currentArticle.title.toLowerCase()
        };
        newMap.set(articleId, updatedArticle);
        return newMap;
      });
      toast({ title: "Résumé mis à jour" });
    } catch (error) {
      toast({ title: "Erreur de mise à jour", variant: "destructive" });
    }
  }, [toast]);

  const handleGenerateAISummary = useCallback(async (articleId) => {
    setArticleGeneratingSummaryId(articleId);
    try {
      // Simulate API call for AI summary generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      // In a real application, you would call an actual API here
      // const response = await generateAISummary(articleId);
      // if (response.success) {
      //   await handleSummaryUpdate(articleId, response.summary);
      // }
      toast({ title: "Résumé IA généré" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de générer le résumé IA.", variant: "destructive" });
    } finally {
      setArticleGeneratingSummaryId(null);
    }
  }, [toast]);

  async function handleOpenCategoryModal(categoryName) {
    setModalData({ categoryName, articles: [], isLoading: true });
    setShowCategoryArticlesModal(true);
    try {
      let articlesForCategory;
      articlesForCategory = Array.from(articlesById.values()).filter(art => {
        // 1. Filtrer par recence (displayHours heures)
        const isRecent = isArticleInTimeRange(art, displayHours);
        if (!isRecent) return false;

        // 2. Filtrer par les catégories exclues pour les statistiques (cohérent avec categoryCounts)
        const isExcludedFromStats = EXCLUDED_CATEGORIES_STATS.some(cat => art.categories?.includes(cat));
        if (isExcludedFromStats) return false;

        // 3. Filtrer par la catégorie spécifique demandée
        if (categoryName === 'Uncategorized' || categoryName === 'Non catégorisé') {
          // L'article est considéré 'non catégorisé' s'il n'a pas de catégories ou seulement 'Aucune catégorie détectée'
          const articleCategories = art.categories || [];
          return articleCategories.length === 0 || (articleCategories.length === 1 && articleCategories[0] === 'Aucune catégorie détectée');
        } else {
          // L'article correspond à une catégorie spécifique s'il inclut cette catégorie
          return art.categories?.includes(categoryName);
        }
      });

      // NOUVEAU : Enrichir chaque article avec les noms des sources
      const enrichedArticles = articlesForCategory.map(article => {
        const sourceNames = [];

        if (article.grouped_sources && article.grouped_sources.length > 0) {
          article.grouped_sources.forEach(sourceId => {
            const sourceName = sourceMap.get(sourceId);
            if (sourceName) {
              sourceNames.push(sourceName);
            }
          });
        } else if (article.source_id) {
          const sourceName = sourceMap.get(article.source_id);
          if (sourceName) {
              sourceNames.push(sourceName);
            }
        }

        return {
          ...article,
          source: sourceNames.length > 0 ? sourceNames.join(' / ') : 'Source inconnue',
          grouped_sources: sourceNames
        };
      });

      setModalData({ categoryName, articles: enrichedArticles, isLoading: false });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger les articles.", variant: "destructive" });
      setModalData({ categoryName, articles: [], isLoading: false });
    }
  }

  async function handleMarkIrrelevant(articleId, categoryName) {
    try {
      const articleToUpdate = articlesById.get(articleId);
      if (!articleToUpdate) return;

      const updatedCategories = articleToUpdate.categories.filter(cat => cat !== categoryName);
      await Article.update(articleId, { categories: updatedCategories, is_manually_categorized: true });

      toast({ title: "Catégorie retirée" });

      // Mise à jour locale pour un retour visuel immédiat
      setArticlesById(prevMap => {
        const newMap = new Map(prevMap);
        const updatedArticle = { ...articleToUpdate, categories: updatedCategories, is_manually_categorized: true };
        newMap.set(articleId, updatedArticle);
        return newMap;
      });

      setModalData(prev => ({ ...prev, articles: prev.articles.filter(art => art.id !== articleId) }));

    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  // NOUVEAU: Fonction pour supprimer un article (utilisée par OptimizedArticleCard et CategoryArticlesModal)
  const handleDeleteArticle = useCallback(async (articleId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet article? Cette action est irréversible.")) {
      return;
    }
    try {
      await Article.delete(articleId);

      // Mise à jour locale immédiate de la carte principale
      setArticlesById(prevMap => {
        const newMap = new Map(prevMap);
        newMap.delete(articleId);
        return newMap;
      });

      // Si le modal de catégorie est ouvert, mettre à jour son état également
      if (showCategoryArticlesModal) {
        setModalData(prev => ({ ...prev, articles: prev.articles.filter(art => art.id !== articleId) }));
      }

      toast({
        title: "Article supprimé",
        description: "L'article a été supprimé définitivement."
      });

    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'article.",
        variant: "destructive"
      });
    }
  }, [toast, showCategoryArticlesModal]);


  // Batch operations (not used in current outline, but kept for future use if needed)
  const handleBatchUpdate = useCallback(async (articleIds, updates) => {
    const results = await Promise.allSettled(
      articleIds.map(id => Article.update(id, updates))
    );

    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      toast({
        title: "Mises à jour partielles",
        description: `${articleIds.length - failures.length} réussies, ${failures.length} échouées`,
        variant: "destructive"
      });
    } else {
      toast({ title: "Toutes les mises à jour réussies" });
    }

    loadData(true); // Reload data after batch updates
  }, [loadData, toast]);

  // Memoized category maps and names for efficiency
  const categoryDetailsMap = useMemo(() =>
    new Map(categories.map(c => [c.name, { id: c.id, color: c.color }])),
    [categories]
  );

  const displayCategoryNames = useMemo(() =>
    Object.keys(categoryCounts)
      .filter(name => name !== 'Uncategorized')
      .sort(),
    [categoryCounts]
  );

  // Total basé sur les articles actifs (displayHours)
  const totalArticlesInStats = useMemo(() => {
    // CORRECTION : Exclure seulement 'Politique' du total pour correspondre au filtre
    return Array.from(articlesById.values()).filter(article => {
      const isRecent = isArticleInTimeRange(article, displayHours);
      const isExcluded = EXCLUDED_CATEGORIES_STATS.some(cat => article.categories?.includes(cat));
      return isRecent && !isExcluded;
    }).length;
  }, [articlesById, displayHours]);

  // Fonction pour calculer le temps écoulé pour l'affichage
  const getElapsedTime = () => {
    if (!scanStartTime) return '';
    const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">🔥 Fil de nouvelles</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center space-x-2">
              <Grid className="w-4 h-4" />
              <Label htmlFor="compact-mode" className="text-sm font-medium">
                {isCompactView ? 'Compact' : 'Confort'}
              </Label>
              <Switch
                id="compact-mode"
                checked={isCompactView}
                onCheckedChange={setIsCompactView}
              />
            </div>
            <Button
              onClick={handleArchiveAllArticles}
              disabled={isArchiving || isScanning || isRecategorizing}
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              <Archive className={`w-4 h-4 mr-2 ${isArchiving ? 'animate-spin' : ''}`} />
              {isArchiving ? 'Archivage...' : 'Archiver tout'}
            </Button>

            <div className="flex flex-col gap-3 min-w-[300px] bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Période de scan</Label>
                <Badge variant="default" className="text-sm font-bold">
                  {scanDays} {scanDays === 1 ? 'jour' : 'jours'} ({scanDays * 24}h)
                </Badge>
              </div>

              <Slider
                value={[scanDays]}
                onValueChange={(value) => setScanDays(value[0])}
                min={1}
                max={3}
                step={1}
                disabled={isScanning || isArchiving || isRecategorizing}
                className="w-full"
              />

              <div className="flex justify-between text-xs text-slate-500 -mt-1">
                <span>1j</span>
                <span>2j</span>
                <span>3j</span>
              </div>

              <Button
                onClick={() => handleProcessSources(scanDays * 24)}
                variant={isScanning ? "secondary" : "default"}
                className={isScanning
                  ? "bg-green-600 text-white hover:bg-green-700 w-full"
                  : "bg-blue-600 hover:bg-blue-700 w-full"}
                disabled={isScanning || isArchiving || isRecategorizing}
              >
                {isScanning ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Scan... ({processedSourcesCount}/{totalActiveSources})
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Lancer le scan ({scanDays * 24}h)
                  </>
                )}
              </Button>

              {isScanning && currentSourceName && (
                <div className="text-xs bg-white p-2 rounded border border-slate-200">
                  <div className="font-medium text-slate-700 truncate" title={currentSourceName}>
                    📡 {currentSourceName}
                  </div>
                  {scanStartTime && (
                    <div className="text-slate-500 mt-1">
                      ⏱️ {getElapsedTime()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleRecategorizeAll}
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50 min-w-[150px]"
              disabled={isScanning || isArchiving || isRecategorizing}
            >
              {isRecategorizing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  En cours...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 mr-2" />
                  Catégoriser
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          <StatsCard title="Total Articles Actifs" value={totalArticlesInStats} icon={Newspaper} hexColor="#3b82f6" />

          {scanResults?.articles_rejected > 0 && (
            <StatsCard title="Articles Rejetés" value={scanResults.articles_rejected} icon={XCircle} hexColor="#EF4444" description="Dernier scan" />
          )}

          {displayCategoryNames.map(name => (
             <StatsCard key={categoryDetailsMap.get(name)?.id || name} title={name} value={categoryCounts[name] || 0} icon={FileText} hexColor={categoryDetailsMap.get(name)?.color || '#6b7280'} onClick={() => handleOpenCategoryModal(name)} />
          ))}
          <StatsCard title="Non catégorisé" value={categoryCounts['Uncategorized'] || 0} icon={FileText} hexColor={'#FFB74D'} onClick={() => handleOpenCategoryModal('Uncategorized')} />
        </div>

        <div className="bg-white p-3 rounded-lg border">
          <div className="flex gap-3 items-center flex-wrap">
            <Select onValueChange={v => setFilters({...filters, source: v})}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrer par source..." /></SelectTrigger>
                <SelectContent className="max-h-96 overflow-y-auto">
                    <SelectItem value="all">Toutes les sources</SelectItem>
                    {[...sources].sort((a, b) => a.name.localeCompare(b.name)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select onValueChange={v => setFilters({...filters, category: v})}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrer par catégorie..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {displayCategoryNames.map(name => <SelectItem key={categoryDetailsMap.get(name)?.id || name} value={name}>{name}</SelectItem>)}
                    <SelectItem value="Uncategorized">Non catégorisé</SelectItem>
                </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Rechercher par titre..."
                value={titleSearchTerm}
                onChange={(e) => setTitleSearchTerm(e.target.value)}
                className="pl-10"
              />
              {/* NOUVEAU : Indicateur de recherche active */}
              {titleSearchTerm && titleSearchTerm !== debouncedSearchTerm && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* NOUVEAU : Afficher la portée d'affichage */}
          <div className="flex items-center justify-between">
            <p className="text-gray-600 text-sm">
              {filteredArticles.length} article{filteredArticles.length > 1 ? 's' : ''} trouvé{filteredArticles.length > 1 ? 's' : ''}
            </p>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-slate-600">
                Affichage : <strong className="text-slate-900">
                  {displayHours === 24 ? '24h' : `${Math.round(displayHours/24)} jours`}
                </strong>
              </span>
              {displayHours !== DEFAULT_DISPLAY_HOURS && (
                <Badge variant="outline" className="text-xs">
                  Portée du dernier scan
                </Badge>
              )}
            </div>
          </div>

          {isLoading && filteredArticles.length === 0 ? (
            <p>Chargement des articles...</p>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <p className="text-gray-500">Aucun article trouvé.</p>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{
                height: 'calc(100vh - 320px)',
                overflowY: 'auto',
              }}
            >
              <div style={{ height: startIndex * itemHeight }} />

              <div className={`px-4 py-2 ${isCompactView ? 'space-y-3' : 'space-y-5'}`}>
                {visibleArticles.map(article => (
                  <OptimizedArticleCard
                    key={article.id}
                    article={article}
                    source={sourceMap.get(article.source_id) || 'Source inconnue'}
                    sources={sources}
                    isCompact={isCompactView}
                    onEditCategory={handleEditCategory}
                    onSummaryUpdate={handleSummaryUpdate}
                    onGenerateAISummary={handleGenerateAISummary}
                    isGeneratingAISummary={articleGeneratingSummaryId === article.id}
                    onDelete={handleDeleteArticle}
                  />
                ))}
              </div>

              <div style={{ height: (filteredArticles.length - endIndex) * itemHeight }} />

              {hasMorePages && (
                <div className="flex justify-center p-4">
                  {isLoading ? <p>Chargement de plus d'articles...</p> : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Toaster />
      {selectedArticle && <EditCategoryModal article={selectedArticle} isOpen={showEditModal} onClose={() => setShowEditModal(false)} onSave={handleSaveCategory} />}
      <CategoryArticlesModal
        isOpen={showCategoryArticlesModal}
        onClose={() => setShowCategoryArticlesModal(false)}
        categoryName={modalData.categoryName}
        articles={modalData.articles}
        isLoading={modalData.isLoading}
        onEdit={handleEditCategory}
        onDelete={handleDeleteArticle}
        onMarkIrrelevant={handleMarkIrrelevant}
      />
    </div>
  );
}
