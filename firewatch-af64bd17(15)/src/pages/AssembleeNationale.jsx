
import React, { useState, useEffect, useCallback } from "react";
import { Article } from "@/api/entities";
import { Landmark, RefreshCw, Archive as ArchiveIcon, Trash2, FileText, Stamp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Corrected syntax: added 'from'
import { processMemoiresConseil } from "@/api/functions";
import { fetchGazetteHTML } from "@/api/functions";
import { fetchCurrentGazette } from "@/api/functions";
import PublicationCard from "../components/parliament/PublicationCard";
import EditCategoryModal from "../components/dashboard/EditCategoryModal";
import { ArchivedGovernmentPublication } from "@/api/entities";
import { archiveOldGovPublications } from "@/api/functions";

// Ajouter 'Gazette' aux types de la gazette pour le filtre des publications
const GAZETTE_TYPES = ['Arrêtés ministériels', 'Avis', 'Décrets administratifs', 'Entrée en vigueur de lois', 'Lois', 'Projets de règlement', 'Règlements et autres actes', 'Document', 'Gazette'];

// Ajouter une catégorie pour la gazette officielle
const PUBLICATION_TYPES = [
    { key: "Tous", label: "Toutes les publications", icon: Landmark },
    { key: "Mémoire", label: "Mémoires", icon: FileText },
    { key: "Gazette", label: "Gazette officielle", icon: Stamp },
];

// Helper pour parser les dates en français (VERSION CORRIGÉE ET STRICTE)
function parseFrenchDate(dateString) {
    if (!dateString) return null;
    const months = {
        'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
        'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    };
    
    const cleanedString = dateString.toLowerCase().replace(/er\b/, '').trim();

    // NOUVEAU: Gérer le format "soumis le XX mois YYYY" des mémoires
    const soumisMatch = cleanedString.match(/soumis le (\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (soumisMatch) {
        const [, day, monthName, year] = soumisMatch;
        const monthIndex = months[monthName];
        if (monthIndex !== undefined && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(year, 10))) {
            const currentYear = new Date().getFullYear();
            let finalYear = parseInt(year, 10);
            if (finalYear > currentYear) finalYear = currentYear;
            
            return new Date(Date.UTC(finalYear, monthIndex, parseInt(day, 10), 12, 0, 0));
        }
    }

    // NOUVEAU: Gérer "déposé en mois YYYY"
    const deposeMatch = cleanedString.match(/déposé en (\w+)\s+(\d{4})/);
    if (deposeMatch) {
        const [, monthName, year] = deposeMatch;
        const monthIndex = months[monthName];
        if (monthIndex !== undefined && !isNaN(parseInt(year, 10))) {
            const currentYear = new Date().getFullYear();
            let finalYear = parseInt(year, 10);
            if (finalYear > currentYear) finalYear = currentYear;
            
            return new Date(Date.UTC(finalYear, monthIndex, 1, 12, 0, 0));
        }
    }

    // Logique existante pour le format "du DD-MM-YYYY" des gazettes
    const parts = cleanedString.split(' ');
    
    if (parts.length < 3) return null;

    const day = parseInt(parts[0], 10);
    const month = months[parts[1]];
    const year = parseInt(parts[2], 10);

    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        const currentYear = new Date().getFullYear();
        let finalYear = year;
        if (year > currentYear) finalYear = currentYear;
        
        return new Date(Date.UTC(finalYear, month, day, 12, 0, 0)); 
    }
    return null;
}

// ANALYSE DU CONTENU DE LA GAZETTE basée sur la vraie structure HTML
const analyzeGazetteContent = async (html, gazetteNumber) => {
  const publications = [];
  
  console.log(`LOG: Analyse du contenu de la gazette ${gazetteNumber}`);

  // Extraire la date depuis le titre de la gazette
  let publicationDate = null;
  const titleMatch = html.match(/No\.\s+\d+[A-Z]?\s+du\s+(\d{2}-\d{2}-\d{4})/);
  if (titleMatch && titleMatch[1]) {
    const dateParts = titleMatch[1].split('-');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Mois en base 0
      const year = parseInt(dateParts[2], 10);
      publicationDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
      console.log(`LOG: Date extraite du titre: ${publicationDate.toISOString()}`);
    }
  }

  if (!publicationDate) {
      console.error(`LOG: Impossible de trouver une date valide pour la gazette ${gazetteNumber}.`);
      return [];
  }
  
  // Mapping des rubriques
  const sections = [
    { name: 'Arrêtés ministériels', type: 'Arrêtés ministériels' },
    { name: 'Avis', type: 'Avis' },
    { name: 'Décrets administratifs', type: 'Décrets administratifs' },
    { name: 'Entrée en vigueur de lois', type: 'Entrée en vigueur de lois' },
    { name: 'Lois', type: 'Lois' },
    { name: 'Projets de règlement', type: 'Projets de règlement' },
    { name: 'Règlements et autres actes', type: 'Règlements et autres actes' },
    { name: 'Erratum', type: 'Erratum' }
  ];

  // Extraire chaque élément de rubrique
  const elementPattern = /<div class="rubriqueElement">([\s\S]*?)<div class="notice">([\s\S]*?)<\/div>\s*<\/div>/g;
  const allMatches = [...html.matchAll(elementPattern)];
  
  console.log(`LOG: ${allMatches.length} éléments trouvés dans la gazette`);
  
  allMatches.forEach((match, index) => {
    const elementContent = match[1];
    const noticeContent = match[2];
    
    // Extraire la rubrique depuis la notice
    const rubriqueMatch = noticeContent.match(/<div class="rubrique">([^<]+)<\/div>/);
    if (!rubriqueMatch) {
        console.log(`LOG: Rubrique non trouvée pour élément ${index}`);
        return;
    }
    
    const rubriqueType = rubriqueMatch[1].trim();
    const sectionConfig = sections.find(s => s.name === rubriqueType);
    if (!sectionConfig) {
        console.log(`LOG: Type de rubrique inconnu "${rubriqueType}"`);
        return;
    }
    
    // Extraire les informations de l'élément
    let numero = null;
    let title = null;
    let pdfUrl = null;
    
    // Chercher le lien PDF
    const pdfMatch = elementContent.match(/<a href="([^"]*\.pdf)"/);
    if (pdfMatch) {
      pdfUrl = `https://www.publicationsduquebec.gouv.qc.ca${pdfMatch[1]}`;
    }
    
    // Chercher le numéro de décret
    const numeroMatch = elementContent.match(/<div class="noDecret">([^<]+)<\/div>/);
    if (numeroMatch) {
      numero = numeroMatch[1].trim();
    }
    
    // Extraire le titre
    const titleMatch = elementContent.match(/<div class="titre">([^<]+(?:<[^>]*>[^<]*<\/[^>]*>[^<]*)*)<\/div>/);
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#xA0;/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
    }
    
    if (title && title.length > 5) {
      const finalTitle = numero ? `${numero} - ${title}` : title;
      const finalUrl = pdfUrl || `https://www.publicationsduquebec.gouv.qc.ca/gazette-officielle/la-gazette-officielle-du-quebec/partie-2-lois-et-reglements/?tx_cspqgazette_cspqgazette%5Baction%5D=detail&tx_cspqgazette_cspqgazette%5BgazetteId%5D=${gazetteNumber}`;
      
      // Vérifier les doublons
      const isDuplicate = publications.some(p => p.title === finalTitle);
      if (!isDuplicate) {
        publications.push({
          title: finalTitle,
          url: finalUrl,
          publication_date: publicationDate.toISOString(),
          publication_type: sectionConfig.type,
          categories: ['GazetteOfficielle'],
          content: title,
          numero: numero || '',
          pdf_url: pdfUrl || null
        });
        console.log(`LOG: ✅ Ajouté [${sectionConfig.type}]: ${finalTitle.substring(0, 60)}...`);
      }
    }
  });
  
  console.log(`LOG: ${publications.length} publications extraites de la gazette ${gazetteNumber}`);
  return publications;
};


