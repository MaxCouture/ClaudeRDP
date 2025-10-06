
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
  Clock,
  AlertCircle,
} from "lucide-react";
import { transcribeAudio } from "@/api/functions/transcribeAudio.js";
import { summarizeQuestionPeriod } from "@/api/functions";
import { summarizeQuestionPeriodOttawa } from "@/api/functions";
import { generateChroniqueSummary } from "@/api/functions";

const SOURCE_TYPES = {
  LIVE: 'live',
  M3U8: 'm3u8',
  FILE: 'file',
};

const LIVE_CAPTURE_MODES = {
  MICROPHONE: 'microphone',
  TAB_AUDIO: 'tab_audio',
  SYSTEM_AUDIO: 'system_audio',
};

const FILTERS = {
    CHRONIQUE: 'chronique',
    QUESTIONS_QUEBEC: 'questions_quebec',
    QUESTIONS_OTTAWA: 'questions_ottawa',
    BRUTE: 'brute'
};

const CHANNELS = [
  { name: '98,5 FM Montréal', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CHMPFM.mp3' },
  { name: 'QUB Radio', url: 'https://video.qub.ca/live/qub-radio-aac/playlist.m3u8' },
  { name: 'ICI Première Montréal', url: 'https://cbcfrequence.akamaized.net/hls/live/2040600/CBF_MONTREAL/master.m3u8' },
  { name: 'Assemblée Nationale', url: 'https://videos.assnat.qc.ca/live/salle-assemblee-nationale/playlist.m3u8' },
];

const MAX_RECORDING_DURATION_MS = 2 * 60 * 60 * 1000;
const TRANSCRIPTION_INTERVAL_MS = 30000;
const FIRST_TRANSCRIPTION_DELAY_MS = 5000;
const KEEP_ALIVE_INTERVAL_MS = 60000;

export default function RetranscriptionPage() {
  const [sourceType, setSourceType] = useState(SOURCE_TYPES.FILE);
  const [liveCaptureMode, setLiveCaptureMode] = useState(LIVE_CAPTURE_MODES.MICROPHONE);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [rawTranscription, setRawTranscription] = useState('');
  const [editedTranscription, setEditedTranscription] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(FILTERS.CHRONIQUE);
  const [isProcessingGpt, setIsProcessingGpt] = useState(false);
  
  const [processedOutput, setProcessedOutput] = useState('');
  const [dailyTitle, setDailyTitle] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [editableSummary, setEditableSummary] = useState({ title: '', text: '', speaker: 'Louis Lacroix', customSpeakerInput: '' });

  const [deputes, setDeputes] = useState([]);
  const [detectedSpeakers, setDetectedSpeakers] = useState([]); // For Quebec
  const [detectedSpeakersOttawa, setDetectedSpeakersOttawa] = useState([]); // For Ottawa

  const [summaryPoints, setSummaryPoints] = useState(['', '', '']);

  const { toast } = useToast();
  
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [audioQualityIndicator, setAudioQualityIndicator] = useState('good');
  const recordingTimerRef = useRef(null);
  const transcriptionIntervalRef = useRef(null);
  const keepAliveIntervalRef = useRef(null);
  const lastSuccessfulTranscriptionRef = useRef(Date.now());

  // Generalized detectSpeakersFromHTML to accept a list of deputes
  const detectSpeakersFromHTML = useCallback((htmlContent, availableDeputes) => {
    if (!htmlContent) return [];
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const h4Elements = doc.querySelectorAll('h4');

    const detected = Array.from(h4Elements).map((h4, index) => {
      const fullText = h4.textContent || '';
      const nameMatch = fullText.match(/^([^,:]+)/);
      const speakerName = nameMatch ? nameMatch[1].trim() : fullText;
      
      let foundDepute = null;
      if (availableDeputes && availableDeputes.length > 0) {
        const searchName = speakerName.toLowerCase();
        
        for (const depute of availableDeputes) {
          const deputeName = depute.nomComplet.toLowerCase();
          const deputeLastName = depute.nom.toLowerCase();
          
          if (deputeName === searchName) {
            foundDepute = depute;
            break;
          }
          if (searchName.includes(deputeLastName) && searchName.split(' ').length <= 2 && deputeLastName.length > 2) {
              foundDepute = depute;
              break;
          }
        }
        if (!foundDepute) {
          for (const depute of availableDeputes) {
            const deputeName = depute.nomComplet.toLowerCase();
            if (deputeName.includes(searchName) || searchName.includes(deputeName)) {
              foundDepute = depute;
              break;
            }
          }
        }
      }
      
      return {
        id: `speaker-${index}-${Date.now()}`,
        originalText: fullText,
        displayName: speakerName,
        deputeId: foundDepute?.id || null
      };
    });
    
    const uniqueDetected = [];
    const seenNames = new Set();
    for (const speaker of detected) {
        if (!seenNames.has(speaker.displayName)) {
            uniqueDetected.push(speaker);
            seenNames.add(speaker.displayName);
        }
    }
    return uniqueDetected;
  }, []); // Removed 'deputes' from dependencies, now relies on 'availableDeputes' parameter

  const handleSpeakerChange = useCallback((speakerId, newDeputeId) => {
    setDetectedSpeakers(prev => prev.map(speaker => 
      speaker.id === speakerId ? { ...speaker, deputeId: newDeputeId } : speaker
    ));
  }, []);

  const handleSpeakerChangeOttawa = useCallback((speakerId, newDeputeId) => {
    // For Ottawa, newDeputeId will typically be null as we pass an empty deputes list to PdQContentEditor.
    // This handler can still be used if the editor allows custom names to be updated in the future.
    setDetectedSpeakersOttawa(prev => prev.map(speaker => 
      speaker.id === speakerId ? { ...speaker, deputeId: newDeputeId } : speaker
    ));
  }, []);

  const handlePdQContentChange = useCallback((newHtml) => {
    setProcessedOutput(newHtml);
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC && deputes.length > 0) {
      const newlyDetected = detectSpeakersFromHTML(newHtml, deputes);
      const existingMappingsMap = new Map(detectedSpeakers.map(s => [s.originalText, s.deputeId]));

      const updatedDetectedSpeakers = newlyDetected.map(newSpeaker => {
        const previouslyMappedDeputeId = existingMappingsMap.get(newSpeaker.originalText);
        return {
          ...newSpeaker,
          deputeId: previouslyMappedDeputeId !== undefined ? previouslyMappedDeputeId : newSpeaker.deputeId
        };
      });
      setDetectedSpeakers(updatedDetectedSpeakers);
    }
  }, [selectedFilter, deputes, detectSpeakersFromHTML, detectedSpeakers]);

  const handlePdQContentChangeOttawa = useCallback((newHtml) => {
    setProcessedOutput(newHtml);
    if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) {
      const newlyDetected = detectSpeakersFromHTML(newHtml, []); // No deputes for Ottawa mapping
      const existingSpeakerMap = new Map(detectedSpeakersOttawa.map(s => [s.originalText, s]));

      const updatedDetectedSpeakers = newlyDetected.map(newSpeaker => {
        const existing = existingSpeakerMap.get(newSpeaker.originalText);
        return existing ? { ...newSpeaker, displayName: existing.displayName } : newSpeaker;
      });
      setDetectedSpeakersOttawa(updatedDetectedSpeakers);
    }
  }, [selectedFilter, detectSpeakersFromHTML, detectedSpeakersOttawa]);

  useEffect(() => {
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
      const loadDeputes = async () => {
        try {
          const allDeputes = await Depute.list('-nom', 200);
          setDeputes(allDeputes);
        } catch (error) {
          console.error("Erreur chargement députés:", error);
          toast({ title: "Erreur", description: "Impossible de charger la liste des députés.", variant: "destructive" });
        }
      };
      loadDeputes();
    } else {
      setDeputes([]); // Clear deputes when not in Quebec filter
    }
  }, [selectedFilter, toast]);

  useEffect(() => {
    const loadDailySummaries = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Ajouter un timeout de 10 secondes pour éviter les blocages
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout lors du chargement des résumés')), 10000)
        );
        
        const summariesPromise = DailySummary.filter({ summary_date: todayStr });
        
        let summaries;
        try {
          summaries = await Promise.race([summariesPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.warn('⚠️ Timeout chargement résumés, utilisation de valeurs par défaut');
          summaries = []; // En cas de timeout, on utilise un tableau vide pour ne pas bloquer l'application
        }
        
        const chroniqueSummary = summaries.find(s => s.type === 'chronique');
        const pdqQuebecSummary = summaries.find(s => s.type === 'pdq_quebec');
        const pdqOttawaSummary = summaries.find(s => s.type === 'pdq_ottawa');

        setProcessedOutput('');
        setDailyTitle('');
        setDetectedSpeakers([]); // Clear Quebec speakers
        setDetectedSpeakersOttawa([]); // Clear Ottawa speakers
        setSummaryPoints(['', '', '']);

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
            speakerOption = 'Louis Lacroix';
          }

          setEditableSummary(prev => ({
            ...prev,
            title: chroniqueSummary.daily_title || '',
            speaker: speakerOption,
            customSpeakerInput: customInput
          }));
        } else {
            setEditableSummary(prev => ({ ...prev, title: '', speaker: 'Louis Lacroix', customSpeakerInput: '' }));
        }

        if (selectedFilter === FILTERS.CHRONIQUE) {
            setProcessedOutput(chroniqueSummary?.summary_text || '');
            setDailyTitle(chroniqueSummary?.daily_title || '');
        } else if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
            if (pdqQuebecSummary) {
                const cleanContent = pdqQuebecSummary.summary_text.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
                setProcessedOutput(cleanContent);
                setDailyTitle(pdqQuebecSummary.daily_title || ''); 
                
                if (pdqQuebecSummary.summary_points && Array.isArray(pdqQuebecSummary.summary_points)) {
                  const points = [...pdqQuebecSummary.summary_points];
                  while (points.length < 3) points.push('');
                  setSummaryPoints(points.slice(0, 3));
                }
                
                if (deputes.length > 0) {
                    let speakers = detectSpeakersFromHTML(cleanContent, deputes); // Pass deputes for Quebec
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
                setDailyTitle(''); 
                setDetectedSpeakers([]);
                setSummaryPoints(['', '', '']);
            }
        } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) {
            if (pdqOttawaSummary) {
                const cleanContent = pdqOttawaSummary.summary_text.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
                
                console.log('LOG: 📦 Chargement PdQ Ottawa depuis DB');
                console.log('LOG: 📦 Contenu DB (200 premiers char):', cleanContent.substring(0, 200));
                console.log('LOG: 📦 Longueur contenu:', cleanContent.length);
                
                setProcessedOutput(cleanContent);
                setDailyTitle(pdqOttawaSummary.daily_title || ''); 
                
                if (pdqOttawaSummary.summary_points && Array.isArray(pdqOttawaSummary.summary_points)) {
                  const points = [...pdqOttawaSummary.summary_points];
                  while (points.length < 3) points.push('');
                  setSummaryPoints(points.slice(0, 3));
                }
                
                // For Ottawa, detect speakers but don't map to deputes
                let speakersOttawa = detectSpeakersFromHTML(cleanContent, []); // Pass empty deputes list
                // If pdqOttawaSummary stores speaker mappings (e.g., custom names), we'd load them here
                // For now, only detect based on content.
                setDetectedSpeakersOttawa(speakersOttawa);
                
                console.log('LOG: 📦 Speakers Ottawa détectés:', speakersOttawa.length);
            } else {
                console.log('LOG: 📦 Aucun résumé PdQ Ottawa en DB');
                setProcessedOutput('');
                setDailyTitle(''); 
                setDetectedSpeakersOttawa([]);
                setSummaryPoints(['', '', '']);
            }
        } else {
            setProcessedOutput('');
            setDailyTitle('');
            setSummaryPoints(['', '', '']);
        }
        
      } catch(e){ 
          console.error("Erreur lors du chargement des résumés:", e);
          // Ne pas bloquer l'app si le chargement échoue
          setEditableSummary(prev => ({ ...prev, title: '', speaker: 'Louis Lacroix', customSpeakerInput: '' }));
          setProcessedOutput('');
          setDailyTitle('');
          setDetectedSpeakers([]);
          setDetectedSpeakersOttawa([]);
          setSummaryPoints(['', '', '']);
          
          // Toast optionnel pour informer l'utilisateur
          toast({ 
            title: "Chargement partiel", 
            description: "Impossible de charger les résumés existants. Vous pouvez continuer à travailler normalement.",
            variant: "default",
            duration: 3000
          });
      }
    };
    loadDailySummaries();
  }, [selectedFilter, deputes, detectSpeakersFromHTML, toast]); // Dependencies update to include detectSpeakersFromHTML

  const saveToLocalStorage = useCallback(() => {
    try {
      const saveData = {
        rawTranscription,
        editedTranscription,
        processedOutput,
        dailyTitle,
        editableSummary,
        selectedFilter,
        detectedSpeakers,
        detectedSpeakersOttawa, // Save Ottawa speakers
        summaryPoints,
        timestamp: Date.now()
      };
      localStorage.setItem('retranscription_backup', JSON.stringify(saveData));
      setLastSaved(new Date());
      setHasPendingChanges(false);
      console.log('💾 Sauvegarde automatique effectuée');
    } catch (error) {
      console.error('Erreur de sauvegarde locale:', error);
    }
  }, [rawTranscription, editedTranscription, processedOutput, dailyTitle, editableSummary, selectedFilter, detectedSpeakers, detectedSpeakersOttawa, summaryPoints]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('retranscription_backup');
      if (saved) {
        const saveData = JSON.parse(saved);
        const ageMinutes = (Date.now() - saveData.timestamp) / (1000 * 60);
        
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
            setDetectedSpeakers(saveData.detectedSpeakers || []);
            setDetectedSpeakersOttawa(saveData.detectedSpeakersOttawa || []); // Restore Ottawa speakers
            setSummaryPoints(saveData.summaryPoints || ['', '', '']);
            
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

  useEffect(() => {
    if (hasPendingChanges) {
      const timer = setTimeout(() => {
        saveToLocalStorage();
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [hasPendingChanges, saveToLocalStorage]);

  useEffect(() => {
    const hasContent = rawTranscription.trim() || editedTranscription.trim() || processedOutput.trim() || dailyTitle.trim() || editableSummary.customSpeakerInput.trim() || detectedSpeakers.length > 0 || detectedSpeakersOttawa.length > 0 || summaryPoints.some(p => p.trim());
    if (hasContent) {
        setHasPendingChanges(true);
    }
  }, [rawTranscription, editedTranscription, processedOutput, dailyTitle, editableSummary, selectedFilter, detectedSpeakers, detectedSpeakersOttawa, summaryPoints]);

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

  useEffect(() => {
    if (isRecording && recordingStartTime) {
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        setRecordingDuration(elapsed);
        
        if (elapsed > MAX_RECORDING_DURATION_MS * 0.9) {
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
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording, recordingStartTime, toast]);

  useEffect(() => {
    if (isRecording) {
      const checkQuality = setInterval(() => {
        const timeSinceLastTranscription = Date.now() - lastSuccessfulTranscriptionRef.current;
        
        if (timeSinceLastTranscription > 120000) {
          setAudioQualityIndicator('error');
          console.warn('⚠️ Aucune transcription depuis 2 minutes');
        } else if (timeSinceLastTranscription > 60000) {
          setAudioQualityIndicator('warning');
        } else {
          setAudioQualityIndicator('good');
        }
      }, 10000);
      
      return () => clearInterval(checkQuality);
    }
  }, [isRecording]);

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
    setDetectedSpeakers([]);
    setDetectedSpeakersOttawa([]);
    setSummaryPoints(['', '', '']);
    clearLocalBackup();
  };
  
  const handleTranscriptionSuccess = (transcriptionText) => {
    setRawTranscription(transcriptionText); 
    setEditedTranscription(transcriptionText);
    setProcessedOutput('');
    setDailyTitle('');
    setDetectedSpeakers([]);
    setDetectedSpeakersOttawa([]);
    setSummaryPoints(['', '', '']);
    toast({ title: "Transcription réussie", description: "Vous pouvez maintenant modifier le texte et choisir un traitement." });
  };
  
  const handleTranscriptionError = (errorMessage) => {
    toast({ title: "Erreur de transcription", description: errorMessage, variant: "destructive" });
    setIsTranscribing(false);
  };

  const captureAndTranscribe = async () => {
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setRecordingDuration(0);
    setAudioQualityIndicator('good');
    lastSuccessfulTranscriptionRef.current = Date.now();

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
        setRecordingStartTime(null);
        return;
      }
      
      if (!stream) {
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }

      const mimeTypes = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus", 
        "audio/webm",
        "audio/mp4"
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || "";
      
      let recordingStream = stream;
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
          setRecordingStartTime(null);
          return;
        }
        recordingStream = new MediaStream(audioTracks);
      }
      
      mediaRecorderRef.current = new MediaRecorder(recordingStream, supportedMimeType ? { mimeType: supportedMimeType } : undefined);
      
      chunksRef.current = [];
      let lastToastTime = Date.now();
      
      const transcribeAccumulatedAudio = async () => {
        if (chunksRef.current.length === 0) return;
        
        const audioBlob = new Blob([...chunksRef.current], { type: supportedMimeType || "audio/webm" });
        
        if (audioBlob.size < 1024) return;
        
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording_${Date.now()}.webm`);
          const { data } = await transcribeAudio(formData);
          
          if (data.success && data.transcription.trim()) {
            setEditedTranscription(data.transcription.trim());
            lastSuccessfulTranscriptionRef.current = Date.now();
            setAudioQualityIndicator('good');
            
            const now = Date.now();
            if (now - lastToastTime > 60000) {
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
        }
      };

      keepAliveIntervalRef.current = setInterval(() => {
        console.log('💓 Keep-alive: enregistrement actif, durée:', Math.floor(recordingDuration / 1000), 's');
        
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
        setRecordingStartTime(null);
        setRecordingDuration(0);

        const audioBlob = new Blob(chunksRef.current, { type: supportedMimeType || "audio/webm" });
        
        if (audioBlob.size < 1024) {
            handleTranscriptionError("Aucun son n'a été enregistré. Vérifiez que votre microphone est activé et non muet.");
            return;
        }

        toast({ title: "Enregistrement terminé", description: "Transcription finale en cours..." });
        await processAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start(1000);
      
      setTimeout(transcribeAccumulatedAudio, FIRST_TRANSCRIPTION_DELAY_MS);
      
      setTimeout(transcribeAccumulatedAudio, 15000);
      
      setTimeout(() => {
        transcriptionIntervalRef.current = setInterval(transcribeAccumulatedAudio, TRANSCRIPTION_INTERVAL_MS);
      }, 20000);
      
      toast({ 
        title: "🎙️ Enregistrement démarré", 
        description: "Les premiers mots apparaîtront dans 5 secondes. L'enregistrement peut durer jusqu'à 2 heures." 
      });

    } catch (error) {
      console.error("Erreur de capture :", error);
      
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

      if (error.name === 'NotAllowedError') {
        toast({ title: "Permission refusée", description: "Vous devez autoriser l'accès pour démarrer l'enregistrement.", variant: "destructive" });
      } else {
        toast({ title: "Erreur de capture", description: "Impossible de démarrer l'enregistrement.", variant: "destructive" });
      }
      setIsRecording(false);
      setRecordingStartTime(null);
    }
  };
    
  const startMicrophoneRecording = () => {
    setEditedTranscription('');
    setRawTranscription('');
    setProcessedOutput('');
    setDailyTitle('');
    setDetectedSpeakers([]);
    setDetectedSpeakersOttawa([]);
    setSummaryPoints(['', '', '']);
    captureAndTranscribe();
  };

  const stopMicrophoneRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const processAudioBlob = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
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
      setDetectedSpeakersOttawa([]);
      setSummaryPoints(['', '', '']);
      console.log(`LOG: Lancement du traitement GPT avec le filtre : ${selectedFilter}`);
      console.log(`LOG: Longueur du texte à traiter : ${editedTranscription.length} caractères`);

      try {
          if (selectedFilter === FILTERS.BRUTE) {
              const formattedBrute = editedTranscription.replace(/\n/g, '<br>');
              setProcessedOutput(formattedBrute);
              setDailyTitle("Transcription brute");
          } else if (selectedFilter === FILTERS.CHRONIQUE) {
              console.log('LOG: 📨 Envoi vers generateChroniqueSummary...');
              const { data, error } = await generateChroniqueSummary({ text_to_summarize: editedTranscription });
              
              console.log('LOG: 📬 Réponse reçue:', data);
              console.log('LOG: 📬 Erreur éventuelle:', error);
              
              if (error) {
                  console.error('LOG: ❌ Erreur API:', error);
                  throw new Error(error.data?.error || error.error || "Erreur du résumé de chronique");
              }
              
              let summaryText = data?.summary || '';
              
              console.log('LOG: 📝 Résumé brut reçu:', summaryText ? summaryText.substring(0, 200) + '...' : 'VIDE');
              
              if (!summaryText) {
                  throw new Error("Aucun résumé reçu du serveur");
              }
              
              console.log('LOG: ✅ Résumé reçu avant nettoyage:', summaryText.substring(0, 200));
              
              // NETTOYAGE des blocs markdown
              summaryText = summaryText
                .replace(/```html\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
              
              // Convertir markdown ** en HTML strong
              summaryText = summaryText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
              
              console.log('LOG: 🧹 Après nettoyage:', summaryText.substring(0, 200));
              
              // NOUVELLE LOGIQUE DE PARSING STRICTE
              const lines = summaryText.split('\n').map(l => l.trim()).filter(l => l);
              let result = [];
              let inList = false;
              let lastWasTitle = false;
              
              console.log('LOG: 📋 Nombre de lignes à parser:', lines.length);
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // TITRE (commence par <strong>)
                if (line.startsWith('<strong>') || line.match(/^<strong>/)) {
                  if (inList) {
                    result.push('<ul>'); // Close previous list if any
                    inList = false;
                  }
                  
                  if (result.length > 0 && !lastWasTitle) {
                    result.push('<br>');
                  }
                  
                  result.push(`<p>${line}</p>`);
                  lastWasTitle = true;
                  continue;
                }
                
                // POINT DE LISTE
                if (line.match(/^[-•]\s+/) || line.startsWith('<li>') || line.startsWith('<ul>')) {
                  lastWasTitle = false;
                  
                  if (line === '<ul>') {
                    if (!inList) {
                      result.push('<ul>');
                      inList = true;
                    }
                    continue;
                  }
                  
                  if (line === '</ul>') {
                    if (inList) {
                      result.push('</ul>');
                      inList = false;
                    }
                    continue;
                  }
                  
                  if (!inList) {
                    result.push('<ul>');
                    inList = true;
                  }
                  
                  let cleanedPoint = line
                    .replace(/^[-•]\s+/, '')
                    .replace(/^<li>/, '')
                    .replace(/<\/li>$/, '')
                    .trim();
                  
                  if (cleanedPoint) {
                    result.push(`<li>${cleanedPoint}</li>`);
                  }
                  continue;
                }
                
                // Ligne de texte normal après un titre
                if (lastWasTitle) {
                  if (!inList) {
                    result.push('<ul>');
                    inList = true;
                  }
                  if (line) {
                    result.push(`<li>${line}</li>`);
                  }
                  lastWasTitle = false;
                } else {
                  if (inList) {
                    result.push('</ul>');
                    inList = false;
                  }
                  if (line) {
                    result.push(`<p>${line}</p>`);
                  }
                }
              }
              
              if (inList) {
                result.push('</ul>');
              }
              
              const finalHtml = result.filter(r => r.trim()).join('\n');
              
              console.log('LOG: ✅ HTML final généré, longueur:', finalHtml.length);
              console.log('LOG: ✅ HTML final (premiers 500 char):', finalHtml.substring(0, 500));
              
              setDailyTitle('');
              setProcessedOutput(finalHtml);
              
              console.log('LOG: ✅ État mis à jour avec le résumé');
              
          } else if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
              console.log('LOG: 📨 Envoi vers summarizeQuestionPeriod (Québec)...');
              console.log('LOG: 📝 Contenu envoyé:', editedTranscription.substring(0, 100) + '...');
              
              const { summarizeQuestionPeriod } = await import("@/api/functions");
              const response = await summarizeQuestionPeriod({ transcript: editedTranscription });
              
              console.log('LOG: 📬 Réponse complète reçue:', response);
              
              if (response.error) {
                  throw new Error(response.error.error || response.error.message || "Erreur du résumé PdQ Québec");
              }
              
              setDailyTitle(''); 
              
              let cleanHtml = response.data?.summary_html || response.summary_html || '';
              cleanHtml = cleanHtml.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
              
              setProcessedOutput(cleanHtml);
              
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
                const speakers = detectSpeakersFromHTML(cleanHtml, deputes); // Pass deputes
                setDetectedSpeakers(speakers);
              }
          } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) {
              console.log('LOG: 📨 Envoi vers summarizeQuestionPeriodOttawa...');
              const textLength = editedTranscription.length;
              console.log('LOG: 📝 Longueur du texte:', textLength, 'caractères');
              
              // Avertissement si le texte est très long
              if (textLength > 30000) {
                  toast({
                      title: "⚠️ Texte très long détecté",
                      description: `${textLength} caractères. Le traitement sera automatiquement limité aux 30 000 premiers caractères pour éviter un timeout.`,
                      duration: 6000
                  });
              }
              
              console.log('LOG: 📝 Contenu envoyé:', editedTranscription.substring(0, 100) + '...');

              const { summarizeQuestionPeriodOttawa } = await import("@/api/functions");
              const response = await summarizeQuestionPeriodOttawa({ transcript: editedTranscription });

              console.log('LOG: 📬 Réponse complète reçue:', response);
              console.log('LOG: 📦 response.data:', response.data);
              console.log('LOG: 📦 Type de response.data:', typeof response.data);
              console.log('LOG: 📦 Clés de response.data:', response.data ? Object.keys(response.data) : 'N/A');
              
              // LOGS DÉTAILLÉS POUR LE HTML
              console.log('LOG: 🔍 response.data?.summary_html existe?', !!response.data?.summary_html);
              console.log('LOG: 🔍 response.data?.summary_html type:', typeof response.data?.summary_html);
              console.log('LOG: 🔍 response.data?.summary_html longueur:', response.data?.summary_html?.length);
              console.log('LOG: 🔍 response.data?.summary_html contenu (500 premiers char):', response.data?.summary_html?.substring(0, 500));
              
              console.log('LOG: 🔍 response.data?.summary_points existe?', !!response.data?.summary_points);
              console.log('LOG: 🔍 response.data?.summary_points:', response.data?.summary_points);

              if (response.error) {
                  console.error('LOG: ❌ Erreur dans response:', response.error);
                  throw new Error(response.error.error || response.error.message || "Erreur du résumé PdQ Ottawa");
              }

              setDailyTitle('');

              let cleanHtml = response.data?.summary_html || '';
              console.log('LOG: 🧹 HTML AVANT nettoyage - existe?', !!cleanHtml);
              console.log('LOG: 🧹 HTML AVANT nettoyage - longueur:', cleanHtml.length);
              console.log('LOG: 🧹 HTML AVANT nettoyage - 500 premiers char:', cleanHtml.substring(0, 500));
              
              cleanHtml = cleanHtml.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
              
              console.log('LOG: ✅ HTML APRÈS nettoyage - existe?', !!cleanHtml);
              console.log('LOG: ✅ HTML APRÈS nettoyage - longueur:', cleanHtml.length);
              console.log('LOG: ✅ HTML APRÈS nettoyage - 500 premiers char:', cleanHtml.substring(0, 500));

              console.log('LOG: 🎯 Avant setProcessedOutput, cleanHtml =', cleanHtml.substring(0, 200));
              setProcessedOutput(cleanHtml);
              console.log('LOG: 🎯 Après setProcessedOutput');

              const points = response.data?.summary_points || [];
              console.log('LOG: 📌 Points reçus de Claude (Ottawa):', points);

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

              // Detect speakers for Ottawa as well, but don't map to deputes
              if (cleanHtml) {
                console.log('LOG: 👥 Détection des speakers pour Ottawa...');
                const speakersOttawa = detectSpeakersFromHTML(cleanHtml, []); // No deputes for Ottawa
                console.log('LOG: 👥 Speakers Ottawa détectés:', speakersOttawa.length, speakersOttawa);
                setDetectedSpeakersOttawa(speakersOttawa);
              } else {
                console.log('LOG: ⚠️ Pas de HTML pour détecter les speakers Ottawa');
              }
          }
          toast({ title: "✅ Traitement terminé", description: `Le texte a été traité avec succès.` });
          setHasPendingChanges(true);

      } catch (error) {
          console.error('LOG: ❌ Erreur complète:', error);
          console.error('LOG: ❌ Message d\'erreur:', error.message);
          toast({
              title: "Erreur de traitement",
              description: error.message || "Une erreur est survenue lors du traitement.",
              variant: "destructive"
          });
      } finally {
          setIsProcessingGpt(false);
      }
  };
  
  const handleSendToNewsletter = async () => {
    let summaryType = 'chronique';
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
      summaryType = 'pdq_quebec';
    } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) {
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
              : summaryType === 'pdq_ottawa'
              ? "Résumé de la période de questions (Ottawa)"
              : "Contenu généré par Retranscription",
            daily_title: dailyTitle,
            summary_text: processedOutput,
            summary_date: todayStr,
            speaker: finalSpeaker,
            type: summaryType
        };

        if (summaryType === 'pdq_quebec') {
          summaryData.speaker_mappings = detectedSpeakers
            .filter(s => s.deputeId)
            .map(s => ({
              originalText: s.originalText,
              deputeId: s.deputeId
            }));
          
          summaryData.summary_points = summaryPoints.filter(p => p.trim());
        } else if (summaryType === 'pdq_ottawa') {
          summaryData.summary_points = summaryPoints.filter(p => p.trim());
          // No speaker_mappings for Ottawa specified in the DailySummary entity in this context
        }

        if (existingSummaries.length > 0) {
            await DailySummary.update(existingSummaries[0].id, summaryData);
            toast({ 
              title: "Contenu mis à jour !", 
              description: summaryType === 'pdq_quebec' 
                ? "Le résumé PdQ Québec a été mis à jour avec les sujets du jour." 
                : summaryType === 'pdq_ottawa'
                ? "Le résumé PdQ Ottawa a été mis à jour avec les sujets du jour."
                : "Le contenu pour le bulletin d'aujourd'hui a été mis à jour." 
            });
        } else {
            await DailySummary.create(summaryData);
            toast({ 
              title: "Contenu sauvegardé !", 
              description: summaryType.includes('pdq')
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
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
                    <SelectItem value={SOURCE_TYPES.FILE}>
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Fichier Audio/Vidéo
                      </div>
                    </SelectItem>
                    <SelectItem value={SOURCE_TYPES.LIVE}>
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        Enregistrement Direct
                      </div>
                    </SelectItem>
                    <SelectItem value={SOURCE_TYPES.M3U8}>
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4" />
                        Flux Radio
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {sourceType === SOURCE_TYPES.FILE && (
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                      <p className="text-sm text-blue-800 font-medium mb-2">
                        📁 Formats acceptés : MP3, WAV, M4A, MP4, WebM
                      </p>
                      <p className="text-xs text-blue-700 mb-3">
                        Taille maximale : 25 MB (environ 15-20 minutes d'audio)
                      </p>
                      <details className="text-xs text-blue-700 mt-2">
                        <summary className="font-medium cursor-pointer hover:text-blue-900 mb-2">
                          💡 Comment transcrire une vidéo YouTube ?
                        </summary>
                        <div className="mt-2 space-y-2 bg-white p-3 rounded border border-blue-200">
                          <p className="font-medium">Méthode rapide en 3 étapes :</p>
                          <ol className="ml-4 space-y-1 list-decimal">
                            <li>
                              Allez sur{' '}
                              <a 
                                href="https://ytmp3.nu" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="underline font-medium hover:text-blue-900"
                              >
                                ytmp3.nu
                              </a>
                              {' '}ou{' '}
                              <a 
                                href="https://y2mate.com" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="underline font-medium hover:text-blue-900"
                              >
                                y2mate.com
                              </a>
                            </li>
                            <li>Collez l'URL YouTube et téléchargez le MP3</li>
                            <li>Revenez ici et uploadez le fichier ci-dessous ⬇️</li>
                          </ol>
                        </div>
                      </details>
                    </div>
                    <Input 
                      id="file-upload" 
                      type="file" 
                      accept="audio/*,video/*" 
                      onChange={(e) => handleFileUpload(e.target.files[0])} 
                      disabled={isTranscribing || isRecording}
                      className="cursor-pointer"
                    />
                  </div>
                )}
                
                {sourceType === SOURCE_TYPES.LIVE && (
                  <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <Label className="font-semibold">Source de l'enregistrement direct</Label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded-md border">
                      <Mic className="w-4 h-4 text-blue-600" />
                      <span>Microphone (votre voix)</span>
                    </div>
                    
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
                
                {isTranscribing && (
                  <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">Transcription en cours...</p>
                      <p className="text-blue-700 text-xs mt-1">Cela peut prendre 30 seconds à 2 minutes</p>
                    </div>
                  </div>
                )}
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
                      <SelectItem value={FILTERS.QUESTIONS_QUEBEC}>Résumé de la période de questions (Québec)</SelectItem>
                      <SelectItem value={FILTERS.QUESTIONS_OTTAWA}>Résumé de la période de questions (Ottawa)</SelectItem>
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

            {processedOutput && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenSquare className="w-5 h-5 text-blue-600" />
                    {selectedFilter === FILTERS.CHRONIQUE ? 'Éditer le résumé de la chronique' : 
                     selectedFilter === FILTERS.QUESTIONS_QUEBEC ? 'Résumé de la période de questions (Québec)' :
                     selectedFilter === FILTERS.QUESTIONS_OTTAWA ? 'Résumé de la période de questions (Ottawa)' :
                     'Transcription brute'}
                  </CardTitle>
                  <CardDescription>
                    {selectedFilter === FILTERS.CHRONIQUE ? 'Modifiez le résumé avant de l\'envoyer au bulletin.' :
                     selectedFilter === FILTERS.QUESTIONS_QUEBEC ? 'Vérifiez et corrigez les intervenants (Québec).' :
                     selectedFilter === FILTERS.QUESTIONS_OTTAWA ? 'Vérifiez et corrigez le contenu (Ottawa).' :
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

                       <div>
                         <Label>Contenu du résumé - {selectedFilter === FILTERS.QUESTIONS_OTTAWA ? 'OTTAWA' : selectedFilter === FILTERS.QUESTIONS_QUEBEC ? 'QUÉBEC' : 'AUTRE'}</Label>
                         <div className="text-xs text-gray-500 mb-2">
                           DEBUG: processedOutput existe? {processedOutput ? 'OUI' : 'NON'} | Longueur: {processedOutput?.length || 0} | Filtre: {selectedFilter}
                         </div>
                         {selectedFilter === FILTERS.QUESTIONS_QUEBEC ? (
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
                         ) : selectedFilter === FILTERS.QUESTIONS_OTTAWA ? (
                           <div className="prose prose-slate max-w-none" style={{ minHeight: '400px' }}>
                             <div className="text-xs text-red-600 mb-2">
                               DEBUG OTTAWA: processedOutput longueur = {processedOutput?.length || 0}
                             </div>
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
                               deputes={[]} // No depute mapping for Ottawa
                               detectedSpeakers={detectedSpeakersOttawa} // Ottawa specific speakers
                               onSpeakerChange={handleSpeakerChangeOttawa} // Ottawa specific content change handler
                               onContentChange={handlePdQContentChangeOttawa} // Ottawa specific content change handler
                             />
                           </div>
                         ) : (
                           <div style={{ minHeight: '400px' }}>
                             <style>{`
                               .ql-editor strong {
                                 display: block;
                                 font-weight: 700;
                                 font-size: 17px;
                                 margin-top: 20px;
                                 margin-bottom: 10px;
                                 color: #111827;
                               }
                               .ql-editor strong:first-child {
                                 margin-top: 0;
                               }
                               .ql-editor ul {
                                 margin-top: 8px;
                                 margin-bottom: 20px;
                                 padding-left: 20px;
                                 list-style-type: disc;
                               }
                               .ql-editor li {
                                 margin-bottom: 6px;
                                 color: #374151;
                               }
                               .ql-editor li:empty {
                                 display: none !important;
                               }
                               .ql-editor p:empty {
                                 display: none !important;
                               }
                               .ql-editor br + br {
                                 display: none;
                               }
                             `}</style>
                             <ReactQuill 
                               theme="snow" 
                               value={processedOutput} 
                               onChange={(newValue) => {
                                 // Nettoyer les éléments vides lors de l'édition
                                 const cleaned = newValue
                                   .replace(/<li><\/li>/g, '')
                                   .replace(/<li>\s*<\/li>/g, '')
                                   .replace(/<p><\/p>/g, '')
                                   .replace(/<p>\s*<\/p>/g, '');
                                 setProcessedOutput(cleaned);
                               }}
                               className="bg-white mt-1" 
                               placeholder="Le contenu apparaîtra ici une fois le texte traité..."
                             />
                           </div>
                         )}
                       </div>

                       {(selectedFilter === FILTERS.CHRONIQUE || selectedFilter === FILTERS.QUESTIONS_QUEBEC || selectedFilter === FILTERS.QUESTIONS_OTTAWA) && (
                         <Button 
                           onClick={handleSendToNewsletter} 
                           disabled={isSending || !processedOutput.replace(/<(.|\n)*?>/g, '').trim()} 
                           className="w-full bg-green-600 hover:bg-green-700"
                         >
                           {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                           {selectedFilter === FILTERS.CHRONIQUE 
                             ? 'Sauvegarder pour le bulletin' 
                             : selectedFilter === FILTERS.QUESTIONS_OTTAWA
                             ? 'Sauvegarder le résumé PdQ Ottawa'
                             : 'Sauvegarder le résumé PdQ Québec'}
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
