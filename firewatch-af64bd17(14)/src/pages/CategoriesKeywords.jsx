
import React, { useState, useEffect, useCallback } from "react";
import { Category, Keyword } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag, Key, Edit3, Save, X, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getMailchimpAudiences } from "@/api/functions";

function CategoryAccordionCard({ category, keywords, audiences, onEdit, onDelete, onAddKeyword, onDeleteKeyword, onUpdateKeyword }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [editingKeywordId, setEditingKeywordId] = useState(null);
  const [newKeyword, setNewKeyword] = useState({ word: "", weight: 5, description: "" });
  const [editFormData, setEditFormData] = useState({ word: "", weight: 5, description: "" });

  const categoryKeywords = keywords.filter(k => k.category_id === category.id);
  const audience = audiences.find(a => a.id === category.mailchimp_audience_id);

  const handleAddKeyword = async () => {
    if (!newKeyword.word.trim()) return;
    await onAddKeyword(category.id, newKeyword);
    setNewKeyword({ word: "", weight: 5, description: "" });
    setShowAddKeyword(false);
  };

  const startEditingKeyword = (keyword) => {
    setEditingKeywordId(keyword.id);
    setEditFormData({
      word: keyword.word,
      weight: keyword.weight,
      description: keyword.description || ""
    });
  };

  const cancelEditingKeyword = () => {
    setEditingKeywordId(null);
    setEditFormData({ word: "", weight: 5, description: "" });
  };

  const saveEditedKeyword = async () => {
    if (!editFormData.word.trim()) return;
    await onUpdateKeyword(editingKeywordId, editFormData);
    cancelEditingKeyword();
  };

  const getScoreColor = (weight) => {
    switch(weight) {
      case 5: return "bg-red-100 text-red-800 border-red-300";
      case 4: return "bg-orange-100 text-orange-800 border-orange-300";
      case 3: return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case 2: return "bg-blue-100 text-blue-800 border-blue-300";
      case 1: return "bg-gray-100 text-gray-800 border-gray-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getScoreLabel = (weight) => {
    switch(weight) {
      case 5: return "Critique";
      case 4: return "Très important";
      case 3: return "Important";
      case 2: return "Modéré";
      case 1: return "Faible";
      default: return "Non défini";
    }
  };

  // Alerte spéciale pour Saguenay-Lac-St-Jean
  const isSaguenayCategory = category.name === 'Saguenay-Lac-St-Jean';

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: category.color || '#e2e8f0' }}
            >
              <Tag className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{category.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {categoryKeywords.length} mot{categoryKeywords.length > 1 ? 's' : ''}-clé{categoryKeywords.length > 1 ? 's' : ''}
                </Badge>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
              <p className="text-sm text-slate-500">{category.description}</p>
              {audience && (
                <Badge variant="outline" className="text-xs mt-1">
                  📧 {audience.name} ({audience.member_count} abonnés)
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(category); }}>
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(category.id); }}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>

        {/* Alerte pour Saguenay-Lac-St-Jean */}
        {isSaguenayCategory && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-orange-600">⚠️</span>
              <div className="text-sm">
                <p className="font-medium text-orange-800">Attention aux faux positifs</p>
                <p className="text-orange-700">Cette catégorie capture automatiquement tous les articles du Quotidien. Vérifiez que les mots-clés sont spécifiques pour éviter la sur-catégorisation.</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Key className="w-4 h-4" />
              Mots-clés configurés
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                  setShowAddKeyword(!showAddKeyword);
                  if (editingKeywordId) cancelEditingKeyword();
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Ajouter
            </Button>
          </div>

          {showAddKeyword && (
            <div className="bg-slate-50 p-3 rounded-lg space-y-3">
              <Input
                placeholder="Mot-clé ou expression..."
                value={newKeyword.word}
                onChange={(e) => setNewKeyword({...newKeyword, word: e.target.value})}
              />
              <div className="flex gap-2">
                <Select
                  value={newKeyword.weight.toString()}
                  onValueChange={(value) => setNewKeyword({...newKeyword, weight: parseInt(value)})}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 - Critique</SelectItem>
                    <SelectItem value="4">4 - Très important</SelectItem>
                    <SelectItem value="3">3 - Important</SelectItem>
                    <SelectItem value="2">2 - Modéré</SelectItem>
                    <SelectItem value="1">1 - Faible</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Description (optionnel)"
                  value={newKeyword.description}
                  onChange={(e) => setNewKeyword({...newKeyword, description: e.target.value})}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddKeyword} disabled={!newKeyword.word.trim()}>
                  <Save className="w-3 h-3 mr-1" />
                  Sauvegarder
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddKeyword(false)}>
                  <X className="w-3 h-3 mr-1" />
                  Annuler
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categoryKeywords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm italic">Aucun mot-clé configuré</p>
                <p className="text-xs text-gray-400 mt-1">Cliquez sur "Ajouter" pour créer votre premier mot-clé</p>
              </div>
            ) : (
              categoryKeywords.map(keyword => (
                <div key={keyword.id} className="p-2 bg-white rounded border">
                  {editingKeywordId === keyword.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editFormData.word}
                        onChange={(e) => setEditFormData({...editFormData, word: e.target.value})}
                        className="font-medium"
                      />
                      <div className="flex gap-2">
                        <Select
                          value={editFormData.weight.toString()}
                          onValueChange={(value) => setEditFormData({...editFormData, weight: parseInt(value)})}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 - Critique</SelectItem>
                            <SelectItem value="4">4 - Très important</SelectItem>
                            <SelectItem value="3">3 - Important</SelectItem>
                            <SelectItem value="2">2 - Modéré</SelectItem>
                            <SelectItem value="1">1 - Faible</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={editFormData.description}
                          onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                          placeholder="Description (optionnel)"
                          className="flex-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveEditedKeyword}
                          disabled={!editFormData.word.trim()}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          Sauvegarder
                        </Button>
                        <Button variant="outline" size="sm" onClick={cancelEditingKeyword}>
                          <X className="w-3 h-3 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{keyword.word}</span>
                        <Badge className={`text-xs ${getScoreColor(keyword.weight)}`}>
                          {keyword.weight} - {getScoreLabel(keyword.weight)}
                        </Badge>
                        {keyword.description && (
                          <span className="text-xs text-gray-500">&bull;&nbsp;{keyword.description}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                              startEditingKeyword(keyword);
                              setShowAddKeyword(false);
                          }}
                        >
                          <Edit3 className="w-3 h-3 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onDeleteKeyword(keyword.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {categoryKeywords.length > 0 && (
            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
              💡 <strong>Catégorisation automatique :</strong> Score 4-5 = catégorisation automatique | Score 1-3 = influence la catégorisation
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function CategoryModal({ category, isOpen, onClose, onSave, audiences }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    mailchimp_audience_id: "",
    alert_email: "",
    alert_teams_webhook: ""
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        description: category.description || "",
        color: category.color || "#3b82f6",
        mailchimp_audience_id: category.mailchimp_audience_id || "",
        alert_email: category.alert_email || "",
        alert_teams_webhook: category.alert_teams_webhook || ""
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "#3b82f6",
        mailchimp_audience_id: "",
        alert_email: "",
        alert_teams_webhook: ""
      });
    }
  }, [category]);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nom de la catégorie *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Politique"
              />
            </div>
            <div>
              <Label>Couleur</Label>
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="w-full h-10 p-1"
              />
            </div>
          </div>
          
          <div>
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Description de la catégorie"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Intégrations & Alertes</h3>
            <div className="space-y-4">
              <div>
                <Label>Audience Mailchimp</Label>
                <Select value={formData.mailchimp_audience_id} onValueChange={(value) => setFormData({...formData, mailchimp_audience_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une audience..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Aucune</SelectItem>
                    {audiences.map(audience => (
                      <SelectItem key={audience.id} value={audience.id}>
                        {audience.name} ({audience.member_count} abonnés)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Alerte par E-mail</Label>
                <Input
                  type="email"
                  value={formData.alert_email}
                  onChange={(e) => setFormData({...formData, alert_email: e.target.value})}
                  placeholder="nom@exemple.com"
                />
                 <p className="text-xs text-gray-500 mt-1">Notifier cette adresse dès qu'un article est classé dans cette catégorie.</p>
              </div>
              <div>
                <Label>Alerte Microsoft Teams</Label>
                <Input
                  value={formData.alert_teams_webhook}
                  onChange={(e) => setFormData({...formData, alert_teams_webhook: e.target.value})}
                  placeholder="URL du webhook entrant de votre canal Teams"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={!formData.name.trim()}>
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CategoriesKeywordsPage() {
  const [categories, setCategories] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [categoryData, keywordData, audienceData] = await Promise.all([
        Category.list(),
        Keyword.list(),
        getMailchimpAudiences().then(res => res.data).catch(() => [])
      ]);
      setCategories(categoryData);
      setKeywords(keywordData);
      setAudiences(audienceData);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveCategory = async (formData) => {
    try {
      if (editingCategory) {
        await Category.update(editingCategory.id, formData);
        toast({ title: "Catégorie modifiée", description: "La catégorie a été mise à jour." });
      } else {
        await Category.create(formData);
        toast({ title: "Catégorie créée", description: "La nouvelle catégorie a été créée." });
      }
      setEditingCategory(null);
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder la catégorie.", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette catégorie et tous ses mots-clés ?")) {
      try {
        // Supprimer tous les mots-clés de cette catégorie
        const categoryKeywords = keywords.filter(k => k.category_id === id);
        for (const keyword of categoryKeywords) {
          await Keyword.delete(keyword.id);
        }

        // Supprimer la catégorie
        await Category.delete(id);
        toast({ title: "Catégorie supprimée", description: "La catégorie et ses mots-clés ont été supprimés." });
        loadData();
      } catch (error) {
        toast({ title: "Erreur", description: "Impossible de supprimer la catégorie.", variant: "destructive" });
      }
    }
  };

  const handleAddKeyword = async (categoryId, keywordData) => {
    try {
      await Keyword.create({
        ...keywordData,
        category_id: categoryId
      });
      toast({ title: "Mot-clé ajouté", description: "Le nouveau mot-clé a été ajouté." });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le mot-clé.", variant: "destructive" });
    }
  };

  const handleDeleteKeyword = async (keywordId) => {
    try {
      await Keyword.delete(keywordId);
      toast({ title: "Mot-clé supprimé", description: "Le mot-clé a été supprimé." });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le mot-clé.", variant: "destructive" });
    }
  };

  const handleUpdateKeyword = async (keywordId, keywordData) => {
    try {
      await Keyword.update(keywordId, keywordData);
      toast({ title: "Mot-clé modifié", description: "Le mot-clé a été mis à jour." });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de modifier le mot-clé.", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Catégories et Mots-clés</h1>
            <p className="text-gray-600">Gestion intégrée avec catégorisation automatique</p>
          </div>
        </div>
        <Button onClick={() => { setEditingCategory(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Tag className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{categories.length}</p>
                <p className="text-sm text-gray-600">Catégories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Key className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{keywords.length}</p>
                <p className="text-sm text-gray-600">Mots-clés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">📧</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{audiences.length}</p>
                <p className="text-sm text-gray-600">Audiences Mailchimp</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des catégories avec accordéon */}
      <div className="space-y-4">
        {isLoading ? (
          <p>Chargement...</p>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucune catégorie configurée</h3>
              <p className="text-gray-500 mb-4">Créez votre première catégorie pour commencer la catégorisation automatique.</p>
              <Button onClick={() => { setEditingCategory(null); setShowModal(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Créer une catégorie
              </Button>
            </CardContent>
          </Card>
        ) : (
          categories.map(category => (
            <CategoryAccordionCard
              key={category.id}
              category={category}
              keywords={keywords}
              audiences={audiences}
              onEdit={(cat) => { setEditingCategory(cat); setShowModal(true); }}
              onDelete={handleDeleteCategory}
              onAddKeyword={handleAddKeyword}
              onDeleteKeyword={handleDeleteKeyword}
              onUpdateKeyword={handleUpdateKeyword}
            />
          ))
        )}
      </div>

      <CategoryModal
        category={editingCategory}
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingCategory(null); }}
        onSave={handleSaveCategory}
        audiences={audiences}
      />

      <Toaster />
    </div>
  );
}
