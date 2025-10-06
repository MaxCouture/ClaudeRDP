import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, X } from "lucide-react";
import { Category } from "@/api/entities";

export default function EditCategoryModal({ article, isOpen, onClose, onSave }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Charger les catégories depuis la base de données
  useEffect(() => {
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categories = await Category.list();
        // Transformer les catégories pour le format attendu
        const formattedCategories = categories.map(cat => ({
          value: cat.name,
          label: cat.name,
          color: getCategoryColorClass(cat.name)
        }));
        setAvailableCategories(formattedCategories);
      } catch (error) {
        console.error("Erreur lors du chargement des catégories:", error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    // S'assure que l'état est bien réinitialisé avec les catégories de l'article actuel
    if (article && article.categories) {
      // Filtre pour ne garder que les catégories valides au cas où des données corrompues existeraient
      const validCategories = article.categories.filter(cat => 
        availableCategories.some(ac => ac.value === cat)
      );
      setSelectedCategories(validCategories);
    } else {
      setSelectedCategories([]);
    }
  }, [article, availableCategories]);

  // Fonction pour obtenir la couleur d'une catégorie
  const getCategoryColorClass = (categoryName) => {
    const categoryColors = {
      "Économie": "bg-green-100 text-green-800",
      "Santé": "bg-blue-100 text-blue-800",
      "Environnement": "bg-emerald-100 text-emerald-800",
      "Éducation": "bg-yellow-100 text-yellow-800",
      "Saguenay-Lac-St-Jean": "bg-indigo-100 text-indigo-800",
      "Aînés": "bg-purple-100 text-purple-800",
      "ALERTES": "bg-red-100 text-red-800",
      "Politique": "bg-red-100 text-red-800"
    };
    
    return categoryColors[categoryName] || "bg-gray-100 text-gray-800";
  };

  const handleCategoryToggle = (categoryValue) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(categoryValue);
      if (isSelected) {
        return prev.filter(cat => cat !== categoryValue);
      } else {
        return [...prev, categoryValue];
      }
    });
  };

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      // Envoie le tableau complet des catégories sélectionnées pour mise à jour
      await onSave(article.id, selectedCategories);
      onClose();
    } catch (error) {
      console.error("Error updating categories:", error);
    }
    setIsUpdating(false);
  };

  const removeCategory = (categoryToRemove) => {
    setSelectedCategories(prev => prev.filter(cat => cat !== categoryToRemove));
  };

  if (!article) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catégoriser l'article</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h4 className="font-medium text-sm text-slate-600 mb-2">Article</h4>
            <p className="text-sm font-medium line-clamp-2 bg-slate-50 p-3 rounded">{article.title}</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Catégories actuelles</Label>
            <div className="mt-2 flex flex-wrap gap-2 min-h-[24px]">
              {selectedCategories.length === 0 ? (
                <Badge variant="outline" className="text-gray-500">Aucune catégorie</Badge>
              ) : (
                selectedCategories.map((category) => {
                  const categoryInfo = availableCategories.find(c => c.value === category);
                  return (
                    <Badge 
                      key={category} 
                      className={`${categoryInfo?.color || 'bg-gray-200'} flex items-center gap-1`}
                    >
                      {category}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => removeCategory(category)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Catégories disponibles</Label>
            {isLoadingCategories ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Chargement des catégories...</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {availableCategories.map((category) => (
                  <div key={category.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={category.value}
                      checked={selectedCategories.includes(category.value)}
                      onCheckedChange={() => handleCategoryToggle(category.value)}
                    />
                    <Badge className={`${category.color} text-xs`}>
                      {category.label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isUpdating || isLoadingCategories}
          >
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}