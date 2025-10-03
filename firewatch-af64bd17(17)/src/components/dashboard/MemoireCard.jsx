import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, FileText, ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { summarizeMemoirePDF } from '@/api/functions';
import { Article } from '@/api/entities';

export default function MemoireCard({ memoire }) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(memoire.summary || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const pubDate = memoire.publication_date ? parseISO(memoire.publication_date) : new Date();
  const dateLabel = format(pubDate, "d MMMM yyyy", { locale: fr });

  const handleGenerateSummary = useCallback(async () => {
    if (summary) {
        setIsExpanded(!isExpanded);
        return;
    }
    
    setIsSummarizing(true);
    setIsExpanded(true);
    try {
      const { data } = await summarizeMemoirePDF({ pdfUrl: memoire.url });
      setSummary(data.summary);
      await Article.update(memoire.id, { summary: data.summary });
      toast({ title: "Résumé généré", description: "Le résumé du mémoire est maintenant disponible." });
    } catch (error) {
      toast({
        title: "Erreur de résumé",
        description: "Impossible de générer le résumé pour ce mémoire.",
        variant: "destructive"
      });
      setIsExpanded(false);
    } finally {
      setIsSummarizing(false);
    }
  }, [memoire.id, memoire.url, summary, toast, isExpanded]);

  return (
    <Card className="bg-white hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <h3 className="font-bold text-lg text-slate-900">{memoire.title}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>Publié le {dateLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={memoire.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Mémoire
              </Button>
            </a>
            {memoire.air_url && (
              <a href={memoire.air_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Analyse d'impact
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button onClick={handleGenerateSummary} disabled={isSummarizing} className="w-full">
          {isSummarizing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyse du PDF en cours...
            </>
          ) : summary ? (
            <>
              {isExpanded ? 'Masquer le résumé' : 'Afficher le résumé'}
              {isExpanded ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Générer le résumé en 10 points
            </>
          )}
        </Button>
        
        {isExpanded && summary && (
          <div 
            className="mt-4 p-4 bg-slate-50 rounded-lg border prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: summary }} 
          />
        )}
      </CardContent>
    </Card>
  );
}