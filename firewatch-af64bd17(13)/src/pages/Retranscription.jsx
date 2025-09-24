
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { DailySummary } from "@/api/entities";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


import {
  Mic,
  Square,
  Upload,
  Youtube,
  Radio,
  FileText,
  Settings,
  BrainCircuit,
  Loader2,
  Send,
  Monitor,
  Computer,
  PenSquare,
} from "lucide-react";
import { transcribeAudio } from "@/api/functions/transcribeAudio.js";
import { generateChroniqueSummary } from "@/api/functions";
import { summarizeQuestionPeriod } from "@/api/functions";


const SOURCE_TYPES = {
  LIVE: 'live',
  M3U8: 'm3u8',
  FILE: 'file',
  YOUTUBE: 'youtube'
};

const LIVE_CAPTURE_MODES = {
  MICROPHONE: 'microphone',
  TAB_AUDIO: 'tab_audio',
  SYSTEM_AUDIO: 'system_audio',
};

const FILTERS = {
    CHRONIQUE: 'chronique',
    QUESTIONS: 'questions',
    BRUTE: 'brute'
};

const CHANNELS = [
  { name: '98,5 FM Montréal', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CHMPFM.mp3' },
  { name: 'QUB Radio', url: 'https://video.qub.ca/live/qub-radio-aac/playlist.m3u8' },
  { name: 'ICI Première Montréal', url: 'https://cbcfrequence.akamaized.net/hls/live/2040600/CBF_MONTREAL/master.m3u8' },
  { name: 'Assemblée Nationale', url: 'https://videos.assnat.qc.ca/live/salle-assemblee-nationale/playlist.m3u8' },
];

export default function RetranscriptionPage() {
  // --- États pour la source audio ---
  const [sourceType, setSourceType] = useState(SOURCE_TYPES.FILE);
  const [liveCaptureMode, setLiveCaptureMode] = useState(LIVE_CAPTURE_MODES.MICROPHONE);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const mediaRecorderRef = useRef(null);
  // NOTE: chunksRef est maintenant utilisé pour l'accumulation des données audio en mode LIVE.
  const chunksRef = useRef([]);

  // --- États pour le workflow de traitement ---
  const [rawTranscription, setRawTranscription] = useState('');
  const [editedTranscription, setEditedTranscription] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(FILTERS.CHRONIQUE);
  const [isProcessingGpt, setIsProcessingGpt] = useState(false);
  
  // --- États pour le résultat final ---
  const [processedOutput, setProcessedOutput] = useState('');
  const [dailyTitle, setDailyTitle] = useState('');
  const [isSending, setIsSending] = useState(false);

  // NOUVEAU: Ajout speaker, text, title for editable summary (mainly for speaker and initial load)
  // Ajout de customSpeakerInput pour la saisie libre
  const [editableSummary, setEditableSummary] = useState({ title: '', text: '', speaker: 'Louis Lacroix', customSpeakerInput: '' });

  const { toast } = useToast();
  
  // NOUVEAU: États pour la sauvegarde automatique
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // NOUVEAU : Charger le résumé du jour pour l'édition à l'initialisation
  useEffect(() => {
    const loadDailySummary = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const summaries = await DailySummary.filter({ summary_date: todayStr });
        if (summaries.length > 0) {
          const loadedSpeaker = summaries[0].speaker || '';
          const predefinedSpeakers = ['Jonathan Trudeau', 'Louis Lacroix', 'Philippe Léger'];
          
          let speakerOption = '';
          let customInput = '';

          if (predefinedSpeakers.includes(loadedSpeaker)) {
            speakerOption = loadedSpeaker;
          } else if (loadedSpeaker) {
            speakerOption = 'custom';
            customInput = loadedSpeaker;
          } else {
            speakerOption = 'Louis Lacroix';
          }

          setEditableSummary(prev => ({
            ...prev,
            title: summaries[0].daily_title || '',
            text: summaries[0].summary_text || '',
            speaker: speakerOption,
            customSpeakerInput: customInput
          }));
          // Also set dailyTitle and processedOutput for the card to reflect loaded data
          setDailyTitle(summaries[0].daily_title || '');
          setProcessedOutput(summaries[0].summary_text || '');
        } else {
            setEditableSummary(prev => ({...prev, speaker: 'Louis Lacroix'}));
        }
      } catch(e){ 
          console.error("Erreur lors du chargement du résumé de la chronique:", e);
          setEditableSummary(prev => ({ ...prev, title: '', text: '', speaker: 'Louis Lacroix', customSpeakerInput: '' }));
      }
    };
    loadDailySummary();
  }, []); // Pas de dépendances - exécution une seule fois au montage

  // NOUVEAU: Sauvegarde automatique dans localStorage
  const saveToLocalStorage = useCallback(() => {
    try {
      const saveData = {
        rawTranscription,
        editedTranscription,
        processedOutput,
        dailyTitle,
        editableSummary,
        selectedFilter,
        timestamp: Date.now()
      };
      localStorage.setItem('retranscription_backup', JSON.stringify(saveData));
      setLastSaved(new Date());
      setHasPendingChanges(false);
      console.log('💾 Sauvegarde automatique effectuée');
    } catch (error) {
      console.error('Erreur de sauvegarde locale:', error);
    }
  }, [rawTranscription, editedTranscription, processedOutput, dailyTitle, editableSummary, selectedFilter]);

  // NOUVEAU: Récupération depuis localStorage au chargement
  useEffect(() => {
    try {
      const saved = localStorage.getItem('retranscription_backup');
      if (saved) {
        const saveData = JSON.parse(saved);
        const ageMinutes = (Date.now() - saveData.timestamp) / (1000 * 60);
        
        // Si la sauvegarde a moins de 24h, proposer la récupération
        if (ageMinutes < 1440) {
          const shouldRestore = window.confirm(
            `Une sauvegarde automatique a été trouvée (il y a ${Math.round(ageMinutes)} minutes). Voulez-vous la récupérer ?`
          );
          
          if (shouldRestore) {
            setRawTranscription(saveData.rawTranscription || '');
            setEditedTranscription(saveData.editedTranscription || '');
            setProcessedOutput(saveData.processedOutput || '');
            setDailyTitle(saveData.dailyTitle || '');
            setEditableSummary(saveData.editableSummary || { title: '', text: '', speaker: 'Louis Lacroix', customSpeakerInput: '' });
            setSelectedFilter(saveData.selectedFilter || FILTERS.CHRONIQUE);
            
            toast({ 
              title: "Travail récupéré !", 
              description: "Vos données ont été restaurées depuis la sauvegarde automatique.",
              duration: 5000
            });
          }
        }
      }
    } catch (error) {
      console.error('Erreur de récupération:', error);
    }
  }, [toast]);

  // NOUVEAU: Sauvegarde automatique toutes les 30 secondes si il y a des changements
  useEffect(() => {
    if (hasPendingChanges) {
      const timer = setTimeout(() => {
        saveToLocalStorage();
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000); // Reset isSaving state after 1 sec
      }, 3000); // Sauvegarde 3s après le dernier changement (debounce)

      return () => clearTimeout(timer); // Clear previous timer if changes happen rapidly
    }
  }, [hasPendingChanges, saveToLocalStorage]);

  // NOUVEAU: Marquer comme ayant des changements quand les données changent
  useEffect(() => {
    // Only mark as pending if there's actual content that could be saved
    const hasContent = rawTranscription.trim() || editedTranscription.trim() || processedOutput.trim() || dailyTitle.trim() || editableSummary.customSpeakerInput.trim();
    if (hasContent) {
        setHasPendingChanges(true);
    }
  }, [rawTranscription, editedTranscription, processedOutput, dailyTitle, editableSummary, selectedFilter]);

  // NOUVEAU: Sauvegarde avant fermeture de page
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasPendingChanges) {
        saveToLocalStorage();
        e.preventDefault();
        e.returnValue = 'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter ?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges, saveToLocalStorage]);

  // NOUVEAU: Fonction pour vider la sauvegarde
  const clearLocalBackup = () => {
    localStorage.removeItem('retranscription_backup');
    setLastSaved(null);
    setHasPendingChanges(false);
    toast({ title: "Sauvegarde effacée" });
  };

  const resetWorkflow = () => {
    setRawTranscription('');
    setEditedTranscription('');
    setProcessedOutput('');
    setDailyTitle('');
    // Do not reset editableSummary here, as it may hold pre-loaded speaker info
    // NOUVEAU: Vider aussi la sauvegarde locale
    clearLocalBackup();
  };
  
  const handleTranscriptionSuccess = (transcriptionText) => {
    // We intentionally don't reset editedTranscription here to allow manual input to persist
    // setRawTranscription is still useful to know if a transcription occurred, but editedTranscription is the source for processing
    setRawTranscription(transcriptionText); 
    setEditedTranscription(transcriptionText); // Set edited text to the new transcription
    setProcessedOutput(''); // Clear previous processed output
    setDailyTitle(''); // Clear previous title
    toast({ title: "Transcription réussie", description: "Vous pouvez maintenant modifier le texte et choisir un traitement." });
  };
  
  const handleTranscriptionError = (errorMessage) => {
    toast({ title: "Erreur de transcription", description: errorMessage, variant: "destructive" });
    setIsTranscribing(false); // S'assurer que l'état de chargement est réinitialisé
  };

  const captureAndTranscribe = async () => {
    setIsRecording(true);
    let stream = null;
    try {
      if (liveCaptureMode === LIVE_CAPTURE_MODES.MICROPHONE) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } else {
        toast({ title: "Mode de capture non supporté", description: "Seule la capture microphone est actuellement disponible.", variant: "destructive" });
        setIsRecording(false);
        return;
      }
      
      if (!stream) {
        setIsRecording(false);
        return;
      }

      const mimeTypes = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus", 
        "audio/webm",
        "audio/mp4" // Safari fallback
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || "";
      
      let recordingStream = stream;
      // This block will not be active with current UI (as liveCaptureMode is always MICROPHONE), but kept for logic integrity.
      if (liveCaptureMode !== LIVE_CAPTURE_MODES.MICROPHONE) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          toast({
            title: "Aucune piste audio trouvée",
            description: "Veuillez cocher 'Partager l'audio' dans la popup du navigateur.",
            variant: "destructive",
            duration: 10000
          });
          stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
          return;
        }
        recordingStream = new MediaStream(audioTracks);
      }
      
      mediaRecorderRef.current = new MediaRecorder(recordingStream, supportedMimeType ? { mimeType: supportedMimeType } : undefined);
      
      chunksRef.current = [];
      let transcriptionIntervalRef = null;
      let lastTranscriptionTime = Date.now();
      
      // Fonction pour transcrire l'audio accumulé
      const transcribeAccumulatedAudio = async () => {
        if (chunksRef.current.length === 0) return;
        
        // Créer un blob avec tout l'audio accumulé jusqu'à présent
        const audioBlob = new Blob([...chunksRef.current], { type: supportedMimeType || "audio/webm" });
        
        if (audioBlob.size < 1024) return; // Trop petit pour transcrire
        
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording_${Date.now()}.webm`);
          const { data } = await transcribeAudio(formData);
          
          if (data.success && data.transcription.trim()) {
            // Remplace le texte existant avec la transcription complète
            setEditedTranscription(data.transcription.trim());
            
            // Notification discrète que la transcription fonctionne
            const now = Date.now();
            if (now - lastTranscriptionTime > 60000) { // Une fois par minute max
              toast({ 
                title: "Transcription en cours", 
                description: "Le texte est mis à jour régulièrement.",
                duration: 2000 
              });
              lastTranscriptionTime = now;
            }
          }
        } catch (error) {
          console.error("Erreur de transcription périodique:", error);
          // Ne pas afficher d'erreur pour ne pas spammer l'utilisateur
        }
      };
      
      mediaRecorderRef.current.ondataavailable = e => { 
        if (e.data && e.data.size) chunksRef.current.push(e.data); 
      };
      
      mediaRecorderRef.current.onstop = async () => {
        // Arrêter l'intervalle de transcription
        if (transcriptionIntervalRef) {
          clearInterval(transcriptionIntervalRef);
          transcriptionIntervalRef = null;
        }
        
        stream.getTracks().forEach(track => track.stop());
        if (recordingStream !== stream) {
          recordingStream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);

        const audioBlob = new Blob(chunksRef.current, { type: supportedMimeType || "audio/webm" });
        
        if (audioBlob.size < 1024) {
            handleTranscriptionError("Aucun son n'a été enregistré. Vérifiez que votre microphone est activé et non muet.");
            return;
        }

        toast({ title: "Enregistrement terminé", description: "Transcription finale en cours..." });
        await processAudioBlob(audioBlob);
      };

      // Démarrer l'enregistrement avec des chunks toutes les secondes
      mediaRecorderRef.current.start(1000); // Collecte des données chaque seconde
      
      // Première transcription après 5 secondes pour un feedback très rapide
      setTimeout(transcribeAccumulatedAudio, 5000);
      
      // Deuxième transcription après 15 secondes
      setTimeout(transcribeAccumulatedAudio, 15000);
      
      // Puis lancer la transcription périodique toutes les 20 secondes
      setTimeout(() => {
        transcriptionIntervalRef = setInterval(transcribeAccumulatedAudio, 20000);
      }, 20000);
      
      toast({ 
        title: "Enregistrement démarré", 
        description: "Les premiers mots apparaîtront dans 5 secondes." 
      });

    } catch (error) {
      console.error("Erreur de capture :", error);
      if (error.name === 'NotAllowedError') {
        toast({ title: "Permission refusée", description: "Vous devez autoriser l'accès pour démarrer l'enregistrement.", variant: "destructive" });
      } else {
        toast({ title: "Erreur de capture", description: "Impossible de démarrer l'enregistrement.", variant: "destructive" });
      }
      setIsRecording(false);
    }
  };
    
  const startMicrophoneRecording = () => {
    // Réinitialiser le texte avant de commencer un nouvel enregistrement
    setEditedTranscription('');
    setRawTranscription('');
    setProcessedOutput('');
    setDailyTitle('');
    captureAndTranscribe();
  };

  const stopMicrophoneRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Le toast est maintenant géré dans l'événement onstop
    }
  };
  
  const processAudioBlob = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      // CORRECTIF: Nom de fichier unique avec timestamp
      const timestamp = Date.now();
      formData.append('audio', audioBlob, `recording_${timestamp}.webm`);
      
      const { data } = await transcribeAudio(formData);
      if (data.success) {
        handleTranscriptionSuccess(data.transcription);
      } else {
        handleTranscriptionError(data.error);
      }
    } catch (error) {
      handleTranscriptionError(error.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const { data } = await transcribeAudio(formData);
      if (data.success) {
        handleTranscriptionSuccess(data.transcription);
      } else {
        handleTranscriptionError(data.error);
      }
    } catch (error) {
      handleTranscriptionError(error.message);
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleStreamProcess = async (streamUrlToProcess) => {
    const url = typeof streamUrlToProcess === 'string' ? streamUrlToProcess : streamUrl;
    if (!url.trim()) return;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('stream_url', url);
      const { data } = await transcribeAudio(formData);
      if (data.success) {
        handleTranscriptionSuccess(data.transcription);
      } else {
        handleTranscriptionError(data.error);
      }
    } catch (error) {
      handleTranscriptionError(error.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleProcessText = async () => {
      if (!editedTranscription.trim()) {
        toast({ title: "Aucun texte à traiter", variant: "destructive" });
        return;
      }
      setIsProcessingGpt(true);
      setProcessedOutput('');
      setDailyTitle('');
      console.log(`LOG: Lancement du traitement GPT avec le filtre : ${selectedFilter}`);

      try {
          if (selectedFilter === FILTERS.BRUTE) {
              const formattedBrute = editedTranscription.replace(/\n/g, '<br>');
              setProcessedOutput(formattedBrute);
              setDailyTitle("Transcription brute");
          } else if (selectedFilter === FILTERS.CHRONIQUE) {
              const { data, error } = await generateChroniqueSummary({ text_to_summarize: editedTranscription });
              if (error) throw new Error(error.data?.error || "Erreur du résumé de chronique");
              setDailyTitle(data.daily_title || '');
              
              // Formate le texte brut en HTML pour un affichage correct avec les espacements
              const formattedHtml = (data.summary_points || "")
                .replace(/\n\n/g, '<br><br>') // Espace entre les sujets
                .replace(/\n/g, '<br>');      // Saut de ligne simple
                
              setProcessedOutput(formattedHtml);
          } else if (selectedFilter === FILTERS.QUESTIONS) {
              const { data, error } = await summarizeQuestionPeriod({ transcript: editedTranscription });
              if (error) throw new Error(error.data?.error || "Erreur du résumé de la période de questions");
              setDailyTitle('Résumé de la période de questions');
              setProcessedOutput(data.summary_html || '');
          }
          toast({ title: "Traitement terminé !", description: "Le résultat est prêt à être envoyé." });
      } catch (error) {
          toast({ title: "Erreur de traitement GPT", description: error.message, variant: "destructive" });
          console.error("LOG: Erreur de traitement GPT:", error);
      }
      setIsProcessingGpt(false);
  };
  
  const handleSendToNewsletter = async () => {
    const cleanSummaryText = processedOutput.replace(/<(.|\n)*?>/g, '').trim();
    if (!cleanSummaryText && selectedFilter !== FILTERS.BRUTE) { // Allow sending brute if it's intentionally empty or just whitespace
        toast({ title: "Erreur", description: "Le contenu final est requis pour les résumés.", variant: "destructive" });
        return;
    }

    // Déterminer le nom de l'intervenant à envoyer
    let finalSpeaker = editableSummary.speaker;
    if (editableSummary.speaker === 'custom') {
        finalSpeaker = editableSummary.customSpeakerInput || 'Louis Lacroix'; // Fallback for custom empty input
    } else if (!finalSpeaker) {
        finalSpeaker = 'Louis Lacroix'; // Fallback if no speaker selected
    }


    setIsSending(true);

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const existingSummaries = await DailySummary.filter({ summary_date: todayStr });

        const summaryData = {
            title: "Contenu généré par Retranscription",
            daily_title: dailyTitle, // This title comes from the GPT processing
            summary_text: processedOutput,
            summary_date: todayStr,
            speaker: finalSpeaker // Utilise le nom de l'intervenant final
        };

        if (existingSummaries.length > 0) {
            await DailySummary.update(existingSummaries[0].id, summaryData);
            toast({ title: "Contenu mis à jour !", description: "Le contenu pour le bulletin d'aujourd'hui a été mis à jour." });
        } else {
            await DailySummary.create(summaryData);
            toast({ title: "Contenu sauvegardé !", description: "Sera disponible pour les prochains bulletins." });
        }
        clearLocalBackup(); // Clear local backup after successful send to DB
    } catch (error) {
        toast({ title: "Erreur d'envoi", description: "Impossible de sauvegarder le contenu.", variant: "destructive" });
    }
    setIsSending(false);
  };

  // NOUVEAU: Fonction de sauvegarde manuelle
  const handleManualSave = () => {
    setIsSaving(true);
    saveToLocalStorage();
    setTimeout(() => setIsSaving(false), 1000);
    toast({ 
      title: "Sauvegardé !", 
      description: "Vos données ont été sauvegardées localement.",
      duration: 2000 
    });
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--editorial-light)' }}>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between"> {/* Adjusted for new Save UI */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Retranscription & Traitement</h1>
              <p className="text-slate-600 mt-1">Capturez, éditez et analysez du contenu audio.</p>
            </div>
          </div>

          {/* NOUVEAU: Indicateur de sauvegarde */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {isSaving ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  <span>Sauvegarde...</span>
                </div>
              ) : hasPendingChanges ? (
                <div className="flex items-center gap-2 text-orange-600">
                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                  <span>Non sauvegardé</span>
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span>Sauvegardé {format(lastSaved, 'HH:mm', { locale: fr })}</span>
                </div>
              ) : null}
            </div>
            
            <Button 
              onClick={handleManualSave} 
              variant="outline" 
              size="sm"
              disabled={isSaving}
            >
              💾 Sauvegarder
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 items-start">
          {/* --- Section complète : Capture, Traitement et Résultat --- */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Étape 1 : Source Audio</CardTitle>
                <CardDescription>Choisissez une source audio pour la transcription.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SOURCE_TYPES.FILE}><div className="flex items-center gap-2"><Upload className="w-4 h-4" />Fichier</div></SelectItem>
                    <SelectItem value={SOURCE_TYPES.LIVE}><div className="flex items-center gap-2"><Mic className="w-4 h-4" />Enregistrement Direct</div></SelectItem>
                    <SelectItem value={SOURCE_TYPES.M3U8}><div className="flex items-center gap-2"><Radio className="w-4 h-4" />Flux Radio</div></SelectItem>
                    <SelectItem value={SOURCE_TYPES.YOUTUBE}><div className="flex items-center gap-2"><Youtube className="w-4 h-4" />YouTube</div></SelectItem>
                  </SelectContent>
                </Select>
                
                {/* --- Options de source --- */}
                {sourceType === SOURCE_TYPES.FILE && <Input id="file-upload" type="file" accept="audio/*,video/*" onChange={(e) => handleFileUpload(e.target.files[0])} disabled={isTranscribing || isRecording} />}
                
                {/* NOUVELLE section pour l'enregistrement direct */}
                {sourceType === SOURCE_TYPES.LIVE && (
                  <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <Label className="font-semibold">Source de l'enregistrement direct</Label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded-md border">
                      <Mic className="w-4 h-4 text-blue-600" />
                      <span>Microphone (votre voix)</span>
                    </div>
                    <div>
                      {isRecording ? 
                        <Button onClick={stopMicrophoneRecording} className="w-full bg-red-600 hover:bg-red-700"><Square className="w-4 h-4 mr-2" />Arrêter l'enregistrement</Button> : 
                        <Button onClick={startMicrophoneRecording} disabled={isTranscribing} className="w-full"><Mic className="w-4 h-4 mr-2" />Démarrer l'enregistrement</Button>
                      }
                      <p className="text-xs text-slate-500 mt-3 p-2 bg-slate-50 rounded-md text-center">
                        Idéal pour la dictée vocale. La transcription apparaîtra une fois l'enregistrement terminé.
                      </p>
                    </div>
                  </div>
                )}

                {sourceType === SOURCE_TYPES.M3U8 && (
                    <div className="space-y-2">
                        <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="URL de flux direct..." disabled={isTranscribing || isRecording} />
                        <div className="flex flex-wrap gap-2">
                            {CHANNELS.map(ch => <Button key={ch.name} variant="outline" size="sm" onClick={() => handleStreamProcess(ch.url)} disabled={isTranscribing || isRecording}>{ch.name}</Button>)}
                        </div>
                        <Button onClick={() => handleStreamProcess()} disabled={!streamUrl.trim() || isTranscribing || isRecording} className="w-full"><Radio className="w-4 h-4 mr-2" />Transcrire le flux</Button>
                    </div>
                )}
                 {sourceType === SOURCE_TYPES.YOUTUBE && <div className="text-sm p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">Fonctionnalité YouTube en maintenance.</div>}
                
                {isTranscribing && <div className="flex items-center justify-center text-sm text-gray-600"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transcription en cours...</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Étape 2 : Édition & Traitement</CardTitle>
                <CardDescription>Saisissez ou modifiez le texte, puis choisissez un type de traitement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Texte à traiter (sauvegarde automatique activée)</Label>
                  <Textarea 
                    value={editedTranscription} 
                    onChange={(e) => setEditedTranscription(e.target.value)} 
                    rows={12} 
                    className="text-base" 
                    placeholder="Saisissez votre texte ici ou utilisez une source audio ci-dessus pour le remplir automatiquement..."
                  />
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>{editedTranscription.length} caractères</span>
                    <span>💾 Sauvegarde automatique active (3s après chaque modification)</span>
                  </div>
                </div>
                <div>
                  <Label>Type de traitement GPT</Label>
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FILTERS.CHRONIQUE}>Résumé de la chronique politique</SelectItem>
                      <SelectItem value={FILTERS.QUESTIONS}>Résumé de la période de questions</SelectItem>
                      <SelectItem value={FILTERS.BRUTE}>Transcription brute (aucun traitement)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleProcessText} disabled={isProcessingGpt || !editedTranscription.trim()} className="w-full">
                  {isProcessingGpt ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                  Traiter le texte
                </Button>
              </CardContent>
            </Card>

            {/* --- Boîte d'édition de la chronique (toujours visible) --- */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenSquare className="w-5 h-5 text-amber-600" />
                  Éditer le résumé de la chronique
                </CardTitle>
                <CardDescription>Modifiez le résultat traité avant de l'envoyer au bulletin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isProcessingGpt ? (
                   <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                      <p className="text-gray-600 font-medium">Traitement en cours...</p>
                      <p className="text-gray-500 text-sm">Génération du résumé par l'IA</p>
                   </div>
                ) : (
                  <>
                     <div>
                       <Label htmlFor="chronique-title">Titre de la chronique</Label>
                       <Input 
                         id="chronique-title"
                         value={dailyTitle}
                         onChange={(e) => setDailyTitle(e.target.value)}
                         placeholder="Titre de la chronique..."
                       />
                     </div>
                     <div>
                       <Label htmlFor="chronique-speaker">Intervenant</Label>
                       <Select 
                         value={editableSummary.speaker} 
                         onValueChange={(value) => {
                           if (value === 'custom') {
                             setEditableSummary(prev => ({...prev, speaker: value, customSpeakerInput: ''}));
                           } else {
                             setEditableSummary(prev => ({...prev, speaker: value}));
                           }
                         }}
                       >
                         <SelectTrigger>
                           <SelectValue placeholder="Sélectionner l'intervenant..." />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Jonathan Trudeau">Jonathan Trudeau</SelectItem>
                           <SelectItem value="Louis Lacroix">Louis Lacroix</SelectItem>
                           <SelectItem value="Philippe Léger">Philippe Léger</SelectItem>
                           <SelectItem value="custom">Autre (saisie libre)</SelectItem>
                         </SelectContent>
                       </Select>
                       {editableSummary.speaker === 'custom' && (
                         <Input 
                           placeholder="Nom de l'intervenant..."
                           value={editableSummary.customSpeakerInput}
                           onChange={(e) => setEditableSummary(prev => ({...prev, customSpeakerInput: e.target.value}))}
                           className="mt-2"
                         />
                       )}
                     </div>
                     <div>
                       <Label>Contenu du résumé</Label>
                        <ReactQuill 
                          theme="snow" 
                          value={processedOutput} 
                          onChange={setProcessedOutput}
                          className="bg-white mt-1" 
                          placeholder="Le contenu apparaîtra ici une fois le texte traité..."
                        />
                     </div>
                     <Button onClick={handleSendToNewsletter} disabled={isSending || !processedOutput.replace(/<(.|\n)*?>/g, '').trim()} className="w-full bg-green-600 hover:bg-green-700">
                       {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                       Envoyer vers le bulletin
                     </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
