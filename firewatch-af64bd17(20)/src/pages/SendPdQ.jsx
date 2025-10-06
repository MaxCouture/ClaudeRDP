
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Mic, Send, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMailchimpAudiences } from "@/api/functions";
import { getMailchimpSegments } from "@/api/functions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from 'react-router-dom';
import { Setting } from "@/api/entities";
import { DailySummary } from "@/api/entities";
import { Depute } from "@/api/entities";
import { DeputeFederal } from "@/api/entities";
import PdQContentEditor from "../components/retranscription/PdQContentEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Fonction pour construire le HTML du bulletin PdQ avec photos
async function buildPdQNewsletterHTML(pdqContent, customSettings, deputes, emailSubject, detectedSpeakers, summaryPoints = [], pdqType = 'quebec') {
  if (!customSettings || !customSettings.newsletter_template) {
    return '<p style="font-family: Arial, sans-serif; text-align: center; color: #666;">Chargement du template...</p>';
  }

  const pdqTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .header-padding { padding: 25px 20px !important; }
      .main-title { font-size: 24px !important; }
      .date-subtitle { font-size: 14px !important; }
      .speaker-name { font-size: 18px !important; }
      .speaker-photo { width: 60px !important; height: 60px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: {{newsletter_body_bg_color}}; font-family: {{newsletter_font_family}};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: {{newsletter_body_bg_color}};">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table class="container" width="{{newsletter_container_width}}" cellpadding="0" cellspacing="0" border="0" style="max-width: {{newsletter_container_width}}; background-color: {{newsletter_body_bg_color}};">
          <!-- En-tête -->
          <tr>
            <td class="header-padding" style="padding: 40px 40px 30px 40px; background-color: {{newsletter_header_bg_color}};">
              {{{header_html}}}
            </td>
          </tr>
          
          <!-- Date -->
          <tr>
            <td class="content-padding" style="padding: 0 40px 20px 40px; background-color: {{newsletter_body_bg_color}};">
              <div style="font-size: 14px; color: {{newsletter_footer_text_color}}; text-align: right; font-family: {{newsletter_font_family}};">
                Édition du {{current_date}}
              </div>
              <hr style="border: none; height: 1px; background-color: #000000; margin: 15px 0 0 0;" />
            </td>
          </tr>
          
          <!-- Titre principal et date -->
          <tr>
            <td class="content-padding" style="padding: 20px 40px 10px 40px; text-align: center; background-color: {{newsletter_body_bg_color}};">
              <h1 class="main-title" style="font-size: 28px; font-weight: 700; color: #967150; margin: 0; font-family: {{newsletter_main_title_font_family}}; line-height: 1.2;">
                {{pdq_title}}
              </h1>
              <p class="date-subtitle" style="font-size: 16px; color: {{newsletter_footer_text_color}}; margin: 8px 0 0 0; font-family: {{newsletter_font_family}};">
                {{pdq_date}}
              </p>
            </td>
          </tr>
          
          <!-- Contenu PdQ -->
          <tr>
            <td class="content-padding" style="padding: 30px 40px 30px 40px; background-color: {{newsletter_body_bg_color}};">
              {{{pdq_content_html}}}
            </td>
          </tr>
          
          <!-- Pied de page -->
          <tr>
            <td class="footer-padding" style="padding: 40px; text-align: center; background-color: {{newsletter_footer_bg_color}};">
              <h3 style="font-size: 18px; color: {{newsletter_text_color}}; margin: 0 0 20px 0; font-family: {{newsletter_title_font_family}};">COMMUNIQUEZ AVEC NOUS !</h3>
              <p style="font-size: 14px; color: {{newsletter_footer_text_color}}; margin: 8px 0; font-family: {{newsletter_font_family}};">{{newsletter_contact_info_email}}</p>
              <p style="font-size: 14px; color: {{newsletter_footer_text_color}}; margin: 8px 0; font-family: {{newsletter_font_family}};">{{newsletter_contact_info_phone}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Construire le HTML de l'en-tête
  let headerHtml = '';
  if (customSettings.newsletter_logo_url) {
    const logoHeight = customSettings.newsletter_logo_font_size === '32px' ? '80px' : 
                       customSettings.newsletter_logo_font_size === '36px' ? '100px' :
                       customSettings.newsletter_logo_font_size === '40px' ? '120px' :
                       customSettings.newsletter_logo_font_size === '44px' ? '140px' : '100px';
    headerHtml = `<a href="https://www.catapultecommunication.com" style="text-decoration: none;"><img src="${customSettings.newsletter_logo_url}" alt="${customSettings.newsletter_logo_text || ''}" class="logo-img" style="display: block; max-height: ${logoHeight}; height: auto; width: auto;"></a>`;
  } else {
    headerHtml = `
      <a href="https://www.catapultecommunication.com" style="text-decoration: none; color: inherit;">
        <div style="font-size: ${customSettings.newsletter_logo_font_size || '42px'}; color: ${customSettings.newsletter_text_color || '#333333'}; font-weight: 300; margin-bottom: 8px; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'};">${customSettings.newsletter_logo_text || 'Catapulte'}</div>
        <div style="font-size: 14px; color: ${customSettings.newsletter_footer_text_color || '#666666'}; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">${customSettings.newsletter_logo_subtitle || 'Bureau de communication'}</div>
      </a>
    `;
  }

  // Traiter le contenu PdQ pour ajouter les photos des intervenants
  let pdqContentWithPhotos = pdqContent;
  
  // Nettoyer le contenu
  pdqContentWithPhotos = pdqContentWithPhotos
    .replace(/<h3>Résumé de la période de questions[\s\S]*?<\/h3>/gi, '')
    .replace(/<p>Résumé de la période de questions[\s\S]*?<\/p>/gi, '')
    .replace(/Résumé de la période de questions\s*-\s*\d+\s+\w+\s+\d{4}/gi, '')
    .replace(/<h3>Résumé global<\/h3>[\s\S]*?(?=<h3>|$)/gi, '')
    .replace(/<h3>Résumé en 3 points<\/h3>[\s\S]*?(?=<h3>|$)/gi, '')
    .replace(/<h3>Points principaux<\/h3>[\s\S]*?(?=<h3>|$)/gi, '')
    .replace(/<h3>Sujets abordés<\/h3>[\s\S]*?(?=<h3>|$)/gi, '')
    .replace(/<h3>Développement détaillé<\/h3>/gi, '')
    .replace(/^[\s]*(?:<p>)?[\s]*[-•]\s+.+(?:\n[-•]\s+.+)*(?:<\/p>)?[\s]*(?=<h3>)/gm, '');
  
  // Ajouter les Sujets du jour au début si présents
  if (summaryPoints && summaryPoints.length > 0 && summaryPoints.some(point => point.trim() !== '')) {
    const pointsHtml = `
      <div style="margin-bottom: 25px; padding: 20px 25px; background-color: #f8f9fa; border-left: 4px solid #967150; border-radius: 8px;">
        <div style="display:flex; align-items:center; margin-bottom: 12px;">
          <div style="width: 20px; height: 20px; margin-right: 10px; flex-shrink: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18l6-6-6-6" stroke="#967150" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #967150; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'};">
            Sujets du jour
          </h3>
        </div>
        <ul style="margin: 0; padding-left: 20px; list-style-type: none;">
          ${summaryPoints.filter(point => point.trim() !== '').map(point => `
            <li style="margin-bottom: 10px; padding-left: 10px; position: relative; font-size: 15px; line-height: 1.5; color: #333333; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">
              <span style="position: absolute; left: -10px; color: #967150; font-weight: bold;">•</span>
              ${point}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    pdqContentWithPhotos = pointsHtml + pdqContentWithPhotos;
  }
  
  // Remplacer les <h4> (intervenants) par des blocs avec photo ET SÉPARATION VISUELLE
  pdqContentWithPhotos = pdqContentWithPhotos.replace(/<h4>(.+?)<\/h4>/g, (match, speakerFullText) => {
    const cleanedSpeakerFullText = speakerFullText.trim();
    const matchedDetectedSpeaker = detectedSpeakers.find(ds => ds.originalText === cleanedSpeakerFullText);

    let depute = null;
    if (matchedDetectedSpeaker && matchedDetectedSpeaker.deputeId) {
      depute = deputes.find(d => d.id === matchedDetectedSpeaker.deputeId);
    }
    
    const photoHtml = depute && depute.photoUrl 
      ? `<img src="${depute.photoUrl}" alt="${depute.nomComplet}" class="speaker-photo" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; margin-right: 12px; border: 3px solid #967150;" />`
      : `<div class="speaker-photo" style="width: 70px; height: 70px; border-radius: 50%; background-color: #e5e7eb; margin-right: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid #967150;"><span style="font-size: 28px; color: #9ca3af;">👤</span></div>`;
    
    return `
      <div style="border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 18px;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          ${photoHtml}
          <h4 class="speaker-name" style="margin: 0; font-size: 18px; font-weight: 600; color: #333333; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'};">
            ${speakerFullText}
          </h4>
        </div>
      </div>
    `;
  });

  // Styliser les titres de sujet <h3> avec boîte de regroupement
  let subjectCounter = 0;
  pdqContentWithPhotos = pdqContentWithPhotos.replace(/<h3>(.+?)<\/h3>([\s\S]*?)(?=<h3>|$)/g, (match, subjectText, subjectContent) => {
    subjectCounter++;
    
    const styledTitle = `
      <div style="margin-top: 0; margin-bottom: 15px;">
        <hr style="border: none; height: 3px; background-color: #967150; width: 45px; margin: 0 0 10px 0;" />
        <h3 style="margin: 0; font-size: 22px; font-weight: 700; color: #967150; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'}; line-height: 1.3;">
          ${subjectText}
        </h3>
      </div>
    `;
    
    return `
      <div style="background-color: #ffffff; border-radius: 12px; padding: 20px 25px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${styledTitle}
        ${subjectContent}
      </div>
    `;
  });

  // Styliser les paragraphes <p> et listes <ul>
  pdqContentWithPhotos = pdqContentWithPhotos.replace(/<p>/g, `<p style="font-size: 15px; line-height: 1.6; color: #333333; margin: 6px 0; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">`);
  pdqContentWithPhotos = pdqContentWithPhotos.replace(/<ul>/g, `<ul style="font-size: 15px; line-height: 1.6; color: #333333; margin: 6px 0 10px 20px; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">`);

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const pdqTitle = pdqType === 'ottawa' ? 'Période de questions - Ottawa' : 'Période de questions';

  const templateVariables = {
    header_html: headerHtml,
    pdq_content_html: pdqContentWithPhotos,
    subject: emailSubject || pdqTitle,
    current_date: dateStr,
    pdq_date: dateStr,
    pdq_title: pdqTitle,
    newsletter_body_bg_color: customSettings.newsletter_body_bg_color || '#f5f5f5',
    newsletter_header_bg_color: customSettings.newsletter_header_bg_color || '#FFFFFF',
    newsletter_footer_text_color: customSettings.newsletter_footer_text_color || '#666666',
    newsletter_main_title_font_family: customSettings.newsletter_main_title_font_family || 'Georgia, serif',
    newsletter_text_color: customSettings.newsletter_text_color || '#333333',
    newsletter_footer_bg_color: customSettings.newsletter_footer_bg_color || '#f5f5f5',
    newsletter_font_family: customSettings.newsletter_font_family || 'Arial, sans-serif',
    newsletter_title_font_family: customSettings.newsletter_title_font_family || 'Georgia, serif',
    newsletter_contact_info_email: customSettings.newsletter_contact_info_email || 'Info@catapultecommunication.com',
    newsletter_contact_info_phone: customSettings.newsletter_contact_info_phone || '(418) 545-4373',
    newsletter_container_width: customSettings.newsletter_container_width || '680px'
  };

  function replaceTemplateVariables(template, variables) {
    let result = template;
    Object.keys(variables).forEach(key => {
      const tripleRegex = new RegExp(`\\{\\{\\{${key}\\}\\}\\}`, 'g');
      result = result.replace(tripleRegex, variables[key] || '');
    });
    Object.keys(variables).forEach(key => {
      const doubleRegex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(doubleRegex, variables[key] || '');
    });
    return result;
  }

  return replaceTemplateVariables(pdqTemplate, templateVariables);
}

function PdQPreview({ pdqContent, customSettings, deputes, emailSubject, detectedSpeakers, summaryPoints, pdqType }) {
  const [previewHtml, setPreviewHtml] = React.useState('');

  React.useEffect(() => {
    const generatePreview = async () => {
      const finalHtml = await buildPdQNewsletterHTML(pdqContent, customSettings, deputes, emailSubject, detectedSpeakers, summaryPoints, pdqType);
      setPreviewHtml(finalHtml);
    };
    generatePreview();
  }, [pdqContent, customSettings, deputes, emailSubject, detectedSpeakers, summaryPoints, pdqType]);

  return (
    <div className="w-full bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600">
        Aperçu du bulletin PdQ
      </div>
      <iframe
        srcDoc={previewHtml}
        title="Aperçu du bulletin PdQ"
        className="w-full h-[800px]"
        style={{ border: 'none' }}
      />
    </div>
  );
}

export default function SendPdQPage() {
  const [activeTab, setActiveTab] = useState("quebec");
  const [audiences, setAudiences] = useState([]);
  const [segments, setSegments] = useState([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [customSettings, setCustomSettings] = useState({});
  
  // États Québec
  const [pdqSummaryQuebec, setPdqSummaryQuebec] = useState(null);
  const [editedContentQuebec, setEditedContentQuebec] = useState('');
  const [deputesQuebec, setDeputesQuebec] = useState([]);
  const [detectedSpeakersQuebec, setDetectedSpeakersQuebec] = useState([]);
  const [summaryPointsQuebec, setSummaryPointsQuebec] = useState(['', '', '']);
  
  // États Ottawa
  const [pdqSummaryOttawa, setPdqSummaryOttawa] = useState(null);
  const [editedContentOttawa, setEditedContentOttawa] = useState('');
  const [deputesOttawa, setDeputesOttawa] = useState([]);
  const [detectedSpeakersOttawa, setDetectedSpeakersOttawa] = useState([]);
  const [summaryPointsOttawa, setSummaryPointsOttawa] = useState(['', '', '']);
  
  const navigate = useNavigate();
  
  const [formDataQuebec, setFormDataQuebec] = useState({
    subject: "Période de questions - Québec",
    audience: "",
    segment: "",
    fromName: "Catapulte",
    replyTo: "info@catapultecommunication.com"
  });
  
  const [formDataOttawa, setFormDataOttawa] = useState({
    subject: "Période de questions - Ottawa",
    audience: "",
    segment: "",
    fromName: "Catapulte",
    replyTo: "info@catapultecommunication.com"
  });

  const { toast } = useToast();

  const detectSpeakersFromHTML = useCallback((htmlContent, deputesList) => {
    if (!htmlContent || !deputesList) return [];
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const h4Elements = doc.querySelectorAll('h4');

    const detected = Array.from(h4Elements).map((h4, index) => {
      const fullText = h4.textContent || '';
      
      // Extraire le nom (avant la première virgule)
      const nameMatch = fullText.match(/^([^,]+)/);
      const speakerName = nameMatch ? nameMatch[1].trim() : fullText;
      
      // Nettoyer "L'hon." si présent
      const cleanName = speakerName.replace(/^L'hon\.\s+/i, '').trim();
      
      let foundDepute = null;
      const searchName = cleanName.toLowerCase();
      
      // Chercher dans la liste de députés
      for (const depute of deputesList) {
        const deputeFullName = depute.nomComplet.toLowerCase();
        const deputeLastName = depute.nom.toLowerCase();
        const deputeFirstName = depute.prenom.toLowerCase();
        
        // Match exact sur nom complet
        if (deputeFullName === searchName) {
          foundDepute = depute;
          break;
        }
        
        // Match sur "Prénom Nom" ou "Nom Prénom"
        const deputeFirstLast = `${deputeFirstName} ${deputeLastName}`;
        const deputeLastFirst = `${deputeLastName} ${deputeFirstName}`;
        
        if (searchName === deputeFirstLast || searchName === deputeLastFirst) {
            foundDepute = depute;
            break;
        }
        
        // Match sur nom de famille seul (si assez long et unique)
        if (searchName === deputeLastName && deputeLastName.length > 4) {
            const matchingDeputesByLastName = deputesList.filter(d => d.nom.toLowerCase() === searchName);
            if (matchingDeputesByLastName.length === 1) { // Only assign if it's unambiguous
                foundDepute = matchingDeputesByLastName[0];
                break;
            }
        }
      }
      
      // Si toujours pas trouvé, fuzzy match
      if (!foundDepute) {
        for (const depute of deputesList) {
          const deputeName = depute.nomComplet.toLowerCase();
          // Si 60% des mots matchent
          const searchWords = searchName.split(' ').filter(w => w.length > 0);
          const deputeWords = deputeName.split(' ').filter(w => w.length > 0);
          
          let matchCount = 0;
          for (const sWord of searchWords) {
              if (deputeWords.some(dw => dw.includes(sWord) || sWord.includes(dw))) {
                  matchCount++;
              }
          }
          
          if (searchWords.length > 0 && matchCount >= searchWords.length * 0.6) {
            foundDepute = depute;
            break;
          }
        }
      }
      
      console.log(`🔍 Speaker détecté: "${speakerName}" → ${foundDepute ? foundDepute.nomComplet : 'NON TROUVÉ'}`);
      
      return {
        id: `speaker-${index}-${Date.now()}-${Math.random()}`,
        originalText: fullText,
        displayName: speakerName,
        deputeId: foundDepute?.id || null
      };
    });
    
    return detected;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [settings, deputesQc, deputesFed] = await Promise.all([
          Setting.filter({ name: "default_configuration" }),
          Depute.list('-nom', 200),
          DeputeFederal.list('-nom', 400)
        ]);

        setCustomSettings(settings.length > 0 ? settings[0] : {});
        setDeputesQuebec(deputesQc);
        setDeputesOttawa(deputesFed);

        const todayStr = new Date().toISOString().split('T')[0];
        
        // Charger résumé Québec
        const summariesQc = await DailySummary.filter({ 
          summary_date: todayStr,
          type: 'pdq_quebec'
        });
        
        if (summariesQc.length > 0) {
          setPdqSummaryQuebec(summariesQc[0]);
          let cleanContent = summariesQc[0].summary_text || '';
          cleanContent = cleanContent.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
          setEditedContentQuebec(cleanContent);
          // Set default subject if not already set, or load from summary if available
          setFormDataQuebec(prev => ({ 
            ...prev, 
            subject: summariesQc[0].subject || 'Période de questions - Québec' 
          }));
          
          if (summariesQc[0].summary_points && Array.isArray(summariesQc[0].summary_points)) {
            const points = [...summariesQc[0].summary_points];
            while (points.length < 3) points.push('');
            setSummaryPointsQuebec(points.slice(0, 3));
          }
          
          let initialDetectedSpeakersQuebec = [];
          if (deputesQc.length > 0) {
              initialDetectedSpeakersQuebec = detectSpeakersFromHTML(cleanContent, deputesQc);
              if (summariesQc[0].speaker_mappings && Array.isArray(summariesQc[0].speaker_mappings)) {
                  initialDetectedSpeakersQuebec = initialDetectedSpeakersQuebec.map(speaker => {
                      const savedMapping = summariesQc[0].speaker_mappings.find(m => m.originalText === speaker.originalText);
                      return savedMapping ? { ...speaker, deputeId: savedMapping.deputeId } : speaker;
                  });
              }
          }
          setDetectedSpeakersQuebec(initialDetectedSpeakersQuebec);
        }
        
        // Charger résumé Ottawa
        const summariesOttawa = await DailySummary.filter({ 
          summary_date: todayStr,
          type: 'pdq_ottawa'
        });
        
        if (summariesOttawa.length > 0) {
          setPdqSummaryOttawa(summariesOttawa[0]);
          let cleanContent = summariesOttawa[0].summary_text || '';
          cleanContent = cleanContent.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
          setEditedContentOttawa(cleanContent);
          // Set default subject if not already set, or load from summary if available
          setFormDataOttawa(prev => ({ 
            ...prev, 
            subject: summariesOttawa[0].subject || 'Période de questions - Ottawa' 
          }));
          
          if (summariesOttawa[0].summary_points && Array.isArray(summariesOttawa[0].summary_points)) {
            const points = [...summariesOttawa[0].summary_points];
            while (points.length < 3) points.push('');
            setSummaryPointsOttawa(points.slice(0, 3));
          }
          
          // NOUVEAU : Charger les speaker_mappings pour Ottawa aussi
          let initialDetectedSpeakersOttawa = [];
          if (deputesFed.length > 0) {
            initialDetectedSpeakersOttawa = detectSpeakersFromHTML(cleanContent, deputesFed);
            if (summariesOttawa[0].speaker_mappings && Array.isArray(summariesOttawa[0].speaker_mappings)) {
              initialDetectedSpeakersOttawa = initialDetectedSpeakersOttawa.map(speaker => {
                const savedMapping = summariesOttawa[0].speaker_mappings.find(m => m.originalText === speaker.originalText);
                return savedMapping ? { ...speaker, deputeId: savedMapping.deputeId } : speaker;
              });
            }
          }
          setDetectedSpeakersOttawa(initialDetectedSpeakersOttawa);
        }

      } catch (error) {
        toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
      }
    };

    const fetchAudiences = async () => {
      try {
        const res = await getMailchimpAudiences();
        setAudiences(res.data);
      } catch (error) {
        toast({ title: "Erreur", description: "Impossible de charger les audiences Mailchimp.", variant: "destructive" });
      }
    };

    loadData();
    fetchAudiences();
  }, [toast, detectSpeakersFromHTML]);

  useEffect(() => {
    const fetchSegments = async () => {
      const currentAudience = activeTab === 'quebec' ? formDataQuebec.audience : formDataOttawa.audience;
      
      if (!currentAudience) {
        setSegments([]);
        if (activeTab === 'quebec') {
          setFormDataQuebec(prev => ({ ...prev, segment: "" }));
        } else {
          setFormDataOttawa(prev => ({ ...prev, segment: "" }));
        }
        return;
      }
      
      setIsLoadingSegments(true);
      setSegments([]);
      if (activeTab === 'quebec') {
        setFormDataQuebec(prev => ({ ...prev, segment: "" }));
      } else {
        setFormDataOttawa(prev => ({ ...prev, segment: "" }));
      }
      
      try {
        const res = await getMailchimpSegments({ audience_id: currentAudience });
        setSegments(res.data);
      } catch (error) {
        toast({ title: "Erreur", description: "Impossible de charger les segments.", variant: "destructive" });
      } finally {
        setIsLoadingSegments(false);
      }
    };

    fetchSegments();
  }, [activeTab, formDataQuebec.audience, formDataOttawa.audience, toast]);

  const handleSpeakerChangeQuebec = (speakerId, newDeputeId) => {
    setDetectedSpeakersQuebec(prev => prev.map(speaker => {
      if (speaker.id === speakerId) {
        return { ...speaker, deputeId: newDeputeId };
      }
      return speaker;
    }));
  };
  
  const handleSpeakerChangeOttawa = (speakerId, newDeputeId) => {
    setDetectedSpeakersOttawa(prev => prev.map(speaker => {
      if (speaker.id === speakerId) {
        return { ...speaker, deputeId: newDeputeId };
      }
      return speaker;
    }));
  };

  const handlePdQContentChangeQuebec = useCallback((newHtml) => {
    setEditedContentQuebec(newHtml);
    if (deputesQuebec.length > 0) {
      const newlyDetected = detectSpeakersFromHTML(newHtml, deputesQuebec);
      const existingMappingsMap = new Map(detectedSpeakersQuebec.map(s => [s.originalText, s.deputeId]));

      const updatedDetectedSpeakers = newlyDetected.map(newSpeaker => {
        const previouslyMappedDeputeId = existingMappingsMap.get(newSpeaker.originalText);
        return {
          ...newSpeaker,
          deputeId: previouslyMappedDeputeId !== undefined ? previouslyMappedDeputeId : newSpeaker.deputeId
        };
      });
      setDetectedSpeakersQuebec(updatedDetectedSpeakers);
    }
  }, [deputesQuebec, detectSpeakersFromHTML, detectedSpeakersQuebec]);

  const handlePdQContentChangeOttawa = useCallback((newHtml) => {
    setEditedContentOttawa(newHtml);
    if (deputesOttawa.length > 0) {
      const newlyDetected = detectSpeakersFromHTML(newHtml, deputesOttawa);
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
  }, [deputesOttawa, detectSpeakersFromHTML, detectedSpeakersOttawa]);

  const handleSend = async (pdqType) => {
    const formData = pdqType === 'quebec' ? formDataQuebec : formDataOttawa;
    const editedContent = pdqType === 'quebec' ? editedContentQuebec : editedContentOttawa;
    const deputes = pdqType === 'quebec' ? deputesQuebec : deputesOttawa;
    const detectedSpeakers = pdqType === 'quebec' ? detectedSpeakersQuebec : detectedSpeakersOttawa;
    const summaryPoints = pdqType === 'quebec' ? summaryPointsQuebec : summaryPointsOttawa;
    
    if (!formData.subject.trim()) {
      toast({ title: "Objet manquant", description: "Veuillez saisir un objet pour le courriel.", variant: "destructive" });
      return;
    }
    if (!formData.audience) {
      toast({ title: "Sélection manquante", description: "Veuillez sélectionner une audience.", variant: "destructive" });
      return;
    }
    if (!formData.fromName.trim()) {
      toast({ title: "Nom d'expéditeur manquant", description: "Veuillez saisir un nom d'expéditeur pour le courriel.", variant: "destructive" });
      return;
    }
    if (!formData.replyTo.trim()) {
      toast({ title: "Adresse de réponse manquante", description: "Veuillez saisir une adresse 'Répondre à' pour le courriel.", variant: "destructive" });
      return;
    }

    if (!editedContent.trim()) {
      toast({ title: "Contenu manquant", description: "Le résumé PdQ est vide.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const finalHtml = await buildPdQNewsletterHTML(editedContent, customSettings, deputes, formData.subject, detectedSpeakers, summaryPoints, pdqType);

      const { sendPdQNewsletter: sendPdQNewsletterFunction } = await import("@/api/functions");
      await sendPdQNewsletterFunction({
        subject: formData.subject,
        audience: formData.audience,
        segment_id: formData.segment || null,
        html_content: finalHtml,
        from_name: formData.fromName,
        reply_to: formData.replyTo
      });
      
      toast({ 
        title: "Bulletin PdQ envoyé !", 
        description: `Le résumé de la période de questions (${pdqType === 'quebec' ? 'Québec' : 'Ottawa'}) a été envoyé avec succès.` 
       });
      
      navigate('/Dashboard');
      
    } catch (error) {
      toast({ title: "Erreur d'envoi", description: error.data?.error || "Le bulletin n'a pas pu être envoyé.", variant: "destructive" });
      setIsSending(false);
    }
  };

  const renderPdQForm = (pdqType) => {
    const pdqSummary = pdqType === 'quebec' ? pdqSummaryQuebec : pdqSummaryOttawa;
    const editedContent = pdqType === 'quebec' ? editedContentQuebec : editedContentOttawa;
    const deputes = pdqType === 'quebec' ? deputesQuebec : deputesOttawa;
    const detectedSpeakers = pdqType === 'quebec' ? detectedSpeakersQuebec : detectedSpeakersOttawa;
    const handleSpeakerChange = pdqType === 'quebec' ? handleSpeakerChangeQuebec : handleSpeakerChangeOttawa;
    const handleContentChange = pdqType === 'quebec' ? handlePdQContentChangeQuebec : handlePdQContentChangeOttawa;
    const summaryPoints = pdqType === 'quebec' ? summaryPointsQuebec : summaryPointsOttawa;
    const setSummaryPoints = pdqType === 'quebec' ? setSummaryPointsQuebec : setSummaryPointsOttawa;
    
    const formData = pdqType === 'quebec' ? formDataQuebec : formDataOttawa;
    const setCurrentFormData = pdqType === 'quebec' ? setFormDataQuebec : setFormDataOttawa;

    
    if (!pdqSummary) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] bg-gray-50 rounded-lg border-2 border-dashed">
          <AlertCircle className="w-16 h-16 text-amber-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Aucun résumé PdQ disponible ({pdqType === 'quebec' ? 'Québec' : 'Ottawa'})
          </h3>
          <p className="text-gray-500 text-center max-w-md">
            Veuillez d'abord créer et sauvegarder un résumé dans la section Retranscription.
          </p>
        </div>
      );
    }
    
    const audienceNameForPopup = audiences.find(a => a.id === formData.audience)?.name;
    const segmentNameForPopup = segments.find(s => s.id === formData.segment)?.name;
    const targetDescription = segmentNameForPopup 
      ? `au segment "${segmentNameForPopup}"` 
      : (audienceNameForPopup ? `à toute l'audience "${audienceNameForPopup}"` : '');
    
    const confirmationMessage = `Vous êtes sur le point d'envoyer le bulletin de la période de questions (${pdqType === 'quebec' ? 'Québec' : 'Ottawa'}) ${targetDescription}.`;
    
    return (
      <div className="space-y-8">
        {/* Configuration de l'envoi */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration de l'envoi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={`email-subject-${pdqType}`}>Objet du courriel</Label>
              <Input
                id={`email-subject-${pdqType}`}
                value={formData.subject}
                onChange={(e) => setCurrentFormData(prev => ({...prev, subject: e.target.value}))}
                placeholder="Période de questions..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`mailchimp-audience-${pdqType}`}>Audience Mailchimp</Label>
                <Select value={formData.audience} onValueChange={(value) => setCurrentFormData(prev => ({...prev, audience: value}))}>
                  <SelectTrigger id={`mailchimp-audience-${pdqType}`}><SelectValue placeholder="Sélectionner une audience..." /></SelectTrigger>
                  <SelectContent>
                    {audiences.map(audience => (
                      <SelectItem key={audience.id} value={audience.id}>
                        {audience.name} ({audience.member_count} abonnés)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor={`mailchimp-segment-${pdqType}`}>Segment (optionnel)</Label>
                <Select 
                  value={formData.segment} 
                  onValueChange={(value) => setCurrentFormData(prev => ({...prev, segment: value}))}
                  disabled={!formData.audience || isLoadingSegments}
                >
                  <SelectTrigger id={`mailchimp-segment-${pdqType}`}>
                    <SelectValue placeholder={
                      isLoadingSegments ? "Chargement..." : 
                      !formData.audience ? "Choisissez d'abord une audience" :
                      "Optionnel - laissez vide pour toute l'audience"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.audience && (
                      <SelectItem value={""}>
                        Toute l'audience ({audiences.find(a => a.id === formData.audience)?.member_count || 0} abonnés)
                      </SelectItem>
                    )}
                    {segments.map(segment => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name} ({segment.member_count} membres)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`from-name-${pdqType}`}>Nom de l'expéditeur</Label>
                <Input
                  id={`from-name-${pdqType}`}
                  value={formData.fromName}
                  onChange={(e) => setCurrentFormData(prev => ({...prev, fromName: e.target.value}))}
                  placeholder="Catapulte"
                />
              </div>
              <div>
                <Label htmlFor={`reply-to-${pdqType}`}>Répondre à (adresse courriel)</Label>
                <Input
                  id={`reply-to-${pdqType}`}
                  value={formData.replyTo}
                  onChange={(e) => setCurrentFormData(prev => ({...prev, replyTo: e.target.value}))}
                  placeholder="info@catapultecommunication.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Section Sujets du jour */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-1 h-8 bg-purple-600 rounded-full"></div>
              Sujets du jour
            </CardTitle>
            <CardDescription>Ces 3 points apparaîtront en haut du bulletin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm mt-1">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <Input
                    id={`send-point-${pdqType}-${index}`}
                    value={summaryPoints[index] || ''}
                    onChange={(e) => {
                      const newPoints = [...summaryPoints];
                      newPoints[index] = e.target.value;
                      setSummaryPoints(newPoints);
                    }}
                    placeholder={`Sujet principal ${index + 1}...`}
                    className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Édition du contenu */}
        <Card>
          <CardHeader>
            <CardTitle>Éditer le contenu PdQ</CardTitle>
            <CardDescription>Modifiez les sujets, intervenants et contenus avant l'envoi</CardDescription>
          </CardHeader>
          <CardContent>
            <PdQContentEditor
              htmlContent={editedContent}
              deputes={deputes}
              detectedSpeakers={detectedSpeakers}
              onSpeakerChange={handleSpeakerChange}
              onContentChange={handleContentChange}
            />
          </CardContent>
        </Card>

        {/* Prévisualisation */}
        <Card>
          <CardHeader>
            <CardTitle>Prévisualisation du bulletin</CardTitle>
            <CardDescription>Vérifiez le rendu final avant l'envoi</CardDescription>
          </CardHeader>
          <CardContent>
            <PdQPreview 
              pdqContent={editedContent}
              customSettings={customSettings}
              deputes={deputes}
              emailSubject={formData.subject}
              detectedSpeakers={detectedSpeakers}
              summaryPoints={summaryPoints}
              pdqType={pdqType}
            />
          </CardContent>
        </Card>
        
        {/* Bouton d'envoi */}
        <Card>
          <CardHeader><CardTitle>Envoi</CardTitle></CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={isSending || !editedContent.trim() || !formData.audience || !formData.subject.trim() || !formData.fromName.trim() || !formData.replyTo.trim()} 
                  className="w-full bg-purple-600 hover:bg-purple-700" 
                  size="lg"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> 
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" /> 
                      Envoyer le bulletin PdQ
                      {targetDescription && ` ${targetDescription}`}
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer l'envoi ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {confirmationMessage}
                    <br/><br/>
                    Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleSend(pdqType)} className="bg-purple-600 hover:bg-purple-700">
                    Confirmer et Envoyer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mic className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Envoyer le bulletin PdQ</h1>
              <p className="text-gray-600 mt-1">
                Choisissez entre Québec et Ottawa
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/Dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="quebec" className="flex items-center gap-2">
              <span className="text-lg">🍁</span>
              <span>Québec</span>
            </TabsTrigger>
            <TabsTrigger value="ottawa" className="flex items-center gap-2">
              <span className="text-lg">🇨🇦</span>
              <span>Ottawa</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="quebec" className="mt-6">
            {renderPdQForm('quebec')}
          </TabsContent>
          
          <TabsContent value="ottawa" className="mt-6">
            {renderPdQForm('ottawa')}
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
}
