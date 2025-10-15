
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Clock, Edit3, FileText, Loader2, Rss, Users, AlertTriangle, Tag, Trash2 } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { base44 } from "@/api/base44Client"; // Added this import
import { useToast } from "@/components/ui/use-toast";
import SummaryModal from "./SummaryModal";
import KeywordsModal from "./KeywordsModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TeamsChannel } from "@/api/entities";
// Removed: import { generateSummary } from "@/api/functions";
// Removed: import { sendToTeamsChannel } from "@/api/functions";

// CONFIGURATION CENTRALISÉE des couleurs de catégories
const CATEGORY_COLORS = {
  "Économie": "bg-green-100 text-green-800 border-green-200",
  "Santé": "bg-blue-100 text-blue-800 border-blue-200",
  "Environnement": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Éducation": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Saguenay-Lac-St-Jean": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Aînés": "bg-purple-100 text-purple-800 border-purple-200",
  "ALERTES": "bg-red-100 text-red-800 border-red-200",
  "Politique": "bg-red-100 text-red-800 border-red-200",
  "AssembleeNationale": "bg-slate-200 text-slate-800 border-slate-300",
  "Aucune catégorie détectée": "bg-gray-100 text-gray-600 border-gray-200"
};

export default function ArticleCard({
  article,
  source,
  sources = [],
  onEditCategory,
  onSummaryUpdate,
  onGenerateAISummary,
  isGeneratingAISummary,
  isCompact = false,
  onDelete
}) {
  // États locaux optimisés
  const [isGeneratingLocalSummary, setIsGeneratingLocalSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState(false);
  
  // États pour le modal Teams
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [teamsChannels, setTeamsChannels] = useState([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isSendingToTeams, setIsSendingToTeams] = useState(false);
  
  const { toast } = useToast();
  
  // UTILITAIRE: Décodage HTML sécurisé et optimisé
  const decodeHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    
    const htmlEntities = {
      '&apos;': "'", '&quot;': '"', '&amp;': '&',
      '&lt;': '<', '&gt;': '>', '&#039;': "'",
      '&#x27;': "'", '&nbsp;': ' '
    };
    
    return html.replace(/&[#\w]+;/g, entity => htmlEntities[entity] || entity);
  };

  // CALCUL de date optimisé avec gestion d'erreurs
  const dateInfo = React.useMemo(() => {
    try {
      if (!article.publication_date) {
        return { dateLabel: 'Date inconnue', timeLabel: '', isRecent: false };
      }
      
      const pubDate = parseISO(article.publication_date);
      
      if (isNaN(pubDate.getTime())) {
        return { dateLabel: 'Date invalide', timeLabel: '', isRecent: false };
      }

      if (pubDate > new Date()) {
          return { dateLabel: 'Date future', timeLabel: '', isRecent: false };
      }
      
      return {
        pubDate,
        dateLabel: format(pubDate, "d MMMM yyyy", { locale: fr }),
        timeLabel: format(pubDate, "HH:mm", { locale: fr }),
        isRecent: isToday(pubDate)
      };
    } catch (error) {
      console.warn('Erreur parsing date:', article.publication_date, error);
      return { dateLabel: 'Date inconnue', timeLabel: '', isRecent: false };
    }
  }, [article.publication_date]);

  // REGROUPEMENT de sources optimisé
  const groupedSources = React.useMemo(() => {
    if (!article.grouped_sources || article.grouped_sources.length <= 1) {
      return [{ name: source || 'Source inconnue', count: 1 }];
    }
    
    const sourceCounts = {};
    article.grouped_sources.forEach(sourceId => {
      const sourceObj = sources.find(s => s.id === sourceId);
      const sourceName = sourceObj?.name || 'Source inconnue';
      sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    });
    
    return Object.entries(sourceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [article.grouped_sources, sources, source]);

  const isMultipleSources = groupedSources.length > 1;

  // EXTRACTION intelligente du premier paragraphe
  const getFirstSentence = React.useCallback((text) => {
    if (!text || typeof text !== 'string') return '';
    
    let cleanedText = decodeHtml(text);
    
    const prefixPatterns = [
      /^Article du [^:]+:\s*/i,
      /^Article de [^:]+:\s*/i,
      /^Article du [^:]+\s*-\s*[^:]+:\s*/i,
      /^Article de la [^:]+:\s*/i
    ];
    
    prefixPatterns.forEach(pattern => {
      cleanedText = cleanedText.replace(pattern, '');
    });
    
    if (article.title) {
      const decodedTitle = decodeHtml(article.title);
      if (cleanedText.toLowerCase().startsWith(decodedTitle.toLowerCase())) {
        cleanedText = cleanedText.substring(decodedTitle.length).replace(/^[\s:.-]+/, '');
      }
    }
    
    cleanedText = cleanedText.trim();
    
    if (cleanedText && cleanedText.length > 20) {
      const sentences = cleanedText.split(/[.!?]+/);
      let bestSentence = sentences[0]?.trim();
      
      if ((!bestSentence || bestSentence.length < 30) && sentences[1]) {
        const secondSentence = sentences[1]?.trim();
        if (secondSentence && secondSentence.length > 20) {
          bestSentence = secondSentence;
        }
      }
      
      if (bestSentence && bestSentence.length > 15) {
        return bestSentence + (sentences.length > 1 ? '...' : '');
      }
    }
    
    if (article.summary && article.summary !== article.title) {
      const decodedSummary = decodeHtml(article.summary);
      if (decodedSummary.length > article.title.length + 10) {
        return decodedSummary.substring(0, 200) + '...';
      }
    }
    
    return '';
  }, [article.title, article.summary]);

  // HANDLER: Générer résumé
  const handleGenerateSummary = React.useCallback(async () => {
    if (isGeneratingLocalSummary) return;
    
    setIsGeneratingLocalSummary(true);
    setSummaryContent('');
    setIsSummaryModalOpen(true);
    
    try {
      const { data } = await base44.functions.invoke('generateSummary', {
        title: article.title,
        content: article.content || '',
        url: article.url
      });
      setSummaryContent(data.summary);
    } catch (error) {
      console.error('Erreur génération résumé:', error);
      toast({
        title: "Erreur de résumé",
        description: "Impossible de générer le résumé pour cet article.",
        variant: "destructive"
      });
      setIsSummaryModalOpen(false);
    } finally {
      setIsGeneratingLocalSummary(false);
    }
  }, [article, isGeneratingLocalSummary, toast]);

  // NOUVEAU: Ouvrir le modal Teams et charger les canaux
  const handleOpenTeamsModal = React.useCallback(async () => {
    setShowTeamsModal(true);
    setIsLoadingChannels(true);
    
    try {
      const channels = await TeamsChannel.filter({ is_active: true });
      setTeamsChannels(channels);
      
      if (channels.length === 0) {
        toast({
          title: "Aucun canal configuré",
          description: "Veuillez d'abord configurer des canaux Teams dans les paramètres.",
          variant: "destructive"
        });
        setShowTeamsModal(false);
      }
    } catch (error) {
      console.error('Erreur chargement canaux:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les canaux Teams.",
        variant: "destructive"
      });
      setShowTeamsModal(false);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [toast]);

  // ✅ CORRIGÉ: Envoyer à un canal spécifique via SDK
  const handleSendToChannel = React.useCallback(async (channelId, channelName) => {
    setIsSendingToTeams(true);
    
    try {
      const { data } = await base44.functions.invoke('sendToTeamsChannel', { 
        articleId: article.id,
        channelId: channelId
      });
      
      toast({
        title: "📨 Alerte envoyée !",
        description: data.message || `Message envoyé au canal "${channelName}"`,
        duration: 5000
      });
      
      setShowTeamsModal(false);
    } catch (error) {
      console.error('Erreur envoi Teams:', error);
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Impossible d'envoyer l'alerte.",
        variant: "destructive"
      });
    } finally {
      setIsSendingToTeams(false);
    }
  }, [article.id, toast]);

  const handleDelete = React.useCallback(async () => {
    if (window.confirm("Voulez-vous vraiment supprimer cet article ? Cette action est irréversible.")) {
      try {
        if (onDelete) {
          await onDelete(article.id);
          toast({
            title: "Article supprimé",
            description: "L'article a été supprimé avec succès.",
            duration: 3000
          });
        }
      } catch (error) {
        console.error('Erreur suppression:', error);
        toast({
          title: "Erreur",
          description: "Impossible de supprimer l'article.",
          variant: "destructive"
        });
      }
    }
  }, [article.id, onDelete, toast]);

  // DONNÉES calculées
  const decodedTitle = decodeHtml(article.title);
  const firstSentence = getFirstSentence(article.content);
  const articleCategories = Array.isArray(article.categories) 
    ? article.categories 
    : (article.category ? [article.category] : []);
  const isCategorized = articleCategories.length > 0 && 
    articleCategories[0] !== 'Aucune catégorie détectée' && 
    articleCategories[0] !== 'AssembleeNationale';
  
  const hasKeywords = article.detected_keywords && Array.isArray(article.detected_keywords) && article.detected_keywords.length > 0;
  
  return (
    <>
      <div className="relative">
        {/* Indicateur visuel latéral optimisé */}
        <div
          className={`absolute left-0 top-2 bottom-2 w-1.5 rounded-full z-[1] pointer-events-none ${
            isMultipleSources 
              ? 'bg-purple-500' 
              : isCategorized 
                ? 'bg-green-500' 
                : dateInfo.isRecent 
                  ? 'bg-blue-500' 
                  : 'bg-slate-300'
          }`}
        />
        
        <Card className={`bg-white transition-all duration-200 rounded-2xl overflow-hidden relative z-0 hover:z-10 flex flex-col border-0 ring-1 ring-slate-200/70 hover:ring-slate-300 hover:shadow-md focus-within:ring-slate-300 ${isCompact ? 'min-h-[64px]' : 'min-h-[96px]'} ml-2`}>
          
          {/* Effet lumineux subtil */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]" />
          
          <CardHeader className={isCompact ? 'pb-3 pt-3 px-4' : 'pb-4 px-5'}>
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex-1 space-y-2 min-w-0">
                
                {/* Titre optimisé */}
                <h3
                  className={`font-bold leading-tight text-gray-900 pr-10 ${
                    isCompact 
                      ? 'text-sm line-clamp-1' 
                      : 'text-lg line-clamp-2'
                  }`}
                  title={decodedTitle}
                >
                  {decodedTitle}
                </h3>

                {!isCompact && (
                  <>
                    {/* Informations sources simplifiées */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isMultipleSources ? (
                        <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-2 border-purple-200 text-purple-700 bg-purple-50 font-medium w-fit shrink-0">
                          <Users className="w-3 h-3" />
                          {groupedSources.map(src => src.name).join(' / ')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-2 border-blue-200 text-blue-700 bg-blue-50 font-medium w-fit shrink-0">
                          <Rss className="w-3 h-3" />
                          {groupedSources[0].name}
                        </Badge>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">{dateInfo.dateLabel}</span>
                        </span>
                        {dateInfo.timeLabel && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{dateInfo.timeLabel}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Extrait optimisé */}
                    {firstSentence && (
                      <div className="bg-slate-50/70 p-3 rounded-md border border-slate-100">
                        <p className="text-gray-700 text-sm leading-relaxed italic line-clamp-2">
                          "{firstSentence}"
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Catégories et actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Badges catégories */}
                  {articleCategories.length === 0 ? (
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                      Aucune catégorie
                    </Badge>
                  ) : (
                    articleCategories.map((category, index) => (
                      <Badge
                        key={`${category}-${index}`}
                        className={`${CATEGORY_COLORS[category] || CATEGORY_COLORS['Aucune catégorie détectée']} font-medium text-xs`}
                        title={category}
                      >
                        {category}
                      </Badge>
                    ))
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {/* Bouton édition */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onEditCategory(article); 
                      }}
                      className="text-gray-400 hover:text-gray-600 h-auto p-1"
                      aria-label="Modifier la catégorie"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>

                    {!isCompact && (
                      <>
                        {/* Bouton mots-clés détectés */}
                        {isCategorized && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setIsKeywordsModalOpen(true); 
                            }}
                            className="text-xs h-6 px-2 hover:bg-indigo-50 border-indigo-200 text-indigo-700"
                            aria-label="Voir les mots-clés détectés"
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            Mots-clés {hasKeywords ? `(${article.detected_keywords.length})` : '(0)'}
                          </Button>
                        )}

                        {/* MODIFIÉ: Bouton ALERTES ouvre un modal */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTeamsModal();
                          }}
                          disabled={isSendingToTeams || isLoadingChannels}
                          className="text-xs h-6 px-2 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                        >
                          {isLoadingChannels ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Chargement...
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              ALERTES
                            </>
                          )}
                        </Button>

                        {/* Bouton résumé IA */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleGenerateSummary(); 
                          }}
                          disabled={isGeneratingLocalSummary}
                          className="text-xs h-6 px-2 hover:bg-blue-50"
                          aria-label="Générer un résumé IA"
                        >
                          {isGeneratingLocalSummary ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Analyse...
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3 mr-1" />
                              RÉSUMÉ IA
                            </>
                          )}
                        </Button>

                        {/* Bouton supprimer */}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDelete(); 
                            }}
                            className="text-xs h-6 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                            aria-label="Supprimer l'article"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Lien externe optimisé */}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 shrink-0 group"
                onClick={(e) => e.stopPropagation()}
                aria-label="Ouvrir l'article dans un nouvel onglet"
              >
                <ExternalLink className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-gray-500 group-hover:text-gray-700 transition-colors`} />
              </a>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Modal résumé optimisé */}
      {!isCompact && (
        <SummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          title={article.title}
          summary={summaryContent}
          isLoading={isGeneratingLocalSummary}
        />
      )}

      {/* Modal des mots-clés détectés */}
      {!isCompact && (
        <KeywordsModal
          isOpen={isKeywordsModalOpen}
          onClose={() => setIsKeywordsModalOpen(false)}
          title={article.title}
          keywords={article.detected_keywords || []}
        />
      )}

      {/* NOUVEAU: Modal de sélection de canal Teams */}
      <Dialog open={showTeamsModal} onOpenChange={setShowTeamsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Envoyer une alerte Teams
            </DialogTitle>
            <DialogDescription>
              Sélectionnez le canal Teams où envoyer cet article
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto py-4">
            {isLoadingChannels ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
                <p className="text-sm text-gray-600">Chargement des canaux...</p>
              </div>
            ) : teamsChannels.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucun canal configuré</p>
                <p className="text-xs text-gray-500 mt-1">
                  Configurez des canaux Teams dans les paramètres
                </p>
              </div>
            ) : (
              teamsChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => handleSendToChannel(channel.id, channel.name)}
                  disabled={isSendingToTeams}
                  className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-colors">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{channel.name}</p>
                      {channel.description && (
                        <p className="text-xs text-gray-600 truncate">{channel.description}</p>
                      )}
                    </div>
                    {isSendingToTeams && (
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeamsModal(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
