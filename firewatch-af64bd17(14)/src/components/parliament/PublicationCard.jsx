import React from 'react';
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, FileText, Stamp, Edit3, Archive } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const publicationTypeColors = {
  "Mémoire": "bg-blue-100 text-blue-800 border-blue-200",
  "Arrêtés ministériels": "bg-purple-100 text-purple-800 border-purple-200",
  "Avis": "bg-green-100 text-green-800 border-green-200",
  "Décrets administratifs": "bg-orange-100 text-orange-800 border-orange-200",
  "Entrée en vigueur de lois": "bg-red-100 text-red-800 border-red-200",
  "Lois": "bg-red-100 text-red-800 border-red-200",
  "Projets de règlement": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Règlements et autres actes": "bg-gray-100 text-gray-800 border-gray-200",
  "Autres": "bg-slate-100 text-slate-800 border-slate-200"
};

const categoryColors = {
  "Politique": "bg-red-100 text-red-800 border-red-200",
  "Économie": "bg-green-100 text-green-800 border-green-200",
  "Santé": "bg-blue-100 text-blue-800 border-blue-200",
  "Environnement": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Éducation": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Saguenay-Lac-St-Jean": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Aucune catégorie détectée": "bg-gray-100 text-gray-600 border-gray-200"
};

export default function PublicationCard({ publication, onUpdate, onEditCategory, onArchive }) {
  const pubDate = publication.publication_date ? parseISO(publication.publication_date) : new Date();
  const dateLabel = format(pubDate, "d MMMM yyyy", { locale: fr });
  
  const getPublicationIcon = (type) => {
    if (type === 'Mémoire') return <FileText className="w-5 h-5" />;
    return <Stamp className="w-5 h-5" />;
  };

  const getPublicationTypeColor = (type) => {
    return publicationTypeColors[type] || publicationTypeColors["Autres"];
  };

  const manualCategories = publication.categories?.filter(cat => !['ConseilDesMinistres', 'GazetteOfficielle', 'Gouvernement'].includes(cat)) || [];

  return (
    <Card className="border-l-4 border-l-slate-400 bg-white hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-slate-100 flex-shrink-0">
              {getPublicationIcon(publication.publication_type)}
            </div>
            
            <div className="flex-1 space-y-3">
              <h3 className="font-bold text-lg leading-tight text-gray-900 line-clamp-2">
                {publication.title}
              </h3>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">{dateLabel}</span>
                </div>
              </div>

              {publication.content && (
                <div className="bg-slate-50 p-3 rounded-lg border-l-2 border-l-slate-300">
                  <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">
                    {publication.content}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getPublicationTypeColor(publication.publication_type)} font-medium`}>
                  {publication.publication_type}
                </Badge>
                
                {manualCategories.map((category, index) => (
                  <Badge key={index} className={`${categoryColors[category] || categoryColors["Aucune catégorie détectée"]} font-medium`}>
                    {category}
                  </Badge>
                ))}

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onEditCategory(publication)}
                  className="text-gray-400 hover:text-blue-600 h-auto p-1 ml-1"
                  title="Catégoriser cette publication"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onArchive(publication)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              title="Archiver cette publication"
            >
              <Archive className="w-4 h-4 text-gray-500" />
            </Button>
            
            <a 
              href={publication.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              title="Voir le document"
            >
              <ExternalLink className="w-5 h-5 text-gray-500" />
            </a>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}