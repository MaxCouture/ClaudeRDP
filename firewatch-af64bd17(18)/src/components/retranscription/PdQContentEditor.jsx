import React from 'react';
import PdQSpeakerSelect from './PdQSpeakerSelect';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function PdQContentEditor({ htmlContent, deputes, detectedSpeakers, onSpeakerChange, onContentChange }) {
  const [interventions, setInterventions] = React.useState([]);

  React.useEffect(() => {
    if (!htmlContent) {
      setInterventions([]);
      return;
    }

    // Parser le HTML pour extraire les interventions structurées
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const body = doc.body;
    
    const parsedInterventions = [];
    let currentSubject = '';
    let currentIntervention = null;
    
    Array.from(body.childNodes).forEach((node) => {
      if (node.nodeName === 'H3') {
        // Nouveau sujet détecté
        currentSubject = node.textContent;
      } else if (node.nodeName === 'H4') {
        // Nouveau speaker détecté - sauvegarder l'intervention précédente
        if (currentIntervention) {
          parsedInterventions.push(currentIntervention);
        }
        
        // Créer une nouvelle intervention
        const speakerText = node.textContent;
        const matchedSpeaker = detectedSpeakers.find(s => s.originalText === speakerText);
        
        currentIntervention = {
          id: `intervention-${Date.now()}-${Math.random()}`,
          subject: currentSubject,
          speakerText: speakerText,
          deputeId: matchedSpeaker?.deputeId || null,
          speakerId: matchedSpeaker?.id || `speaker-${Date.now()}`,
          content: ''
        };
      } else if (currentIntervention) {
        // Ajouter du contenu à l'intervention courante
        currentIntervention.content += node.outerHTML || node.textContent || '';
      }
    });
    
    // Ajouter la dernière intervention
    if (currentIntervention) {
      parsedInterventions.push(currentIntervention);
    }
    
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
                          {/* En-tête avec poignée de drag et bouton supprimer */}
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

                          {/* Sujet */}
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

                          {/* Député (dropdown avec photo) */}
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

                          {/* Contenu de l'intervention */}
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