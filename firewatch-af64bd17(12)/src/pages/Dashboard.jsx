
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Article, Source, Category } from "@/api/entities";
import { Newspaper, FileText, RefreshCw, Archive, Search, Grid } from "lucide-react";
import { captageComplet } from "@/api/functions/captageComplet.js";
import { archiveAllArticles } from "@/api/functions";
import { scrapeSitemaps } from "@/api/functions";
import { scrapeLeQuotidien } from "@/api/functions";
import { scrapeLeDroit } from "@/api/functions";
import { processArticleAlerts } from "@/api/functions";
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

// Configuration windowing
const ITEM_HEIGHT_COMPACT = 64;
const ITEM_HEIGHT_COMFORT = 140;
const VIEWPORT_PADDING = 6;
const ARTICLE_FETCH_LIMIT = 2000;
const RECENT_HOURS = 36;

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
  isGeneratingAISummary
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
  const [isProcessing, setIsProcessing] = useState(false); // Renommé et unifié pour le scan complet
  const [isArchiving, setIsArchiving] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryArticlesModal, setShowCategoryArticlesModal] = useState(false);
  const [modalData, setModalData] = useState({ categoryName: '', articles: [], isLoading: false });
  const [filters, setFilters] = useState({ source: "all", category: "all" });
  const [titleSearchTerm, setTitleSearchTerm] = useState("");
  const [articleGeneratingSummaryId, setArticleGeneratingSummaryId] = useState(null);

  // États pour le suivi de progression du scan unifié
  const [processedSourcesCount, setProcessedSourcesCount] = useState(0);
  const [totalActiveSources, setTotalActiveSources] = useState(0);
  const [currentSourceName, setCurrentSourceName] = useState('');
  const [scanStartTime, setScanStartTime] = useState(null); // Renommé de autoScanStartTime

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

  // Les statistiques avec logique 36h unifiée
  const categoryCounts = useMemo(() => {
    const counts = {};
    let uncategorizedCount = 0;
    const currentMoment = new Date();

    const articlesToCount = Array.from(articlesById.values());
    articlesToCount.forEach(article => {
        // Vérifier si l'article est dans la fenêtre de 36h
        const diffInHours = (currentMoment - new Date(article.publication_date)) / (1000 * 60 * 60);
        const isActiveForDashboard = diffInHours <= RECENT_HOURS;

        if (!isActiveForDashboard) return; // Ignorer les articles plus anciens que 36h

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

  // Optimisation: Articles filtrés avec logique 36h unifiée
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

      // Filtre temporal unifié (36h)
      const diffInHours = (currentMoment - new Date(a.publication_date)) / (1000 * 60 * 60);
      const isRecent = diffInHours <= RECENT_HOURS;

      if (!isRecent) return false; // Ne pas afficher les articles plus anciens que 36h

      // Filtres utilisateur
      const sourceMatch = filters.source === 'all' || a.source_id === filters.source;
      const categoryMatch = filters.category === 'all' ? true : (filters.category === 'Uncategorized' ? (!a.categories || a.categories.length === 0 || a.categories[0] === 'Aucune catégorie détectée') : a.categories?.includes(filters.category));
      const titleMatch = !titleSearchTerm || a.title.toLowerCase().includes(titleSearchTerm.toLowerCase());

      return sourceMatch && categoryMatch && titleMatch;
    }).sort((a, b) => new Date(b.publication_date) - new Date(a.publication_date));
  }, [articlesById, filters, titleSearchTerm]);

  // Calcul du windowing virtuel
  const itemHeight = isCompactView ? ITEM_HEIGHT_COMPACT : ITEM_HEIGHT_COMFORT;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - VIEWPORT_PADDING);
  const endIndex = Math.min(filteredArticles.length, startIndex + Math.ceil(viewportHeight / itemHeight) + 2 * VIEWPORT_PADDING);
  const visibleArticles = filteredArticles.slice(startIndex, endIndex);

  // Fonction de rafraîchissement (articles uniquement)
  const loadData = useCallback(async () => {
    const now = Date.now();
    if (now - lastLoadTime < 2000) {
      console.log("LOG: Rafraîchissement ignoré (protection rate limit)");
      return;
    }
    setLastLoadTime(now);

    console.log("LOG: Début rafraîchissement des articles...");
    try {
        const allArticles = await Article.list("-publication_date", ARTICLE_FETCH_LIMIT);
        setArticlesById(new Map(allArticles.map(article => [article.id, article])));
        setHasMorePages(allArticles.length === ARTICLE_FETCH_LIMIT);
    } catch (error) {
        console.error("LOG: ❌ Erreur de rafraîchissement:", error);
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
        captageComplet().then(response => {
          console.log("LOG: ✅ Auto-scan terminé:", response.data);

          // Si des articles ont été ajoutés, recharger les données
          if (response.data?.articles_added > 0) {
            toast({
              title: "🔄 Nouveaux articles détectés",
              description: `${response.data.articles_added} nouveaux articles ajoutés automatiquement.`
            });
            setTimeout(loadData, 2000); // Recharger après 2s
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

  // Chargement initial unique au montage
  useEffect(() => {
    const performInitialLoad = async () => {
        if (hasInitiallyLoaded.current) return;
        hasInitiallyLoaded.current = true;

        setIsLoading(true);
        console.log("LOG: Lancement du chargement initial complet...");

        try {
            const [articlesData, sourcesData, categoriesData] = await Promise.all([
                Article.list("-publication_date", ARTICLE_FETCH_LIMIT),
                Source.list(),
                Category.list()
            ]);

            setArticlesById(new Map(articlesData.map(article => [article.id, article])));
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
    const interval = setInterval(() => {
      if (!isProcessing && !isArchiving && hasInitiallyLoaded.current) {
        loadData();
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [isProcessing, isArchiving, loadData]);

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

  // ---- Fonction de scan unifiée et complète ----
  async function handleProcessSources() {
    setIsProcessing(true);
    setScanStartTime(Date.now());
    setProcessedSourcesCount(0);
    setCurrentSourceName('Initialisation...');

    // Récupérer le décompte des sources pour le suivi
    const allSources = sources.filter(s => s.status === 'active');
    const totalToScan = allSources.length + 4; // +4 pour JdQ, JdM, Le Quotidien, Le Droit (SANS Le Réveil)
    setTotalActiveSources(totalToScan);

    toast({
      title: "Scan complet lancé",
      description: `${totalToScan} sources à analyser (incluant les scrapers spéciaux).`
    });

    let articlesAddedInTotal = 0;
    let processedCount = 0;

    try {
      // --- 1. Traitement JdQ/JdM via la nouvelle fonction ---
      setCurrentSourceName('Analyse JdQ/JdM...');
      try {
        const sitemapPromise = scrapeSitemaps();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Le scan JdQ/JdM a dépassé 30s et a été sauté.')), 30000)
        );

        const sitemapResponse = await Promise.race([
          sitemapPromise,
          timeoutPromise
        ]);

        if (sitemapResponse.data?.created > 0) {
          articlesAddedInTotal += sitemapResponse.data.created;
          toast({
            title: `JdQ/JdM analysés`,
            description: `${sitemapResponse.data.created} nouveaux articles.`
          });
          await delay(1000);
          await loadData();
        }
      } catch (sitemapError) {
        console.error("Erreur ou timeout scrapeSitemaps:", sitemapError);
        toast({ title: "Alerte Scan JdQ/JdM", description: sitemapError.message, variant: "destructive" });
      }
      processedCount += 2; // JdQ et JdM
      setProcessedSourcesCount(processedCount);

      // --- 2. NOUVEAU: Traitement Le Quotidien ---
      setCurrentSourceName('Analyse Le Quotidien...');
      try {
        const quotidienPromise = scrapeLeQuotidien(); // CORRECTION: Appel direct de la fonction importée
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Le scan Le Quotidien a dépassé 30s et a été sauté.')), 30000)
        );

        const quotidienResponse = await Promise.race([
          quotidienPromise,
          timeoutPromise
        ]);

        if (quotidienResponse.data?.created > 0) {
          articlesAddedInTotal += quotidienResponse.data.created;
          toast({
            title: `Le Quotidien analysé`,
            description: `${quotidienResponse.data.created} nouveaux articles.`
          });
          await delay(1000);
          await loadData();
        }
      } catch (quotidienError) {
        console.error("Erreur ou timeout Le Quotidien:", quotidienError);
        toast({ title: "Alerte Scan Le Quotidien", description: quotidienError.message, variant: "destructive" });
      }
      processedCount += 1; // Le Quotidien
      setProcessedSourcesCount(processedCount);

      // --- 3. NOUVEAU: Traitement Le Droit ---
      setCurrentSourceName('Analyse Le Droit...');
      try {
        const leDroitPromise = scrapeLeDroit();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Le scan Le Droit a dépassé 30s et a été sauté.')), 30000)
        );

        const leDroitResponse = await Promise.race([
          leDroitPromise,
          timeoutPromise
        ]);

        if (leDroitResponse.data?.created > 0) {
          articlesAddedInTotal += leDroitResponse.data.created;
          toast({
            title: `Le Droit analysé`,
            description: `${leDroitResponse.data.created} nouveaux articles.`
          });
          await delay(1000); // Corrected syntax here
          await loadData();
        }
      } catch (leDroitError) {
        console.error("Erreur ou timeout Le Droit:", leDroitError);
        toast({ title: "Alerte Scan Le Droit", description: leDroitError.message, variant: "destructive" });
      }
      processedCount += 1; // Le Droit
      setProcessedSourcesCount(processedCount);

      // --- 4. Traitement exhaustif des autres sources RSS ---
      setCurrentSourceName('Traitement des flux RSS...');
      const captageResponse = await captageComplet();

      const rssArticlesAdded = captageResponse.data?.articles_added || 0;
      const rssSourcesProcessed = captageResponse.data?.sources_processed || 0;

      processedCount += rssSourcesProcessed;
      setProcessedSourcesCount(Math.min(totalToScan, processedCount));
      articlesAddedInTotal += rssArticlesAdded;

      if (rssArticlesAdded > 0) {
        await delay(1000);
        await loadData();
      }

      const scanDuration = Math.round((Date.now() - scanStartTime) / 1000);
      toast({
        title: "🎉 Scan complet terminé !",
        description: `${articlesAddedInTotal} articles ajoutés depuis ${processedCount} sources en ${scanDuration}s.`,
        duration: 8000
      });

    } catch (error) {
      toast({
        title: "Erreur de scan",
        description: error.message || "Une erreur est survenue",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setCurrentSourceName('');
      setScanStartTime(null);
    }
  }

  // ---- Fonctions existantes (archivage, etc.) ----
  async function handleArchiveAllArticles() {
    if (!window.confirm("Archiver TOUS les articles actifs par lots automatiques jusqu'à zéro ? L'opération peut prendre plusieurs minutes.")) return;

    setIsArchiving(true);
    toast({ title: "Archivage complet lancé...", description: "Le système va traiter par lots jusqu'à ce que tout soit archivé.", duration: 10000 });

    let totalArchivedOverall = 0;

    const runArchiveBatch = async () => {
      try {
        const response = await archiveAllArticles();
        const result = response.data;

        if (result.error) {
          throw new Error(result.details || result.error);
        }

        totalArchivedOverall += result.total_archived || 0;

        if (result.has_more) {
          toast({
            title: "Archivage en cours...",
            description: `${totalArchivedOverall} articles archivés jusqu'à présent. Traitement du lot suivant...`,
            duration: 5000
          });
          // Attendre un peu avant le lot suivant
          setTimeout(runArchiveBatch, 2000);
        } else {
          toast({
            title: "🎉 Archivage 100% terminé !",
            description: `${totalArchivedOverall} articles ont été archivés au total.`,
            duration: 8000
          });
          setIsArchiving(false);
          await delay(2000);
          loadData();
        }
      } catch (error) {
        const errorMessage = error.response?.data?.details || error.message || "Une erreur inconnue est survenue.";
        toast({
          title: "Erreur d'archivage",
          description: `Le processus a échoué: ${errorMessage}`,
          variant: "destructive",
          duration: 8000
        });
        setIsArchiving(false);
        await delay(2000);
        loadData();
      }
    };

    await runArchiveBatch();
  }

  const handleEditCategory = useCallback((article) => {
    setShowCategoryArticlesModal(false);
    setSelectedArticle(article);
    setShowEditModal(true);
  }, []);

  // La fonction handleSaveCategory doit maintenant recharger les données et déclencher les alertes
  const handleSaveCategory = useCallback(async (articleId, newCategories) => {
    if (!selectedArticle) return;

    try {
      await Article.update(articleId, { categories: newCategories, is_manually_categorized: true });
      setShowEditModal(false);

      // Mettre à jour l'article dans la Map locale pour un retour visuel immédiat
      setArticlesById(prevMap => {
        const newMap = new Map(prevMap);
        const updatedArticle = { ...newMap.get(articleId), categories: newCategories, is_manually_categorized: true };
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

  const handleSummaryUpdate = useCallback(async (articleId, newSummary) => {
    try {
      await Article.update(articleId, { summary: newSummary });
      // Mettre à jour l'article dans la Map principale
      setArticlesById(prevMap => {
        const newMap = new Map(prevMap);
        const updatedArticle = { ...newMap.get(articleId), summary: newSummary };
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
        // 1. Filtrer par recence (36 heures)
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

      setModalData({ categoryName, articles: articlesForCategory, isLoading: false });
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

  async function handleDeleteArticle(articleId) {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet article?")) {
      try {
        await Article.delete(articleId);
        toast({ title: "Article supprimé" });

        // Mise à jour locale
        setArticlesById(prevMap => {
            const newMap = new Map(prevMap);
            newMap.delete(articleId);
            return newMap;
        });

        if (showCategoryArticlesModal) {
          setModalData(prev => ({ ...prev, articles: prev.articles.filter(art => art.id !== articleId) }));
        }

      } catch (error) {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  }

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

    loadData(); // Reload data after batch updates
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

  // Total basé sur les articles actifs (36h)
  const totalArticlesInStats = useMemo(() => {
    // CORRECTION : Exclure seulement 'Politique' du total pour correspondre au filtre
    const EXCLUDED_CATEGORIES_FOR_TOTAL = ['Politique']; // This is for main feed, not necessarily for stats total
    const currentMoment = new Date();
    return Array.from(articlesById.values()).filter(article => {
      const diffInHours = (currentMoment - new Date(article.publication_date)) / (1000 * 60 * 60);
      const isExcluded = EXCLUDED_CATEGORIES_FROM_STATS_AND_UNCATEGORIZED.some(cat => article.categories?.includes(cat)); // Use the consistent exclusion list
      // Only count articles within the RECENT_HOURS window AND not in the excluded list
      return diffInHours <= RECENT_HOURS && !isExcluded;
    }).length;
  }, [articlesById]);

  // Calculer le temps écoulé pour l'affichage
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
            <Button onClick={handleArchiveAllArticles} disabled={isArchiving || isProcessing} variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
              <Archive className={`w-4 h-4 mr-2 ${isArchiving ? 'animate-spin' : ''}`} />
              {isArchiving ? 'Archivage...' : 'Archiver tout'}
            </Button>

            {/* Bouton de scan unifié avec compteur */}
            <div className="flex flex-col items-end">
              <Button
                onClick={handleProcessSources}
                variant={isProcessing ? "destructive" : "default"}
                className={isProcessing ? "bg-green-600 text-white hover:bg-green-700 min-w-[220px]" : "bg-blue-600 hover:bg-blue-700 min-w-[220px]"}
                disabled={isProcessing || isArchiving}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                    <span>Scan en cours... ({processedSourcesCount}/{totalActiveSources})</span>
                  </div>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Scanner les sources
                  </>
                )}
              </Button>

              {/* Détails du scan en cours */}
              {isProcessing && (
                <div className="mt-1 text-xs text-gray-600 max-w-[220px]">
                  <div className="truncate" title={currentSourceName}>
                    {currentSourceName}
                  </div>
                  {scanStartTime && (
                    <div className="text-gray-500">
                      Temps: {getElapsedTime()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatsCard title="Total Articles Actifs" value={totalArticlesInStats} icon={Newspaper} hexColor="#3b82f6" />
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
              <Input placeholder="Rechercher par titre..." value={titleSearchTerm} onChange={(e) => setTitleSearchTerm(e.target.value)} className="pl-10" />
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
      <CategoryArticlesModal isOpen={showCategoryArticlesModal} onClose={() => setShowCategoryArticlesModal(false)} categoryName={modalData.categoryName} articles={modalData.articles} isLoading={modalData.isLoading} onEdit={handleEditCategory} onDelete={handleDeleteArticle} onMarkIrrelevant={handleMarkIrrelevant} />
    </div>
  );
}
