
import React, { useState, useEffect, useMemo } from "react";
import { ArchivedArticle } from "@/api/entities";
import { ArchivedGovernmentPublication } from "@/api/entities"; // New import
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Archive, ExternalLink, Filter, ChevronLeft, ChevronRight, Landmark, FileText } from "lucide-react"; // Added Landmark and FileText
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const categoryColors = {
  Politique: "bg-red-100 text-red-800 border-red-200",
  Économie: "bg-green-100 text-green-800 border-green-200",
  Santé: "bg-blue-100 text-blue-800 border-blue-200",
  Environnement: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Éducation: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Saguenay-Lac-St-Jean": "bg-purple-100 text-purple-800 border-purple-200",
  "Aucune catégorie détectée": "bg-gray-100 text-gray-600 border-gray-200"
};

function ArchivedArticleCard({ article }) {
  const categoryKey = article.category || 'Aucune catégorie détectée';
  const pubDate = article.publication_date ? parseISO(article.publication_date) : new Date();
  const archiveDate = article.archived_date ? parseISO(article.archived_date) : new Date();

  return (
    <Card className="border-l-4 border-l-gray-300 bg-white hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <h3 className="font-bold text-lg leading-tight text-gray-900 line-clamp-2">
              {article.title}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{format(pubDate, "d MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Archive className="w-4 h-4" />
                <span className="text-xs">Archivé le {format(archiveDate, "d/MM/yyyy", { locale: fr })}</span>
              </div>
              <span className="text-gray-500 text-xs">• {article.source_name}</span>
            </div>

            {article.summary && (
              <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">
                {article.summary}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Badge className={`${categoryColors[categoryKey]} font-medium`}>
                {categoryKey}
              </Badge>
            </div>
          </div>

          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 flex-shrink-0"
          >
            <ExternalLink className="w-5 h-5 text-gray-500" />
          </a>
        </div>
      </CardHeader>
    </Card>
  );
}

function ArchivedGovernmentPublicationCard({ publication }) {
  const pubDate = publication.publication_date ? parseISO(publication.publication_date) : new Date();
  const archiveDate = publication.archived_date ? parseISO(publication.archived_date) : new Date();

  const getTypeIcon = (type) => {
    if (type === 'Mémoire') return '📄';
    if (type?.includes('Décret')) return '⚖️';
    if (type === 'Loi') return '📜';
    if (type?.includes('Règlement')) return '📋';
    return '📋';
  };

  return (
    <Card className="border-l-4 border-l-blue-500 bg-white hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <h3 className="font-bold text-lg leading-tight text-gray-900 line-clamp-2">
              {getTypeIcon(publication.publication_type)} {publication.title}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{format(pubDate, "d MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Archive className="w-4 h-4" />
                <span className="text-xs">Archivé le {format(archiveDate, "d/MM/yyyy", { locale: fr })}</span>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {publication.publication_type}
              </Badge>
            </div>

            {publication.content && (
              <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">
                {publication.content}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {publication.categories?.map((category, index) => (
                <Badge key={index} className="bg-gray-100 text-gray-700">
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {publication.air_url && (
              <a 
                href={publication.air_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                title="Analyse d'impact réglementaire"
              >
                <FileText className="w-4 h-4 text-blue-500" />
              </a>
            )}
            <a 
              href={publication.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <ExternalLink className="w-5 h-5 text-gray-500" />
            </a>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function ArchivesPage() {
  const [articles, setArticles] = useState([]);
  const [govPublications, setGovPublications] = useState([]);
  const [totalArticlesCount, setTotalArticlesCount] = useState(0);
  const [totalGovPublicationsCount, setTotalGovPublicationsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [activeTab, setActiveTab] = useState("articles");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 100;

  const loadArchives = async () => {
    setIsLoading(true);
    try {
      // CORRECTION: Ajustement de la limite au maximum autorisé par l'API (10 000)
      const [articleData, govData] = await Promise.all([
        ArchivedArticle.list("-archived_date", 10000), // Limite ramenée à 10 000
        ArchivedGovernmentPublication.list("-archived_date", 10000) // Limite ramenée à 10 000
      ]);
      
      setArticles(articleData);
      setGovPublications(govData);
      setTotalArticlesCount(articleData.length);
      setTotalGovPublicationsCount(govData.length);
      
      console.log(`LOG: Chargé ${articleData.length} articles archivés et ${govData.length} publications gouvernementales archivées`);
    } catch (error) {
      console.error("Erreur lors du chargement des archives:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadArchives();
  }, []);

  const currentData = useMemo(() => {
    return activeTab === "articles" ? articles : govPublications;
  }, [activeTab, articles, govPublications]);

  const filteredData = useMemo(() => {
    let filtered = currentData;

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        // RECHERCHE AMÉLIORÉE : Titre, contenu, résumé ET catégories
        const titleMatch = item.title?.toLowerCase().includes(lowercasedTerm);
        const contentMatch = item.content?.toLowerCase().includes(lowercasedTerm);
        const summaryMatch = item.summary?.toLowerCase().includes(lowercasedTerm);
        
        // Pour les publications gouvernementales, chercher aussi dans les catégories
        let categoryMatch = false;
        if (item.categories && Array.isArray(item.categories)) {
          categoryMatch = item.categories.some(cat => cat.toLowerCase().includes(lowercasedTerm));
        }
        
        // Retourner true si n'importe quel champ correspond
        return titleMatch || contentMatch || summaryMatch || categoryMatch;
      });
    }

    if (selectedCategory !== "all") {
      if (activeTab === "articles") {
        filtered = filtered.filter(item => item.category === selectedCategory);
      } else {
        filtered = filtered.filter(item => 
          item.categories && item.categories.includes(selectedCategory)
        );
      }
    }

    if (selectedMonth !== "all") {
      filtered = filtered.filter(item => {
        if (!item.publication_date) return false;
        const itemMonth = item.publication_date.substring(0, 7);
        return itemMonth === selectedMonth;
      });
    }

    return filtered;
  }, [searchTerm, selectedCategory, selectedMonth, currentData, activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedMonth, activeTab]);

  const categories = useMemo(() => {
    if (activeTab === "articles") {
      return [...new Set(articles.map(a => a.category).filter(Boolean))];
    } else {
      return [...new Set(govPublications.flatMap(p => p.categories || []))];
    }
  }, [articles, govPublications, activeTab]);
  
  const months = useMemo(() => [...new Set(currentData.map(a => {
    if (!a.publication_date) return null;
    return a.publication_date.substring(0, 7);
  }).filter(Boolean))].sort().reverse(), [currentData]);

  const totalPages = Math.ceil(filteredData.length / articlesPerPage);
  const currentItems = filteredData.slice((currentPage - 1) * articlesPerPage, currentPage * articlesPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Archive className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Archives</h1>
            <p className="text-gray-600 mt-1">
              {isLoading ? 'Chargement...' : `${totalArticlesCount.toLocaleString()} articles • ${totalGovPublicationsCount.toLocaleString()} publications gouvernementales`}
            </p>
          </div>
        </div>

        <div className="bg-white p-2 rounded-lg border">
          <div className="flex gap-2">
            <Button
              variant={activeTab === "articles" ? "default" : "ghost"}
              onClick={() => setActiveTab("articles")}
              className="flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              <span>Articles de presse ({totalArticlesCount.toLocaleString()})</span>
            </Button>
            <Button
              variant={activeTab === "government" ? "default" : "ghost"}
              onClick={() => setActiveTab("government")}
              className="flex items-center gap-2"
            >
              <Landmark className="w-4 h-4" />
              <span>Publications gouvernementales ({totalGovPublicationsCount.toLocaleString()})</span>
            </Button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder={`Rechercher dans les ${activeTab === "articles" ? "articles archivés" : "publications gouvernementales"} (titre, contenu, résumé, catégories)...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-lg h-12"
            />
          </div>
          
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tous les mois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {months.map(month => (
                    <SelectItem key={month} value={month}>
                      {format(new Date(month + '-01'), 'MMMM yyyy', { locale: fr })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* NOUVEAU : Indication sur la recherche étendue */}
          {searchTerm && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-md">
              <Search className="w-4 h-4" />
              <span>
                Recherche étendue dans les titres, contenus, résumés et catégories. 
                <strong> {filteredData.length.toLocaleString()} résultat{filteredData.length > 1 ? 's' : ''}</strong> pour "{searchTerm}".
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">
              {filteredData.length.toLocaleString()} résultat{filteredData.length > 1 ? 's' : ''} trouvé{filteredData.length > 1 ? 's' : ''}
              {(!searchTerm && selectedCategory === "all" && selectedMonth === "all") && (
                <span className="ml-2 text-gray-500">
                  (sur {activeTab === "articles" ? totalArticlesCount.toLocaleString() : totalGovPublicationsCount.toLocaleString()} total)
                </span>
              )}
            </p>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevPage} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">
                  Page {currentPage} sur {totalPages}
                </span>
                <Button variant="outline" size="icon" onClick={handleNextPage} disabled={currentPage === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12"><p className="text-gray-500">Chargement des archives...</p></div>
            ) : currentItems.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border">
                <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {searchTerm || selectedCategory !== "all" || selectedMonth !== "all" 
                    ? "Aucun résultat trouvé pour cette recherche."
                    : activeTab === "articles" 
                      ? "Aucun article archivé pour le moment."
                      : "Aucune publication gouvernementale archivée pour le moment."
                  }
                </p>
              </div>
            ) : (
              currentItems.map(item => (
                activeTab === "articles" ? (
                  <ArchivedArticleCard key={item.id} article={item} />
                ) : (
                  <ArchivedGovernmentPublicationCard key={item.id} publication={item} />
                )
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
