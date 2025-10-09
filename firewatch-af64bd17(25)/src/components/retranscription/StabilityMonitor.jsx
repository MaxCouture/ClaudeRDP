import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, SkipForward } from "lucide-react";

export default function StabilityMonitor({ isRecording, recordingDuration }) {
  const [metrics, setMetrics] = useState({
    chunksGenerated: 0,
    chunksEnvoyes: 0,
    chunksIgnores: 0,
    transcriptionsSuccess: 0,
    transcriptionsFailed: 0,
    lastTranscriptionTime: null,
    averageInterval: 0,
    wordCount: 0
  });

  const [intervalTimes, setIntervalTimes] = useState([]);

  useEffect(() => {
    if (!isRecording) {
      setMetrics({
        chunksGenerated: 0,
        chunksEnvoyes: 0,
        chunksIgnores: 0,
        transcriptionsSuccess: 0,
        transcriptionsFailed: 0,
        lastTranscriptionTime: null,
        averageInterval: 0,
        wordCount: 0
      });
      setIntervalTimes([]);
    }
  }, [isRecording]);

  useEffect(() => {
    const handleChunkGenerated = () => {
      setMetrics(prev => ({ ...prev, chunksGenerated: prev.chunksGenerated + 1 }));
    };

    const handleTranscriptionSent = () => {
      setMetrics(prev => {
        const now = Date.now();
        if (prev.lastTranscriptionTime) {
          const interval = (now - prev.lastTranscriptionTime) / 1000;
          setIntervalTimes(prevIntervals => [...prevIntervals, interval]);
        }
        return {
          ...prev,
          chunksEnvoyes: prev.chunksEnvoyes + 1,
          lastTranscriptionTime: now
        };
      });
    };

    const handleTranscriptionSuccess = (event) => {
      const wordCount = event.detail?.wordCount || 0;
      const stats = event.detail?.stats;
      
      setMetrics(prev => ({
        ...prev,
        transcriptionsSuccess: stats?.txReussies || (prev.transcriptionsSuccess + 1),
        wordCount: stats?.motsTranscrits || (prev.wordCount + wordCount),
        chunksIgnores: stats?.chunksIgnores || prev.chunksIgnores
      }));
    };

    const handleTranscriptionFailed = () => {
      setMetrics(prev => ({ ...prev, transcriptionsFailed: prev.transcriptionsFailed + 1 }));
    };

    window.addEventListener('retranscription:chunk', handleChunkGenerated);
    window.addEventListener('retranscription:sent', handleTranscriptionSent);
    window.addEventListener('retranscription:success', handleTranscriptionSuccess);
    window.addEventListener('retranscription:failed', handleTranscriptionFailed);

    return () => {
      window.removeEventListener('retranscription:chunk', handleChunkGenerated);
      window.removeEventListener('retranscription:sent', handleTranscriptionSent);
      window.removeEventListener('retranscription:success', handleTranscriptionSuccess);
      window.removeEventListener('retranscription:failed', handleTranscriptionFailed);
    };
  }, []);

  // Calculer le taux de succès (sur les chunks ENVOYÉS, pas générés)
  const successRate = metrics.chunksEnvoyes > 0
    ? Math.round((metrics.transcriptionsSuccess / metrics.chunksEnvoyes) * 100)
    : 0;

  const averageInterval = intervalTimes.length > 0
    ? (intervalTimes.reduce((a, b) => a + b, 0) / intervalTimes.length).toFixed(1)
    : 0;

  if (!isRecording) return null;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Activity className="w-5 h-5 animate-pulse" />
          Monitoring de stabilité - ÉTAPE 0 (BASELINE)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Chunks générés */}
          <div className="bg-white p-3 rounded-lg border border-blue-100">
            <div className="text-xs text-gray-600 mb-1">Chunks générés</div>
            <div className="text-2xl font-bold text-blue-600">{metrics.chunksGenerated}</div>
          </div>

          {/* Chunks envoyés (valides) */}
          <div className="bg-white p-3 rounded-lg border border-indigo-100">
            <div className="text-xs text-gray-600 mb-1">Chunks envoyés</div>
            <div className="text-2xl font-bold text-indigo-600">{metrics.chunksEnvoyes}</div>
          </div>

          {/* Chunks ignorés */}
          <div className="bg-white p-3 rounded-lg border border-orange-100">
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <SkipForward className="w-3 h-3 text-orange-600" />
              Ignorés
            </div>
            <div className="text-2xl font-bold text-orange-600">{metrics.chunksIgnores}</div>
          </div>

          {/* Succès */}
          <div className="bg-white p-3 rounded-lg border border-green-100">
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              Réussies
            </div>
            <div className="text-2xl font-bold text-green-600">{metrics.transcriptionsSuccess}</div>
          </div>

          {/* Échecs */}
          <div className="bg-white p-3 rounded-lg border border-red-100">
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-600" />
              Échecs
            </div>
            <div className="text-2xl font-bold text-red-600">{metrics.transcriptionsFailed}</div>
          </div>

          {/* Taux de succès (calculé sur chunks ENVOYÉS) */}
          <div className="bg-white p-3 rounded-lg border border-purple-100">
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-purple-600" />
              Taux de succès
            </div>
            <div className="text-2xl font-bold text-purple-600">{successRate}%</div>
          </div>

          {/* Intervalle moyen */}
          <div className="bg-white p-3 rounded-lg border border-orange-100">
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-600" />
              Intervalle moy.
            </div>
            <div className="text-2xl font-bold text-orange-600">{averageInterval}s</div>
          </div>

          {/* Mots transcrits */}
          <div className="bg-white p-3 rounded-lg border border-teal-100">
            <div className="text-xs text-gray-600 mb-1">Mots transcrits</div>
            <div className="text-2xl font-bold text-teal-600">{metrics.wordCount}</div>
          </div>
        </div>

        {/* Badge de qualité */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {successRate >= 95 && (
            <Badge className="bg-green-500 text-white text-base px-4 py-1">✅ Excellent</Badge>
          )}
          {successRate >= 80 && successRate < 95 && (
            <Badge className="bg-blue-500 text-white text-base px-4 py-1">✓ Bon</Badge>
          )}
          {successRate >= 60 && successRate < 80 && (
            <Badge className="bg-orange-500 text-white text-base px-4 py-1">⚠️ Moyen</Badge>
          )}
          {successRate < 60 && (
            <Badge className="bg-red-500 text-white text-base px-4 py-1">❌ Faible</Badge>
          )}
        </div>

        {/* Aide pour documenter */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-900 font-medium mb-2">
            📝 À noter dans la page "Tests de stabilité" :
          </p>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>• Chunks envoyés: <strong>{metrics.chunksEnvoyes}</strong></li>
            <li>• Ignorés (trop petits/gros): <strong>{metrics.chunksIgnores}</strong></li>
            <li>• Réussis: <strong>{metrics.transcriptionsSuccess}</strong></li>
            <li>• Échecs: <strong>{metrics.transcriptionsFailed}</strong></li>
            <li>• Taux: <strong>{successRate}%</strong> (calculé sur envoyés)</li>
            <li>• Intervalle: <strong>{averageInterval}s</strong></li>
            <li>• Mots: <strong>{metrics.wordCount}</strong></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}