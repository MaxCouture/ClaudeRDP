
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Upload, Trash2, CheckCircle, Edit, Save, X, Loader2 } from "lucide-react";
import { UploadFile } from "@/api/integrations";
import { useToast } from "@/components/ui/use-toast";

const PARTY_COLORS = {
  // Québec
  'CAQ': 'bg-blue-100 text-blue-800',
  'PLQ': 'bg-red-100 text-red-800',
  'QS': 'bg-orange-100 text-orange-800',
  'PQ': 'bg-cyan-100 text-cyan-800',
  'IND': 'bg-gray-100 text-gray-800',
  'VACANT': 'bg-slate-100 text-slate-600',
  // Fédéral (Ottawa)
  'PLC': 'bg-red-100 text-red-800',
  'PCC': 'bg-blue-900 text-white',
  'BQ': 'bg-cyan-100 text-cyan-800',
  'NPD': 'bg-orange-100 text-orange-800',
  'PV': 'bg-green-100 text-green-800'
};

const PARTIES = [
  // Québec
  { value: 'CAQ', label: 'Coalition avenir Québec' },
  { value: 'PLQ', label: 'Parti libéral du Québec' },
  { value: 'QS', label: 'Québec solidaire' },
  { value: 'PQ', label: 'Parti québécois' },
  { value: 'IND', label: 'Indépendant' },
  { value: 'VACANT', label: 'Vacant' },
  // Fédéral (Ottawa)
  { value: 'PLC', label: 'Parti libéral du Canada' },
  { value: 'PCC', label: 'Parti conservateur du Canada' },
  { value: 'BQ', label: 'Bloc Québécois' },
  { value: 'NPD', label: 'Nouveau Parti démocratique' },
  { value: 'PV', label: 'Parti vert du Canada' }
];

// Helper pour retry avec exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isTooManyConnections = 
        error.message?.includes('too_many_connections') || 
        error.message?.includes('429') ||
        error.response?.status === 429;
      
      if (!isTooManyConnections || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`LOG: ⏳ Retry ${attempt + 1}/${maxRetries} après ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export default function DeputeCard({ depute, onUpdate }) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedData, setEditedData] = React.useState({
    nomComplet: depute.nomComplet,
    circonscription: depute.circonscription,
    allegeanceAbrege: depute.allegeanceAbrege,
    fonction: depute.fonction || ''
  });
  const { toast } = useToast();

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ 
        title: "Erreur", 
        description: "Le fichier doit être une image (JPG, PNG, WebP).", 
        variant: "destructive" 
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ 
        title: "Erreur", 
        description: "L'image ne doit pas dépasser 2 MB.", 
        variant: "destructive" 
      });
      return;
    }

    setIsUploading(true);
    
    try {
      console.log(`LOG: 📤 Upload de la photo pour ${depute.nomComplet}...`);
      
      // Upload avec retry automatique en cas de rate limiting
      const { file_url } = await retryWithBackoff(
        async () => await UploadFile({ file: file }),
        3, // 3 tentatives max
        1000 // Délai initial de 1s
      );
      
      console.log(`LOG: ✅ Photo uploadée: ${file_url}`);
      
      // Mise à jour avec retry également
      await retryWithBackoff(
        async () => await onUpdate(depute.id, { photoUrl: file_url }),
        3,
        1000
      );
      
      toast({ 
        title: "✅ Photo mise à jour", 
        description: `Photo de ${depute.nomComplet} enregistrée.`,
        duration: 3000
      });
      
    } catch (error) {
      console.error('LOG: ❌ Erreur upload:', error);
      
      const errorMessage = error.message?.includes('too_many_connections') || error.message?.includes('429')
        ? "Trop d'uploads simultanés. Veuillez patienter quelques secondes et réessayer."
        : error.message || "Une erreur est survenue lors de l'upload.";
      
      toast({ 
        title: "❌ Erreur d'upload", 
        description: errorMessage, 
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsUploading(false);
      // Reset le input file pour permettre de réuploader le même fichier
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm(`Supprimer la photo de ${depute.nomComplet} ?`)) return;
    
    try {
      await retryWithBackoff(
        async () => await onUpdate(depute.id, { photoUrl: null }),
        3,
        1000
      );
      toast({ title: "Photo supprimée" });
    } catch (error) {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      const selectedParty = PARTIES.find(p => p.value === editedData.allegeanceAbrege);
      
      await retryWithBackoff(
        async () => await onUpdate(depute.id, {
          nomComplet: editedData.nomComplet,
          circonscription: editedData.circonscription,
          allegeanceAbrege: editedData.allegeanceAbrege,
          allegeance: selectedParty?.label || editedData.allegeanceAbrege,
          fonction: editedData.fonction
        }),
        3,
        1000
      );
      
      setIsEditing(false);
      toast({ title: "Informations mises à jour" });
    } catch (error) {
      toast({ 
        title: "Erreur de mise à jour", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const handleCancelEdit = () => {
    setEditedData({
      nomComplet: depute.nomComplet,
      circonscription: depute.circonscription,
      allegeanceAbrege: depute.allegeanceAbrege,
      fonction: depute.fonction || ''
    });
    setIsEditing(false);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="relative w-20 h-20 flex-shrink-0">
            {isUploading ? (
              <div className="w-20 h-20 rounded-lg bg-blue-50 flex items-center justify-center border-2 border-blue-200">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : depute.photoUrl ? (
              <img 
                src={depute.photoUrl} 
                alt={depute.nomComplet}
                className="w-20 h-20 rounded-lg object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}
            {depute.photoUrl && !isUploading && (
              <div className="absolute -top-1 -right-1">
                <CheckCircle className="w-5 h-5 text-green-500 bg-white rounded-full" />
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editedData.nomComplet}
                  onChange={(e) => setEditedData({...editedData, nomComplet: e.target.value})}
                  placeholder="Nom complet"
                  className="font-semibold"
                />
                <Input
                  value={editedData.circonscription}
                  onChange={(e) => setEditedData({...editedData, circonscription: e.target.value})}
                  placeholder="Circonscription"
                  className="text-sm"
                />
                <Input
                  value={editedData.fonction}
                  onChange={(e) => setEditedData({...editedData, fonction: e.target.value})}
                  placeholder="Fonction (ex: Ministre de la Santé)"
                  className="text-sm"
                />
                <Select 
                  value={editedData.allegeanceAbrege} 
                  onValueChange={(value) => setEditedData({...editedData, allegeanceAbrege: value})}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTIES.map(party => (
                      <SelectItem key={party.value} value={party.value}>
                        {party.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-lg truncate">{depute.nomComplet}</h3>
                <p className="text-sm text-gray-600 truncate">{depute.circonscription}</p>
                {depute.fonction && (
                  <p className="text-sm text-purple-700 font-medium truncate mt-1">
                    {depute.fonction}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Badge className={PARTY_COLORS[depute.allegeanceAbrege] || 'bg-gray-100'}>
                    {depute.allegeanceAbrege}
                  </Badge>
                  {depute.statut !== 'En fonction' && (
                    <Badge variant="outline">{depute.statut}</Badge>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleSaveEdit}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Sauvegarder
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancelEdit}
                >
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Modifier
                </Button>
                <label htmlFor={`photo-${depute.id}`}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isUploading}
                    asChild
                  >
                    <span className="cursor-pointer">
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      {isUploading ? 'Upload...' : 'Photo'}
                    </span>
                  </Button>
                </label>
                <Input
                  id={`photo-${depute.id}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                
                {depute.photoUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRemovePhoto}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={isUploading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
