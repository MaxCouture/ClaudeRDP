
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit3, X, Loader2, ThumbsDown, Rss, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CategoryArticlesModal({ isOpen, onClose, categoryName, articles, isLoading, onEdit, onDelete, onMarkIrrelevant }) {
  // NOUVEAU : Fonction pour obtenir les noms des sources groupées
  const getSourceNames = (article) => {
    if (article.grouped_sources && article.grouped_sources.length > 0) {
      if (article.grouped_sources.length > 1) {
        return {
          isMultiple: true,
          names: article.grouped_sources
        };
      } else { // Exactly one grouped source
        return article.grouped_sources[0];
      }
    }
    // Fallback if no grouped_sources or empty
    return article.source || 'Source inconnue';
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Articles - {categoryName}</DialogTitle>
          <DialogDescription>
            Liste complète des articles actuellement dans la catégorie "{categoryName}".
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-3">
          {isLoading ? (
             <div className="flex justify-center items-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
             </div>
          ) : articles.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Aucun article dans cette catégorie.</p>
          ) : (
            articles.map(article => {
              const sourceInfo = getSourceNames(article);
              const isMultipleSources = sourceInfo?.isMultiple;
              
              // NOUVEAU : Formater la date de publication
              let dateDisplay = '';
              try {
                if (article.publication_date) {
                  const pubDate = new Date(article.publication_date);
                  dateDisplay = format(pubDate, "d MMM yyyy 'à' HH:mm", { locale: fr });
                }
              } catch (e) {
                dateDisplay = 'Date inconnue';
              }

              return (
                <div key={article.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm line-clamp-2 pr-2 text-slate-800 hover:text-blue-600 hover:underline mb-1 block"
                      title={article.title}
                    >
                      {article.title}
                    </a>
                    
                    {/* NOUVEAU : Affichage date/heure */}
                    {dateDisplay && (
                      <p className="text-xs text-gray-500 mb-2">
                        📅 {dateDisplay}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Sources */}
                      {isMultipleSources ? (
                        <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-2 border-purple-200 text-purple-700 bg-purple-50 font-medium text-xs">
                          <Users className="w-3 h-3" />
                          {sourceInfo.names.join(' / ')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-2 border-blue-200 text-blue-700 bg-blue-50 font-medium text-xs">
                          <Rss className="w-3 h-3" />
                          {sourceInfo}
                        </Badge>
                      )}

                      {/* Catégories existantes */}
                      {(article.categories && article.categories.length > 0) ? (
                        article.categories.map(cat => (
                          <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                        ))
                      ) : (
                         <Badge variant="outline" className="text-xs text-gray-500">Non catégorisé</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => onEdit(article)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                     <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-orange-500 hover:text-orange-700" 
                          onClick={() => onMarkIrrelevant(article.id, categoryName)}
                          title="Marquer comme non pertinent pour cette catégorie"
                      >
                          <ThumbsDown className="w-4 h-4" />
                      </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => onDelete(article.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
