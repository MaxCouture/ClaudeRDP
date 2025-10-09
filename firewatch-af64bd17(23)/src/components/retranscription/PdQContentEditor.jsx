
import React from 'react';
import PdQSpeakerSelect from './PdQSpeakerSelect';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Trash2, AlertCircle } from "lucide-react";
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
    
    // Trouver TOUS les H3 et H4
    const allH3 = Array.from(doc.querySelectorAll('h3'));
    const allH4 = Array.from(doc.querySelectorAll('h4'));
    
    console.log(`🔍 Détection: ${allH3.length} H3 trouvés, ${allH4.length} H4 trouvés`);
    
    // Créer une liste ordonnée de tous les éléments structurels
    const elements = [
      ...allH3.map(h3 => ({ type: 'h3', element: h3 })),
      ...allH4.map(h4 => ({ type: 'h4', element: h4 }))
    ].sort((a, b) => {
      const pos = a.element.compareDocumentPosition(b.element);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    
    const parsedInterventions = [];
    let currentSubject = '';
    
    // ⚠️ GESTION DU TEXTE ORPHELIN AVANT LE PREMIER H4
    if (allH4.length > 0) {
      const firstH4 = allH4[0];
      const bodyChildren = Array.from(doc.body.children);
      let orphanContent = '';
      
      // Collecter tout le contenu avant le premier H4
      for (const child of bodyChildren) {
        if (child === firstH4 || child.tagName === 'H4') break;
        if (child.tagName !== 'H3') {
          orphanContent += child.outerHTML || '';
        }
      }
      
      // Si on a du texte orphelin, créer une intervention non identifiée
      if (orphanContent.trim()) {
        console.log(`⚠️ Texte orphelin détecté avant le premier H4`);
        parsedInterventions.push({
          id: `intervention-orphan-${Date.now()}`,
          subject: currentSubject,
          speakerText: '⚠️ Intervenant non identifié',
          deputeId: null,
          speakerId: `speaker-orphan-${Date.now()}`,
          content: orphanContent.trim(),
          isOrphan: true // Marqueur pour affichage spécial
        });
      }
    }
    
    // Parcourir chaque élément structurel
    elements.forEach((item, index) => {
      if (item.type === 'h3') {
        currentSubject = item.element.textContent.trim();
        console.log(`📋 Nouveau sujet: "${currentSubject}"`);
        
      } else if (item.type === 'h4') {
        const speakerText = item.element.textContent.trim();
        const matchedSpeaker = detectedSpeakers.find(s => s.originalText === speakerText);
        
        console.log(`👤 Intervention #${parsedInterventions.length + 1}: "${speakerText}"`);
        
        // Extraire le contenu entre ce H4 et le prochain H3/H4
        let content = '';
        let nextElement = item.element.nextElementSibling;
        
        const nextStructuralIndex = elements.findIndex((e, i) => 
          i > index && (e.type === 'h3' || e.type === 'h4')
        );
        const nextStructuralElement = nextStructuralIndex >= 0 
          ? elements[nextStructuralIndex].element 
          : null;
        
        // Collecter le HTML entre ce H4 et le prochain élément structurel
        while (nextElement && nextElement !== nextStructuralElement) {
          content += nextElement.outerHTML || '';
          nextElement = nextElement.nextElementSibling;
        }
        
        parsedInterventions.push({
          id: `intervention-${Date.now()}-${Math.random()}-${index}`,
          subject: currentSubject,
          speakerText: speakerText,
          deputeId: matchedSpeaker?.deputeId || null,
          speakerId: matchedSpeaker?.id || `speaker-${Date.now()}-${index}`,
          content: content.trim() || '<p>Contenu de l\'intervention...</p>',
          isOrphan: false
        });
      }
    });
    
    console.log(`✅ Total: ${parsedInterventions.length} interventions créées`);
    setInterventions(parsedInterventions);
  }, [htmlContent, detectedSpeakers]);

  const handleSpeakerChange = (interventionId, newDeputeId) => {
    const updatedInterventions = interventions.map(intervention => 
      intervention.id === interventionId 
        ? { ...intervention, deputeId: newDeputeId } 
        : intervention
    );
    setInterventions(updatedInterventions);
    
    const intervention = updatedInterventions.find(i => i.id === interventionId);
    if (intervention) {
      onSpeakerChange(intervention.speakerId, newDeputeId);
    }
    
    rebuildHTML(updatedInterventions);
  };

  const handleSubjectEdit = (interventionId, newSubject) => {
    const updatedInterventions = interventions.map(intervention => 
      intervention.id === interventionId 
        ? { ...intervention, subject: newSubject } 
        : intervention
    );
    setInterventions(updatedInterventions);
    // ⚠️ NE PAS rebuilder pendant l'édition pour éviter le lag
    // rebuildHTML sera appelé sur blur
  };

  const handleSubjectBlur = (interventionId) => {
    // Rebuilder le HTML seulement quand l'utilisateur a fini d'éditer
    // Use the current state 'interventions' which is already updated by handleSubjectEdit
    rebuildHTML(interventions);
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
      content: '<p>Contenu de l\'intervention...</p>',
      isOrphan: false
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
    const fullHtml = interventionsList
      .filter(i => !i.isOrphan) // Exclure les orphelins du rebuild
      .map(intervention => {
        let html = '';
        
        if (intervention.subject && intervention.subject !== lastSubject) {
          html += `<h3>${intervention.subject}</h3>`;
          lastSubject = intervention.subject;
        }
        
        html += `<h4>${intervention.speakerText}</h4>`;
        html += intervention.content;
        
        return html;
      }).join('');
    
    onContentChange(fullHtml);
  };

  if (!htmlContent) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium">Aucun contenu à afficher</p>
        <p className="text-gray-500 text-sm">Le résumé apparaîtra ici une fois généré</p>
      </div>
    );
  }

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
                      <Card className={`border-l-4 ${intervention.isOrphan ? 'border-l-orange-500 bg-orange-50' : 'border-l-purple-500'}`}>
                        <CardContent className="p-4 space-y-3">
                          {/* Avertissement pour les orphelins */}
                          {intervention.isOrphan && (
                            <div className="bg-orange-100 border border-orange-300 rounded p-3 mb-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                <p className="text-sm font-semibold text-orange-800">
                                  Intervention orpheline détectée
                                </p>
                              </div>
                              <p className="text-xs text-orange-700 mt-1">
                                Ce texte n'avait pas de balise H4. Assignez un député manuellement.
                              </p>
                            </div>
                          )}
                          
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
                              onBlur={() => handleSubjectBlur(intervention.id)}
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
