
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
import { Trash2, Edit3, X, Loader2, ThumbsDown } from "lucide-react";

export default function CategoryArticlesModal({ isOpen, onClose, categoryName, articles, isLoading, onEdit, onDelete, onMarkIrrelevant }) {
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
            articles.map(article => (
              <div key={article.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm line-clamp-1 pr-2 text-slate-800 hover:text-blue-600 hover:underline"
                    title={article.title}
                  >
                    {article.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
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
            ))
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
