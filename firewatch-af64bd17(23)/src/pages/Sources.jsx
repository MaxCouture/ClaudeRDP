
import React, { useState, useEffect } from "react";
import { Source } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Rss, Globe, Search, Edit, ExternalLink, ListChecks } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const CATEGORIES = [
  "Presse", "Politique", "Économie", "Environnement", "Sport", "Culture",
  "Régional", "International", "Société", "Technologie", "Communauté",
  "Social", "Podcast", "Vidéo", "Agrégateur", "Diplomatique"
];

function SourceCard({ source, onEdit, onDelete }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais';
    try {
      return new Date(dateString).toLocaleDateString('fr-CA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Date invalide';
    }
  };

  const categoryColors = {
    "Presse": "bg-blue-100 text-blue-800",
    "Politique": "bg-red-100 text-red-800",
    "Économie": "bg-green-100 text-green-800",
    "Environnement": "bg-emerald-100 text-emerald-800",
    "Sport": "bg-orange-100 text-orange-800",
    "Culture": "bg-purple-100 text-purple-800",
    "Régional": "bg-indigo-100 text-indigo-800",
    "International": "bg-gray-100 text-gray-800",
    "Société": "bg-yellow-100 text-yellow-800",
    "Technologie": "bg-cyan-100 text-cyan-800",
    "Communauté": "bg-pink-100 text-pink-800",
    "Social": "bg-teal-100 text-teal-800",
    "Podcast": "bg-violet-100 text-violet-800",
    "Vidéo": "bg-rose-100 text-rose-800",
    "Agrégateur": "bg-slate-100 text-slate-800",
    "Diplomatique": "bg-amber-100 text-amber-800"
  };

  const getIcon = () => {
    switch(source.type) {
      case 'RSS':
        return <Rss className="w-6 h-6 text-orange-500 mt-1 flex-shrink-0" />;
      case 'HTML_LIST':
        return <ListChecks className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />;
      default:
        return <Globe className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Icône et informations principales */}
          <div className="flex items-start gap-3 flex-1">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-lg truncate">{source.name}</h3>
                {source.category && (
                  <Badge className={`${categoryColors[source.category]} text-xs`}>
                    {source.category}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {source.url}
                </a>
              </div>

              {/* Statistiques */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="font-medium text-gray-700">Articles</div>
                  <div className="text-blue-600 font-bold">{source.articles_count || 0}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="font-medium text-gray-700">Dernière vérif</div>
                  <div className="text-gray-600">{formatDate(source.last_checked)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(source)}
              className="hover:bg-blue-50"
            >
              <Edit className="w-4 h-4 mr-1" />
              Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(source.id)}
              className="hover:bg-red-50 text-red-600 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceModal({ source, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "RSS",
    category: ""
  });

  useEffect(() => {
    if (source) {
      setFormData({
        name: source.name || "",
        url: source.url || "",
        type: source.type || "RSS",
        category: source.category || ""
      });
    } else {
      setFormData({
        name: "",
        url: "",
        type: "RSS",
        category: ""
      });
    }
  }, [source, isOpen]);

  const handleSave = () => {
    if (!formData.name.trim() || !formData.url.trim()) return;
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {source ? 'Modifier la source' : 'Ajouter une source'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: La Presse"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL *</label>
            <Input
              value={formData.url}
              onChange={(e) => setFormData({...formData, url: e.target.value})}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RSS">Flux RSS</SelectItem>
                <SelectItem value="HTML_LIST">Scraper de liste HTML</SelectItem>
                <SelectItem value="Website">Site Web (non-supporté)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Catégorie</label>
            <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.name.trim() || !formData.url.trim()}
          >
            {source ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const { toast } = useToast();

  const loadSources = async () => {
    setIsLoading(true);
    const data = await Source.list();
    setSources(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleSaveSource = async (formData) => {
    try {
      if (editingSource) {
        await Source.update(editingSource.id, formData);
        toast({ title: "Source modifiée", description: "La source a été mise à jour avec succès." });
      } else {
        await Source.create({
          ...formData,
          status: 'active',
          articles_count: 0
        });
        toast({ title: "Source ajoutée", description: "La nouvelle source a été créée avec succès." });
      }
      setEditingSource(null);
      loadSources();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la source.",
        variant: "destructive"
      });
    }
  };

  const handleEditSource = (source) => {
    setEditingSource(source);
    setShowModal(true);
  };

  const handleDeleteSource = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette source ?")) {
      try {
        await Source.delete(id);
        toast({ title: "Source supprimée", description: "La source a été supprimée avec succès." });
        loadSources();
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer la source.",
          variant: "destructive"
        });
      }
    }
  };

  // Filtrage
  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Tous" || source.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = sources.filter(s => s.category === cat).length;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sources d'information</h1>
          <p className="text-gray-600 mt-1">{sources.length} source{sources.length > 1 ? 's' : ''} configurée{sources.length > 1 ? 's' : ''}</p>
        </div>
        <Button
          onClick={() => { setEditingSource(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une source
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher une source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tous">Toutes les catégories</SelectItem>
                {CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>
                    {category} ({categoryCounts[category] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Liste des sources */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            {filteredSources.length} source{filteredSources.length > 1 ? 's' : ''} trouvée{filteredSources.length > 1 ? 's' : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Chargement des sources...</p>
          </div>
        ) : filteredSources.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Rss className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune source trouvée</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || selectedCategory !== "Tous"
                  ? "Essayez de modifier vos critères de recherche."
                  : "Commencez par ajouter votre première source d'information."
                }
              </p>
              {!searchTerm && selectedCategory === "Tous" && (
                <Button onClick={() => { setEditingSource(null); setShowModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter une source
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSources.map(source => (
              <SourceCard
                key={source.id}
                source={source}
                onEdit={handleEditSource}
                onDelete={handleDeleteSource}
              />
            ))}
          </div>
        )}
      </div>

      <SourceModal
        source={editingSource}
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingSource(null); }}
        onSave={handleSaveSource}
      />

      <Toaster />
    </div>
  );
}
