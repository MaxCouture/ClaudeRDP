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
import { Loader2, FileText, X } from "lucide-react";

export default function SummaryModal({ isOpen, onClose, title, summary, isLoading }) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <DialogTitle>Résumé par IA</DialogTitle>
              <DialogDescription>
                Analyse rapide du contenu de l'article pour évaluer sa pertinence.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <h4 className="font-bold text-md text-slate-800 border-b pb-2">{title}</h4>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-slate-600">Génération du résumé en cours...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-md border">
              <p>{summary}</p>
            </div>
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