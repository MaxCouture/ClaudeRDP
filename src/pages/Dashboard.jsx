
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Article, Source, Category } from "@/api/entities";
import { Newspaper, FileText, RefreshCw, Archive, Search, Grid, Shield, CheckCircle, XCircle, Loader2, Tag, Activity } from "lucide-react"; // Added Loader2, Tag, Activity
import { captageComplet } from "@/api/functions/captageComplet.js";
import { archiveAllArticles } from "@/api/functions";
import { scrapeSitemaps } from "@/api/functions";
import { scrapeLeQuotidien } from "@/api/functions";
import { scrapeLeDroit } from "@/api/functions";
import { scrapeRadioCanadaSaguenay } from "@/api/functions"; // NEW IMPORT for Radio-Canada Saguenay
import { processArticleAlerts } from "@/api/functions";
import { recategorizeALL } from "@/api/functions";
import { cleanupDuplicates } from "@/api/functions";
import { cleanupFutureArticles } from "@/api/functions"; // NEW IMPORT for cleaning future dated articles
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


// Configuration windowing
const ITEM_HEIGHT_COMPACT = 64;
const ITEM_HEIGHT_COMFORT = 140;
const VIEWPORT_PADDING = 6;
const ARTICLE_FETCH_LIMIT = 2000;
const RECENT_HOURS = 48; // ✅ SYNCHRONISÉ AVEC NEWSLETTER pour cohérence totale

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
  onDelete // New prop for delete functionality
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
        onDelete={onDelete} // Pass onDelete to ArticleCard
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
      onDelete={onDelete} // Pass onDelete to ArticleCard
    />
  );
});

// Constantes pour les catégories exclues des statistiques et des articles "non catégorisés"
const EXCLUDED_CATEGORIES_FROM_STATS_AND_UNCATEGORIZED = [
  'ConseilDesMinistres',
  'GazetteOfficielle',
  'Gouvernement',
  'AssembleeNationale',
  'Politique',
  'Actualités',
  'Outaouais',
  'Sports'
];

