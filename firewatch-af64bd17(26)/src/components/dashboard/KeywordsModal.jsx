import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";

const CATEGORY_COLORS = {
  "Économie": "bg-green-100 text-green-800",
  "Santé": "bg-blue-100 text-blue-800",
  "Environnement": "bg-emerald-100 text-emerald-800",
  "Éducation": "bg-yellow-100 text-yellow-800",
  "Saguenay-Lac-St-Jean": "bg-indigo-100 text-indigo-800",
  "Aînés": "bg-purple-100 text-purple-800",
  "ALERTES": "bg-red-100 text-red-800",
  "Politique": "bg-red-100 text-red-800",
};

export default function KeywordsModal({ isOpen, onClose, title, keywords }) {
  // Grouper les mots-clés par catégorie
  const groupedKeywords = React.useMemo(() => {
    const groups = {};
    keywords.forEach(kw => {
      if (!groups[kw.category]) {
        groups[kw.category] = [];
      }
      groups[kw.category].push(kw);
    });
    return groups;
  }, [keywords]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Mots-clés détectés
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {keywords.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Aucun mot-clé n'a été détecté pour cet article.
            </p>
          ) : (
            <>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <p className="text-sm text-indigo-900">
                  <strong>{keywords.length} mot{keywords.length > 1 ? 's' : ''}-clé{keywords.length > 1 ? 's' : ''}</strong> {keywords.length > 1 ? 'ont' : 'a'} déclenché la catégorisation automatique de cet article.
                </p>
              </div>

              {Object.entries(groupedKeywords).map(([category, kws]) => {
                const totalWeight = kws.reduce((sum, kw) => sum + (kw.weight || 1), 0);
                
                return (
                  <div key={category} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`${CATEGORY_COLORS[category] || 'bg-gray-200 text-gray-800'} text-sm font-semibold`}>
                        {category}
                      </Badge>
                      <span className="text-xs font-medium text-gray-600">
                        Score total: {totalWeight}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {kws.map((kw, index) => (
                        <div
                          key={`${kw.word}-${index}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            {kw.word}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {kw.weight || 1}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}