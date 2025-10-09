
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
import { DeputeFederal } from "@/api/entities";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PdQContentEditor from "../components/retranscription/PdQContentEditor";
import StabilityMonitor from "../components/retranscription/StabilityMonitor"; // New import

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
  Clock,
  AlertCircle,
} from "lucide-react";
import { transcribeAudio } from "@/api/functions/transcribeAudio.js";
import { generateChroniqueSummary } from "@/api/functions";

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
  const [youtubeUrl, setYoutubeUrl] = useState('');
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
  const [deputesFederaux, setDeputesFederaux] = useState([]);
  const [detectedSpeakers, setDetectedSpeakers] = useState([]);
  const [detectedSpeakersOttawa, setDetectedSpeakersOttawa] = useState([]);

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

  const statsRef = useRef({
    chunksEnvoyes: 0,
    chunksIgnores: 0,
    txReussies: 0,
    txEchouees: 0,
    motsTranscrits: 0
  });

  const detectSpeakersFromHTML = useCallback((htmlContent, availableDeputes) => {
    if (!htmlContent || !availableDeputes || availableDeputes.length === 0) return [];
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const h4Elements = doc.querySelectorAll('h4');

    const detected = Array.from(h4Elements).map((h4, index) => {
      const fullText = h4.textContent || '';
      const speakerNameMatch = fullText.match(/^([^,:]+)/);
      const speakerName = (speakerNameMatch ? speakerNameMatch[1] : fullText).trim();
      
      const normalizeName = (name) => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/^(m\.|mme|monsieur|madame|le|la|l'hon\.)\s+/i, '')
          .trim();
      };

      const normalizedSpeakerName = normalizeName(speakerName);
      let foundDepute = null;

      const deputeData = availableDeputes.map(depute => ({
        depute: depute,
        normalizedFullName: normalizeName(depute.nomComplet),
        normalizedLastName: normalizeName(depute.nom)
      }));

      foundDepute = deputeData.find(d => d.normalizedFullName === normalizedSpeakerName);

      if (!foundDepute) {
        const speakerLastNameMatch = normalizedSpeakerName.match(/\b(\w+)$/);
        if (speakerLastNameMatch) {
          const speakerLastName = speakerLastNameMatch[1];
          foundDepute = deputeData.find(d => d.normalizedLastName === speakerLastName);
        }
      }

      if (!foundDepute) {
        foundDepute = deputeData.find(d => 
          d.normalizedFullName.includes(normalizedSpeakerName) || 
          normalizedSpeakerName.includes(d.normalizedFullName)
        );
      }

      const deputeResult = foundDepute ? foundDepute.depute : null;
      
      return {
        id: `speaker-${index}-${Date.now()}`,
        originalText: fullText,
        displayName: speakerName,
        deputeId: deputeResult ? deputeResult.id : null
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
  }, []);

  const handleSpeakerChange = useCallback((speakerId, newDeputeId) => {
    console.log('handleSpeakerChange appelé:', { speakerId, newDeputeId });
    setDetectedSpeakers(prev => {
      const updated = prev.map(speaker => 
        speaker.id === speakerId ? { ...speaker, deputeId: newDeputeId } : speaker
      );
      console.log('Speakers mis à jour:', updated);
      return updated;
    });
  }, []);

  const handleSpeakerChangeOttawa = useCallback((speakerId, newDeputeId) => {
    console.log('handleSpeakerChangeOttawa appelé:', { speakerId, newDeputeId });
    setDetectedSpeakersOttawa(prev => {
      const updated = prev.map(speaker => 
        speaker.id === speakerId ? { ...speaker, deputeId: newDeputeId } : speaker
      );
      console.log('Speakers Ottawa mis à jour:', updated);
      return updated;
    });
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
    if (deputesFederaux.length > 0) {
      const newlyDetected = detectSpeakersFromHTML(newHtml, deputesFederaux);
      const existingMappingsMap = new Map(detectedSpeakersOttawa.map(s => [s.originalText, s.deputeId]));

      const updatedDetectedSpeakers = newlyDetected.map(newSpeaker => {
        const previouslyMappedDeputeId = existingMappingsMap.get(newSpeaker.originalText);
        return {
          ...newSpeaker,
          deputeId: previouslyMappedDeputeId !== undefined ? previouslyMappedDeputeId : newSpeaker.deputeId
        };
      });
      setDetectedSpeakersOttawa(updatedDetectedSpeakers);
    }
  }, [deputesFederaux, detectSpeakersFromHTML, detectedSpeakersOttawa]);

  useEffect(() => {
    if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
      const loadDeputes = async () => {
        try {
          const allDeputes = await Depute.list('-nom', 200);
          setDeputes(allDeputes);
          setDeputesFederaux([]);
        } catch (error) {
          console.error("Erreur chargement députés:", error);
          toast({ title: "Erreur", description: "Impossible de charger la liste des députés.", variant: "destructive" });
        }
      };
      loadDeputes();
    } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) {
      const loadDeputesFederaux = async () => {
        try {
          const allDeputesFederaux = await DeputeFederal.list('-nom', 350);
          setDeputesFederaux(allDeputesFederaux);
          setDeputes([]);
        } catch (error) {
          console.error("Erreur chargement députés fédéraux:", error);
          toast({ title: "Erreur", description: "Impossible de charger la liste des députés fédéraux.", variant: "destructive" });
        }
      };
      loadDeputesFederaux();
    } else {
      setDeputes([]);
      setDeputesFederaux([]);
    }
  }, [selectedFilter, toast]);

  useEffect(() => {
    const loadDailySummaries = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const summaries = await DailySummary.filter({ summary_date: todayStr });
        
        const chroniqueSummary = summaries.find(s => s.type === 'chronique');
        const pdqQuebecSummary = summaries.find(s => s.type === 'pdq_quebec');
        const pdqOttawaSummary = summaries.find(s => s.type === 'pdq_ottawa');

        setProcessedOutput('');
        setDailyTitle('');
        setDetectedSpeakers([]);
        setDetectedSpeakersOttawa([]);
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
                    let speakers = detectSpeakersFromHTML(cleanContent, deputes);
                    if (pdqQuebecSummary.speaker_mappings) {
                        speakers = speakers.map(speaker => {
                            const savedMapping = pdqQuebecSummary.speaker_mappings.find(m => m.originalText === speaker.originalText);
                            return savedMapping ? { ...speaker, deputeId: savedMapping.deputeId } : speaker;
                        });
                    }
                    setDetectedSpeakers(speakers);
                } else {
                    setDetectedSpeakers(detectSpeakersFromHTML(cleanContent, []));
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
                setProcessedOutput(cleanContent);
                setDailyTitle(pdqOttawaSummary.daily_title || ''); 
                
                if (pdqOttawaSummary.summary_points && Array.isArray(pdqOttawaSummary.summary_points)) {
                  const points = [...pdqOttawaSummary.summary_points];
                  while (points.length < 3) points.push('');
                  setSummaryPoints(points.slice(0, 3));
                }
                
                if (deputesFederaux.length > 0) {
                    let speakersOttawa = detectSpeakersFromHTML(cleanContent, deputesFederaux);
                    if (pdqOttawaSummary.speaker_mappings) {
                        speakersOttawa = speakersOttawa.map(speaker => {
                            const savedMapping = pdqOttawaSummary.speaker_mappings.find(m => m.originalText === speaker.originalText);
                            return savedMapping ? { ...speaker, deputeId: savedMapping.deputeId } : speaker;
                        });
                    }
                    setDetectedSpeakersOttawa(speakersOttawa);
                } else {
                    setDetectedSpeakersOttawa(detectSpeakersFromHTML(cleanContent, []));
                }
            } else {
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
          setEditableSummary(prev => ({ ...prev, title: '', speaker: 'Louis Lacroix', customSpeakerInput: '' }));
      }
    };
    loadDailySummaries();
  }, [selectedFilter, deputes, deputesFederaux, detectSpeakersFromHTML]);

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
        detectedSpeakersOttawa,
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
            setDetectedSpeakersOttawa(saveData.detectedSpeakersOttawa || []);
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
    toast({ title: "✅ Contenu sauvegardé et sauvegarde locale effacée" });
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
    
    // Réinitialiser les stats
    statsRef.current = {
      chunksEnvoyes: 0,
      chunksIgnores: 0,
      txReussies: 0,
      txEchouees: 0,
      motsTranscrits: 0
    };

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

      // Prioriser les formats compatibles avec Whisper
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/mpeg"
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      if (!supportedMimeType) {
        toast({
          title: "Format audio non supporté",
          description: "Votre navigateur ne supporte aucun format compatible.",
          variant: "destructive"
        });
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }
      
      console.log(`🎵 Format audio sélectionné: ${supportedMimeType}`);
      
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
      
      mediaRecorderRef.current = new MediaRecorder(recordingStream, { mimeType: supportedMimeType });
      
      chunksRef.current = [];
      let lastToastTime = Date.now();
      let lastTranscriptionTime = 0;
      
      const MIN_INTERVAL_MS = 5000;
      
      // Fonction helper pour obtenir l'extension correcte
      const getFileExtension = (mimeType) => {
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('ogg')) return 'ogg';
        if (mimeType.includes('mp4')) return 'mp4';
        if (mimeType.includes('mpeg')) return 'mp3';
        return 'webm'; // fallback
      };
      
      const transcribeWithRetry = async (audioBlob, maxRetries = 2) => {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📤 Tentative ${attempt}/${maxRetries} - Taille: ${(audioBlob.size / 1024).toFixed(1)} KB`);
            
            // Créer un nouveau blob avec le MIME type explicite
            const properBlob = new Blob([audioBlob], { type: supportedMimeType });
            const extension = getFileExtension(supportedMimeType);
            const fileName = `recording_${Date.now()}.${extension}`;
            
            console.log(`📦 Envoi: ${fileName} (${supportedMimeType})`);
            
            const formData = new FormData();
            formData.append('audio', properBlob, fileName);
            
            const { data } = await transcribeAudio(formData);
            
            // ✅ Validation stricte de la réponse
            if (!data) {
              throw new Error('Aucune donnée reçue du serveur');
            }
            
            if (!data.success) {
              throw new Error(data.error || 'Transcription échouée');
            }
            
            const transcriptionText = data.transcription?.trim();
            
            // ✅ CORRECTION : Accepter les transcriptions même très courtes
            if (!transcriptionText) {
              throw new Error('Transcription complètement vide');
            }
            
            // ⚠️ Warning si transcription très courte, mais on accepte quand même
            if (transcriptionText.length < 3) {
              console.warn(`⚠️ Transcription très courte (${transcriptionText.length} car): "${transcriptionText}"`);
            }
            
            console.log(`✅ Tentative ${attempt} réussie: ${transcriptionText.length} caractères`);
            return {
              success: true,
              text: transcriptionText,
              wordCount: transcriptionText.split(/\s+/).filter(w => w.length > 0).length
            };
            
          } catch (error) {
            lastError = error;
            console.error(`❌ Tentative ${attempt}/${maxRetries} échouée:`, error.message);
            
            if (attempt < maxRetries) {
              const delayMs = attempt * 1500;
              console.log(`⏳ Attente de ${delayMs}ms avant retry...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }
        
        console.error(`❌ Échec définitif après ${maxRetries} tentatives:`, lastError?.message);
        return {
          success: false,
          error: lastError?.message || 'Erreur inconnue'
        };
      };
      
      const transcribeAccumulatedAudio = async () => {
        const now = Date.now();
        const timeSinceLast = now - lastTranscriptionTime;
        
        // ✅ Rate limiting
        if (timeSinceLast < MIN_INTERVAL_MS) {
          const waitTime = ((MIN_INTERVAL_MS - timeSinceLast) / 1000).toFixed(1);
          console.log(`⏳ Rate limit: attente de ${waitTime}s avant prochaine transcription`);
          return;
        }
        
        if (chunksRef.current.length === 0) {
          console.log('⚠️ Aucun chunk à transcrire');
          return;
        }
        
        // Créer le blob avec le MIME type correct
        const audioBlob = new Blob([...chunksRef.current], { type: supportedMimeType });
        
        console.log(`📦 Préparation transcription: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB, type: ${supportedMimeType}`);
        
        // ✅ VALIDATION 1 : Taille minimum
        if (audioBlob.size < 10000) {
          console.log('⏭️ Chunk ignoré (< 10 KB)');
          statsRef.current.chunksIgnores++;
          return;
        }
        
        // ✅ VALIDATION 2 : Taille maximum Whisper
        if (audioBlob.size > 24 * 1024 * 1024) {
          console.warn('⚠️ Blob trop volumineux (> 24 MB), réduction du buffer');
          statsRef.current.chunksIgnores++;
          chunksRef.current = chunksRef.current.slice(-40);
          window.dispatchEvent(new CustomEvent('retranscription:failed'));
          return;
        }
        
        lastTranscriptionTime = now;
        statsRef.current.chunksEnvoyes++;
        window.dispatchEvent(new CustomEvent('retranscription:sent'));
        
        const result = await transcribeWithRetry(audioBlob, 2);
        
        if (result.success) {
          statsRef.current.txReussies++;
          statsRef.current.motsTranscrits += result.wordCount;
          
          setEditedTranscription(result.text);
          lastSuccessfulTranscriptionRef.current = Date.now();
          setAudioQualityIndicator('good');
          
          console.log('🗑️ Vidage du buffer de chunks');
          chunksRef.current = [];
          
          const tauxSucces = Math.round((statsRef.current.txReussies / statsRef.current.chunksEnvoyes) * 100);
          console.log(`📊 Stats: ${statsRef.current.txReussies}/${statsRef.current.chunksEnvoyes} réussies (${tauxSucces}%), ${statsRef.current.chunksIgnores} ignorés, ${statsRef.current.motsTranscrits} mots`);
          
          window.dispatchEvent(new CustomEvent('retranscription:success', { 
            detail: { 
              text: result.text,
              wordCount: result.wordCount,
              stats: { ...statsRef.current }
            } 
          }));
          
          const toastNow = Date.now();
          if (toastNow - lastToastTime > 60000) {
            toast({ 
              title: "Transcription en cours", 
              description: `Taux de succès: ${tauxSucces}% - ${statsRef.current.motsTranscrits} mots transcrits`,
              duration: 2000 
            });
            lastToastTime = toastNow;
          }
          
        } else {
          statsRef.current.txEchouees++;
          chunksRef.current = chunksRef.current.slice(-30);
          window.dispatchEvent(new CustomEvent('retranscription:failed'));
          console.error('❌ Transcription échouée:', result.error);
        }
      };

      keepAliveIntervalRef.current = setInterval(() => {
        const tauxSucces = statsRef.current.chunksEnvoyes > 0 
          ? Math.round((statsRef.current.txReussies / statsRef.current.chunksEnvoyes) * 100)
          : 0;
        
        console.log('💓 Keep-alive: enregistrement actif, durée:', Math.floor(recordingDuration / 1000), 's');
        console.log(`📦 Buffer: ${chunksRef.current.length} chunks | Stats: ${statsRef.current.txReussies}/${statsRef.current.chunksEnvoyes} (${tauxSucces}%)`);
        
        if (document.hidden) {
          console.log('⚠️ Page cachée, keep-alive actif');
        }
      }, KEEP_ALIVE_INTERVAL_MS);
      
      mediaRecorderRef.current.ondataavailable = e => { 
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data); 
          console.log(`📦 Chunk reçu: ${(e.data.size / 1024).toFixed(1)} KB, total: ${chunksRef.current.length} chunks`);
          window.dispatchEvent(new CustomEvent('retranscription:chunk'));
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        // Nettoyage des intervalles
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
        
        // Arrêt des pistes audio
        stream.getTracks().forEach(track => track.stop());
        if (recordingStream !== stream) {
          recordingStream.getTracks().forEach(track => track.stop());
        }
        
        setIsRecording(false);
        setRecordingStartTime(null);
        setRecordingDuration(0);

        // Préparation du blob final
        let finalChunks = [...chunksRef.current];
        // Créer le blob final avec le bon MIME type
        let audioBlob = new Blob(finalChunks, { type: supportedMimeType });
        
        // Réduction si trop gros
        while (audioBlob.size > 24 * 1024 * 1024 && finalChunks.length > 10) {
          finalChunks = finalChunks.slice(10);
          audioBlob = new Blob(finalChunks, { type: supportedMimeType });
          console.warn(`⚠️ Réduction du blob final: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // Validation taille minimum
        if (audioBlob.size < 10000) {
            handleTranscriptionError("Aucun son enregistré. Vérifiez que votre microphone fonctionne.");
            return;
        }

        // Afficher le résumé final
        const tauxSucces = statsRef.current.chunksEnvoyes > 0 
          ? Math.round((statsRef.current.txReussies / statsRef.current.chunksEnvoyes) * 100)
          : 0;
        
        console.log('\n📊 ═══════════════════════════════════════════');
        console.log('📊 RÉSUMÉ FINAL DE L\'ENREGISTREMENT');
        console.log('📊 ═══════════════════════════════════════════');
        console.log(`  ✅ Chunks envoyés à l'API: ${statsRef.current.chunksEnvoyes}`);
        console.log(`  ⏭️  Chunks ignorés: ${statsRef.current.chunksIgnores}`);
        console.log(`  ✓  Transcriptions réussies: ${statsRef.current.txReussies}`);
        console.log(`  ✗  Transcriptions échouées: ${statsRef.current.txEchouees}`);
        console.log(`  📈 Taux de succès: ${tauxSucces}%`);
        console.log(`  📝 Mots transcrits: ${statsRef.current.motsTranscrits}`);
        console.log('📊 ═══════════════════════════════════════════\n');
        
        toast({ 
          title: "Enregistrement terminé", 
          description: `Taux de succès: ${tauxSucces}% - ${statsRef.current.motsTranscrits} mots transcrits - Transcription finale...`,
          duration: 5000
        });
        
        // Transcription finale
        await processAudioBlob(audioBlob);
      };

      // Démarrage de l'enregistrement avec chunks de 1 seconde
      mediaRecorderRef.current.start(1000);
      
      // Première transcription après 5 secondes
      setTimeout(transcribeAccumulatedAudio, FIRST_TRANSCRIPTION_DELAY_MS);
      
      // Deuxième transcription après 15 secondes
      setTimeout(transcribeAccumulatedAudio, 15000);
      
      // Transcriptions périodiques toutes les 30 secondes
      setTimeout(() => {
        transcriptionIntervalRef.current = setInterval(transcribeAccumulatedAudio, TRANSCRIPTION_INTERVAL_MS);
      }, 20000);
      
      toast({ 
        title: "🎙️ Enregistrement démarré", 
        description: `Format: ${supportedMimeType} - Système de retry + rate limiting activés` 
      });

    } catch (error) {
      console.error("❌ Erreur critique de capture:", error);
      
      // Nettoyage en cas d'erreur
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

      if (error.name === 'NotAllowedError') {
        toast({ 
          title: "Permission refusée", 
          description: "Vous devez autoriser l'accès au microphone.", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Erreur de capture", 
          description: "Impossible de démarrer l'enregistrement.", 
          variant: "destructive" 
        });
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
      const getFileExtension = (mimeType) => {
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('ogg')) return 'ogg';
        if (mimeType.includes('mp4')) return 'mp4';
        if (mimeType.includes('mpeg')) return 'mp3';
        return 'webm'; // fallback
      };
      
      const transcribeWithRetry = async (blob, maxRetries = 2) => {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📤 Tentative finale ${attempt}/${maxRetries} - Taille: ${(blob.size / 1024).toFixed(1)} KB`);
            const formData = new FormData();
            
            // Re-detect the mime type from the blob if not explicitly known, or assume webm for safety.
            // For this specific use case, it's safer to use the 'supportedMimeType' captured earlier.
            const mimeTypeForFinalBlob = mediaRecorderRef.current ? mediaRecorderRef.current.mimeType : 'audio/webm';
            const extension = getFileExtension(mimeTypeForFinalBlob);
            
            formData.append('audio', blob, `recording_final_${Date.now()}.${extension}`);
            const { data } = await transcribeAudio(formData);
            if (!data || !data.success || !data.transcription) { // Changed from data.transcription.trim() to data.transcription
              throw new Error(data?.error || 'Transcription finale vide ou échouée');
            }
            const transcriptionText = data.transcription.trim();
            if (!transcriptionText) { // Check for empty after trimming for error scenario
              throw new Error('Transcription finale complètement vide');
            }
            if (transcriptionText.length < 3) {
              console.warn(`⚠️ Transcription finale très courte (${transcriptionText.length} car): "${transcriptionText}"`);
            }
            console.log(`✅ Tentative finale ${attempt} réussie: ${transcriptionText.length} caractères`);
            return { success: true, transcription: transcriptionText };
          } catch (error) {
            lastError = error;
            console.error(`❌ Tentative finale ${attempt}/${maxRetries} échouée:`, error.message);
            if (attempt < maxRetries) {
              const delayMs = attempt * 2000;
              console.log(`⏳ Attente de ${delayMs}ms avant retry final...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }
        return { success: false, error: lastError?.message || 'Erreur inconnue' };
      };

      const result = await transcribeWithRetry(audioBlob);

      if (result.success) {
        handleTranscriptionSuccess(result.transcription);
      } else {
        handleTranscriptionError(result.error);
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

      try {
          if (selectedFilter === FILTERS.BRUTE) {
              const formattedBrute = editedTranscription.replace(/\n/g, '<br>');
              setProcessedOutput(formattedBrute);
              setDailyTitle("Transcription brute");
              
          } else if (selectedFilter === FILTERS.CHRONIQUE) {
              const { data, error } = await generateChroniqueSummary({ text_to_summarize: editedTranscription });
              
              if (error) {
                  const errorMessage = error.data?.error || error.error || error.message || "Erreur du résumé de chronique";
                  
                  if (errorMessage.includes('credit balance is too low') || errorMessage.includes('insufficient credits')) {
                      throw new Error("CRÉDITS ANTHROPIC ÉPUISÉS");
                  }
                  
                  throw new Error(errorMessage);
              }
              
              let summaryText = data?.summary || '';
              
              if (!summaryText) {
                  throw new Error("Aucun résumé reçu du serveur");
              }
              
              summaryText = summaryText
                .replace(/```html\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
              
              summaryText = summaryText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
              
              const lines = summaryText.split('\n').map(l => l.trim()).filter(l => l);
              let result = [];
              let inList = false;
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.startsWith('<strong>')) {
                  if (inList) {
                    result.push('</ul>');
                    inList = false;
                  }
                  result.push(`<p>${line}</p>`);
                  continue;
                }
                
                if (line.startsWith('<ul>')) {
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

                const bulletMatch = line.match(/^[-•]\s+/);
                if (bulletMatch || line.startsWith('<li>')) {
                  if (!inList) {
                    result.push('<ul>');
                    inList = true;
                  }
                  
                  let cleanedPoint = line.replace(/^[-•]\s+/, '').replace(/^<li>/, '').replace(/<\/li>$/, '').trim();
                  
                  if (cleanedPoint) {
                    result.push(`<li>${cleanedPoint}</li>`);
                  }
                  continue;
                }
                
                if (inList) {
                  result.push('</ul>');
                }
                if (line) {
                  result.push(`<p>${line}</p>`);
                }
              }
              
              if (inList) {
                result.push('</ul>');
              }
              
              const finalHtml = result.filter(r => r.trim()).join('\n');
              
              setDailyTitle('');
              setProcessedOutput(finalHtml);
              
          } else if (selectedFilter === FILTERS.QUESTIONS_QUEBEC) {
              const deputesList = deputes
                .map(d => `${d.nomComplet} (${d.allegeanceAbrege})`)
                .sort()
                .join('\n');

              const { summarizeQuestionPeriod } = await import("@/api/functions");

              console.log('LOG: 📨 Envoi vers summarizeQuestionPeriod...');
              
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: La génération prend trop de temps (>2 minutes). Essayez avec une transcription plus courte.')), 120000)
              );

              const summaryPromise = summarizeQuestionPeriod({
                transcript: editedTranscription,
                deputes_reference: deputesList
              });

              const response = await Promise.race([summaryPromise, timeoutPromise]);
              
              console.log('LOG: 📬 Réponse complète reçue:', response);
              
              if (response.error) {
                  const errorMessage = response.error.error || response.error.message || (typeof response.error === 'string' ? response.error : "Erreur du résumé PdQ Québec");
                  
                  if (errorMessage.includes('credit balance is too low') || errorMessage.includes('insufficient credits')) {
                      throw new Error("CRÉDITS ANTHROPIC ÉPUISÉS");
                  }
                  
                  throw new Error(errorMessage);
              }
              
              // CORRECTION : Accéder correctement aux données
              const summaryHtml = response.data?.summary_html || response.summary_html || '';
              const summaryPointsArray = response.data?.summary_points || response.summary_points || [];
              
              console.log('LOG: 📄 HTML extrait:', summaryHtml.substring(0, 300));
              console.log('LOG: 📌 Points extraits:', summaryPointsArray);
              
              if (!summaryHtml || !summaryHtml.trim()) {
                  throw new Error("Aucun contenu HTML reçu du serveur");
              }
              
              setDailyTitle(''); 
              
              let cleanHtml = summaryHtml.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
              
              setProcessedOutput(cleanHtml);
              
              if (summaryPointsArray && summaryPointsArray.length > 0) {
                  const displayPoints = [...summaryPointsArray.slice(0, 3)];
                  while (displayPoints.length < 3) {
                      displayPoints.push('');
                  }
                  setSummaryPoints(displayPoints);
              } else {
                  setSummaryPoints(['', '', '']);
              }
              
              if (deputes.length > 0) {
                const speakers = detectSpeakersFromHTML(cleanHtml, deputes);
                setDetectedSpeakers(speakers);
              }
              
          } else if (selectedFilter === FILTERS.QUESTIONS_OTTAWA) {
              const deputesList = deputesFederaux
                .map(d => `${d.nomComplet} (${d.allegeanceAbrege})`)
                .sort()
                .join('\n');

              const { summarizeQuestionPeriodOttawa } = await import("@/api/functions");

              console.log('LOG: 📨 Envoi vers summarizeQuestionPeriodOttawa...');
              
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: La génération prend trop de temps (>2 minutes). Essayez avec une transcription plus courte.')), 120000)
              );

              const summaryPromise = summarizeQuestionPeriodOttawa({
                transcript: editedTranscription,
                deputes_reference: deputesList
              });

              const response = await Promise.race([summaryPromise, timeoutPromise]);
              
              console.log('LOG: 📬 Réponse complète reçue (Ottawa):', response);

              if (response.error) {
                  const errorMessage = response.error.error || response.error.message || (typeof response.error === 'string' ? response.error : "Erreur du résumé PdQ Ottawa");
                  
                  if (errorMessage.includes('credit balance is too low') || errorMessage.includes('insufficient credits')) {
                      throw new Error("CRÉDITS ANTHROPIC ÉPUISÉS");
                  }
                  
                  throw new Error(errorMessage);
              }

              // CORRECTION : Accéder correctement aux données
              const summaryHtml = response.data?.summary_html || response.summary_html || '';
              const summaryPointsArray = response.data?.summary_points || response.summary_points || [];
              
              console.log('LOG: 📄 HTML extrait (Ottawa):', summaryHtml.substring(0, 300));
              console.log('LOG: 📌 Points extraits (Ottawa):', summaryPointsArray);
              
              if (!summaryHtml || !summaryHtml.trim()) {
                  throw new Error("Aucun contenu HTML reçu du serveur");
              }

              setDailyTitle('');

              let cleanHtml = summaryHtml.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();

              setProcessedOutput(cleanHtml);

              if (summaryPointsArray && summaryPointsArray.length > 0) {
                  const displayPoints = [...summaryPointsArray.slice(0, 3)];
                  while (displayPoints.length < 3) {
                      displayPoints.push('');
                  }
                  setSummaryPoints(displayPoints);
              } else {
                  setSummaryPoints(['', '', '']);
              }

              if (deputesFederaux.length > 0) {
                const speakersOttawa = detectSpeakersFromHTML(cleanHtml, deputesFederaux);
                setDetectedSpeakersOttawa(speakersOttawa);
              }
          }
          
          toast({ title: "✅ Traitement terminé", description: `Le texte a été traité avec succès.` });
          setHasPendingChanges(true);

      } catch (error) {
          console.error('LOG: ❌ Erreur complète:', error);
          let descriptionMessage = error.message || "Une erreur est survenue lors du traitement.";

          if (descriptionMessage.includes('CRÉDITS ANTHROPIC ÉPUISÉS') || descriptionMessage.includes('credit balance is too low') || descriptionMessage.includes('insufficient credits')) {
              toast({
                  title: "💳 Crédits Anthropic épuisés",
                  description: "Votre compte Claude AI n'a plus de crédits. Rendez-vous sur https://console.anthropic.com/settings/billing pour recharger votre compte.",
                  variant: "destructive",
                  duration: 15000
              });
          } else if (error.message && error.message.includes('Timeout')) {
              descriptionMessage = error.message;
              toast({
                  title: "Erreur de traitement",
                  description: descriptionMessage,
                  variant: "destructive"
              });
          } else if (error.response?.data?.error) {
              descriptionMessage = error.response.data.error;
              toast({
                  title: "Erreur de traitement",
                  description: descriptionMessage,
                  variant: "destructive"
              });
          } else {
              toast({
                  title: "Erreur de traitement",
                  description: descriptionMessage,
                  variant: "destructive"
              });
          }
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
            type: summaryType, // Explicitly set the type
            summary_date: todayStr,
            speaker: finalSpeaker, // Only relevant for chronique, but keep for consistency
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
          summaryData.speaker_mappings = detectedSpeakersOttawa
            .filter(s => s.deputeId)
            .map(s => ({
              originalText: s.originalText,
              deputeId: s.deputeId
            }));
          summaryData.summary_points = summaryPoints.filter(p => p.trim());
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

        {/* Stability Monitor */}
        {isRecording && (
          <StabilityMonitor 
            isRecording={isRecording}
            recordingDuration={recordingDuration}
          />
        )}

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
                    <SelectItem value={SOURCE_TYPES.FILE}><div className="flex items-center gap-2"><Upload className="w-4 h-4" />Fichier</div></SelectItem>
                    <SelectItem value={SOURCE_TYPES.LIVE}><div className="flex items-center gap-2"><Mic className="w-4 h-4" />Enregistrement Direct</div></SelectItem>
                    <SelectItem value={SOURCE_TYPES.M3U8}><div className="flex items-center gap-2"><Radio className="w-4 h-4" />Flux Radio</div></SelectItem>
                    <SelectItem value={SOURCE_TYPES.YOUTUBE}><div className="flex items-center gap-2"><Youtube className="w-4 h-4" />YouTube</div></SelectItem>
                  </SelectContent>
                </Select>
                
                {sourceType === SOURCE_TYPES.FILE && <Input id="file-upload" type="file" accept="audio/*,video/*" onChange={(e) => handleFileUpload(e.target.files[0])} disabled={isTranscribing || isRecording} />}
                
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
                      <SelectItem value={FILTERS.QUESTIONS_QUEBEC}>Résumé de la période de questions (Québec)</SelectItem>
                      <SelectItem value={FILTERS.QUESTIONS_OTTAWA}>Résumé de la période de questions (Ottawa)</SelectItem>
                      <SelectItem value={FILTERS.BRUTE}>Transcription brute (aucun traitement)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {selectedFilter === FILTERS.QUESTIONS_OTTAWA && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold mb-1">⚠️ Vérification importante</p>
                          <p>L'IA peut se tromper ou inventer des noms de députés. Vérifiez TOUJOURS l'identité des intervenants dans les dropdowns après le traitement.</p>
                        </div>
                      </div>
                    </div>
                  )}
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
                     selectedFilter === FILTERS.QUESTIONS_OTTAWA ? 'Vérifiez et corrigez les intervenants (Ottawa).' :
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
                             <div className="w-1 h-8 bg-purple-600 text-white rounded-full"></div>
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
                             deputes={deputesFederaux}
                             detectedSpeakers={detectedSpeakersOttawa}
                             onSpeakerChange={handleSpeakerChangeOttawa}
                             onContentChange={handlePdQContentChangeOttawa}
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
