import React, { useState, useEffect } from "react";
import { Keyword } from "@/api/entities";
import { Category } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Key, Target } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

function KeywordCard({ keyword, categories, onDelete }) {
  const category = categories.find(c => c.id === keyword.category_id);
  
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-gray-500" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{keyword.word}</span>
              {category && (
                <Badge 
                  className="text-xs text-white border-0" 
                  style={{ backgroundColor: category.color }}
                >
                  {category.name}
                </Badge>
              )}
              {keyword.weight > 1 && (
                <Badge variant="outline" className="text-xs">
                  Poids: {keyword.weight}
                </Badge>
              )}
            </div>
            {keyword.description && (
              <p className="text-sm text-gray-500 mt-1">{keyword.description}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(keyword.id)}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newKeyword, setNewKeyword] = useState({ 
    word: "", 
    category_id: "", 
    weight: 1, 
    description: "" 
  });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    const [keywordData, categoryData] = await Promise.all([
      Keyword.list(),
      Category.list()
    ]);
    setKeywords(keywordData);
    setCategories(categoryData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.word || !newKeyword.category_id) {
      toast({ 
        title: "Champs requis", 
        description: "Veuillez remplir le mot-clé et sélectionner une catégorie.", 
        variant: "destructive" 
      });
      return;
    }
    
    await Keyword.create(newKeyword);
    const category = categories.find(c => c.id === newKeyword.category_id);
    setNewKeyword({ word: "", category_id: "", weight: 1, description: "" });
    toast({ 
      title: "Mot-clé ajouté", 
      description: `"${newKeyword.word}" a été ajouté à la catégorie ${category?.name}.` 
    });
    loadData();
  };

  const handleDeleteKeyword = async (id) => {
    await Keyword.delete(id);
    toast({ title: "Mot-clé supprimé", description: "Le mot-clé a été supprimé." });
    loadData();
  };

  const filteredKeywords = selectedCategory === "all" 
    ? keywords 
    : keywords.filter(k => k.category_id === selectedCategory);

  const keywordsByCategory = categories.reduce((acc, category) => {
    acc[category.id] = keywords.filter(k => k.category_id === category.id).length;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Key className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Gestion des mots-clés</h1>
      </div>

      <div className="grid lg:grid-cols-6 gap-4 mb-8">
        {categories.map((category) => (
          <Card key={category.id} className="text-center">
            <CardContent className="p-4">
              <div 
                className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-2 bg-opacity-20"
                style={{ backgroundColor: `${category.color}20` }}
              >
                <Target className="w-6 h-6" style={{ color: category.color }} />
              </div>
              <h3 className="font-semibold text-sm">{category.name}</h3>
              <p className="text-2xl font-bold">{keywordsByCategory[category.id] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Ajouter un nouveau mot-clé</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddKeyword} className="space-y-4">
                <div>
                  <Label htmlFor="keyword-word">Mot-clé ou expression</Label>
                  <Input 
                    id="keyword-word" 
                    placeholder="Ex: Pierre Poilievre, congrès, santé publique" 
                    value={newKeyword.word} 
                    onChange={(e) => setNewKeyword({ ...newKeyword, word: e.target.value })} 
                  />
                </div>
                <div>
                  <Label htmlFor="keyword-category">Catégorie</Label>
                  <Select 
                    value={newKeyword.category_id} 
                    onValueChange={(value) => setNewKeyword({ ...newKeyword, category_id: value })}
                  >
                    <SelectTrigger id="keyword-category">
                      <SelectValue placeholder="Sélectionner une catégorie..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            ></div>
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="keyword-weight">Poids (importance)</Label>
                  <Select 
                    value={newKeyword.weight.toString()} 
                    onValueChange={(value) => setNewKeyword({ ...newKeyword, weight: parseInt(value) })}
                  >
                    <SelectTrigger id="keyword-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Normal</SelectItem>
                      <SelectItem value="2">2 - Important</SelectItem>
                      <SelectItem value="3">3 - Très important</SelectItem>
                      <SelectItem value="4">4 - Critique</SelectItem>
                      <SelectItem value="5">5 - Priorité absolue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="keyword-desc">Description (optionnel)</Label>
                  <Input 
                    id="keyword-desc" 
                    placeholder="Contexte ou précision sur ce mot-clé" 
                    value={newKeyword.description} 
                    onChange={(e) => setNewKeyword({ ...newKeyword, description: e.target.value })} 
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Ajouter le mot-clé
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Mots-clés actuels ({filteredKeywords.length})
            </h2>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      ></div>
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p>Chargement...</p>
          ) : filteredKeywords.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {selectedCategory === "all" 
                  ? "Aucun mot-clé configuré. Ajoutez-en pour améliorer la catégorisation automatique."
                  : `Aucun mot-clé pour cette catégorie.`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredKeywords.map(keyword => (
                <KeywordCard 
                  key={keyword.id} 
                  keyword={keyword} 
                  categories={categories}
                  onDelete={handleDeleteKeyword} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Toaster />
    </div>
  );
}