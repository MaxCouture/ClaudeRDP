import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function EditableNewsletterPreview({ 
  articles, 
  governmentPublications,
  onReorderArticles, 
  onToggleExclude,
  customSettings 
}) {
  const visibleArticles = articles.filter(a => !a.newsletter_excluded);
  const hiddenArticles = articles.filter(a => a.newsletter_excluded);

  const getFirstSentences = (text, count = 2) => {
    if (!text) return '';
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.slice(0, count).join(' ');
  };

  const ArticlePreviewCard = ({ article, index, isDragging }) => {
    const formattedDate = article.publication_date 
      ? format(new Date(article.publication_date), 'dd MMM yyyy', { locale: fr })
      : '';

    return (
      <div
        className={`group relative bg-white border rounded-lg transition-all ${
          isDragging ? 'shadow-2xl border-blue-500 scale-105' : 'hover:shadow-md'
        }`}
      >
        <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {index + 1}
          </div>
          
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-gray-600 truncate block">
              {article.source_name || 'Source inconnue'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(article.url, '_blank')}
              className="h-8 w-8 p-0"
              title="Ouvrir l'article"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExclude(article.id)}
              className="h-8 w-8 p-0"
              title="Masquer du bulletin"
            >
              <EyeOff className="w-4 h-4 text-gray-600" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          <div className="h-0.5 w-12 bg-amber-700 mb-4" />
          
          <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
            {article.title}
          </h3>
          
          <div className="text-sm text-gray-600 mb-3">
            {article.source_name}{formattedDate && ` • ${formattedDate}`}
          </div>
          
          <p className="text-sm text-gray-700 leading-relaxed">
            {getFirstSentences(article.content || article.summary || article.description)}
          </p>
        </div>
      </div>
    );
  };

  const GovPublicationCard = ({ publication }) => {
    const formattedDate = publication.publication_date 
      ? format(new Date(publication.publication_date), 'dd MMM yyyy', { locale: fr })
      : '';

    let typeIcon = '📋';
    if (publication.publication_type === 'Mémoire') typeIcon = '📄';
    else if (publication.publication_type?.includes('Décret')) typeIcon = '⚖️';
    else if (publication.publication_type === 'Loi') typeIcon = '📜';

    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="h-0.5 w-12 bg-amber-700 mb-3" />
        
        <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight flex items-center gap-2">
          <span>{typeIcon}</span>
          {publication.title}
        </h3>
        
        <div className="text-sm text-gray-600 mb-2">
          {publication.publication_type}{formattedDate && ` • ${formattedDate}`}
        </div>
        
        {publication.summary && (
          <p className="text-sm text-gray-700">
            {getFirstSentences(publication.summary)}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              📝 Aperçu éditable du bulletin
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Dernière vérification avant envoi • Glissez pour réorganiser • Cliquez l'œil pour masquer
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-mono">
              {visibleArticles.length} article{visibleArticles.length > 1 ? 's' : ''}
            </Badge>
            {governmentPublications.length > 0 && (
              <Badge variant="secondary" className="font-mono">
                {governmentPublications.length} pub. gouv.
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {visibleArticles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-semibold text-gray-700 px-3">
                REVUE DE PRESSE
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <DragDropContext onDragEnd={onReorderArticles}>
              <Droppable droppableId="editable-articles">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`space-y-4 ${
                      snapshot.isDraggingOver ? 'bg-blue-50/50 rounded-lg p-2' : ''
                    }`}
                  >
                    {visibleArticles.map((article, index) => (
                      <Draggable
                        key={article.id}
                        draggableId={article.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                          >
                            <div className="flex gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="flex-shrink-0 w-8 flex items-start justify-center pt-4 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 transition-opacity"
                              >
                                <GripVertical className="w-5 h-5 text-gray-600" />
                              </div>
                              
                              <div className="flex-1">
                                <ArticlePreviewCard
                                  article={article}
                                  index={index}
                                  isDragging={snapshot.isDragging}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}

        {governmentPublications.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-semibold text-gray-700 px-3">
                PUBLICATIONS GOUVERNEMENTALES
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="space-y-4">
              {governmentPublications.map((publication) => (
                <GovPublicationCard key={publication.id} publication={publication} />
              ))}
            </div>
          </div>
        )}

        {hiddenArticles.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <EyeOff className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-600">
                Articles masqués ({hiddenArticles.length})
              </p>
              <Badge variant="outline" className="text-xs">
                Ne seront pas envoyés
              </Badge>
            </div>
            
            <div className="space-y-2">
              {hiddenArticles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center gap-3 p-3 bg-gray-100 border border-gray-300 rounded-lg opacity-60"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-gray-700 line-through">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {article.source_name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleExclude(article.id)}
                    title="Réafficher cet article"
                  >
                    <Eye className="w-4 h-4 text-gray-600" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleArticles.length === 0 && governmentPublications.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">
              Aucun contenu visible • Tous les articles sont masqués
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}