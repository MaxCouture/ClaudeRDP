
import React, { useState, useEffect } from "react";
import { Article, Source } from "@/api/entities"; // Ajout de Source
import { Card, CardContent, CardHeader, CardTitle }
from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, Eye, Loader2, ArrowLeft, PenSquare } from "lucide-react"; // Ajout de PenSquare
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { getMailchimpAudiences } from "@/api/functions";
import { getMailchimpSegments } from "@/api/functions"; // Corrected syntax here
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from 'react-router-dom';
import { Setting } from "@/api/entities"; // Importer l'entité Setting
import { DailySummary } from "@/api/entities"; // Importer l'entité DailySummary
import ReactQuill from 'react-quill'; // Importer ReactQuill
import 'react-quill/dist/quill.snow.css'; // Importer les styles de ReactQuill
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // Added this import
} from "@/components/ui/alert-dialog";


// Fonction partagée pour construire le HTML de l'email
async function buildNewsletterHTML(articles, governmentPublications, formData, selectedCategory, customSettings, chroniqueSummary) { // NOUVEAU: Ajout de chroniqueSummary
  if (!customSettings || !customSettings.newsletter_template) {
    return '<p style="font-family: Arial, sans-serif; text-align: center; color: #666;">Chargement du template...</p>';
  }

  // SOLUTION RADICALE : Utiliser un template propre au lieu du template corrompu
  // MISE À JOUR : Ajout d'un bloc <style> avec des media queries pour la responsivity mobile
  const cleanTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    /* Styles pour la responsivity */
    @media screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .header-padding {
        padding: 25px 20px !important;
      }
      .footer-padding {
        padding: 30px 20px !important;
      }
      .main-title {
        font-size: 32px !important;
        line-height: 1.3 !important;
      }
      .article-title {
        font-size: 20px !important;
        line-height: 1.3 !important;
      }
      .article-text, .intro-text {
        font-size: 16px !important;
        line-height: 1.6 !important;
      }
      .logo-img {
         max-height: 80px !important;
      }
      .gov-banner-title {
        font-size: 18px !important;
      }
      .gov-publication-title {
        font-size: 17px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: {{newsletter_body_bg_color}}; font-family: {{newsletter_font_family}};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: {{newsletter_body_bg_color}};">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table class="container" width="{{newsletter_container_width}}" cellpadding="0" cellspacing="0" border="0" style="max-width: {{newsletter_container_width}}; background-color: {{newsletter_body_bg_color}};">
          <tr>
            <td class="header-padding" style="padding: 40px 40px 30px 40px; background-color: {{newsletter_header_bg_color}};">
              {{header_html}}
            </td>
          </tr>
          <tr>
            <td class="content-padding" style="padding: 0 40px 20px 40px; background-color: {{newsletter_body_bg_color}};">
              <div style="font-size: 14px; color: {{newsletter_footer_text_color}}; text-align: right; font-family: {{newsletter_font_family}};">
                Édition du {{current_date}}
              </div>
              <!-- Ligne noire sous la date -->
              <hr style="border: none; height: 1px; background-color: #000000; margin: 15px 0 0 0;" />
            </td>
          </tr>
          <tr>
            <td class="content-padding" style="padding: 20px 40px 30px 40px; text-align: center; background-color: {{newsletter_body_bg_color}};">
              <h1 class="main-title" style="font-size: 42px; font-weight: 700; color: #967150; margin: 0; font-family: {{newsletter_main_title_font_family}}; line-height: 1.2;">
                Résumé de l'actualité
              </h1>
            </td>
          </tr>
          {{introduction_html}}
          {{chronique_summary_html}}
          <tr>
            <td class="content-padding" style="padding: 30px 40px 30px 40px; background-color: {{newsletter_body_bg_color}};">
              {{articles_html}}
            </td>
          </tr>
          {{government_publications_html}}
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

  const getFirstSentences = (text, count = 2) => {
    if (!text) return '';
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.slice(0, count).join(' ');
  };

  // Construire le HTML des articles avec le nouveau format sans boîtes
  let articlesHtml = '';
  
  // Bandeau "Revue de presse" avant les articles (si il y a des articles)
  if (articles.length > 0) {
    articlesHtml += `
      <div style="margin-bottom: 30px;">
        <img src="${customSettings.newsletter_revue_presse_banner_url || ''}" alt="Revue de presse" style="width: 100%; height: auto; display: block; border-radius: 8px;" />
      </div>
    `;
  }
  
  articles.forEach((article, index) => {
    const spacing = index > 0 ? "20px" : "0px"; // Réduit l'espacement entre les articles
    
    // Formater la date de publication
    let formattedDate = '';
    if (article.publication_date) {
      try {
        const pubDate = new Date(article.publication_date);
        formattedDate = format(pubDate, 'dd MMM yyyy', { locale: fr });
      } catch (error) {
        formattedDate = '';
      }
    }
    
    articlesHtml += `
        <div style="margin-top: ${spacing};">
          <!-- Ligne horizontale courte et épaisse -->
          <hr style="border: none; height: 3px; background-color: #967150; width: 45px; margin: 0 0 20px 0;" />
          
          <!-- Titre de l'article -->
          <h2 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.4; font-weight: bold; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'};">
              <a href="${article.url}" style="color: #000000; text-decoration: none;">${article.title}</a>
          </h2>
          
          <!-- Source et date -->
          <div style="margin-bottom: 15px; color: #000000; font-size: 14px; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">
              <span>
                  ${article.source_name}${formattedDate ? ` • ${formattedDate}` : ''}
              </span>
          </div>
          
          <!-- Contenu descriptif -->
          <p style="font-size: 16px; line-height: 1.6; color: #000000; margin: 0; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">
              ${getFirstSentences(article.content || article.summary)}
          </p>
        </div>
    `;
  });

  // Construire le HTML des publications gouvernementales avec le même style que les articles
  let governmentPublicationsHtml = '';
  if (governmentPublications && governmentPublications.length > 0) {
    
    // Bandeau "Publications gouvernementales" avant les publications
    governmentPublicationsHtml = `
        <tr>
            <td class="content-padding" style="padding: 30px 40px 10px 40px; background-color: ${customSettings.newsletter_body_bg_color || '#f5f5f5'};">
                <img src="${customSettings.newsletter_gov_publications_banner_url || ''}" alt="Publications gouvernementales" style="width: 100%; height: auto; display: block; border-radius: 8px;" />
            </td>
        </tr>
        <tr>
            <td class="content-padding" style="padding: 20px 40px 30px 40px; background-color: ${customSettings.newsletter_body_bg_color || '#f5f5f5'};">
    `;

    // Ajouter chaque publication gouvernementale avec le même style que les articles
    governmentPublications.forEach((publication, index) => {
      const spacing = index > 0 ? "60px" : "0px";
      
      let formattedDate = '';
      if (publication.publication_date) {
        try {
          const pubDate = new Date(publication.publication_date);
          formattedDate = format(pubDate, 'dd MMM yyyy', { locale: fr });
        } catch (error) {
          formattedDate = '';
        }
      }

      // Icône selon le type de publication
      let typeIcon = '📋';
      if (publication.publication_type === 'Mémoire') typeIcon = '📄';
      else if (publication.publication_type?.includes('Décret')) typeIcon = '⚖️';
      else if (publication.publication_type === 'Loi') typeIcon = '📜';
      else if (publication.publication_type?.includes('Règlement')) typeIcon = '📋';

      governmentPublicationsHtml += `
            <div style="margin-top: ${spacing};">
              <!-- Ligne horizontale courte et épaisse -->
              <hr style="border: none; height: 3px; background-color: #967150; width: 45px; margin: 0 0 20px 0;" />
              
              <!-- Titre de la publication -->
              <h2 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.4; font-weight: bold; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'};">
                  <a href="${publication.url}" style="color: #000000; text-decoration: none;">
                      ${typeIcon} ${publication.title}
                  </a>
              </h2>
              
              <!-- Type et date -->
              <div style="margin-bottom: 15px; color: #000000; font-size: 14px; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">
                  <span style="color: #000000; font-size: 14px;">
                      ${publication.publication_type}
                  </span>
                  ${formattedDate ? ` • ${formattedDate}` : ''}
                  ${publication.air_url ? ' • <a href="' + publication.air_url + '" style="color: #1e40af;">Analyse d\'impact</a>' : ''}
              </div>
            </div>
      `;
    });

    governmentPublicationsHtml += `
            </td>
        </tr>
    `;
  }

  // Déterminer la hauteur du logo image en fonction de la taille de la police
  const getImageLogoHeight = (fontSize) => {
    switch (fontSize) {
      case '32px': return '80px';
      case '36px': return '100px';
      case '40px': return '120px';
      case '44px': return '140px';
      default: return '100px';
    }
  };

  // Construire le HTML de l'en-tête avec logo plus gros
  let headerHtml = '';
  if (customSettings.newsletter_logo_url) {
    const logoHeight = getImageLogoHeight(customSettings.newsletter_logo_font_size);
    headerHtml = `<a href="https://www.catapultecommunication.com" style="text-decoration: none;"><img src="${customSettings.newsletter_logo_url}" alt="${customSettings.newsletter_logo_text || ''}" class="logo-img" style="display: block; max-height: ${logoHeight}; height: auto; width: auto;"></a>`;
  } else {
    headerHtml = `
        <a href="https://www.catapultecommunication.com" style="text-decoration: none; color: inherit;">
          <div style="font-size: ${customSettings.newsletter_logo_font_size || '42px'}; color: ${customSettings.newsletter_text_color || '#333333'}; font-weight: 300; margin-bottom: 8px; font-family: ${customSettings.newsletter_title_font_family || 'Georgia, serif'};">${customSettings.newsletter_logo_text || 'Catapulte'}</div>
          <div style="font-size: 14px; color: ${customSettings.newsletter_footer_text_color || '#666666'}; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">${customSettings.newsletter_logo_subtitle || 'Bureau de communication'}</div>
        </a>
    `;
  }

  // Construire le HTML de l'introduction SEULEMENT si elle existe
  let introductionHtml = '';
  if (formData.introduction && formData.introduction.trim()) {
    introductionHtml = `
        <tr>
          <td class="content-padding" style="padding: 0 40px 25px 40px;">
            <div class="intro-text" style="font-size: 15px; line-height: 1.6; color: ${customSettings.newsletter_text_color || '#333333'}; background-color: #fef3c7; padding: 18px; border-radius: 6px; border-left: 4px solid #f59e0b; font-family: ${customSettings.newsletter_font_family || 'Arial, sans-serif'};">
              ${formData.introduction.replace(/\n/g, '<br>')}
            </div>
          </td>
        </tr>
    `;
  }

  // Construire le HTML du résumé de la chronique SEULEMENT s'il existe
  let chroniqueSummaryHtml = '';
  
  if (chroniqueSummary && chroniqueSummary.text) {
    const spacer24 = `
      <tr>
        <td height="24" style="height:24px; line-height:24px; font-size:0; mso-line-height-rule:exactly;">&nbsp;</td>
      </tr>
    `;
  
    // 1) BANDEAU = hors de la boîte
    let topBannerRow = '';
    if (customSettings.newsletter_chronique_banner_1_url) {
      topBannerRow = `
        <tr>
          <td style="padding: 0 40px;">
            <img src="${customSettings.newsletter_chronique_banner_1_url}" alt="Bannière Chronique" style="display:block; width:100%; height:auto; border:0; outline:none; text-decoration:none;" />
          </td>
        </tr>
      `;
    }
  
    // Déterminer le nom de l'intervenant à afficher
    const speakerName = chroniqueSummary.speaker === 'custom' 
      ? (chroniqueSummary.customSpeakerInput || '') 
      : (chroniqueSummary.speaker || '');

    // 2) BOÎTE TEXTE avec styles pour espacement entre sujets - SANS LOGO
    const textBox = `
      <tr>
        <td style="padding: 0 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="border-collapse:separate; border-spacing:0; background-color:${customSettings.newsletter_chronique_bg_color || '#967150'}; border-radius:8px;">
            <tr>
              <td style="padding: 30px 25px 30px 25px;">
                <div style="margin:0 0 20px 0;">
                  <h2 style="font-family:${customSettings.newsletter_title_font_family || 'Inter, sans-serif'}; font-size:24px; color:${customSettings.newsletter_chronique_title_color || '#FFFFFF'}; margin:0; font-weight:400; line-height:1.3;">
                    ${chroniqueSummary.title || ""}
                  </h2>
                  ${speakerName
                      ? `<p style="font-family:${customSettings.newsletter_font_family || 'Inter, sans-serif'}; font-size:17px; color:${customSettings.newsletter_chronique_text_color || '#FFFFFF'}; margin:8px 0 0 0; opacity:0.95; font-weight:600;">
                           par ${speakerName}
                         </p>`
                      : '' }
                </div>
  
                <!-- Contenu avec styles pour strong (titres) et listes -->
                <div style="font-family:${customSettings.newsletter_font_family || 'Inter, sans-serif'}; font-size:15px; color:${customSettings.newsletter_chronique_text_color || '#FFFFFF'}; line-height:1.7; margin:0;">
                  <style>
                    strong {
                      font-weight: 700 !important;
                      font-size: 17px !important;
                      display: block !important;
                      margin: 15px 0 8px 0 !important;
                      line-height: 1.3 !important;
                      color: ${customSettings.newsletter_chronique_text_color || '#FFFFFF'} !important;
                    }
                    strong:first-child {
                      margin-top: 0 !important;
                    }
                    ul {
                      margin: 8px 0 24px 0 !important;
                      padding-left: 20px !important;
                      list-style-type: disc !important;
                    }
                    li {
                      margin: 4px 0 !important;
                      color: ${customSettings.newsletter_chronique_text_color || '#FFFFFF'} !important;
                    }
                  </style>
                  ${chroniqueSummary.text}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  
    // 3) (Optionnel) bandeau de fin
    let bottomBannerRow = '';
    if (customSettings.newsletter_chronique_banner_2_url) {
      bottomBannerRow = `
        <tr>
          <td style="padding: 0 40px;">
            <img src="${customSettings.newsletter_chronique_banner_2_url}" alt="Bannière Chronique Fin" style="display:block; width:100%; height:auto; border:0; outline:none; text-decoration:none;" />
          </td>
        </tr>
      `;
    }
  
    chroniqueSummaryHtml = `
      ${topBannerRow}
      ${topBannerRow ? spacer24 : ''}
      ${textBox}
      ${bottomBannerRow ? spacer24 : ''}
      ${bottomBannerRow}
    `;
  }

  // Date actuelle formatée au long
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  
  // NOUVEAU: Titre simplifié pour le bulletin
  const subject = `Bulletin d'information`;

  // Variables de remplacement
  const templateVariables = {
    header_html: headerHtml,
    introduction_html: introductionHtml,
    chronique_summary_html: chroniqueSummaryHtml,
    articles_html: articlesHtml,
    government_publications_html: governmentPublicationsHtml,
    subject: subject,
    current_date: dateStr,
    newsletter_body_bg_color: customSettings.newsletter_body_bg_color || '#f5f5f5',
    newsletter_header_bg_color: customSettings.newsletter_header_bg_color || '#FFFFFF',
    newsletter_footer_text_color: customSettings.newsletter_footer_text_color || '#666666',
    newsletter_main_title_color: customSettings.newsletter_main_title_color || '#333333', // Kept for consistency, not directly used in H1 anymore
    newsletter_main_title_font_size: customSettings.newsletter_main_title_font_size || '32px', // Kept for consistency, not directly used in H1 anymore
    newsletter_main_title_font_family: customSettings.newsletter_main_title_font_family || 'Georgia, serif',
    newsletter_text_color: customSettings.newsletter_text_color || '#333333',
    newsletter_footer_bg_color: customSettings.newsletter_footer_bg_color || '#f5f5f5',
    newsletter_font_family: customSettings.newsletter_font_family || 'Arial, sans-serif',
    newsletter_title_font_family: customSettings.newsletter_title_font_family || 'Georgia, serif',
    newsletter_contact_info_email: customSettings.newsletter_contact_info_email || 'Info@catapultecommunication.com',
    newsletter_contact_info_phone: customSettings.newsletter_contact_info_phone || '(418) 545-4373',
    newsletter_logo_font_size: customSettings.newsletter_logo_font_size || '42px',
    newsletter_container_width: customSettings.newsletter_container_width || '680px',
    newsletter_link_color: customSettings.newsletter_link_color || '#2563eb'
  };

  // Fonction de remplacement des variables
  function replaceTemplateVariables(template, variables) {
    let result = template;
    
    // Remplacer les variables avec triple accolades d'abord {{{var}}}
    // This part remains, but will likely no longer find matches in the cleanTemplate
    Object.keys(variables).forEach(key => {
      const tripleRegex = new RegExp(`\\{\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(tripleRegex, variables[key] || '');
    });
    
    // Puis remplacer les variables avec double accolades {{var}}
    Object.keys(variables).forEach(key => {
      const doubleRegex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(doubleRegex, variables[key] || '');
    });
    
    return result;
  }

  // Remplacer toutes les variables dans le template nettoyé
  return replaceTemplateVariables(cleanTemplate, templateVariables);
}

function NewsletterPreview({ articles, governmentPublications, formData, selectedCategory, customSettings, chroniqueSummary }) { // NOUVEAU: Ajout de chroniqueSummary
  const [previewHtml, setPreviewHtml] = React.useState('');

  React.useEffect(() => {
    const generatePreview = async () => {
        const finalHtml = await buildNewsletterHTML(articles, governmentPublications, formData, selectedCategory, customSettings, chroniqueSummary); // NOUVEAU: Passer chroniqueSummary
        setPreviewHtml(finalHtml);
    };
    generatePreview();
  }, [articles, governmentPublications, formData, selectedCategory, customSettings, chroniqueSummary]); // NOUVEAU: Ajout de chroniqueSummary

  return (
    <div className="w-full bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600">
            Aperçu du courriel
        </div>
        <iframe
            srcDoc={previewHtml}
            title="Aperçu du bulletin"
            className="w-full h-[800px]"
            style={{ border: 'none' }}
        />
    </div>
  );
}

export default function NewsletterPage() {
  const [categorizedArticles, setCategorizedArticles] = useState([]);
  const [categorizedGovPublications, setCategorizedGovPublications] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [segments, setSegments] = useState([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customSettings, setCustomSettings] = useState({}); // État pour les paramètres personnalisés
  const [editableSummary, setEditableSummary] = useState({ title: '', text: '', speaker: '', customSpeakerInput: '' }); // NOUVEAU: État pour le résumé éditable et le nom de l'intervenant
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    subject: "Résumé de l'actualité - " + format(new Date(), 'd MMMM yyyy', { locale: fr }),
    audience: "",
    segment: "", // Initialisé à une chaîne vide
    introduction: "",
    fromName: "Catapulte", // Changed from "Catapulte Communication" to "Catapulte"
    replyTo: "info@catapultecommunication.com"
  });

  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("🔥 Newsletter - Chargement des articles catégorisés...");
        
        const [allArticles, sources, settings] = await Promise.all([
          Article.list("-publication_date", 2000), // MÊME limite que le Dashboard
          Source.list(),
          Setting.filter({ name: "default_configuration" })
        ]);

        const sourceMap = new Map(sources.map(s => [s.id, s.name]));
        
        // COPIE EXACTE de la logique du Dashboard
        const EXCLUDED_CATEGORIES = ['ConseilDesMinistres', 'GazetteOfficielle', 'Gouvernement', 'AssembleeNationale'];
        const now = new Date();

        // 1. On filtre les articles pour le fil d'actualité. C'est notre définition d'un article "actif".
        const articlesForDashboardFeed = allArticles.filter(article => {
          const isExcluded = EXCLUDED_CATEGORIES.some(cat => article.categories?.includes(cat));
          if (isExcluded) return false;

          let isRecent = false;
          if (article.publication_date) {
              try {
                  const diffInHours = (now.getTime() - new Date(article.publication_date).getTime()) / (1000 * 60 * 60); // Ensure valid date object before getTime()
                  if (diffInHours <= 48) isRecent = true;
              } catch (e) { /* ignore */ }
          }
          const isCategorized = article.categories && article.categories.length > 0 && !article.categories.includes('Aucune catégorie détectée');
          return isRecent || isCategorized;
        });

        // 2. Séparer articles de presse et publications gouvernementales
        const pressArticles = [];
        const govPublications = [];
        
        allArticles.forEach(article => {
          const isExcluded = EXCLUDED_CATEGORIES.some(cat => article.categories?.includes(cat));
          
          if (isExcluded) {
            // Publications gouvernementales - même logique que le Dashboard
            let publicationType = 'Document';
            if (article.categories?.includes('ConseilDesMinistres')) {
                publicationType = 'Mémoire';
            } else if (article.categories?.includes('AssembleeNationale')) {
                publicationType = 'Décret';
            } else if (article.categories?.includes('GazetteOfficielle')) {
                if (article.title.toLowerCase().includes('décret')) publicationType = 'Décret';
                else if (article.title.toLowerCase().includes('règlement')) publicationType = 'Règlement';
                else publicationType = 'Décret/Règlement';
            } else if (article.categories?.includes('Gouvernement')) {
                publicationType = 'Document gouvernemental';
            }

            // CORRECTION: Inclure toutes les publications gouvernementales qui ont au moins une vraie catégorie en plus
            const hasNonGovCategories = article.categories && 
              article.categories.some(cat => 
                !EXCLUDED_CATEGORIES.includes(cat) && 
                cat !== 'Aucune catégorie détectée'
              );
            
            if (hasNonGovCategories) {
              govPublications.push({
                  ...article,
                  source_name: sourceMap.get(article.source_id) || 'Gouvernement du Québec',
                  publication_type: publicationType,
                  air_url: article.air_url || null
              });
            }
          } else {
            // COPIE EXACTE : Utiliser la logique du Dashboard pour articles de presse
            let isRecent = false;
            if (article.publication_date) {
                try {
                    const articleDate = new Date(article.publication_date);
                    if (!isNaN(articleDate.getTime())) { // Ensure date is valid
                        const diffInHours = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
                        if (diffInHours <= 48) isRecent = true;
                    }
                } catch (e) { /* ignore */ }
            }
            
            const isCategorized = article.categories && 
                                 article.categories.length > 0 && 
                                 !article.categories.includes('Aucune catégorie détectée');
            
            if (isRecent || isCategorized) {
                pressArticles.push({
                    ...article,
                    source_name: sourceMap.get(article.source_id) || 'Source inconnue'
                });
            }
          }
        });
        
        console.log(`🔥 Newsletter - ${pressArticles.length} articles de presse prêts, ${govPublications.length} publications gouvernementales`);
        console.log(`🔥 Newsletter - Détail articles presse: ${pressArticles.map(a => a.categories?.join(',') || 'aucune').join(' | ')}`);
        console.log(`🔥 Newsletter - Détail publications gouv: ${govPublications.map(g => g.categories?.join(',') || 'aucune').join(' | ')}`);
        
        setCategorizedArticles(pressArticles);
        setCategorizedGovPublications(govPublications);
        setCustomSettings(settings.length > 0 ? settings[0] : {});

        // CORRECTION: Filtrer seulement les résumés de type 'chronique'
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const summaries = await DailySummary.filter({ 
            summary_date: todayStr,
            type: 'chronique'  // ✅ Filtre seulement les chroniques pour le bulletin
          });
          
          if (summaries.length > 0) {
            const loadedTitle = summaries[0].daily_title || '';
            const loadedText = summaries[0].summary_text || '';
            const loadedSpeaker = summaries[0].speaker || '';

            const predefinedSpeakers = ["Jonathan Trudeau", "Louis Lacroix", "Philippe Léger"];
            let initialSpeakerSelectValue = '';
            let initialCustomSpeakerInputValue = '';

            if (predefinedSpeakers.includes(loadedSpeaker)) {
              initialSpeakerSelectValue = loadedSpeaker;
            } else if (loadedSpeaker) {
              initialSpeakerSelectValue = 'custom';
              initialCustomSpeakerInputValue = loadedSpeaker;
            }

            setEditableSummary({
              title: loadedTitle,
              text: loadedText,
              speaker: initialSpeakerSelectValue,
              customSpeakerInput: initialCustomSpeakerInputValue
            });
          } else {
            setEditableSummary({ title: '', text: '', speaker: '', customSpeakerInput: '' });
          }
        } catch(e){ 
            console.error("Erreur lors du chargement du résumé de la chronique:", e);
            setEditableSummary({ title: '', text: '', speaker: '', customSpeakerInput: '' });
        }


      } catch (error) {
        console.error("🔥 Newsletter - Erreur:", error);
        toast({ title: "Erreur", description: "Impossible de charger les articles catégorisés ou les paramètres.", variant: "destructive" });
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
  }, [toast]);

  // NOUVEAU: useEffect pour charger les segments quand l'audience change
  useEffect(() => {
    const fetchSegments = async () => {
      if (!formData.audience) {
        setSegments([]);
        setFormData(prev => ({ ...prev, segment: "" }));
        return;
      }
      
      setIsLoadingSegments(true);
      setSegments([]);
      setFormData(prev => ({ ...prev, segment: "" }));
      
      try {
        const res = await getMailchimpSegments({ audience_id: formData.audience });
        setSegments(res.data);
      } catch (error) {
        toast({ title: "Erreur", description: "Impossible de charger les segments pour cette audience.", variant: "destructive" });
      } finally {
        setIsLoadingSegments(false);
      }
    };

    fetchSegments();
  }, [formData.audience, toast]);


  // Filtrer les articles par catégorie sélectionnée
  const filteredArticles = selectedCategory === 'all' 
    ? categorizedArticles 
    : categorizedArticles.filter(article => 
        article.categories && article.categories.includes(selectedCategory)
      );

  // Filtrer les publications gouvernementales par catégorie sélectionnée
  const filteredGovPublications = selectedCategory === 'all' 
    ? categorizedGovPublications 
    : categorizedGovPublications.filter(publication => 
        publication.categories && publication.categories.includes(selectedCategory)
      );

  // CORRECTION: Obtenir toutes les catégories disponibles en excluant correctement les catégories système
  const allCategorizedContent = [...categorizedArticles, ...categorizedGovPublications];
  const availableCategories = [...new Set(
    allCategorizedContent.flatMap(item => 
      item.categories?.filter(cat => 
        !['ConseilDesMinistres', 'AssembleeNationale', 'GazetteOfficielle', 'Aucune catégorie détectée', 'Gouvernement'].includes(cat)
      ) || []
    )
  )].sort();

  console.log(`🔥 Newsletter - Catégories disponibles: ${availableCategories.join(', ')}`);
  console.log(`🔥 Newsletter - Total contenu catégorisé: ${allCategorizedContent.length} éléments`);

  const handleSend = async () => {
    // Vérifier si on a du contenu (articles/publications OU résumé de chronique)
    const hasChroniqueSummary = editableSummary && editableSummary.text && editableSummary.text.trim();
    
    if (!formData.audience) {
      toast({ title: "Sélection manquante", description: "Veuillez sélectionner une audience.", variant: "destructive" });
      return;
    }

    if (filteredArticles.length === 0 && filteredGovPublications.length === 0 && !hasChroniqueSummary) {
      toast({ title: "Aucun contenu", description: "Aucun article, publication ou résumé à envoyer.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      // NOUVEAU: Objet personnalisé avec la catégorie
      const updatedSubject = selectedCategory === 'all' 
        ? `☕ Le tour de l'actualité` 
        : `☕ Le tour de l'actualité - ${selectedCategory}`;
      
      const finalHtml = await buildNewsletterHTML(filteredArticles, filteredGovPublications, formData, selectedCategory, customSettings, editableSummary);

      const { sendNewsletter: sendNewsletterFunction } = await import("@/api/functions");
      await sendNewsletterFunction({
        subject: updatedSubject,
        audience: formData.audience,
        segment_id: (formData.segment && formData.segment !== "__all__") ? formData.segment : null, // Correctly handle "__all__" value
        html_content: finalHtml,
        from_name: formData.fromName,
        reply_to: formData.replyTo,
      });
      
      // CORRECTION MAJEURE: Réinitialiser les articles selon la catégorie
      if (selectedCategory === 'all') {
        // Si "toutes les catégories", réinitialiser tous les articles de presse
        const allPressArticles = categorizedArticles; // Tous les articles de presse catégorisés
        const pressUpdatePromises = allPressArticles.map(article =>
          Article.update(article.id, { categories: [], is_manually_categorized: false })
        );
        
        // Pour les publications gouvernementales, garder seulement les catégories de source
        const allGovPublications = categorizedGovPublications; // Toutes les publications gouvernementales
        const govUpdatePromises = allGovPublications.map(publication =>
          Article.update(publication.id, { 
            categories: publication.categories.filter(cat => 
              ['ConseilDesMinistres', 'AssembleeNationale', 'GazetteOfficielle', 'Gouvernement'].includes(cat)
            ), 
            is_manually_categorized: false 
          })
        );
        
        await Promise.all([...pressUpdatePromises, ...govUpdatePromises]);
        
      } else {
        // Si catégorie spécifique, réinitialiser TOUS les articles qui ont cette catégorie
        // Articles de presse: retirer complètement la catégorie spécifique
        const articlesWithCategory = categorizedArticles.filter(article => 
          article.categories && article.categories.includes(selectedCategory)
        );
        
        const pressUpdatePromises = articlesWithCategory.map(article => {
          const updatedCategories = article.categories.filter(cat => cat !== selectedCategory);
          return Article.update(article.id, { 
            categories: updatedCategories, 
            is_manually_categorized: updatedCategories.length > 0 // Garder le flag si d'autres catégories restent
          });
        });
        
        // Publications gouvernementales: retirer seulement la catégorie spécifique
        const govPublicationsWithCategory = categorizedGovPublications.filter(publication => 
          publication.categories && publication.categories.includes(selectedCategory)
        );
        
        const govUpdatePromises = govPublicationsWithCategory.map(publication => {
          const updatedCategories = publication.categories.filter(cat => 
            // Keep system categories, and filter out the selectedCategory
            ['ConseilDesMinistres', 'AssembleeNationale', 'GazetteOfficielle', 'Gouvernement'].includes(cat) ||
            (cat !== selectedCategory && !['ConseilDesMinistres', 'AssembleeNationale', 'GazetteOfficielle', 'Gouvernement'].includes(cat))
          );
          return Article.update(publication.id, { 
            categories: updatedCategories, 
            is_manually_categorized: false 
          });
        });
        
        await Promise.all([...pressUpdatePromises, ...govUpdatePromises]);
      }
      
      const totalSentPress = filteredArticles.length;
      const totalSentGov = filteredGovPublications.length;
      const categoryText = selectedCategory === 'all' ? 'toutes catégories' : `catégorie "${selectedCategory}"`;
      
      const sentItemSummary = [];
      if (totalSentPress > 0) sentItemSummary.push(`${totalSentPress} article${totalSentPress > 1 ? 's' : ''} de presse`);
      if (totalSentGov > 0) sentItemSummary.push(`${totalSentGov} publication${totalSentGov > 1 ? 's' : ''} gouvernementale${totalSentGov > 1 ? 's' : ''}`);
      if (hasChroniqueSummary) sentItemSummary.push('résumé de chronique');

      const itemDescription = sentItemSummary.length > 0 ? ` incluant ${sentItemSummary.join(' et ')}` : '';
      
      toast({ 
        title: "Bulletin envoyé!", 
        description: `Le bulletin ${categoryText}${itemDescription} a été envoyé avec succès. Les contenus ont été réinitialisés.`,
      });
      
      // Rediriger vers le tableau de bord pour forcer le rafraîchissement des données
      navigate('/Dashboard');
      
    } catch (error) {
      toast({ title: "Erreur d'envoi", description: error.data?.error || "La newsletter n'a pas pu être envoyée.", variant: "destructive" });
      setIsSending(false);
    }
  };
  
  const totalContent = filteredArticles.length + filteredGovPublications.length;
  
  const totalGovContent = categorizedGovPublications.length;
  const hasChroniqueSummary = editableSummary && editableSummary.text && editableSummary.text.trim();

  // Créer le message de confirmation
  const categoryNameForPopup = selectedCategory === 'all' ? 'de toutes les catégories' : `de la catégorie "${selectedCategory}"`;
  const audienceNameForPopup = audiences.find(a => a.id === formData.audience)?.name;
  const segmentNameForPopup = (formData.segment && formData.segment !== "__all__")
    ? segments.find(s => s.id === formData.segment)?.name
    : null; // If "__all__" is selected, segmentNameForPopup should be null for specific segment name
  
  const targetDescription = segmentNameForPopup 
    ? `au segment "${segmentNameForPopup}"` 
    : (audienceNameForPopup ? `à toute l'audience "${audienceNameForPopup}"` : '');
  
  const confirmationMessage = `Vous êtes sur le point d'envoyer la revue de presse ${categoryNameForPopup} ${targetDescription}.`;

  // MODIFICATION: Permettre l'accès même sans articles si on a un résumé
  if (categorizedArticles.length === 0 && totalGovContent === 0 && !hasChroniqueSummary) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
              <Mail className="w-16 h-16 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">Aucun contenu disponible</h2>
              <p className="text-gray-500 mb-6">Veuillez d'abord catégoriser des articles ou créer un résumé de chronique.</p>
              <Button onClick={() => navigate('/Dashboard')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retourner au fil de nouvelles
              </Button>
          </div>
      );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Envoyer le bulletin</h1>
                <p className="text-gray-600 mt-1">
                  {categorizedArticles.length} article{categorizedArticles.length > 1 ? 's' : ''} de presse • 
                  {totalGovContent} publication{totalGovContent > 1 ? 's' : ''} gouvernementale{totalGovContent > 1 ? 's' : ''}
                  {hasChroniqueSummary && ' • Résumé de chronique disponible'}
                  {selectedCategory !== 'all' && ` • ${totalContent} dans "${selectedCategory}"`}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/Dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retourner au fil de nouvelles
            </Button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Configuration du bulletin</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Catégorie à envoyer</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        Toutes les catégories ({categorizedArticles.length + categorizedGovPublications.length} éléments)
                      </SelectItem>
                      {availableCategories.map(category => {
                        const articleCount = categorizedArticles.filter(a => a.categories?.includes(category)).length;
                        const govCount = categorizedGovPublications.filter(g => g.categories?.includes(category)).length;
                        return (
                          <SelectItem key={category} value={category}>
                            {category} ({articleCount} articles + {govCount} publications)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Audience Mailchimp</Label>
                  <Select value={formData.audience} onValueChange={(value) => setFormData({...formData, audience: value})}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une audience..." /></SelectTrigger>
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
                  <Label>Segment (optionnel)</Label>
                  <Select 
                    value={formData.segment} 
                    onValueChange={(value) => setFormData({...formData, segment: value})}
                    disabled={!formData.audience || isLoadingSegments}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        isLoadingSegments ? "Chargement des segments..." : 
                        !formData.audience ? "Choisissez d'abord une audience" :
                        segments.length === 0 ? "Aucun segment disponible - envoi à toute l'audience" :
                        "Optionnel - laissez vide pour toute l'audience"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.audience && (
                        <SelectItem value="__all__">
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
                  {segments.length === 0 && formData.audience && !isLoadingSegments && (
                    <p className="text-sm text-gray-500 mt-1">
                      Cette audience n'a pas de segments configurés. Le bulletin sera envoyé à tous les abonnés.
                    </p>
                  )}
                </div>
                
                <div>
                  <Label>Introduction (optionnel)</Label>
                  <Textarea
                    value={formData.introduction}
                    onChange={(e) => setFormData({...formData, introduction: e.target.value})}
                    placeholder="Texte d'introduction du bulletin..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* NOUVEAU: Carte pour éditer le résumé de la chronique */}
            {editableSummary.text && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenSquare className="w-5 h-5 text-amber-600" />
                    Éditer le résumé de la chronique
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div>
                     <Label htmlFor="chronique-title">Titre de la chronique</Label>
                     <Input 
                       id="chronique-title"
                       value={editableSummary.title}
                       onChange={(e) => setEditableSummary(prev => ({...prev, title: e.target.value}))}
                     />
                   </div>
                   <div>
                     <Label htmlFor="chronique-speaker">Intervenant</Label>
                     <Select 
                       value={editableSummary.speaker} 
                       onValueChange={(value) => {
                         if (value === 'custom') {
                           setEditableSummary(prev => ({...prev, speaker: value}));
                         } else {
                           setEditableSummary(prev => ({...prev, speaker: value, customSpeakerInput: ''}));
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
                        value={editableSummary.text} 
                        onChange={(value) => setEditableSummary(prev => ({...prev, text: value}))}
                        className="bg-white mt-1" 
                      />
                   </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader><CardTitle>Envoi</CardTitle></CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      disabled={isSending || (totalContent === 0 && !hasChroniqueSummary) || !formData.audience} 
                      className="w-full bg-blue-600 hover:bg-blue-700" 
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
                          Envoyer le bulletin 
                          {totalContent > 0 && `(${totalContent} éléments)`}
                          {totalContent === 0 && hasChroniqueSummary && '(résumé de chronique)'}
                          {(formData.segment && formData.segment !== "__all__") ? 
                            ` au segment "${segments.find(s => s.id === formData.segment)?.name}"` : 
                            (formData.audience && formData.segment === "__all__" ? ` à toute l'audience "${audiences.find(a => a.id === formData.audience)?.name}"` : "")
                          }
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer l'envoi ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {confirmationMessage}
                        {hasChroniqueSummary && <><br/><br/>Inclut également le résumé de chronique du jour.</>}
                        <br/><br/>
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSend} className="bg-blue-600 hover:bg-blue-700">
                        Confirmer et Envoyer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Après l'envoi, les articles seront automatiquement réinitialisés.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Prévisualisation</CardTitle></CardHeader>
              <CardContent>
                <NewsletterPreview 
                  articles={filteredArticles} 
                  governmentPublications={filteredGovPublications}
                  formData={formData} 
                  selectedCategory={selectedCategory} 
                  customSettings={customSettings} 
                  chroniqueSummary={editableSummary} // NOUVEAU: Passer le résumé éditable
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
