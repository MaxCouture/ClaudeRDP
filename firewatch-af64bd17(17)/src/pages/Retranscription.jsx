
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
import { Depute } from "@/api/entities";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PdQContentEditor from "../components/retranscription/PdQContentEditor";


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
  User,
  Clock, // NEW import for Clock icon
  AlertCircle, // NEW import for AlertCircle icon
} from "lucide-react";
import { transcribeAudio } from "@/api/functions/transcribeAudio.js";
import { generateChroniqueSummary } from "@/api/functions";
// Removed: import { summarizeQuestionPeriod } from "@/api/functions";
// Will use dynamic imports for summarizeQuestionPeriod and summarizeQuestionPeriodOttawa

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
    QUESTIONS_QUEBEC: 'questions_quebec', // Renamed from QUESTIONS
    QUESTIONS_OTTAWA: 'questions_ottawa', // NEW
    BRUTE: 'brute'
};

const CHANNELS = [
  { name: '98,5 FM Montréal', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CHMPFM.mp3' },
  { name: 'QUB Radio', url: 'https://video.qub.ca/live/qub-radio-aac/playlist.m3u8' },
  { name: 'ICI Première Montréal', url: 'https://cbcfrequence.akamaized.net/hls/live/2040600/CBF_MONTREAL/master.m3u8' },
  { name: 'Assemblée Nationale', url: 'https://videos.assnat.qc.ca/live/salle-assemblee-nationale/playlist.m3u8' },
];

// NOUVEAU: Constantes pour la gestion de l'enregistrement longue durée
const MAX_RECORDING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 heures max
const TRANSCRIPTION_INTERVAL_MS = 30000; // 30 secondes entre chaque transcription
const FIRST_TRANSCRIPTION_DELAY_MS = 5000; // Première transcription après 5 secondes
const KEEP_ALIVE_INTERVAL_MS = 60000; // Keep-alive toutes les 60 secondes

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

  // NOUVEAU : États pour la gestion des intervenants PdQ
  const [deputes, setDeputes] = useState([]);
  const [detectedSpeakers, setDetectedSpeakers] = useState([]);

  // NOUVEAU: 3 points du jour
  const [summaryPoints, setSummaryPoints] = useState(['', '', '']);

  const { toast } = useToast();
  
  // NOUVEAU: États pour la sauvegarde automatique
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // NOUVEAU: États pour le monitoring de l'enregistrement longue durée
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [audioQualityIndicator, setAudioQualityIndicator] = useState('good'); // good, warning, error
  const recordingTimerRef = useRef(null);
  const transcriptionIntervalRef = useRef(null);
  const keepAliveIntervalRef = useRef(null);
  const lastSuccessfulTranscriptionRef = useRef(Date.now());

  // NOUVEAU : Fonction pour détecter les intervenants dans le HTML
  const detectSpeakersFromHTML = useCallback((htmlContent) => {
    if (!htmlContent) return [];
    
    // Use DOMParser to parse the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const h4Elements = doc.querySelectorAll('h4');

    const detected = Array.from(h4Elements).map((h4, index) => {
      const fullText = h4.textContent || '';
      const nameMatch = fullText.match(/^([^,:]+)/); // Extracts name before comma or colon
      const speakerName = nameMatch ? nameMatch[1].trim() : fullText;
      
      // Chercher automatiquement le député correspondant
      let foundDepute = null;
      const searchName = speakerName.toLowerCase();
      
      // Prioritize exact match or very close match
      for (const depute of deputes) {
        const deputeName = depute.nomComplet.toLowerCase();
        const deputeLastName = depute.nom.toLowerCase();
        
        if (deputeName === searchName) { // Exact full name match
          foundDepute = depute;
          break;
        }
        if (searchName.includes(deputeLastName) && searchName.split(' ').length <= 2 && deputeLastName.length > 2) { // Partial match on last name for short speaker names
            foundDepute = depute;
            break; // Found a good enough match
        }
      }
      // If no exact match, try broader contains check
      if (!foundDepute) {
        for (const depute of deputes) {
          const deputeName = depute.nomComplet.toLowerCase();
          if (deputeName.includes(searchName) || searchName.includes(deputeName)) {
            foundDepute = depute;
            break;
          }
        }
      }
      
      return {
        id: `speaker-${index}-${Date.now()}`, // Unique ID for React key
        originalText: fullText, // The full text from the h4 tag
        displayName: speakerName, // The extracted name
        deputeId: foundDepute?.id || null // ID of the matched Depute
      };
    });
    
    // Filter out duplicates based on displayName, keeping the first occurrence
    const uniqueDetected = [];
    const seenNames = new Set();
    for (const speaker of detected) {
        if (!seenNames.has(speaker.displayName)) {
            uniqueDetected.push(speaker);
            seenNames.add(speaker.displayName);
        }
    }
    return uniqueDetected;
  }, [deputes]);

  // NOUVEAU : Fonction pour gérer le changement de député
  const handleSpeakerChange = useCallback((speakerId, newDeputeId) => {
    setDetectedSpeakers(prev => prev.map(speaker => 
      speaker.id === speakerId ? { ...speaker, deputeId: newDeputeId } : speaker
    ));
  }, []);

  // NOUVEAU : Fonction pour gérer le changement de contenu PdQ
  const handlePdQContentChange = useCallback((newHtml) => {
    setProcessedOutput(newHtml);
    // Re-détecter les intervenants si le contenu change (PdQ uniquement)
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC && deputes.length > 0) { // Changed filter
      const newlyDetected = detectSpeakersFromHTML(newHtml);
      // Create a map of existing mappings for quick lookup by originalText
      const existingMappingsMap = new Map(detectedSpeakers.map(s => [s.originalText, s.deputeId]));

      const updatedDetectedSpeakers = newlyDetected.map(newSpeaker => {
        // If this speaker's originalText was previously mapped, re-apply that deputeId
        const previouslyMappedDeputeId = existingMappingsMap.get(newSpeaker.originalText);
        return {
          ...newSpeaker,
          deputeId: previouslyMappedDeputeId !== undefined ? previouslyMappedDeputeId : newSpeaker.deputeId // Use existing mapping, else default detection
        };
      });
      setDetectedSpeakers(updatedDetectedSpeakers);
    }
  }, [selectedFilter, deputes, detectSpeakersFromHTML, detectedSpeakers]);

  // Charger les députés au démarrage
  useEffect(() => {
    // Only load deputes if a Quebec PdQ filter is selected, to optimize
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
      const loadDeputes = async () => {
        try {
          const allDeputes = await Depute.list('-nom', 200); // Assuming Depute.list exists and returns an array
          setDeputes(allDeputes);
        } catch (error) {
          console.error("Erreur chargement députés:", error);
          toast({ title: "Erreur", description: "Impossible de charger la liste des députés.", variant: "destructive" });
        }
      };
      loadDeputes();
    } else {
      setDeputes([]); // Clear deputes if not in Quebec PdQ mode
    }
  }, [selectedFilter, toast]); // Add selectedFilter to dependencies

  // MODIFICATION : Charger les deux types de résumés et afficher le bon selon selectedFilter
  useEffect(() => {
    const loadDailySummaries = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const summaries = await DailySummary.filter({ summary_date: todayStr });
        
        const chroniqueSummary = summaries.find(s => s.type === 'chronique');
        const pdqQuebecSummary = summaries.find(s => s.type === 'pdq_quebec'); // NEW
        const pdqOttawaSummary = summaries.find(s => s.type === 'pdq_ottawa'); // NEW

        // Reset states that are filter-specific when switching or loading
        setProcessedOutput('');
        setDailyTitle('');
        setDetectedSpeakers([]); // Reset detected speakers on load
        setSummaryPoints(['', '', '']); // Réinitialiser les points

        // Handle Chronique specific editable fields
        if (chroniqueSummary) {
          const loadedSpeaker = chroniqueSummary.speaker || '';
          const predefinedSpeakers = ['Jonathan Trudeau', 'Louis Lacroix', 'Philippe Léger'];
          
          let speakerOption = '';
          let customInput = '';

          if (predefinedSpeakers.includes(loadedSpeaker)) {
            speakerOption = loadedSpeaker;
          } else if (loadedSpeaker) {
            speakerOption = 'custom';
            customInput = loadedSpeaker;
          } else {
            speakerOption = 'Louis Lacroix'; // Default
          }

          setEditableSummary(prev => ({
            ...prev,
            title: chroniqueSummary.daily_title || '',
            speaker: speakerOption,
            customSpeakerInput: customInput
          }));
        } else {
            // Reset editableSummary fields if no chronique found
            setEditableSummary(prev => ({ ...prev, title: '', speaker: 'Louis Lacroix', customSpeakerInput: '' }));
        }

        // Set processedOutput and dailyTitle based on the currently selected filter
        if (selectedFilter === FILTERS.CHRONIQUE) {
            setProcessedOutput(chroniqueSummary?.summary_text || '');
            setDailyTitle(chroniqueSummary?.daily_title || '');
        } else if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) { // Changed from FILTERS.QUESTIONS
            if (pdqQuebecSummary) { // Changed from pdqSummary
                const cleanContent = pdqQuebecSummary.summary_text.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
                setProcessedOutput(cleanContent);
                // Retrait du titre 'Résumé de la période de questions'
                setDailyTitle(pdqQuebecSummary.daily_title || ''); 
                
                // NOUVEAU: Charger les summary_points
                if (pdqQuebecSummary.summary_points && Array.isArray(pdqQuebecSummary.summary_points)) {
                  const points = [...pdqQuebecSummary.summary_points];
                  while (points.length < 3) points.push(''); // S'assurer qu'on a 3 points
                  setSummaryPoints(points.slice(0, 3));
                }
                
                if (deputes.length > 0) {
                    let speakers = detectSpeakersFromHTML(cleanContent);
                    if (pdqQuebecSummary.speaker_mappings) {
                        speakers = speakers.map(speaker => {
                            const savedMapping = pdqQuebecSummary.speaker_mappings.find(m => m.originalText === speaker.originalText);
                            return savedMapping ? { ...speaker, deputeId: savedMapping.deputeId } : speaker;
                        });
                    }
                    setDetectedSpeakers(speakers);
                }
            } else {
                setProcessedOutput('');
                // Retrait du titre 'Résumé de la période de questions'
                setDailyTitle(''); 
                setDetectedSpeakers([]);
                setSummaryPoints(['', '', '']);
            }
        } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) { // NEW branch for Ottawa
            if (pdqOttawaSummary) {
                const cleanContent = pdqOttawaSummary.summary_text.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
                setProcessedOutput(cleanContent);
                setDailyTitle(pdqOttawaSummary.daily_title || ''); 
                
                if (pdqOttawaSummary.summary_points && Array.isArray(pdqOttawaSummary.summary_points)) {
                  const points = [...pdqOttawaSummary.summary_points];
                  while (points.length < 3) points.push(''); // S'assurer qu'on a 3 points
                  setSummaryPoints(points.slice(0, 3));
                }
                
                // Pas de détection de speakers pour Ottawa pour l'instant
                setDetectedSpeakers([]);
            } else {
                setProcessedOutput('');
                setDailyTitle(''); 
                setDetectedSpeakers([]);
                setSummaryPoints(['', '', '']);
            }
        } else { // For BRUTE
            setProcessedOutput('');
            setDailyTitle('');
            setSummaryPoints(['', '', '']); // Also reset for brute
        }
        
      } catch(e){ 
          console.error("Erreur lors du chargement des résumés:", e);
          // Fallback to default speaker on error
          setEditableSummary(prev => ({ ...prev, title: '', speaker: 'Louis Lacroix', customSpeakerInput: '' }));
      }
    };
    // Only load if deputes are available for PDQ Quebec processing, or if not PDQ Quebec (to avoid issues with detectSpeakersFromHTML)
    if (selectedFilter !== FILTERS.QUESTIONS_QUEBEC || deputes.length > 0) {
        loadDailySummaries();
    }
  }, [selectedFilter, deputes, detectSpeakersFromHTML]); // Add selectedFilter, deputes, detectSpeakersFromHTML as dependencies to react to changes

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
        detectedSpeakers, // NEW: Include detectedSpeakers in backup
        summaryPoints, // NOUVEAU
        timestamp: Date.now()
      };
      localStorage.setItem('retranscription_backup', JSON.stringify(saveData));
      setLastSaved(new Date());
      setHasPendingChanges(false);
      console.log('💾 Sauvegarde automatique effectuée');
    } catch (error) {
      console.error('Erreur de sauvegarde locale:', error);
    }
  }, [rawTranscription, editedTranscription, processedOutput, dailyTitle, editableSummary, selectedFilter, detectedSpeakers, summaryPoints]); // NEW dependency

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
            setDetectedSpeakers(saveData.detectedSpeakers || []); // NEW: Restore detectedSpeakers
            setSummaryPoints(saveData.summaryPoints || ['', '', '']); // NOUVEAU
            
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
    const hasContent = rawTranscription.trim() || editedTranscription.trim() || processedOutput.trim() || dailyTitle.trim() || editableSummary.customSpeakerInput.trim() || detectedSpeakers.length > 0 || summaryPoints.some(p => p.trim()); // NOUVEAU
    if (hasContent) {
        setHasPendingChanges(true);
    }
  }, [rawTranscription, editedTranscription, processedOutput, dailyTitle, editableSummary, selectedFilter, detectedSpeakers, summaryPoints]); // NEW dependency

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

  // NOUVEAU: Timer de l'enregistrement
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        setRecordingDuration(elapsed);
        
        // Vérifier si on approche de la limite
        if (elapsed > MAX_RECORDING_DURATION_MS * 0.9) { // 90% de la durée max
          setAudioQualityIndicator('warning');
          
          if (elapsed >= MAX_RECORDING_DURATION_MS) {
            console.log('⏱️ Durée maximale atteinte, arrêt automatique');
            stopMicrophoneRecording();
            toast({
              title: "Enregistrement arrêté automatiquement",
              description: "La durée maximale de 2 heures a été atteinte.",
              variant: "destructive",
              duration: 10000
            });
          }
        }
      }, 1000);
      
      return () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };
    } else {
      // Clear timer if recording stops
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording, recordingStartTime, toast]);

  // NOUVEAU: Monitoring de la qualité de l'enregistrement
  useEffect(() => {
    if (isRecording) {
      const checkQuality = setInterval(() => {
        const timeSinceLastTranscription = Date.now() - lastSuccessfulTranscriptionRef.current;
        
        if (timeSinceLastTranscription > 120000) { // 2 minutes sans transcription
          setAudioQualityIndicator('error');
          console.warn('⚠️ Aucune transcription depuis 2 minutes');
        } else if (timeSinceLastTranscription > 60000) { // 1 minute
          setAudioQualityIndicator('warning');
        } else {
          setAudioQualityIndicator('good');
        }
      }, 10000); // Vérifier toutes les 10 secondes
      
      return () => clearInterval(checkQuality);
    }
  }, [isRecording]);

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
    setDetectedSpeakers([]); // NEW: Clear detected speakers on reset
    setSummaryPoints(['', '', '']); // NOUVEAU
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
    setDetectedSpeakers([]); // NEW: Clear detected speakers on new transcription
    setSummaryPoints(['', '', '']); // NOUVEAU
    toast({ title: "Transcription réussie", description: "Vous pouvez maintenant modifier le texte et choisir un traitement." });
  };
  
  const handleTranscriptionError = (errorMessage) => {
    toast({ title: "Erreur de transcription", description: errorMessage, variant: "destructive" });
    setIsTranscribing(false); // S'assurer que l'état de chargement est réinitialisé
  };

  const captureAndTranscribe = async () => {
    setIsRecording(true);
    setRecordingStartTime(Date.now()); // Définir le début de l'enregistrement
    setRecordingDuration(0); // Réinitialiser la durée
    setAudioQualityIndicator('good'); // Réinitialiser l'indicateur de qualité
    lastSuccessfulTranscriptionRef.current = Date.now(); // CORRECTION: enlevé le "2" entre Date et now

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
        setRecordingStartTime(null); // Clear start time
        return;
      }
      
      if (!stream) {
        setIsRecording(false);
        setRecordingStartTime(null); // Clear start time
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
          setRecordingStartTime(null); // Clear start time
          return;
        }
        recordingStream = new MediaStream(audioTracks);
      }
      
      mediaRecorderRef.current = new MediaRecorder(recordingStream, supportedMimeType ? { mimeType: supportedMimeType } : undefined);
      
      chunksRef.current = [];
      let lastToastTime = Date.now(); // Renommé pour éviter la confusion avec lastSuccessfulTranscriptionRef
      
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
            lastSuccessfulTranscriptionRef.current = Date.now(); // Mettre à jour le marqueur de succès
            setAudioQualityIndicator('good'); // Réinitialiser l'indicateur de qualité
            
            // Notification discrète que la transcription fonctionne
            const now = Date.now();
            if (now - lastToastTime > 60000) { // Une fois par minute max
              toast({ 
                title: "Transcription en cours", 
                description: "Le texte est mis à jour régulièrement.",
                duration: 2000 
              });
              lastToastTime = now;
            }
          }
        } catch (error) {
          console.error("Erreur de transcription périodique:", error);
          // Ne pas afficher d'erreur pour ne pas spammer l'utilisateur
          // et ne pas arrêter l'enregistrement, juste logger l'erreur.
        }
      };

      // NOUVEAU: Keep-alive pour maintenir la connexion active
      keepAliveIntervalRef.current = setInterval(() => {
        console.log('💓 Keep-alive: enregistrement actif, durée:', Math.floor(recordingDuration / 1000), 's');
        
        // Déclencher une petite action pour garder le navigateur "actif"
        // (par exemple, un ping au serveur si applicable, ou juste un log pour montrer l'activité)
        if (document.hidden) {
          console.log('⚠️ Page cachée détectée, keep-alive actif pour éviter la mise en veille.');
        }
      }, KEEP_ALIVE_INTERVAL_MS);
      
      mediaRecorderRef.current.ondataavailable = e => { 
        if (e.data && e.data.size) {
          chunksRef.current.push(e.data); 
          console.log(`📦 Chunk reçu: ${e.data.size} bytes, total chunks: ${chunksRef.current.length}`);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        // Arrêter tous les intervalles
        if (transcriptionIntervalRef.current) {
          clearInterval(transcriptionIntervalRef.current);
          transcriptionIntervalRef.current = null;
        }
        
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }

        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        stream.getTracks().forEach(track => track.stop());
        if (recordingStream !== stream) {
          recordingStream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
        setRecordingStartTime(null); // Clear start time
        setRecordingDuration(0); // Reset duration display

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
      setTimeout(transcribeAccumulatedAudio, FIRST_TRANSCRIPTION_DELAY_MS);
      
      // Deuxième transcription après 15 secondes
      setTimeout(transcribeAccumulatedAudio, 15000);
      
      // Puis lancer la transcription périodique toutes les 30 secondes
      setTimeout(() => {
        transcriptionIntervalRef.current = setInterval(transcribeAccumulatedAudio, TRANSCRIPTION_INTERVAL_MS);
      }, 20000); // Start periodic interval after 20 seconds
      
      toast({ 
        title: "🎙️ Enregistrement démarré", 
        description: "Les premiers mots apparaîtront dans 5 secondes. L'enregistrement peut durer jusqu'à 2 heures." 
      });

    } catch (error) {
      console.error("Erreur de capture :", error);
      
      // Nettoyer tous les intervalles en cas d'erreur de démarrage
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

      if (error.name === 'NotAllowedError') {
        toast({ title: "Permission refusée", description: "Vous devez autoriser l'accès pour démarrer l'enregistrement.", variant: "destructive" });
      } else {
        toast({ title: "Erreur de capture", description: "Impossible de démarrer l'enregistrement.", variant: "destructive" });
      }
      setIsRecording(false);
      setRecordingStartTime(null); // Clear start time
    }
  };
    
  const startMicrophoneRecording = () => {
    // Réinitialiser le texte et les sorties avant de commencer un nouvel enregistrement
    setEditedTranscription('');
    setRawTranscription('');
    setProcessedOutput('');
    setDailyTitle('');
    setDetectedSpeakers([]); // NEW: Clear detected speakers
    setSummaryPoints(['', '', '']); // NOUVEAU
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
      setDetectedSpeakers([]);
      setSummaryPoints(['', '', '']);
      console.log(`LOG: Lancement du traitement GPT avec le filtre : ${selectedFilter}`);
      console.log(`LOG: Longueur du texte à traiter : ${editedTranscription.length} caractères`);

      try {
          if (selectedFilter === FILTERS.BRUTE) {
              const formattedBrute = editedTranscription.replace(/\n/g, '<br>');
              setProcessedOutput(formattedBrute);
              setDailyTitle("Transcription brute");
          } else if (selectedFilter === FILTERS.CHRONIQUE) {
              const { data, error } = await generateChroniqueSummary({ text_to_summarize: editedTranscription });
              if (error) throw new Error(error.data?.error || "Erreur du résumé de chronique");
              setDailyTitle(data.daily_title || '');
              
              const formattedHtml = (data.summary_points || "")
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
                
              setProcessedOutput(formattedHtml);
          } else if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) { // Changed filter
              console.log('LOG: 📨 Envoi vers summarizeQuestionPeriod (Québec)...');
              console.log('LOG: 📝 Contenu envoyé:', editedTranscription.substring(0, 100) + '...');
              
              const { summarizeQuestionPeriod } = await import("@/api/functions"); // Dynamic import
              const response = await summarizeQuestionPeriod({ transcript: editedTranscription });
              
              console.log('LOG: 📬 Réponse complète reçue:', response);
              
              if (response.error) {
                  throw new Error(response.error.error || response.error.message || "Erreur du résumé PdQ Québec");
              }
              
              // Ne plus définir de dailyTitle pour PdQ - pas besoin dans Retranscription
              setDailyTitle(''); 
              
              // Nettoyer le HTML reçu
              let cleanHtml = response.data?.summary_html || response.summary_html || '';
              cleanHtml = cleanHtml.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
              
              setProcessedOutput(cleanHtml);
              
              // IMPORTANT: Récupérer et afficher les summary_points générés par OpenAI
              const points = response.data?.summary_points || response.summary_points || [];
              console.log('LOG: 📌 Points reçus de OpenAI:', points);
              
              if (points && points.length > 0) {
                  const displayPoints = [...points.slice(0, 3)];
                  while (displayPoints.length < 3) {
                      displayPoints.push('');
                  }
                  setSummaryPoints(displayPoints);
                  console.log('LOG: ✅ Points affichés dans l\'UI:', displayPoints);
              } else {
                  console.log('LOG: ⚠️ Aucun point reçu, affichage de champs vides');
                  setSummaryPoints(['', '', '']);
              }
              
              if (deputes.length > 0) {
                const speakers = detectSpeakersFromHTML(cleanHtml);
                setDetectedSpeakers(speakers);
              }
          } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) { // NEW branch
              console.log('LOG: 📨 Envoi vers summarizeQuestionPeriodOttawa...');
              console.log('LOG: 📝 Contenu envoyé:', editedTranscription.substring(0, 100) + '...');

              const { summarizeQuestionPeriodOttawa } = await import("@/api/functions"); // Dynamic import
              const response = await summarizeQuestionPeriodOttawa({ transcript: editedTranscription });

              console.log('LOG: 📬 Réponse complète reçue:', response);

              if (response.error) {
                  throw new Error(response.error.error || response.error.message || "Erreur du résumé PdQ Ottawa");
              }

              setDailyTitle('');

              let cleanHtml = response.data?.summary_html || response.summary_html || '';
              cleanHtml = cleanHtml.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();

              setProcessedOutput(cleanHtml);

              const points = response.data?.summary_points || response.summary_points || [];
              console.log('LOG: 📌 Points reçus de OpenAI (Ottawa):', points);

              if (points && points.length > 0) {
                  const displayPoints = [...points.slice(0, 3)];
                  while (displayPoints.length < 3) {
                      displayPoints.push('');
                  }
                  setSummaryPoints(displayPoints);
                  console.log('LOG: ✅ Points affichés dans l\'UI (Ottawa):', displayPoints);
              } else {
                  console.log('LOG: ⚠️ Aucun point reçu (Ottawa), affichage de champs vides');
                  setSummaryPoints(['', '', '']);
              }

              // Pas de détection de députés pour Ottawa pour l'instant
              setDetectedSpeakers([]);
          }
          toast({ title: "Traitement terminé !", description: "Le résultat est prêt." });
      } catch (error) {
          console.error('LOG: ❌ Erreur complète:', error);
          toast({ title: "Erreur de traitement GPT", description: error.message, variant: "destructive" });
      }
      setIsProcessingGpt(false);
  };
  
  // MODIFICATION : Fonction de sauvegarde adaptée au type
  const handleSendToNewsletter = async () => {
    let summaryType = 'chronique'; // Default
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
      summaryType = 'pdq_quebec';
    } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) { // NEW
      summaryType = 'pdq_ottawa';
    }
    
    let finalSpeaker = '';
    if (summaryType === 'chronique') {
      finalSpeaker = editableSummary.speaker === 'custom' 
        ? (editableSummary.customSpeakerInput || 'Louis Lacroix')
        : (editableSummary.speaker || 'Louis Lacroix');
    }

    const cleanSummaryText = processedOutput.replace(/<(.|\n)*?>/g, '').trim();
    if (!cleanSummaryText && selectedFilter !== FILTERS.BRUTE) {
        toast({ title: "Erreur", description: "Le contenu final est requis pour les résumés.", variant: "destructive" });
        return;
    }

    setIsSending(true);

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const existingSummaries = await DailySummary.filter({ 
          summary_date: todayStr,
          type: summaryType 
        });

        const summaryData = {
            title: summaryType === 'pdq_quebec' 
              ? "Résumé de la période de questions (Québec)" 
              : summaryType === 'pdq_ottawa' // NEW
              ? "Résumé de la période de questions (Ottawa)" // NEW
              : "Contenu généré par Retranscription",
            daily_title: dailyTitle,
            summary_text: processedOutput,
            summary_date: todayStr,
            speaker: finalSpeaker, // This field is mainly for chronique
            type: summaryType
        };

        // NOUVEAU : Ajouter les associations d'intervenants pour PdQ
        if (summaryType === 'pdq_quebec') { // Changed from pdq
          summaryData.speaker_mappings = detectedSpeakers
            .filter(s => s.deputeId) // Only save speakers that have been explicitly mapped
            .map(s => ({
              originalText: s.originalText,
              deputeId: s.deputeId
            }));
          
          // NOUVEAU: Sauvegarder les summary_points
          summaryData.summary_points = summaryPoints.filter(p => p.trim());
        } else if (summaryType === 'pdq_ottawa') { // NEW
          summaryData.summary_points = summaryPoints.filter(p => p.trim());
        }

        if (existingSummaries.length > 0) {
            await DailySummary.update(existingSummaries[0].id, summaryData);
            toast({ 
              title: "Contenu mis à jour !", 
              description: summaryType === 'pdq_quebec' 
                ? "Le résumé PdQ Québec a été mis à jour avec les sujets du jour." 
                : summaryType === 'pdq_ottawa' // NEW
                ? "Le résumé PdQ Ottawa a été mis à jour avec les sujets du jour." // NEW
                : "Le contenu pour le bulletin d'aujourd'hui a été mis à jour." 
            });
        } else {
            await DailySummary.create(summaryData);
            toast({ 
              title: "Contenu sauvegardé !", 
              description: summaryType.includes('pdq') // Generic message for both types of PdQ
                ? "Le résumé PdQ est prêt pour l'envoi."
                : "Sera disponible pour les prochains bulletins." 
            });
        }
        clearLocalBackup();
    } catch (error) {
        console.error("Erreur d'envoi:", error);
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

  // NOUVEAU: Formater la durée d'enregistrement
  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes.toString().padStart(2, '0')}m`);
    parts.push(`${seconds.toString().padStart(2, '0')}s`);
    
    return parts.join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-50 to-blue-600 flex items-center justify-center">
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
                    
                    {/* NOUVEAU: Indicateurs de statut d'enregistrement */}
                    {isRecording && (
                      <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="font-semibold text-blue-900">Enregistrement en cours</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Clock className="w-4 h-4" />
                            <span className="font-mono font-bold">{formatDuration(recordingDuration)}</span>
                          </div>
                        </div>
                        
                        {/* NOUVEAU: Indicateur de qualité */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-700">Qualité:</span>
                          {audioQualityIndicator === 'good' && (
                            <div className="flex items-center gap-1 text-green-600">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs font-medium">Excellente</span>
                            </div>
                          )}
                          {audioQualityIndicator === 'warning' && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <AlertCircle className="w-3 h-3" />
                              <span className="text-xs font-medium">Attention - Proche de la limite</span>
                            </div>
                          )}
                          {audioQualityIndicator === 'error' && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="w-3 h-3" />
                              <span className="text-xs font-medium">Problème détecté</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-xs text-blue-600">
                          💡 La transcription est mise à jour automatiquement toutes les {TRANSCRIPTION_INTERVAL_MS / 1000} secondes
                        </div>
                      </div>
                    )}
                    
                    <div>
                      {isRecording ? 
                        <Button onClick={stopMicrophoneRecording} className="w-full bg-red-600 hover:bg-red-700">
                          <Square className="w-4 h-4 mr-2" />Arrêter l'enregistrement
                        </Button> : 
                        <Button onClick={startMicrophoneRecording} disabled={isTranscribing} className="w-full">
                          <Mic className="w-4 h-4 mr-2" />Démarrer l'enregistrement
                        </Button>
                      }
                      <p className="text-xs text-slate-500 mt-3 p-2 bg-slate-50 rounded-md text-center">
                        ⏱️ Durée maximale: {MAX_RECORDING_DURATION_MS / (60 * 60 * 1000)} heures | 🔄 Transcription automatique en temps réel | 💾 Sauvegarde automatique
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
                      <SelectItem value={FILTERS.QUESTIONS_QUEBEC}>Résumé de la période de questions (Québec)</SelectItem> {/* Renamed */}
                      <SelectItem value={FILTERS.QUESTIONS_OTTAWA}>Résumé de la période de questions (Ottawa)</SelectItem> {/* NEW */}
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

            {/* MODIFICATION : Carte résultat avec éditeur spécial pour PdQ */}
            {processedOutput && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenSquare className="w-5 h-5 text-blue-600" />
                    {selectedFilter === FILTERS.CHRONIQUE ? 'Éditer le résumé de la chronique' : 
                     selectedFilter === FILTERS.QUESTIONS_QUEBEC ? 'Résumé de la période de questions (Québec)' : // Renamed
                     selectedFilter === FILTERS.QUESTIONS_OTTAWA ? 'Résumé de la période de questions (Ottawa)' : // NEW
                     'Transcription brute'}
                  </CardTitle>
                  <CardDescription>
                    {selectedFilter === FILTERS.CHRONIQUE ? 'Modifiez le résumé avant de l\'envoyer au bulletin.' :
                     selectedFilter === FILTERS.QUESTIONS_QUEBEC ? 'Vérifiez et corrigez les intervenants (Québec).' : // Renamed
                     selectedFilter === FILTERS.QUESTIONS_OTTAWA ? 'Vérifiez et corrigez le contenu (Ottawa).' : // NEW
                     'Texte brut sans traitement.'}
                  </CardDescription>
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
                       {/* Titre et intervenant pour chronique uniquement */}
                       {selectedFilter === FILTERS.CHRONIQUE && (
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
                         </>
                       )}

                       {/* Section Sujets du jour pour PdQ (Québec ou Ottawa) */}
                       {!isProcessingGpt && (selectedFilter === FILTERS.QUESTIONS_QUEBEC || selectedFilter === FILTERS.QUESTIONS_OTTAWA) && (
                         <div className="space-y-3 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200 shadow-sm">
                           <div className="flex items-center gap-2 mb-2">
                             <div className="w-1 h-8 bg-purple-600 rounded-full"></div>
                             <Label className="text-xl font-bold text-purple-900">Sujets du jour</Label>
                           </div>
                           <p className="text-sm text-purple-700 mb-4 italic">
                             Ces points apparaîtront en tête du bulletin PdQ {selectedFilter === FILTERS.QUESTIONS_OTTAWA ? '(Ottawa)' : '(Québec)'}
                           </p>
                           <div className="space-y-3">
                             {[0, 1, 2].map((index) => (
                               <div key={index} className="flex items-start gap-3">
                                 <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm mt-1">
                                   {index + 1}
                                 </div>
                                 <Input
                                   value={summaryPoints[index] || ''}
                                   onChange={(e) => {
                                     const newPoints = [...summaryPoints];
                                     newPoints[index] = e.target.value;
                                     setSummaryPoints(newPoints);
                                   }}
                                   placeholder={`Sujet principal ${index + 1}...`}
                                   className="flex-1 bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                                 />
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                       {/* Contenu */}
                       <div>
                         <Label>Contenu du résumé</Label>
                         {selectedFilter === FILTERS.QUESTIONS_QUEBEC ? ( // Only for Quebec, use custom editor
                           <div className="prose prose-slate max-w-none" style={{ minHeight: '400px' }}>
                             <style>{`
                               .prose h3 {
                                 color: #1e40af;
                                 font-size: 1.25rem;
                                 font-weight: 700;
                                 margin-top: 2rem;
                                 margin-bottom: 1rem;
                                 padding-bottom: 0.5rem;
                                 border-bottom: 2px solid #e5e7eb;
                               }
                               .prose h4 {
                                 color: #374151;
                                 font-size: 1.1rem;
                                 font-weight: 600;
                                 margin-top: 1.5rem;
                                 margin-bottom: 0.75rem;
                               }
                               .prose p {
                                 margin-bottom: 1rem;
                                 color: #1f2937;
                               }
                               .prose ul {
                                 margin-top: 0.5rem;
                                 margin-bottom: 1.5rem;
                                 padding-left: 1.5rem;
                               }
                               .prose li {
                                 margin-bottom: 0.5rem;
                                 color: #374151;
                               }
                               .prose strong {
                                 color: #111827;
                                 font-weight: 600;
                               }
                               .prose .ql-editor {
                                 font-family: Georgia, serif;
                                 font-size: 15px;
                                 line-height: 1.8;
                               }
                             `}</style>
                             <PdQContentEditor
                               htmlContent={processedOutput}
                               deputes={deputes}
                               detectedSpeakers={detectedSpeakers}
                               onSpeakerChange={handleSpeakerChange}
                               onContentChange={handlePdQContentChange}
                             />
                           </div>
                         ) : ( // For Chronique, Brute, and Ottawa, use standard ReactQuill
                           <div style={{ minHeight: '400px' }}>
                             <ReactQuill 
                               theme="snow" 
                               value={processedOutput} 
                               onChange={(newValue) => {
                                 setProcessedOutput(newValue);
                               }}
                               className="bg-white mt-1" 
                               placeholder="Le contenu apparaîtra ici une fois le texte traité..."
                             />
                           </div>
                         )}
                       </div>

                       {(selectedFilter === FILTERS.CHRONIQUE || selectedFilter === FILTERS.QUESTIONS_QUEBEC || selectedFilter === FILTERS.QUESTIONS_OTTAWA) && ( // Updated condition
                         <Button 
                           onClick={handleSendToNewsletter} 
                           disabled={isSending || !processedOutput.replace(/<(.|\n)*?>/g, '').trim()} 
                           className="w-full bg-green-600 hover:bg-green-700"
                         >
                           {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                           {selectedFilter === FILTERS.CHRONIQUE 
                             ? 'Sauvegarder pour le bulletin' 
                             : selectedFilter === FILTERS.QUESTIONS_OTTAWA // NEW
                             ? 'Sauvegarder le résumé PdQ Ottawa' // NEW
                             : 'Sauvegarder le résumé PdQ Québec'} {/* Renamed */}
                         </Button>
                       )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
