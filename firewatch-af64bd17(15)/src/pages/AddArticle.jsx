
import React, { useState, useEffect } from "react";
import { Article, Source, Category } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Plus, ArrowLeft, Save, X } from "lucide-react";
import { useNavigate } from 'react-router-dom';

const availableCategories = [
  "Économie", 
  "Santé",
  "Environnement",
  "Éducation",
  "Saguenay-Lac-St-Jean",
  "Aînés"
];

const categoryColors = {
  "Économie": "bg-green-100 text-green-800",
  "Santé": "bg-blue-100 text-blue-800",
  "Environnement": "bg-emerald-100 text-emerald-800",
  "Éducation": "bg-yellow-100 text-yellow-800",
  "Saguenay-Lac-St-Jean": "bg-indigo-100 text-indigo-800",
  "Aînés": "bg-purple-100 text-purple-800"
};

export default function AddArticlePage() {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    url: "",
    content: "",
    summary: "",
    source_id: "",
    publication_date: new Date().toISOString().split('T')[0] // Date d'aujourd'hui par défaut
  });

  useEffect(() => {
    const loadSources = async () => {
      try {
        const sourcesData = await Source.list();
        setSources(sourcesData || []);
      } catch (error) {
        toast({
          title: "Erreur de chargement",
          description: "Impossible de charger les sources.",
          variant: "destructive"
        });
      }
    };
    loadSources();
  }, [toast]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(category);
      if (isSelected) {
        return prev.filter(cat => cat !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const removeCategory = (categoryToRemove) => {
    setSelectedCategories(prev => prev.filter(cat => cat !== categoryToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation basique
    if (!formData.title.trim() || !formData.url.trim() || !formData.source_id) {
      toast({
        title: "Champs manquants",
        description: "Le titre, l'URL et la source sont obligatoires.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Préparer les données de l'article
      const articleData = {
        title: formData.title.trim(),
        url: formData.url.trim(),
        content: formData.content.trim() || formData.title.trim(),
        summary: formData.summary.trim() || formData.title.trim(),
        source_id: formData.source_id,
        publication_date: formData.publication_date + "T12:00:00Z", // Midi UTC
        categories: selectedCategories,
        is_manually_categorized: selectedCategories.length > 0
      };

      // Créer l'article
      await Article.create(articleData);

      toast({
        title: "✅ Article ajouté !",
        description: `"${formData.title}" a été ajouté au fil de nouvelles.`,
        duration: 4000
      });

      // Rediriger vers le Dashboard après un court délai
      setTimeout(() => {
        navigate('/Dashboard');
      }, 1500);

    } catch (error) {
      toast({
        title: "Erreur de création",
        description: error.message || "Impossible de créer l'article.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plus className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Ajouter un article</h1>
              <p className="text-gray-600 mt-1">
                Créer un article manuel qui apparaîtra dans le fil de nouvelles
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/Dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retourner au fil de nouvelles
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Colonne gauche - Informations principales */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations de l'article</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Titre de l'article *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Saisissez le titre de l'article..."
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="url">URL de l'article *</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) => handleInputChange('url', e.target.value)}
                      placeholder="https://example.com/article"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="source">Source *</Label>
                    <Select value={formData.source_id} onValueChange={(value) => handleInputChange('source_id', value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une source..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map(source => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="publication_date">Date de publication</Label>
                    <Input
                      id="publication_date"
                      type="date"
                      value={formData.publication_date}
                      onChange={(e) => handleInputChange('publication_date', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contenu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="content">Contenu de l'article</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      placeholder="Contenu principal de l'article..."
                      rows={6}
                    />
                  </div>

                  <div>
                    <Label htmlFor="summary">Résumé</Label>
                    <Textarea
                      id="summary"
                      value={formData.summary}
                      onChange={(e) => handleInputChange('summary', e.target.value)}
                      placeholder="Résumé court de l'article..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Colonne droite - Catégorisation */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Catégorisation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Catégories sélectionnées</Label>
                    <div className="mt-2 flex flex-wrap gap-2 min-h-[32px] p-2 bg-gray-50 rounded-md border">
                      {selectedCategories.length === 0 ? (
                        <span className="text-gray-500 text-sm">Aucune catégorie sélectionnée</span>
                      ) : (
                        selectedCategories.map((category) => (
                          <Badge 
                            key={category} 
                            className={`${categoryColors[category] || 'bg-gray-200'} flex items-center gap-1.5 py-1 px-2`}
                          >
                            <span>{category}</span>
                            <X 
                              className="w-3.5 h-3.5 cursor-pointer hover:bg-black/20 rounded-full p-0.5" 
                              onClick={() => removeCategory(category)}
                            />
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Sélectionner les catégories</Label>
                    <div className="space-y-3">
                      {availableCategories.map((category) => (
                        <div key={category} className="flex items-center space-x-3">
                          <Checkbox
                            id={category}
                            checked={selectedCategories.includes(category)}
                            onCheckedChange={() => handleCategoryToggle(category)}
                          />
                          <label 
                            htmlFor={category} 
                            className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                          >
                            <span className={`w-3 h-3 rounded-full ${categoryColors[category]?.split(' ')[0] || 'bg-gray-200'}`}></span>
                            {category}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button 
                      type="submit" 
                      disabled={isLoading || !formData.title.trim() || !formData.url.trim() || !formData.source_id}
                      className="w-full bg-blue-600 hover:bg-blue-700" 
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Création...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5 mr-2" />
                          Créer l'article
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate('/Dashboard')}
                      className="w-full"
                      disabled={isLoading}
                    >
                      Annuler
                    </Button>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <strong>Info :</strong> Votre article apparaîtra immédiatement dans le fil de nouvelles et pourra être inclus dans le bulletin d'information.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
      <Toaster />
    </div>
  );
}
