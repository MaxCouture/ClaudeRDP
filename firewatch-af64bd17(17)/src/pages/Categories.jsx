import React, { useState, useEffect } from "react";
import { Category } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Tag } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function CategoryCard({ category, onDelete }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: category.color || '#e2e8f0' }}>
            <Tag className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold">{category.name}</p>
            <p className="text-sm text-slate-500">{category.description}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(category.id)}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: "", description: "", color: "#3b82f6" });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadCategories = async () => {
    setIsLoading(true);
    const data = await Category.list();
    setCategories(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name) {
      toast({ title: "Nom requis", description: "Veuillez entrer un nom pour la catégorie.", variant: "destructive" });
      return;
    }
    await Category.create(newCategory);
    setNewCategory({ name: "", description: "", color: "#3b82f6" });
    toast({ title: "Catégorie ajoutée", description: "La nouvelle catégorie a été ajoutée." });
    loadCategories();
  };

  const handleDeleteCategory = async (id) => {
    await Category.delete(id);
    toast({ title: "Catégorie supprimée", description: "La catégorie a été supprimée." });
    loadCategories();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Gérer les catégories d'articles</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Ajouter une nouvelle catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <Label htmlFor="cat-name">Nom de la catégorie</Label>
                  <Input id="cat-name" placeholder="Ex: Technologie" value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="cat-desc">Description</Label>
                  <Input id="cat-desc" placeholder="Articles sur les nouvelles technologies..." value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="cat-color">Couleur</Label>
                  <Input id="cat-color" type="color" value={newCategory.color} onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })} className="p-1 h-10"/>
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Ajouter la catégorie
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Catégories actuelles ({categories.length})</h2>
          {isLoading ? <p>Chargement...</p> : (
            categories.map(cat => (
              <CategoryCard key={cat.id} category={cat} onDelete={handleDeleteCategory} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}