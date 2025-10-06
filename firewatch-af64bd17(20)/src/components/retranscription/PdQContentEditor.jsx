
import React from 'react';
import PdQSpeakerSelect from './PdQSpeakerSelect';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Trash2, AlertCircle } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function PdQContentEditor({ htmlContent, deputes, detectedSpeakers, onSpeakerChange, onContentChange }) {
  const [interventions, setInterventions] = React.useState([]);

  React.useEffect(() => {
    console.log('🔍 PdQContentEditor - htmlContent reçu:', htmlContent?.substring(0, 200));
    console.log('🔍 PdQContentEditor - detectedSpeakers:', detectedSpeakers);
    console.log('🔍 PdQContentEditor - deputes:', deputes?.length);
    
    if (!htmlContent) {
      console.log('⚠️ Pas de htmlContent');
      setInterventions([]);
      return;
    }

    // Nettoyer le HTML avant parsing
    let cleanedHtml = htmlContent.trim();
    
    // Parser le HTML pour extraire les interventions structurées
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedHtml, 'text/html');
    const body = doc.body;
    
    console.log('📄 Body parsed:', body.innerHTML.substring(0, 200));
    console.log('📄 ChildNodes:', body.childNodes.length);
    
    // Afficher tous les H4 trouvés
    const allH4 = body.querySelectorAll('h4');
    console.log('📊 Nombre total de H4 détectés:', allH4.length);
    allH4.forEach((h4, idx) => {
      console.log(`  H4 #${idx + 1}:`, h4.textContent);
    });
    
    const parsedInterventions = [];
    let currentSubject = '';
    let currentIntervention = null;
    
    Array.from(body.childNodes).forEach((node, nodeIndex) => {
      console.log(`🔎 Node #${nodeIndex}:`, node.nodeName, node.textContent?.substring(0, 50));
      
      if (node.nodeName === 'H3') {
        // Nouveau sujet détecté
        currentSubject = node.textContent;
        console.log('✅ Nouveau sujet:', currentSubject);
      } else if (node.nodeName === 'H4') {
        // Nouveau speaker détecté - sauvegarder l'intervention précédente
        if (currentIntervention) {
          parsedInterventions.push(currentIntervention);
          console.log('💾 Intervention sauvegardée:', currentIntervention.speakerText);
        }
        
        // Créer une nouvelle intervention
        const speakerText = node.textContent;
        const matchedSpeaker = detectedSpeakers.find(s => s.originalText === speakerText);
        
        currentIntervention = {
          id: `intervention-${Date.now()}-${Math.random()}`,
          subject: currentSubject,
          speakerText: speakerText,
          deputeId: matchedSpeaker?.deputeId || null,
          speakerId: matchedSpeaker?.id || `speaker-${Date.now()}-${Math.random()}`, // Ensure unique ID
          content: ''
        };
        console.log('🆕 Nouvelle intervention créée:', speakerText);
      } else if (currentIntervention) {
        // Ajouter du contenu à l'intervention courante
        const contentToAdd = node.outerHTML || node.textContent || '';
        if (contentToAdd.trim()) { // Only add if content is not empty or just whitespace
          currentIntervention.content += contentToAdd;
        }
      }
    });
    
    // Ajouter la dernière intervention
    if (currentIntervention) {
      parsedInterventions.push(currentIntervention);
      console.log('💾 Dernière intervention sauvegardée:', currentIntervention.speakerText);
    }
    
    console.log('✅ Total interventions parsées:', parsedInterventions.length);
    console.log('📋 Interventions:', parsedInterventions);
    
    setInterventions(parsedInterventions);
  }, [htmlContent, detectedSpeakers]);

  const handleSpeakerChange = (interventionId, newDeputeId) => {
    const updatedInterventions = interventions.map(intervention => 
      intervention.id === interventionId 
        ? { ...intervention, deputeId: newDeputeId } 
        : intervention
    );
    setInterventions(updatedInterventions);
    
    // Notifier le parent du changement de député
    const intervention = updatedInterventions.find(i => i.id === interventionId);
    if (intervention) {
      onSpeakerChange(intervention.speakerId, newDeputeId);
    }
    
    // Reconstruire le HTML
    rebuildHTML(updatedInterventions);
  };

  const handleSubjectEdit = (interventionId, newSubject) => {
    const updatedInterventions = interventions.map(intervention => 
      intervention.id === interventionId 
        ? { ...intervention, subject: newSubject } 
        : intervention
    );
    setInterventions(updatedInterventions);
    rebuildHTML(updatedInterventions);
  };

  const handleContentEdit = (interventionId, newContent) => {
    const updatedInterventions = interventions.map(intervention => 
      intervention.id === interventionId 
        ? { ...intervention, content: newContent } 
        : intervention
    );
    setInterventions(updatedInterventions);
    rebuildHTML(updatedInterventions);
  };

  const handleAddIntervention = () => {
    const newIntervention = {
      id: `intervention-${Date.now()}-${Math.random()}`,
      subject: '',
      speakerText: 'Nouveau député',
      deputeId: null,
      speakerId: `speaker-${Date.now()}`,
      content: '<p>Contenu de l\'intervention...</p>'
    };
    
    const updatedInterventions = [...interventions, newIntervention];
    setInterventions(updatedInterventions);
    rebuildHTML(updatedInterventions);
  };

  const handleDeleteIntervention = (interventionId) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette intervention ?")) {
      const updatedInterventions = interventions.filter(i => i.id !== interventionId);
      setInterventions(updatedInterventions);
      rebuildHTML(updatedInterventions);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(interventions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setInterventions(items);
    rebuildHTML(items);
  };

  const rebuildHTML = (interventionsList) => {
    let lastSubject = '';
    const fullHtml = interventionsList.map(intervention => {
      let html = '';
      
      // Ajouter le sujet seulement s'il change
      if (intervention.subject && intervention.subject !== lastSubject) {
        html += `<h3>${intervention.subject}</h3>`;
        lastSubject = intervention.subject;
      }
      
      // Ajouter le speaker et le contenu
      html += `<h4>${intervention.speakerText}</h4>`;
      html += intervention.content;
      
      return html;
    }).join('');
    
    onContentChange(fullHtml);
  };

  // Message si aucun contenu
  if (!htmlContent) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium">Aucun contenu à afficher</p>
        <p className="text-gray-500 text-sm">Le résumé apparaîtra ici une fois généré</p>
      </div>
    );
  }

  // Message si aucune intervention détectée
  if (interventions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={handleAddIntervention} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une intervention
          </Button>
        </div>
        
        <div className="flex flex-col items-center justify-center p-12 bg-amber-50 rounded-lg border-2 border-dashed border-amber-300">
          <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
          <p className="text-amber-800 font-medium">Aucune intervention structurée détectée</p>
          <p className="text-amber-700 text-sm text-center mt-2">
            Le HTML ne contient pas de balises H3 (sujets) ou H4 (intervenants).
            <br />
            Vérifiez que le résumé généré est au bon format ou ajoutez manuellement une intervention.
          </p>
          <div className="mt-4 p-4 bg-white rounded border text-xs text-left w-full max-w-2xl overflow-auto max-h-64">
            <p className="font-semibold mb-2">HTML reçu (aperçu) :</p>
            <pre className="whitespace-pre-wrap break-words text-gray-600">
              {htmlContent.substring(0, 500)}...
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddIntervention} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une intervention
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="interventions">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {interventions.map((intervention, index) => (
                <Draggable key={intervention.id} draggableId={intervention.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? "opacity-70" : ""}
                    >
                      <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div 
                              {...provided.dragHandleProps}
                              className="flex items-center gap-2 text-gray-400 hover:text-gray-600 cursor-move"
                            >
                              <GripVertical className="w-5 h-5" />
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                Intervention #{index + 1}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteIntervention(intervention.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                              Sujet
                            </label>
                            <input
                              type="text"
                              value={intervention.subject}
                              onChange={(e) => handleSubjectEdit(intervention.id, e.target.value)}
                              className="w-full text-lg font-bold text-blue-900 bg-transparent border-b-2 border-blue-200 focus:border-blue-500 outline-none py-1"
                              placeholder="Titre du sujet..."
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                              Intervenant
                            </label>
                            <PdQSpeakerSelect
                              speakerText={intervention.speakerText}
                              selectedDeputeId={intervention.deputeId}
                              deputes={deputes}
                              onChange={(newDeputeId) => handleSpeakerChange(intervention.id, newDeputeId)}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                              Contenu de l'intervention
                            </label>
                            <div
                              className="prose prose-slate max-w-none bg-gray-50 p-4 rounded-lg border min-h-[100px]"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleContentEdit(intervention.id, e.currentTarget.innerHTML)}
                              dangerouslySetInnerHTML={{ __html: intervention.content }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
