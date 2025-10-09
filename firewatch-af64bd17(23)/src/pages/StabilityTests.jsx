import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, FileText, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";

export default function StabilityTestsPage() {
  const [test1, setTest1] = useState({
    date: '',
    chunks: '',
    sent: '',
    success: '',
    failed: '',
    avgInterval: '',
    words: '',
    notes: ''
  });

  const [test2, setTest2] = useState({
    date: '',
    chunks: '',
    sent: '',
    success: '',
    failed: '',
    avgInterval: '',
    words: '',
    notes: ''
  });

  const [test3, setTest3] = useState({
    date: '',
    chunks: '',
    sent: '',
    success: '',
    failed: '',
    avgInterval: '',
    words: '',
    notes: ''
  });

  const calculateSuccessRate = (success, sent) => {
    if (!success || !sent || sent === 0) return '0';
    return Math.round((parseInt(success) / parseInt(sent)) * 100);
  };

  const calculateAverage = () => {
    const tests = [test1, test2, test3];
    const validTests = tests.filter(t => t.success && t.sent);
    if (validTests.length === 0) return { rate: 0, interval: 0 };

    const totalRate = validTests.reduce((sum, t) => sum + calculateSuccessRate(t.success, t.sent), 0);
    const totalInterval = validTests.reduce((sum, t) => sum + (parseFloat(t.avgInterval) || 0), 0);

    return {
      rate: Math.round(totalRate / validTests.length),
      interval: (totalInterval / validTests.length).toFixed(1)
    };
  };

  const avg = calculateAverage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Tests de stabilité</h1>
            <p className="text-slate-600 mt-1">Documentation des performances de retranscription en temps réel</p>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              📊 ÉTAPE 0 : BASELINE (Avant optimisations)
            </CardTitle>
            <CardDescription>Établir une référence de performance AVANT toute modification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">⚙️ Configuration actuelle</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Intervalle de transcription: <strong>30 secondes</strong></li>
                  <li>• Premier chunk: <strong>5 secondes</strong></li>
                  <li>• Durée max: <strong>2 heures</strong></li>
                  <li>• Keep-alive: <strong>60 secondes</strong></li>
                  <li>• Format audio: <strong>WebM/Opus ou MP4</strong></li>
                  <li>• API: <strong>OpenAI Whisper</strong></li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">📝 Instructions de test</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Aller sur la page <strong>Retranscription</strong></li>
                  <li>• Démarrer un enregistrement de <strong>2 minutes</strong></li>
                  <li>• Observer le panneau de monitoring en temps réel</li>
                  <li>• Noter les métriques après l'arrêt</li>
                  <li>• Documenter ci-dessous</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="test1" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="test1">Test #1</TabsTrigger>
            <TabsTrigger value="test2">Test #2</TabsTrigger>
            <TabsTrigger value="test3">Test #3</TabsTrigger>
            <TabsTrigger value="summary">Résumé</TabsTrigger>
          </TabsList>

          <TabsContent value="test1">
            <Card>
              <CardHeader>
                <CardTitle>🧪 Test #1 - Baseline</CardTitle>
                <CardDescription>
                  Conditions: Microphone dans un environnement de bureau normal (silence relatif)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Date & Heure</label>
                    <Input 
                      type="datetime-local" 
                      value={test1.date} 
                      onChange={(e) => setTest1({...test1, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Chunks générés</label>
                    <Input 
                      type="number" 
                      value={test1.chunks} 
                      onChange={(e) => setTest1({...test1, chunks: e.target.value})}
                      placeholder="Ex: 120"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Chunks envoyés (TX)</label>
                    <Input 
                      type="number" 
                      value={test1.sent} 
                      onChange={(e) => setTest1({...test1, sent: e.target.value})}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Taux de succès</label>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={calculateSuccessRate(test1.success, test1.sent) >= 95 ? "default" : "destructive"}>
                        {calculateSuccessRate(test1.success, test1.sent)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Transcriptions réussies</label>
                    <Input 
                      type="number" 
                      value={test1.success} 
                      onChange={(e) => setTest1({...test1, success: e.target.value})}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Transcriptions échouées</label>
                    <Input 
                      type="number" 
                      value={test1.failed} 
                      onChange={(e) => setTest1({...test1, failed: e.target.value})}
                      placeholder="Ex: 0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Temps moyen entre TX (s)</label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={test1.avgInterval} 
                      onChange={(e) => setTest1({...test1, avgInterval: e.target.value})}
                      placeholder="Ex: 30.2"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Mots transcrits au total</label>
                  <Input 
                    type="number" 
                    value={test1.words} 
                    onChange={(e) => setTest1({...test1, words: e.target.value})}
                    placeholder="Ex: 245"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Notes & Observations</label>
                  <Textarea 
                    value={test1.notes} 
                    onChange={(e) => setTest1({...test1, notes: e.target.value})}
                    placeholder="Problèmes rencontrés, comportements étranges, qualité audio observée..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test2">
            <Card>
              <CardHeader>
                <CardTitle>🧪 Test #2 - Baseline</CardTitle>
                <CardDescription>
                  Conditions: Microphone + parole continue (lecture d'un texte pendant 2 minutes)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Date & Heure</label>
                    <Input 
                      type="datetime-local" 
                      value={test2.date} 
                      onChange={(e) => setTest2({...test2, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Chunks générés</label>
                    <Input 
                      type="number" 
                      value={test2.chunks} 
                      onChange={(e) => setTest2({...test2, chunks: e.target.value})}
                      placeholder="Ex: 120"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Chunks envoyés (TX)</label>
                    <Input 
                      type="number" 
                      value={test2.sent} 
                      onChange={(e) => setTest2({...test2, sent: e.target.value})}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Taux de succès</label>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={calculateSuccessRate(test2.success, test2.sent) >= 95 ? "default" : "destructive"}>
                        {calculateSuccessRate(test2.success, test2.sent)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Transcriptions réussies</label>
                    <Input 
                      type="number" 
                      value={test2.success} 
                      onChange={(e) => setTest2({...test2, success: e.target.value})}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Transcriptions échouées</label>
                    <Input 
                      type="number" 
                      value={test2.failed} 
                      onChange={(e) => setTest2({...test2, failed: e.target.value})}
                      placeholder="Ex: 0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Temps moyen entre TX (s)</label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={test2.avgInterval} 
                      onChange={(e) => setTest2({...test2, avgInterval: e.target.value})}
                      placeholder="Ex: 30.2"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Mots transcrits au total</label>
                  <Input 
                    type="number" 
                    value={test2.words} 
                    onChange={(e) => setTest2({...test2, words: e.target.value})}
                    placeholder="Ex: 245"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Notes & Observations</label>
                  <Textarea 
                    value={test2.notes} 
                    onChange={(e) => setTest2({...test2, notes: e.target.value})}
                    placeholder="Problèmes rencontrés, comportements étranges, qualité audio observée..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test3">
            <Card>
              <CardHeader>
                <CardTitle>🧪 Test #3 - Baseline</CardTitle>
                <CardDescription>
                  Conditions: Microphone + alternance silence/parole (15s parole, 15s silence)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Date & Heure</label>
                    <Input 
                      type="datetime-local" 
                      value={test3.date} 
                      onChange={(e) => setTest3({...test3, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Chunks générés</label>
                    <Input 
                      type="number" 
                      value={test3.chunks} 
                      onChange={(e) => setTest3({...test3, chunks: e.target.value})}
                      placeholder="Ex: 120"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Chunks envoyés (TX)</label>
                    <Input 
                      type="number" 
                      value={test3.sent} 
                      onChange={(e) => setTest3({...test3, sent: e.target.value})}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Taux de succès</label>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={calculateSuccessRate(test3.success, test3.sent) >= 95 ? "default" : "destructive"}>
                        {calculateSuccessRate(test3.success, test3.sent)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Transcriptions réussies</label>
                    <Input 
                      type="number" 
                      value={test3.success} 
                      onChange={(e) => setTest3({...test3, success: e.target.value})}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Transcriptions échouées</label>
                    <Input 
                      type="number" 
                      value={test3.failed} 
                      onChange={(e) => setTest3({...test3, failed: e.target.value})}
                      placeholder="Ex: 0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Temps moyen entre TX (s)</label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={test3.avgInterval} 
                      onChange={(e) => setTest3({...test3, avgInterval: e.target.value})}
                      placeholder="Ex: 30.2"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Mots transcrits au total</label>
                  <Input 
                    type="number" 
                    value={test3.words} 
                    onChange={(e) => setTest3({...test3, words: e.target.value})}
                    placeholder="Ex: 245"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Notes & Observations</label>
                  <Textarea 
                    value={test3.notes} 
                    onChange={(e) => setTest3({...test3, notes: e.target.value})}
                    placeholder="Problèmes rencontrés, comportements étranges, qualité audio observée..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  📈 Résumé BASELINE (3 tests)
                </CardTitle>
                <CardDescription>
                  Moyennes calculées automatiquement à partir des 3 tests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-2">🎯 Taux de succès BASELINE</div>
                      <div className="text-5xl font-bold text-purple-600">{avg.rate}%</div>
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-2">⏱️ Intervalle moyen</div>
                      <div className="text-5xl font-bold text-blue-600">{avg.interval}s</div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Métrique</th>
                        <th className="text-center py-2">Test 1</th>
                        <th className="text-center py-2">Test 2</th>
                        <th className="text-center py-2">Test 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">Chunks envoyés</td>
                        <td className="text-center">{test1.sent || '-'}</td>
                        <td className="text-center">{test2.sent || '-'}</td>
                        <td className="text-center">{test3.sent || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">TX réussies</td>
                        <td className="text-center">{test1.success || '-'}</td>
                        <td className="text-center">{test2.success || '-'}</td>
                        <td className="text-center">{test3.success || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Taux de succès</td>
                        <td className="text-center">{test1.sent ? `${calculateSuccessRate(test1.success, test1.sent)}%` : '-'}</td>
                        <td className="text-center">{test2.sent ? `${calculateSuccessRate(test2.success, test2.sent)}%` : '-'}</td>
                        <td className="text-center">{test3.sent ? `${calculateSuccessRate(test3.success, test3.sent)}%` : '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Intervalle moyen</td>
                        <td className="text-center">{test1.avgInterval ? `${test1.avgInterval}s` : '-'}</td>
                        <td className="text-center">{test2.avgInterval ? `${test2.avgInterval}s` : '-'}</td>
                        <td className="text-center">{test3.avgInterval ? `${test3.avgInterval}s` : '-'}</td>
                      </tr>
                      <tr>
                        <td className="py-2">Mots transcrits</td>
                        <td className="text-center">{test1.words || '-'}</td>
                        <td className="text-center">{test2.words || '-'}</td>
                        <td className="text-center">{test3.words || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">✅ Critères de succès BASELINE</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Page de tests de stabilité créée</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {test1.sent ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Test #1 effectué et documenté</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {test2.sent ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Test #2 effectué et documenté</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {test3.sent ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Test #3 effectué et documenté</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {test1.sent && test2.sent && test3.sent ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Taux de succès moyen calculé</span>
                    </div>
                  </div>
                </div>

                {test1.sent && test2.sent && test3.sent && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium">
                      🚀 Baseline complétée ! Vous êtes prêt pour l'ÉTAPE 1 : Optimisations
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}