export default function AssembleeNationalePage() {
  const [publications, setPublications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPublication, setSelectedPublication] = useState(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // S'assurer d'inclure toutes les catégories gouvernementales
      const allPublications = await Article.filter({
          categories: { '$in': ['ConseilDesMinistres', 'Gouvernement', 'GazetteOfficielle'] }
      }, "-publication_date", 500);
      
      console.log(`LOG: ${allPublications.length} publications gouvernementales chargées.`);
      
      const sortedPublications = allPublications.sort((a, b) => new Date(b.publication_date) - new Date(a.publication_date));
      setPublications(sortedPublications);
    } catch (error) {
      console.error("Erreur chargement des publications:", error);
      toast({ title: "Erreur de chargement", description: "Impossible de charger les publications.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const processGazetteSimple = async () => {
    toast({ title: "Analyse des gazettes récentes...", description: "Recherche des gazettes publiées dans les 14 derniers jours." });
    
    try {
      const htmlResponse = await fetchCurrentGazette();
      
      if (!htmlResponse.data.success) {
        throw new Error(htmlResponse.data.error || 'Erreur lors du téléchargement');
      }
      
      const html = htmlResponse.data.html;
      console.log(`LOG: HTML récupéré: ${html.length} caractères`);
      
      console.log(`LOG: === RECHERCHE DES GAZETTES DANS LE TABLEAU (14 derniers jours) ===`);
      
      // Chercher tous les liens vers les gazettes dans le tableau
      const allGazetteLinks = new Set();
      const linkPattern = /<a class="pdfLink" href="([^"]*tx_cspqgazette_cspqgazette.*?detail.*?)">[\s\S]*?(\d{2}-\d{2}-\d{4})[\s\S]*?<\/a>/g;
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const matches = [...html.matchAll(linkPattern)];
      console.log(`LOG: ${matches.length} liens de gazette trouvés dans le tableau, filtrage en cours...`);

      for (const match of matches) {
          let urlFragment = match[1];
          const dateFound = match[2];
          
          // Filtrer par date (14 jours maximum)
          const dateParts = dateFound.split('-');
          // Note: Month is 0-indexed in Date constructor, so parse as YYYY-MM-DD
          const gazetteDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`); 
          if (gazetteDate < fourteenDaysAgo) {
              console.log(`LOG: ⏭️ Gazette ignorée (plus de 14 jours): ${dateFound}`);
              continue;
          }

          // Décoder les entités HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(`<!doctype html><body>${urlFragment}</body></html>`, 'text/html');
          urlFragment = doc.body.textContent.trim();

          const fullUrl = `https://www.publicationsduquebec.gouv.qc.ca${urlFragment.startsWith('/') ? '' : '/'}${urlFragment}`;
          
          // Extraire l'ID de la gazette de façon plus robuste
          try {
            const urlObject = new URL(fullUrl);
            const gazetteId = urlObject.searchParams.get('tx_cspqgazette_cspqgazette[gazetteId]');

            if (gazetteId) {
                console.log(`LOG: ✅ Gazette valide trouvée: ID [${gazetteId}], Date [${dateFound}]`);
                allGazetteLinks.add(fullUrl);
            }
          } catch(e) {
            console.log(`LOG: ⚠️ URL invalide ignorée: ${e.message}`);
          }
      }
      
      console.log(`LOG: ${allGazetteLinks.size} liens de gazette des 14 derniers jours à traiter`);
      
      if (allGazetteLinks.size === 0) {
        throw new Error("Aucun lien de gazette valide trouvé sur la page pour les 14 derniers jours.");
      }
      
      // Charger les publications existantes pour éviter les doublons (période étendue à 14 jours)
      const fourteenDaysAgoForCheck = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recentPublications = await Article.filter({
          categories: { '$in': ['GazetteOfficielle'] },
          created_date: { '$gte': fourteenDaysAgoForCheck.toISOString() }
      });
      const existingUrls = new Set(recentPublications.map(p => p.url));
      const existingTitles = new Set(recentPublications.map(p => p.title));

      let totalNewArticles = 0;
      let totalSkipped = 0;
      let processedGazettes = 0;
      
      // Traiter chaque gazette
      for (const gazetteUrl of allGazetteLinks) {
        try {
          console.log(`LOG: === TRAITEMENT GAZETTE ${processedGazettes + 1}/${allGazetteLinks.size} ===`);
          
          const urlObject = new URL(gazetteUrl);
          const gazetteNumber = urlObject.searchParams.get('tx_cspqgazette_cspqgazette[gazetteId]') || `gazette_${processedGazettes + 1}`;
          
          console.log(`LOG: Récupération du contenu de la gazette ${gazetteNumber}`);
          
          const detailResponse = await fetchGazetteHTML({ 
            fullUrl: gazetteUrl,
            gazetteId: gazetteNumber 
          });
          
          if (detailResponse.data.success) {
            const gazetteDetailHtml = detailResponse.data.html;
            const publicationsFromGazette = await analyzeGazetteContent(gazetteDetailHtml, gazetteNumber);
            
            if (publicationsFromGazette.length > 0) {
              // Filtrer les doublons
              const articlesToCreate = [];
              for (const publication of publicationsFromGazette) {
                if (!existingUrls.has(publication.url) && !existingTitles.has(publication.title)) {
                  articlesToCreate.push(publication);
                  existingUrls.add(publication.url);
                  existingTitles.add(publication.title);
                } else {
                  totalSkipped++;
                }
              }
              
              if (articlesToCreate.length > 0) {
                await Article.bulkCreate(articlesToCreate);
                totalNewArticles += articlesToCreate.length;
                console.log(`LOG: ✅ ${articlesToCreate.length} nouvelles publications ajoutées`);
              }
            } else {
                console.log(`LOG: ⚠️ Aucune publication extraite de la gazette ${gazetteNumber}.`);
            }
          } else {
            console.log(`LOG: ❌ Erreur récupération gazette ${gazetteNumber}: ${detailResponse.data.error}`);
          }
          
          processedGazettes++;
          
          // Pause entre chaque gazette
          if (processedGazettes < allGazetteLinks.size) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
        } catch (gazetteError) {
          console.error(`LOG: ❌ Erreur traitement gazette: ${gazetteError.message}`);
          processedGazettes++;
        }
      }
      
      const message = `${totalNewArticles} nouveaux documents ajoutés depuis ${processedGazettes} gazette(s), ${totalSkipped} doublons ignorés.`;
      
      toast({
        title: "Traitement des gazettes terminé",
        description: message
      });
      
      return { 
        newArticles: totalNewArticles, 
        skipped: totalSkipped, 
        gazettesProcessed: processedGazettes
      };
      
    } catch (error) {
      throw new Error(`Erreur traitement gazettes: ${error.message}`);
    }
  };


  const handleProcessAll = async () => {
    setIsProcessing(true);
    toast({
      title: "Lancement du diagnostic...",
      description: "Vérification des nouveautés avant traitement."
    });

    try {
      // VÉRIFICATION MÉMOIRES: Vérifier s'il y a de nouveaux mémoires avant traitement
      const existingMemoires = await Article.filter({ 
        categories: { '$in': ['ConseilDesMinistres'] },
        publication_type: 'Mémoire'
      });
      
      console.log(`LOG: ${existingMemoires.length} mémoires existants détectés`);
      
      // Traitement des mémoires seulement si nécessaire
      const memoiresResult = await processMemoiresConseil();
      toast({
        title: "Mémoires vérifiés",
        description: memoiresResult.data.message || "Vérification des mémoires terminée."
      });

      // Traitement de la gazette avec vérification intégrée
      const gazetteResult = await processGazetteSimple();
      toast({
        title: "Gazette vérifiée",
        description: `${gazetteResult.newArticles} nouveaux documents ajoutés, ${gazetteResult.skipped} existants sur ${gazetteResult.gazettesProcessed} gazettes traitées.`
      });

      // Recharger les données après traitement pour mettre à jour les compteurs
      await loadData();
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      toast({
        title: "Erreur de traitement",
        description: error.message || "Une erreur est survenue lors du diagnostic.",
        variant: "destructive"
      });
    }

    setIsProcessing(false);
  };

  const handleArchiveAll = async () => {
    if (!window.confirm("Archiver TOUTES les publications gouvernementales ? Le processus s'exécutera par lots.")) return;
    
    setIsClearing(true);
    let totalArchivedSinceStart = 0;
    
    toast({ 
      title: "Archivage lancé...", 
      description: "Le système va traiter les publications par lots.", 
      duration: 5000 
    });
    
    const runArchiveBatch = async () => {
      try {
        const response = await archiveOldGovPublications();
        const result = response.data;
        
        if (result.status === 'error') {
            throw new Error(result.details || "Une erreur inconnue est survenue.");
        }

        totalArchivedSinceStart += result.archived_in_batch;
        
        if (result.status === 'in_progress') {
          toast({
            title: "Archivage en cours...",
            description: `${totalArchivedSinceStart} publications archivées. ${result.remaining} restantes...`,
            duration: 5000
          });
          // Appelle le prochain lot après un court délai
          setTimeout(runArchiveBatch, 1500);
        } else {
          // Statut 'complete'
          toast({
            title: "🎉 Archivage 100% terminé !",
            description: `${totalArchivedSinceStart} publications ont été archivées.`,
            duration: 8000
          });
          setIsClearing(false);
          await loadData();
        }
      } catch(e) {
        const errorMessage = e.response?.data?.details || e.message || "Une erreur inconnue est survenue.";
        toast({
          title: "Erreur d'archivage",
          description: `Processus interrompu : ${errorMessage}`,
          variant: "destructive",
          duration: 10000
        });
        setIsClearing(false);
        await loadData();
      }
    };

    await runArchiveBatch();
  };

  const handleArchivePublication = async (publication) => {
    if (!window.confirm("Êtes-vous sûr de vouloir archiver cette publication ? Elle sera déplacée vers les archives gouvernementales.")) {
      return;
    }

    try {
      // Créer l'entrée archivée
      await ArchivedGovernmentPublication.create({
        title: publication.title,
        url: publication.url,
        content: publication.content || '',
        publication_date: publication.publication_date || new Date().toISOString(),
        archived_date: new Date().toISOString(),
        publication_type: publication.publication_type,
        numero: publication.numero || '',
        categories: publication.categories || [],
        air_url: publication.air_url || '',
        pdf_url: publication.pdf_url || ''
      });

      // Supprimer la publication originale
      await Article.delete(publication.id);

      toast({ 
        title: "Publication archivée", 
        description: "La publication a été déplacée vers les archives gouvernementales." 
      });

      // Recharger les données pour mettre à jour les compteurs
      await loadData();
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
      toast({
        title: "Erreur d'archivage",
        description: "Impossible d'archiver la publication.",
        variant: "destructive"
      });
    }
  };

  const handleEditCategory = (publication) => {
    setSelectedPublication(publication);
    setShowEditModal(true);
  };

  const handleSaveCategory = async (publicationId, newCategories) => {
    try {
      // Conserver les catégories de source ('GazetteOfficielle', etc.) et ajouter les nouvelles
      const publicationToUpdate = publications.find(p => p.id === publicationId);
      if (!publicationToUpdate) {
          throw new Error("Publication non trouvée pour la mise à jour.");
      }
      const sourceCategories = publicationToUpdate.categories.filter(c => 
        ['ConseilDesMinistres', 'GazetteOfficielle', 'Gouvernement'].includes(c)
      );
      const finalCategories = [...new Set([...sourceCategories, ...newCategories])];

      await Article.update(publicationId, { categories: finalCategories, is_manually_categorized: true });
      setShowEditModal(false);
      await loadData();
      toast({ title: "Publication catégorisée", description: "La publication est prête pour le bulletin." });
    } catch (error) {
      console.error("Erreur de sauvegarde de catégorie:", error);
      toast({
        title: "Erreur de sauvegarde",
        description: error.message || "Impossible de sauvegarder la catégorie.",
        variant: "destructive"
      });
    }
  };

  const filteredPublications = publications.filter(pub => {
    if (activeFilter === "Tous") return true;
    if (activeFilter === "Mémoire") return pub.publication_type === "Mémoire";
    // For "Gazette" filter, include specific 'Gazette' type and any types listed in GAZETTE_TYPES
    if (activeFilter === "Gazette") return pub.publication_type === "Gazette" || GAZETTE_TYPES.includes(pub.publication_type) || pub.categories.includes('GazetteOfficielle');
    return true;
  });

  const getBadgeCount = (filterKey) => {
      if (filterKey === "Tous") {
        // Retourner le nombre exact de publications chargées
        return publications.length;
      }
      if (filterKey === "Mémoire") {
        return publications.filter(p => p.publication_type === "Mémoire").length;
      }
      // For "Gazette" count, include specific 'Gazette' type and any types listed in GAZETTE_TYPES
      if (filterKey === "Gazette") {
        return publications.filter(p => 
          p.publication_type === "Gazette" || 
          GAZETTE_TYPES.includes(p.publication_type) || 
          p.categories.includes('GazetteOfficielle')
        ).length;
      }
      return 0;
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--editorial-light)' }}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Landmark className="w-10 h-10 text-slate-700" />
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Veille gouvernementale</h1>
                <p className="text-slate-600 mt-1">
                  {isLoading ? 'Chargement...' : `${publications.length} publication${publications.length > 1 ? 's' : ''} gouvernementale${publications.length > 1 ? 's' : ''}`}
                </p>
            </div>
          </div>
           <div className="flex gap-3">
             <Button
                onClick={handleArchiveAll}
                disabled={isClearing}
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
                <ArchiveIcon className={`w-4 h-4 mr-2 ${isClearing ? 'animate-spin' : ''}`} />
                {isClearing ? 'Archivage...' : 'Archiver tout'}
            </Button>
            <Button onClick={handleProcessAll} disabled={isProcessing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
              {isProcessing ? 'Diagnostic...' : 'Lancer le diagnostic'}
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white p-3 rounded-xl border flex flex-wrap gap-2">
            {PUBLICATION_TYPES.map(type => (
                <Button
                    key={type.key}
                    variant={activeFilter === type.key ? "default" : "ghost"}
                    onClick={() => setActiveFilter(type.key)}
                    className="flex items-center gap-2"
                >
                    <type.icon className="w-4 h-4" />
                    <span>{type.label}</span>
                    <Badge variant={activeFilter === type.key ? "secondary" : "default"}>
                        {getBadgeCount(type.key)}
                    </Badge>
                </Button>
            ))}
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <p>Chargement des publications...</p>
          ) : filteredPublications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border">
              <p className="text-slate-500 font-medium">Aucune publication trouvée.</p>
              <p className="text-slate-400 mt-2">Cliquez sur "Lancer le diagnostic" pour commencer.</p>
            </div>
          ) : (
            filteredPublications.map(publication => (
              <PublicationCard
                key={publication.id}
                publication={publication}
                onUpdate={loadData}
                onEditCategory={handleEditCategory}
                onArchive={handleArchivePublication}
              />
            ))
          )}
        </div>
      </div>

      {selectedPublication && (
        <EditCategoryModal
          article={selectedPublication}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveCategory}
        />
      )}

      <Toaster />
    </div>
  );
}