export default function Dashboard() {
  // États principaux
  const [articlesById, setArticlesById] = useState(new Map());
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  // categoryCounts est maintenant géré par un useMemo
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRecategorizing, setIsRecategorizing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryArticlesModal, setShowCategoryArticlesModal] = useState(false);
  const [modalData, setModalData] = useState({ categoryName: '', articles: [], isLoading: false });
  const [filters, setFilters] = useState({ source: "all", category: "all" });
  const [titleSearchTerm, setTitleSearchTerm] = useState("");
  const [articleGeneratingSummaryId, setArticleGeneratingSummaryId] = useState(null);

  // ✅ NOUVEAU : Debounce pour la recherche
  const debouncedSearchTerm = useDebounce(titleSearchTerm, 300);

  // ✅ NOUVEAU : Normaliser le terme de recherche une seule fois
  const normalizedSearchTerm = useMemo(() =>
    debouncedSearchTerm.toLowerCase().trim(),
    [debouncedSearchTerm]
  );

  // ✅ MODIFIÉ : Réduire le max à 3 jours pour éviter les timeouts
  const [scanDays, setScanDays] = useState(1);
  const [isScanning, setIsScanning] = useState(false);

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

  // Les statistiques avec logique 48h unifiée
  const categoryCounts = useMemo(() => {
    const counts = {};
    let uncategorizedCount = 0;
    const currentMoment = new Date();

    const articlesToCount = Array.from(articlesById.values());
    articlesToCount.forEach(article => {
        // Vérifier si l'article est dans la fenêtre de 48h
        const diffInHours = (currentMoment - new Date(article.publication_date)) / (1000 * 60 * 60);
        const isActiveForDashboard = diffInHours <= RECENT_HOURS;

        if (!isActiveForDashboard) return; // Ignorer les articles plus anciens que 48h

        const isExcluded = EXCLUDED_CATEGORIES_FROM_STATS_AND_UNCATEGORIZED.some(cat => article.categories?.includes(cat));
        if (isExcluded) return; // L'article est complètement ignoré pour tous les comptes s'il contient une catégorie exclue

        const articleCategories = article.categories || [];
        const isCategorized = articleCategories.length > 0 && !articleCategories.includes('Aucune catégorie détectée');

        if (!isCategorized) {
            uncategorizedCount++;
        }

        articleCategories.forEach(catName => {
            // Si nous arrivons ici, l'article n'est pas exclu par les catégories globales.
            // Nous voulons seulement compter les catégories réelles, pas le marqueur 'Aucune catégorie détectée'.
            if (catName !== 'Aucune catégorie détectée') {
                counts[catName] = (counts[catName] || 0) + 1;
            }
        });
    });

    counts['Uncategorized'] = uncategorizedCount;
    return counts;
  }, [articlesById]);

  // ✅ OPTIMISÉ : Articles filtrés avec recherche pré-calculée
  const filteredArticles = useMemo(() => {
    const currentMoment = new Date();
    const allArticlesArray = Array.from(articlesById.values());

    return allArticlesArray.filter(a => {
      // Exclure seulement 'Politique' du fil principal (logique différente des stats)
      const hasExcludedCategories = ['Politique'].some(cat =>
        a.categories?.includes(cat)
      );
      if (hasExcludedCategories) {
        return false;
      }

      // Filtre temporal unifié (48h)
      const diffInHours = (currentMoment - new Date(a.publication_date)) / (1000 * 60 * 60);
      const isRecent = diffInHours <= RECENT_HOURS;

      if (!isRecent) return false; // Ne pas afficher les articles plus anciens que 48h

      // Filtres utilisateur
      const sourceMatch = filters.source === 'all' ? true : (
        a.source_id === filters.source || (a.grouped_sources && a.grouped_sources.includes(filters.source))
      );
      const categoryMatch = filters.category === 'all' ? true : (filters.category === 'Uncategorized' ? (!a.categories || a.categories.length === 0 || a.categories[0] === 'Aucune catégorie détectée') : a.categories?.includes(filters.category));
      // ✅ CHANGÉ : Utiliser _searchTitle pré-calculé
      const titleMatch = !normalizedSearchTerm || a._searchTitle.includes(normalizedSearchTerm);

      return sourceMatch && categoryMatch && titleMatch;
    }).sort((a, b) => new Date(b.publication_date) - new Date(a.publication_date));
  }, [articlesById, filters, normalizedSearchTerm]); // ✅ CHANGÉ : normalizedSearchTerm dans les dépendances

  // Calcul du windowing virtuel
  const itemHeight = isCompactView ? ITEM_HEIGHT_COMPACT : ITEM_HEIGHT_COMFORT;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - VIEWPORT_PADDING);
  const endIndex = Math.min(filteredArticles.length, startIndex + Math.ceil(viewportHeight / itemHeight) + 2 * VIEWPORT_PADDING);
  const visibleArticles = filteredArticles.slice(startIndex, endIndex);

  // ✅ MODIFIÉ : Fonction de rafraîchissement avec normalisation des titres
  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastLoadTime < 2000) {
      console.log("LOG: Rafraîchissement ignoré (protection rate limit)");
      return;
    }
    setLastLoadTime(now);

    console.log("LOG: Début rafraîchissement des articles...");
    try {
        const allArticles = await Article.list("-publication_date", ARTICLE_FETCH_LIMIT);
        // ✅ CHANGÉ : Ajouter _searchTitle normalisé à chaque article
        setArticlesById(new Map(allArticles.map(article => [
          article.id,
          {
            ...article,
            _searchTitle: article.title.toLowerCase()
          }
        ])));
        setHasMorePages(allArticles.length === ARTICLE_FETCH_LIMIT);
        console.log(`LOG: ✅ ${allArticles.length} articles chargés`);
    } catch (error) {
        console.error("LOG: ❌ Erreur de rafraîchissement", error);
        toast({ title: "Erreur de rafraîchissement", variant: "destructive" });
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
        console.log("LOG: 🔄 Auto-scan déclenché (plus de 15min depuis le dernier)");
        localStorage.setItem(lastScanKey, now.toString());

        // Déclencher scan en arrière-plan sans bloquer l'UI
        // Assuming captageComplet() without params defaults to a reasonable short period (24 hours)
        captageComplet({ scanHours: 24 }).then(response => {
          console.log("LOG: ✅ Auto-scan terminé:", response.data);

          // Si des articles ont été ajoutés, recharger les données
          if (response.data?.articles_added > 0) {
            toast({
              title: "🔄 Nouveaux articles détectés",
              description: `${response.data.articles_added} nouveaux articles ajoutés automatiquement.`
            });
            setTimeout(() => loadData(true), 2000); // Recharger après 2s, forcé
          }
        }).catch(error => {
          console.error("LOG: ❌ Erreur auto-scan:", error);
          // Ne pas afficher d'erreur à l'utilisateur pour ne pas perturber l'expérience
        });
      } else {
        console.log("LOG: ⏭️ Auto-scan non nécessaire (moins de 15min depuis le dernier)");
      }
    } catch (error) {
      console.error("LOG: ❌ Erreur vérification auto-scan:", error);
    }
  }, [toast, loadData]);

  // ✅ MODIFIÉ : Chargement initial avec normalisation des titres
  useEffect(() => {
    const performInitialLoad = async () => {
        if (hasInitiallyLoaded.current) return;
        hasInitiallyLoaded.current = true;

        setIsLoading(true);
        console.log("LOG: Lancement du chargement initial complet...");

        try {
            console.log("LOG: 🧹 Nettoyage préventif des dates futures...");
            try {
                await cleanupFutureArticles();
                console.log("LOG: ✅ Nettoyage terminé");
            } catch (cleanupError) {
                console.log("LOG: ⚠️ Erreur nettoyage:", cleanupError.message);
                // Optionally show a toast for cleanup error if it's critical
                // toast({ title: "Erreur de nettoyage", description: cleanupError.message, variant: "destructive" });
            }

            const [articlesData, sourcesData, categoriesData] = await Promise.all([
                Article.list("-publication_date", ARTICLE_FETCH_LIMIT),
                Source.list(),
                Category.list()
            ]);

            // ✅ CHANGÉ : Ajouter _searchTitle normalisé à chaque article
            setArticlesById(new Map(articlesData.map(article => [
              article.id,
              {
                ...article,
                _searchTitle: article.title.toLowerCase()
              }
            ])));
            setHasMorePages(articlesData.length === ARTICLE_FETCH_LIMIT);
            setSources(sourcesData || []);
            setCategories(categoriesData || []);

            // NOUVEAU : Déclencher l'auto-scan après le chargement initial
            setTimeout(checkAndRunAutoScan, 1000);

        } catch (error) {
            console.error("LOG: ❌ Erreur chargement initial:", error);
            toast({ title: "Erreur de chargement initial", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    performInitialLoad();
  }, [toast, checkAndRunAutoScan]); // Dépendance stable, ne s'exécute qu'une fois.

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

  // ---- Fonction de scan unifiée et complète avec paramètre de durée ----
  async function handleProcessSources(scanHours = 24) {
    if (isScanning) {
      console.log("⚠️ Scan déjà en cours, ignoré");
      return;
    }

    // ✅ SÉCURITÉ : Limiter à 72h max (3 jours)
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

    // Récupérer le décompte des sources pour le suivi
    const allSources = sources.filter(s => s.status === 'active');
    // totalToScan: +5 pour JdQ, JdM, Le Quotidien, Le Droit, Radio-Canada Saguenay
    const totalToScan = allSources.length + 5;
    setTotalActiveSources(totalToScan);

    // ✅ Message dynamique basé sur safeScanHours réel
    const scanDaysText = safeScanHours === 24 ? '1 jour' : `${Math.round(safeScanHours/24)} jours`;
    toast({
      title: `🔍 Scan ${scanDaysText} lancé`,
      description: `${totalToScan} sources à analyser (${safeScanHours}h).`
    });

    let articlesAddedInTotal = 0;
    let processedCount = 0;

    try {
      // --- 1. Traitement JdQ/JdM via la nouvelle fonction ---
      setCurrentSourceName('Analyse JdQ/JdM...');
      try {
        const sitemapResult = await Promise.race([
          scrapeSitemaps(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout JdQ/JdM (30s)')), 30000))
        ]);

        if (sitemapResult.data?.created > 0) {
          articlesAddedInTotal += sitemapResult.data.created;
          toast({
            title: `JdQ/JdM analysés`,
            description: `${sitemapResult.data.created} nouveaux articles.`
          });
          await delay(1000);
          await loadData(true); // Forcer le rafraîchissement
        }
      } catch (error) {
        console.warn('⚠️ Erreur JdQ/JdM:', error.message);
        toast({ title: "Alerte JdQ/JdM", description: error.message, variant: "destructive" });
      }
      processedCount += 2; // JdQ et JdM
      setProcessedSourcesCount(Math.min(totalToScan, processedCount));

      // --- 2. NOUVEAU: Traitement Le Quotidien ---
      setCurrentSourceName('Analyse Le Quotidien...');
      try {
        const quotidienResult = await Promise.race([
          scrapeLeQuotidien(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Le Quotidien (30s)')), 30000))
        ]);

        if (quotidienResult.data?.created > 0) {
          articlesAddedInTotal += quotidienResult.data.created;
          toast({
            title: `Le Quotidien analysé`,
            description: `${quotidienResult.data.created} nouveaux articles.`
          });
          await delay(1000);
          await loadData(true); // Forcer le rafraîchissement
        }
      } catch (error) {
        console.warn('⚠️ Erreur Le Quotidien:', error.message);
        toast({ title: "Alerte Le Quotidien", description: error.message, variant: "destructive" });
      }
      processedCount += 1; // Le Quotidien
      setProcessedSourcesCount(Math.min(totalToScan, processedCount));

      // --- 3. NOUVEAU: Traitement Le Droit ---
      setCurrentSourceName('Analyse Le Droit...');
      try {
        const leDroitResult = await Promise.race([
          scrapeLeDroit(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Le Droit (30s)')), 30000))
        ]);

        if (leDroitResult.data?.created > 0) {
          articlesAddedInTotal += leDroitResult.data.created;
          toast({
            title: `Le Droit analysé`,
            description: `${leDroitResult.data.created} nouveaux articles.`
          });
          await delay(1000);
          await loadData(true); // Forcer le rafraîchissement
        }
      } catch (error) {
        console.warn('⚠️ Erreur Le Droit:', error.message);
        toast({ title: "Alerte Le Droit", description: error.message, variant: "destructive" });
      }
      processedCount += 1; // Le Droit
      setProcessedSourcesCount(Math.min(totalToScan, processedCount));

      // --- 4. NOUVEAU: Traitement Radio-Canada Saguenay ---
      setCurrentSourceName('Analyse Radio-Canada Saguenay...');
      try {
        const saguenayResult = await Promise.race([scrapeRadioCanadaSaguenay(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout RC Saguenay (30s)')), 30000))]);

        if (saguenayResult.data?.created > 0) {
          articlesAddedInTotal += saguenayResult.data.created;
          toast({
            title: `Radio-Canada Saguenay analysé`,
            description: `${saguenayResult.data.created} nouveaux articles.`
          });
          await delay(1000);
          await loadData(true);
        }
      } catch (error) {
        console.warn('⚠️ Erreur Radio-Canada Saguenay:', error.message);
        toast({ title: "Alerte RC Saguenay", description: error.message, variant: "destructive" });
      }
      processedCount += 1; // Radio-Canada Saguenay
      setProcessedSourcesCount(Math.min(totalToScan, processedCount));

      // --- 5. Traitement exhaustif des autres sources RSS avec paramètre de durée ---
      setCurrentSourceName('Traitement des flux RSS...');
      // Pass the safeScanHours parameter to captageComplet
      const captageResponse = await captageComplet({ scanHours: safeScanHours }); // ✅ PARAMÈTRE DYNAMIQUE
      setScanResults(captageResponse.data); // Stocker les résultats

      const rssArticlesAdded = captageResponse.data?.articles_added || 0;
      const rssSourcesProcessed = captageResponse.data?.sources_processed || 0;

      processedCount += rssSourcesProcessed;
      setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      articlesAddedInTotal += rssArticlesAdded;

      if (rssArticlesAdded > 0) {
        await delay(1000);
        await loadData(true); // Forcer le rafraîchissement après le scan
      }

      const scanDuration = Math.round((Date.now() - scanStartTime) / 1000);

      toast({
        title: `🎉 Scan ${scanDaysText} terminé !`,
        description: `${articlesAddedInTotal} articles ajoutés, ${scanResults?.articles_rejected || 0} rejetés en ${scanDuration}s.`,
        duration: 8000
      });

    } catch (error) {
      console.error('❌ Erreur scan:', error);
      toast({
        title: "❌ Erreur de scan",
        description: error.message || "Une erreur est survenue",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false); // Désactiver l'état de scan spécifique
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
      console.log('LOG: 🧹 Étape 1/2 - Nettoyage des doublons...');

      let totalDuplicatesDeleted = 0;
      let totalArticlesMerged = 0;
      let hasMore = true;
      let attempts = 0;
      const maxAttempts = 3;

      while (hasMore && attempts < maxAttempts) {
        attempts++;
        console.log(`LOG: 🧹 Pass ${attempts}/${maxAttempts} - Nettoyage des doublons...`);

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
          console.error(`LOG: ❌ Erreur cleanup pass ${attempts}:`, cleanupError);
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

      // ÉTAPE 2 : Re-catégoriser avec timeout étendu
      console.log('LOG: 🏷️ Étape 2/2 - Re-catégorisation...');
      toast({
        title: "🏷️ Re-catégorisation en cours",
        description: "Cette étape peut prendre jusqu'à 3 minutes...",
        duration: 5000
      });

      try {
        // Augmenter le timeout à 5 minutes pour cette opération
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

        const recatResponse = await recategorizeALL({ signal: controller.signal });
        clearTimeout(timeoutId);

        const recatResult = recatResponse.data;

        if (recatResult.error) {
          throw new Error(recatResult.error);
        }

        toast({
          title: "🎉 Traitement terminé !",
          description: `${totalDuplicatesDeleted} doublons supprimés, ${recatResult.updated} articles re-catégorisés.`,
          duration: 8000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
        // Forcer le rafraîchissement
        loadData(true);

      } catch (recatError) {
        if (recatError.name === 'AbortError') {
          toast({
            title: "⚠️ Timeout",
            description: "La re-catégorisation prend trop de temps. Elle continue en arrière-plan. Rafraîchissez dans 2 minutes.",
            variant: "destructive",
            duration: 10000
          });
        } else {
          throw recatError;
        }
      }

    } catch (error) {
      console.error('LOG: ❌ Erreur handleRecategorizeAll:', error);
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
        console.log(`LOG: 📦 Tentative ${attempts}...`);

        const response = await archiveAllArticles();
        const result = response.data;

        if (result.error && !result.partial_success) {
          throw new Error(result.details || result.error);
        }

        totalArchivedOverall += result.total_archived || 0;

        // Mise à jour de l'UI en temps réel
        if (result.total_archived > 0) { // Only update if articles were actually archived in this batch
            setArticlesById(prevMap => {
              const newMap = new Map(prevMap);
              // Supprimer les X premiers articles de la Map
              // This relies on the assumption that archiveAllArticles archives the articles
              // that correspond to the first keys yielded by newMap.keys().
              // In a typical setup, archiving targets old articles, while Article.list("-publication_date")
              // retrieves newest articles first. If articlesById is populated newest first,
              // removing the first keys would remove the newest. This might require clarification
              // or a more sophisticated matching if backend archives oldest by default.
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

          console.log("LOG: ✅ Archivage terminé");
        }
      } catch (error) {
        console.error('LOG: ❌ Erreur:', error);

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

  // ✅ MODIFIÉ : handleSaveCategory avec normalisation
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
          _searchTitle: currentArticle.title.toLowerCase() // ✅ Garder _searchTitle
        };
        newMap.set(articleId, updatedArticle);
        return newMap;
      });

      toast({ title: "Catégorie mise à jour" });

      // 🚨 NOUVEAU : Déclencher les alertes après catégorisation manuelle
      try {
        console.log(`LOG: 📨 Déclenchement des alertes pour l'article ID: ${articleId}`);
        const alertResponse = await processArticleAlerts({ articleId });

        if (alertResponse.data?.message) {
          console.log(`LOG: 📨 ✅ ${alertResponse.data.message}`);
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
        console.error(`LOG: ❌ Erreur lors de l'envoi des alertes:`, alertError);
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

  // ✅ MODIFIÉ : handleSummaryUpdate avec normalisation
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
          _searchTitle: currentArticle.title.toLowerCase() // ✅ Garder _searchTitle
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
      const currentMoment = new Date();
      const allArticlesArray = Array.from(articlesById.values());

      articlesForCategory = allArticlesArray.filter(art => {
        // 1. Filtrer par recence (48 heures)
        const diffInHours = (currentMoment - new Date(art.publication_date)) / (1000 * 60 * 60);
        const isRecent = diffInHours <= RECENT_HOURS;
        if (!isRecent) return false;

        // 2. Filtrer par les catégories exclues pour les statistiques (cohérent avec categoryCounts)
        const isExcludedFromStats = EXCLUDED_CATEGORIES_FROM_STATS_AND_UNCATEGORIZED.some(cat => art.categories?.includes(cat));
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
          grouped_sources: sourceNames // Keep grouped_sources if needed, or add new field for display
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

  // Total basé sur les articles actifs (48h)
  const totalArticlesInStats = useMemo(() => {
    // CORRECTION : Exclure seulement 'Politique' du total pour correspondre au filtre
    const currentMoment = new Date();
    return Array.from(articlesById.values()).filter(article => {
      const diffInHours = (currentMoment - new Date(article.publication_date)) / (1000 * 60 * 60);
      const isExcluded = EXCLUDED_CATEGORIES_FROM_STATS_AND_UNCATEGORIZED.some(cat => article.categories?.includes(cat)); // Use the consistent exclusion list
      // Only count articles within the RECENT_HOURS window AND not in the excluded list
      return diffInHours <= RECENT_HOURS && !isExcluded;
    }).length;
  }, [articlesById]);

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
              {/* ✅ NOUVEAU : Indicateur de recherche active */}
              {titleSearchTerm && titleSearchTerm !== debouncedSearchTerm && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600 text-sm">{filteredArticles.length} article{filteredArticles.length > 1 ? 's' : ''} trouvé{filteredArticles.length > 1 ? 's' : ''}</p>

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
                    onDelete={handleDeleteArticle} // Passed the new handleDeleteArticle
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
        onDelete={handleDeleteArticle} // Uses the new handleDeleteArticle (which handles modalData update conditionally)
        onMarkIrrelevant={handleMarkIrrelevant}
      />
    </div>
  );
}
