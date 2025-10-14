
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileArchive, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { processDeputePhotosZip } from "@/api/functions";

export default function UploadDeputePhotosPage() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const { toast } = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.zip')) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner un fichier .zip",
          variant: "destructive"
        });
        return;
      }
      setFile(selectedFile);
      setResults(null);
      setProgress(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.zip')) {
      setFile(droppedFile);
      setResults(null);
      setProgress(null);
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez déposer un fichier .zip",
        variant: "destructive"
      });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Aucun fichier",
        description: "Veuillez sélectionner un fichier .zip",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: 0, currentDepute: "Démarrage..." });
    setResults(null);

    try {
      toast({
        title: "🚀 Traitement démarré",
        description: "Décompression et upload en cours...",
      });

      const { data, error } = await processDeputePhotosZip({ zipFile: file });

      if (error) {
        throw new Error(error.message || "Erreur lors du traitement du fichier");
      }

      setResults(data);
      
      const successCount = data.results?.filter(r => r.status === 'success').length || 0;
      const totalCount = data.results?.length || 0;

      toast({
        title: "✅ Traitement terminé",
        description: `${successCount}/${totalCount} photos mises à jour avec succès`,
      });

    } catch (error) {
      console.error("Erreur d'upload:", error);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de traiter le fichier",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'not_found':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'not_found':
        return 'bg-orange-50 border-orange-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload des photos des députés (Ottawa)</h1>
        <p className="text-gray-600 mt-1">Téléversez un fichier .zip contenant les 344 photos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Format attendu des fichiers</CardTitle>
          <CardDescription>
            Les noms de fichiers doivent suivre le format : <code className="bg-gray-100 px-2 py-1 rounded">NomDeFamille_Prenom_(Circonscription)_Parti.jpg</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Exemples valides :</h3>
            <ul className="text-sm text-blue-800 space-y-1 font-mono">
              <li>✅ MacDonald_Heath_(Malpeque)_Liberal.jpg</li>
              <li>✅ Trudeau_Justin_(Papineau)_Liberal.jpg</li>
              <li>✅ Poilievre_Pierre_(Carleton)_Conservative.jpg</li>
            </ul>
            <p className="text-xs text-blue-700 mt-3">
              💡 Seuls les deux premiers segments (Nom et Prénom) sont utilisés pour le matching
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sélectionner le fichier .zip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('fileInput').click()}
          >
            {file ? (
              <div className="space-y-3">
                <FileArchive className="w-16 h-16 text-blue-600 mx-auto" />
                <div>
                  <p className="font-semibold text-lg">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setResults(null);
                  }}
                >
                  Changer de fichier
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                <div>
                  <p className="font-semibold text-lg">Glissez votre fichier .zip ici</p>
                  <p className="text-sm text-gray-600">ou cliquez pour sélectionner</p>
                </div>
              </div>
            )}
            <input
              id="fileInput"
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Traiter et uploader les photos
              </>
            )}
          </Button>

          {progress && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">
                    {progress.current > 0 ? `${progress.current}/${progress.total} photos traitées` : "Décompression..."}
                  </p>
                  <p className="text-sm text-blue-700">{progress.currentDepute}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Résultats du traitement</span>
              <div className="flex gap-4 text-sm font-normal">
                <span className="text-green-600">
                  ✅ {results.results?.filter(r => r.status === 'success').length || 0} succès
                </span>
                <span className="text-orange-600">
                  ⚠️ {results.results?.filter(r => r.status === 'not_found').length || 0} non trouvés
                </span>
                <span className="text-red-600">
                  ❌ {results.results?.filter(r => r.status === 'error').length || 0} erreurs
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {results.results?.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border flex items-center justify-between ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.fileName}</p>
                      {result.matchedDepute && (
                        <p className="text-sm text-gray-600">
                          → {result.matchedDepute}
                        </p>
                      )}
                      {result.error && (
                        <p className="text-sm text-red-600">{result.error}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-semibold uppercase px-2 py-1 rounded">
                    {result.status === 'success' && '✅ OK'}
                    {result.status === 'not_found' && '⚠️ Non trouvé'}
                    {result.status === 'error' && '❌ Erreur'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}
