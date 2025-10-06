
import React, { useState, useEffect } from "react";
import { Setting } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Save, Loader2, Code, Palette, LayoutDashboard, Mail, RefreshCw, PenSquare, User, Shield, Users, Search } from "lucide-react";
import { UploadFile } from "@/api/integrations";
import { Depute } from "@/api/entities";
import { DeputeFederal } from "@/api/entities";
import DeputeCard from "../components/settings/DeputeCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_NEWSLETTER_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: {{newsletter_body_bg_color}}; font-family: {{newsletter_font_family}};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: {{newsletter_body_bg_color}};">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <!-- Container principal -->
        <table width="{{newsletter_container_width}}" cellpadding="0" cellspacing="0" border="0" style="max-width: {{newsletter_container_width}}; background-color: {{newsletter_body_bg_color}};">
          <!-- En-tête -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background-color: {{newsletter_header_bg_color}};">
              {{{header_html}}}
            </td>
          </tr>
          
          <!-- Date -->
          <tr>
            <td style="padding: 0 40px 20px 40px; background-color: {{newsletter_body_bg_color}};">
              <div style="font-size: 14px; color: {{newsletter_footer_text_color}}; text-align: right; font-family: {{newsletter_font_family}};">
                Édition du {{current_date}}
              </div>
            </td>
          </tr>
          
          <!-- Titre principal -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; text-align: center; background-color: {{newsletter_body_bg_color}};">
              <h1 style="font-size: {{newsletter_main_title_font_size}}; font-weight: 300; color: {{newsletter_main_title_color}}; margin: 0; font-family: {{newsletter_main_title_font_family}}; line-height: 1.3;">
                {{subject}}
              </h1>
            </td>
          </tr>
          
          <!-- Résumé de la chronique (si présent) -->
          {{{chronique_summary_html}}}
          
          <!-- Introduction (seulement si présente) -->
          {{{introduction_html}}}
          
          <!-- Articles -->
          <tr>
            <td style="padding: 0 40px 30px 40px; background-color: {{newsletter_body_bg_color}};">
              {{{articles_html}}}
            </td>
          </tr>
          
          <!-- Pied de page -->
          <tr>
            <td style="padding: 40px; text-align: center; background-color: {{newsletter_footer_bg_color}};">
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

const DEFAULT_CLAUDE_PDQ_PROMPT = `Tu es un assistant spécialisé dans la synthèse des débats de l'Assemblée nationale du Québec. Ton rôle est d'analyser la transcription de la période de questions et de produire un résumé structuré en HTML.

Instructions :
1. Identifie les principaux sujets abordés pendant la période de questions
2. Pour chaque sujet, structure ton résumé ainsi :
   - Un titre H3 pour le sujet principal
   - Pour chaque intervenant important, un titre H4 avec son nom et son parti (format: "Prénom Nom, Parti")
   - Les points clés de son intervention en liste à puces
3. Utilise des balises HTML simples : <h3>, <h4>, <p>, <ul>, <li>
4. Garde un ton neutre et factuel
5. Concentre-toi sur les arguments principaux et les échanges significatifs
6. Ne génère que le HTML du contenu, sans balises <html>, <head> ou <body>

Exemple de structure :
<h3>Sujet principal 1</h3>
<h4>François Legault, CAQ</h4>
<ul>
<li>Point clé 1</li>
<li>Point clé 2</li>
</ul>
<h4>Dominique Anglade, PLQ</h4>
<ul>
<li>Point clé 1</li>
<li>Point clé 2</li>
</ul>`;

const DEFAULT_CLAUDE_PDQ_OTTAWA_PROMPT = `Tu es un assistant spécialisé dans la synthèse des débats de la Chambre des communes du Canada. Ton rôle est d'analyser la transcription de la période de questions et de produire un résumé structuré en HTML.

Instructions :
1. Identifie les principaux sujets abordés pendant la période de questions
2. Pour chaque sujet, structure ton résumé ainsi :
   - Un titre H3 pour le sujet principal
   - Pour chaque intervenant important, un titre H4 avec son nom et son parti (format: "Prénom Nom, Parti")
   - Les points clés de son intervention en liste à puces
3. Utilise des balises HTML simples : <h3>, <h4>, <p>, <ul>, <li>
4. Garde un ton neutre et factuel
5. Concentre-toi sur les arguments principaux et les échanges significatifs
6. Ne génère que le HTML du contenu, sans balises <html>, <head> ou <body>

Exemple de structure :
<h3>Sujet principal 1</h3>
<h4>Justin Trudeau, PLC</h4>
<ul>
<li>Point clé 1</li>
<li>Point clé 2</li>
</ul>
<h4>Pierre Poilievre, PCC</h4>
<ul>
<li>Point clé 1</li>
<li>Point clé 2</li>
</ul>`;

const DEFAULT_CLAUDE_CHRONIQUE_PROMPT = `Tu es un expert en résumé de chroniques politiques québécoises.

Ta mission : transformer une transcription audio de chronique politique en un résumé structuré et concis.

FORMAT STRICT À RESPECTER :
- Structure par sujets abordés dans la chronique
- Pour chaque sujet :
  * Un titre en HTML : <strong>Titre du sujet</strong>
  * Immédiatement après, une liste HTML à puces : <ul><li>Point 1</li><li>Point 2</li></ul>
  * 3 à 4 points maximum par sujet
  * Une ligne vide entre chaque sujet

RÈGLES ABSOLUES :
- N'utilise JAMAIS d'astérisques (**) - c'est INTERDIT
- N'utilise JAMAIS de markdown - SEULEMENT du HTML pur
- Le titre ne doit JAMAIS être dans une liste à puces
- Titres : <strong>Titre</strong> (sans <li>)
- Points : <ul><li>...</li></ul> uniquement
- Ton neutre et factuel
- Français québécois
- Maximum 3-4 sujets par résumé

EXEMPLE EXACT DE FORMAT ATTENDU :

<strong>Crise du logement à Montréal</strong>
<ul>
<li>Le gouvernement annonce un investissement de 2 milliards sur 5 ans</li>
<li>Opposition critique le manque de mesures immédiates pour les locataires</li>
<li>Construction de 10 000 nouveaux logements sociaux prévue d'ici 2026</li>
</ul>

<strong>Réforme de la santé</strong>
<ul>
<li>Ajout de 3 000 infirmières dans le réseau public</li>
<li>Délais d'attente toujours problématiques selon les syndicats</li>
<li>Investissement dans la télémédecine pour les régions éloignées</li>
</ul>

IMPORTANT : Ne génère QUE ce format. Pas de préambule, pas de conclusion, ligne vide entre chaque sujet.`;

const DEFAULT_CLAUDE_ARTICLE_PROMPT = `Tu es un expert en résumé d'articles de presse québécois. Tu fournis des résumés précis et concis en français.

Agis comme un analyste de presse expert. Résume l'article en un paragraphe concis (environ 3-4 phrases). Le résumé doit capturer les points clés, le contexte et les principaux acteurs impliqués.

Fournis uniquement le résumé en français, sans préambule ni conclusion.`;

const DEFAULT_CLAUDE_MEMOIRE_PROMPT = `Tu es un analyste politique expert pour le cabinet Catapulte. Ton rôle est de résumer ce mémoire du Conseil des ministres de manière claire, neutre et professionnelle.

Structure ton résumé en deux parties distinctes :

**RÉSUMÉ EXÉCUTIF (2-3 phrases)**
Explique en quelques phrases simples et directes l'objet principal du mémoire, son contexte et son impact général.

**POINTS CLÉS DÉTAILLÉS (5-10 points)**
Liste les éléments importants du mémoire sous forme de points précis et informatifs.

Format de sortie attendu (HTML simple) :
<div class="resume-executif">
<h4>Résumé exécutif</h4>
<p>2-3 phrases qui expliquent l'essentiel du mémoire de manière accessible.</p>
</div>

<div class="points-cles">
<h4>Points clés</h4>
<ul>
  <li><strong>Titre du point 1:</strong> Explication détaillée...</li>
  <li><strong>Titre du point 2:</strong> Explication détaillée...</li>
</ul>
</div>

Instructions importantes :
- Reste factuel et neutre
- Utilise un langage professionnel but accessible
- Évite le jargon technique excessif
- Concentre-toi sur les impacts concrets et les décisions importantes
- N'inclus PAS de balises HTML autres que celles demandées
- Assure-toi que chaque point apporte une information distincte et utile`;

const DEFAULT_CLAUDE_CATEGORIZATION_PROMPT = `Tu es un système de catégorisation d'articles pour une plateforme de veille médiatique québécoise.

Ta tâche est d'analyser un article et de déterminer à quelle(s) catégorie(s) il appartient en te basant sur une liste de mots-clés pondérés pour chaque catégorie.

Règles strictes :
1. Un article peut avoir PLUSIEURS catégories si plusieurs mots-clés de catégories différentes sont détectés
2. Calcule un score pour chaque catégorie en additionnant les poids des mots-clés détectés
3. Assigne TOUTES les catégories dont le score est >= 3
4. Si aucune catégorie n'atteint le seuil, retourne une liste vide
5. Retourne uniquement du JSON valide, sans commentaire ni explication

Format de réponse attendu :
{
  "categories": ["Catégorie1", "Catégorie2"],
  "detected_keywords": [
    {"word": "mot-clé", "category": "Catégorie1", "weight": 3},
    {"word": "autre-mot", "category": "Catégorie2", "weight": 2}
  ],
  "justification": "Explication brève de pourquoi ces catégories ont été choisies"
}`;

export default function SettingsPage() {
    const [settings, setSettings] = useState({});
    const [settingId, setSettingId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // States for Quebec Deputies
    const [deputes, setDeputes] = useState([]);
    const [filteredDeputes, setFilteredDeputes] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [partyFilter, setPartyFilter] = useState('all');
    const [isLoadingDeputes, setIsLoadingDeputes] = useState(false);

    // States for Federal Deputies (Ottawa)
    const [deputesFederaux, setDeputesFederaux] = useState([]);
    const [filteredDeputesFederaux, setFilteredDeputesFederaux] = useState([]);
    const [searchQueryFederal, setSearchQueryFederal] = useState('');
    const [partyFilterFederal, setPartyFilterFederal] = useState('all');
    const [isLoadingDeputesFederaux, setIsLoadingDeputesFederaux] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const results = await Setting.filter({ name: "default_configuration" });
                if (results.length > 0) {
                    let currentSettings = results[0];
                    
                    // Initialiser le nouveau prompt Ottawa s'il n'existe pas
                    if (!currentSettings.claude_pdq_ottawa_system_prompt) {
                        currentSettings.claude_pdq_ottawa_system_prompt = DEFAULT_CLAUDE_PDQ_OTTAWA_PROMPT;
                        await Setting.update(currentSettings.id, {
                            claude_pdq_ottawa_system_prompt: DEFAULT_CLAUDE_PDQ_OTTAWA_PROMPT
                        });
                        toast({ title: "Configuration mise à jour", description: "Le prompt Ottawa a été ajouté." });
                    }
                    
                    // Update chronique prompt if it's the old version
                    // Check if the current prompt contains an old phrase or if it's not the latest default
                    if (currentSettings.claude_chronique_system_prompt && !currentSettings.claude_chronique_system_prompt.includes("FORMAT STRICT À RESPECTER") && !currentSettings.claude_chronique_system_prompt.includes("RÈGLES ABSOLUES")) {
                         currentSettings.claude_chronique_system_prompt = DEFAULT_CLAUDE_CHRONIQUE_PROMPT;
                         await Setting.update(currentSettings.id, {
                            claude_chronique_system_prompt: DEFAULT_CLAUDE_CHRONIQUE_PROMPT
                         });
                         toast({ title: "Configuration mise à jour", description: "Le prompt Chronique a été mis à jour avec la nouvelle version." });
                    } else if (!currentSettings.claude_chronique_system_prompt) { // If it's completely missing
                         currentSettings.claude_chronique_system_prompt = DEFAULT_CLAUDE_CHRONIQUE_PROMPT;
                         await Setting.update(currentSettings.id, {
                            claude_chronique_system_prompt: DEFAULT_CLAUDE_CHRONIQUE_PROMPT
                         });
                         toast({ title: "Configuration mise à jour", description: "Le prompt Chronique a été initialisé." });
                    }


                    if (currentSettings.newsletter_chronique_bg_color === '#fef9c3' || currentSettings.newsletter_chronique_bg_color === '#8B7355' || !currentSettings.newsletter_chronique_bg_color) {
                        currentSettings.newsletter_chronique_bg_color = '#967150';
                        currentSettings.newsletter_chronique_title_color = '#FFFFFF';
                        currentSettings.newsletter_chronique_text_color = '#FFFFFF';
                        
                        await Setting.update(currentSettings.id, {
                            newsletter_chronique_bg_color: '#967150',
                            newsletter_chronique_title_color: '#FFFFFF',
                            newsletter_chronique_text_color: '#FFFFFF'
                        });
                        
                        toast({ title: "✨ Couleurs de la chronique mises à jour", description: "La nouvelle couleur marron a été appliquée." });
                    }
                    
                    setSettings(currentSettings);
                    setSettingId(currentSettings.id);
                } else {
                    const newSetting = await Setting.create({
                        name: "default_configuration",
                        newsletter_template: DEFAULT_NEWSLETTER_TEMPLATE,
                        newsletter_header_bg_color: "#FFFFFF",
                        newsletter_logo_text: "Catapulte",
                        newsletter_logo_subtitle: "Bureau de communication",
                        newsletter_body_bg_color: "#f5f5f5",
                        newsletter_article_box_bg_color: "#ffffff",
                        newsletter_text_color: "#333333",
                        newsletter_link_color: "#2563eb",
                        newsletter_main_title_color: "#333333",
                        newsletter_main_title_font_size: "32px",
                        newsletter_main_title_font_family: "Inter, sans-serif",
                        newsletter_logo_font_size: "36px",
                        newsletter_section_banner_bg_color: "#8B7B6B",
                        newsletter_section_banner_text_color: "#FFFFFF",
                        newsletter_footer_bg_color: "#f5f5f5",
                        newsletter_footer_text_color: "#666666",
                        newsletter_contact_info_email: "Info@catapultecommunication.com",
                        newsletter_contact_info_phone: "(418) 545-4373",
                        newsletter_logo_url: "",
                        newsletter_font_family: "Inter, sans-serif",
                        newsletter_title_font_family: "Inter, sans-serif",
                        newsletter_container_width: "680px",
                        newsletter_article_spacing: "30px",
                        newsletter_paragraph_spacing: "15px",
                        newsletter_chronique_bg_color: "#967150",
                        newsletter_chronique_title_color: "#FFFFFF",
                        newsletter_chronique_text_color: "#FFFFFF",
                        newsletter_chronique_banner_1_url: "",
                        newsletter_chronique_banner_2_url: "",
                        newsletter_revue_presse_banner_url: "",
                        newsletter_gov_publications_banner_url: "",
                        claude_pdq_system_prompt: DEFAULT_CLAUDE_PDQ_PROMPT,
                        claude_pdq_ottawa_system_prompt: DEFAULT_CLAUDE_PDQ_OTTAWA_PROMPT,
                        claude_chronique_system_prompt: DEFAULT_CLAUDE_CHRONIQUE_PROMPT,
                        claude_article_summary_system_prompt: DEFAULT_CLAUDE_ARTICLE_PROMPT,
                        claude_memoire_system_prompt: DEFAULT_CLAUDE_MEMOIRE_PROMPT,
                        claude_categorization_system_prompt: DEFAULT_CLAUDE_CATEGORIZATION_PROMPT
                    });
                    setSettings(newSetting);
                    setSettingId(newSetting.id);
                    toast({ title: "Configuration initialisée", description: "Une configuration par défaut a été créée pour vous." });
                }
            } catch (error) {
                toast({ title: "Erreur de chargement", description: "Impossible de charger la configuration.", variant: "destructive" });
            }
            setIsLoading(false);
        };
        loadSettings();
    }, [toast]);

    useEffect(() => {
        const loadDeputes = async () => {
            setIsLoadingDeputes(true);
            try {
                const allDeputes = await Depute.list('-nom', 200);
                setDeputes(allDeputes);
                setFilteredDeputes(allDeputes);
            } catch (error) {
                console.error('Erreur chargement députés QC:', error);
                toast({ 
                    title: "Erreur de chargement des députés (Québec)", 
                    description: "Impossible de charger la liste. Veuillez réessayer.", 
                    variant: "destructive" 
                });
            }
            setIsLoadingDeputes(false);
        };
        loadDeputes();
    }, [toast]);

    useEffect(() => {
        let filtered = deputes;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(d => 
                d.nomComplet.toLowerCase().includes(query) ||
                d.circonscription.toLowerCase().includes(query)
            );
        }

        if (partyFilter !== 'all') {
            filtered = filtered.filter(d => d.allegeanceAbrege === partyFilter);
        }

        setFilteredDeputes(filtered);
    }, [searchQuery, partyFilter, deputes]);

    useEffect(() => {
        const loadDeputesFederaux = async () => {
            setIsLoadingDeputesFederaux(true);
            try {
                // Charger en plusieurs fois pour éviter les timeouts
                const allDeputesFederaux = await DeputeFederal.list('-nom', 350);
                setDeputesFederaux(allDeputesFederaux);
                setFilteredDeputesFederaux(allDeputesFederaux);
            } catch (error) {
                console.error('Erreur chargement députés fédéraux:', error);
                
                // Retry avec un limit plus petit si échec
                try {
                    console.log('Retry avec limit réduit...');
                    const reducedList = await DeputeFederal.list('-nom', 200);
                    setDeputesFederaux(reducedList);
                    setFilteredDeputesFederaux(reducedList);
                    toast({ 
                        title: "Chargement partiel", 
                        description: "Seuls les 200 premiers députés fédéraux ont été chargés.", 
                        variant: "default" 
                    });
                } catch (retryError) {
                    console.error('Erreur après retry:', retryError);
                    toast({ 
                        title: "Erreur de chargement des députés fédéraux", 
                        description: "Impossible de charger la liste complète. Veuillez rafraîchir la page.", 
                        variant: "destructive" 
                    });
                }
            }
            setIsLoadingDeputesFederaux(false);
        };
        loadDeputesFederaux();
    }, [toast]);

    useEffect(() => {
        let filtered = deputesFederaux;

        if (searchQueryFederal.trim()) {
            const query = searchQueryFederal.toLowerCase();
            filtered = filtered.filter(d => 
                d.nomComplet.toLowerCase().includes(query) ||
                d.circonscription.toLowerCase().includes(query)
            );
        }

        if (partyFilterFederal !== 'all') {
            filtered = filtered.filter(d => d.allegeanceAbrege === partyFilterFederal);
        }

        setFilteredDeputesFederaux(filtered);
    }, [searchQueryFederal, partyFilterFederal, deputesFederaux]);

    const handleUpdateDepute = async (deputeId, updates) => {
        try {
            await Depute.update(deputeId, updates);
            const allDeputes = await Depute.list('-nom', 200);
            setDeputes(allDeputes);
            toast({ title: "Député mis à jour", description: "Les informations ont été enregistrées." });
        } catch (error) {
            toast({ title: "Erreur de mise à jour", description: error.message, variant: "destructive" });
            throw error;
        }
    };

    const handleUpdateDeputeFederal = async (deputeId, updates) => {
        try {
            await DeputeFederal.update(deputeId, updates);
            // After update, refresh the list, potentially using the retry logic for fetching
            setIsLoadingDeputesFederaux(true);
            try {
                const allDeputesFederaux = await DeputeFederal.list('-nom', 350); 
                setDeputesFederaux(allDeputesFederaux);
                setFilteredDeputesFederaux(allDeputesFederaux);
            } catch (error) {
                console.error('Erreur chargement députés fédéraux après update:', error);
                try {
                    const reducedList = await DeputeFederal.list('-nom', 200);
                    setDeputesFederaux(reducedList);
                    setFilteredDeputesFederaux(reducedList);
                    toast({ 
                        title: "Chargement partiel", 
                        description: "Seuls les 200 premiers députés fédéraux ont été chargés après mise à jour.", 
                        variant: "default" 
                    });
                } catch (retryError) {
                    console.error('Erreur après retry suite à update:', retryError);
                    toast({ 
                        title: "Erreur de chargement des députés fédéraux", 
                        description: "Impossible de recharger la liste des députés fédéraux après mise à jour.", 
                        variant: "destructive" 
                    });
                }
            } finally {
                setIsLoadingDeputesFederaux(false);
            }

            toast({ title: "Député fédéral mis à jour", description: "Les informations ont été enregistrées." });
        } catch (error) {
            toast({ title: "Erreur de mise à jour", description: error.message, variant: "destructive" });
            throw error;
        }
    };

    const handleSave = async () => {
        if (!settingId) {
            toast({ title: "Erreur", description: "ID de configuration manquant.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            await Setting.update(settingId, settings);
            toast({ title: "✅ Configuration sauvegardée", description: "Vos modifications ont été enregistrées." });
        } catch (error) {
            toast({ title: "Erreur de sauvegarde", description: "Impossible de sauvegarder la configuration.", variant: "destructive" });
        }
        setIsSaving(false);
    };

    const handleResetTemplate = async () => {
        if (!settingId) {
            toast({ title: "Erreur", description: "ID de configuration manquant.", variant: "destructive" });
            return;
        }
        if (window.confirm("Êtes-vous sûr de vouloir réinitialiser le template HTML ? Vos modifications personnalisées seront perdues.")) {
            setIsSaving(true);
            try {
                const updatedSettings = { ...settings, newsletter_template: DEFAULT_NEWSLETTER_TEMPLATE };
                await Setting.update(settingId, { newsletter_template: DEFAULT_NEWSLETTER_TEMPLATE });
                setSettings(updatedSettings);
                toast({ title: "✅ Template réinitialisé", description: "Le template a été restauré avec succès." });
            } catch (error) {
                toast({ title: "Erreur de réinitialisation", description: "Impossible de réinitialiser le template.", variant: "destructive" });
            }
            setIsSaving(false);
        }
    };

    const handleResetPrompt = async (promptType) => {
        if (!settingId) {
            toast({ title: "Erreur", description: "ID de configuration manquant.", variant: "destructive" });
            return;
        }

        const promptDefaults = {
            'pdq': { key: 'claude_pdq_system_prompt', value: DEFAULT_CLAUDE_PDQ_PROMPT, label: 'Période de Questions (Québec)' },
            'pdq_ottawa': { key: 'claude_pdq_ottawa_system_prompt', value: DEFAULT_CLAUDE_PDQ_OTTAWA_PROMPT, label: 'Période de Questions (Ottawa)' }, // New entry
            'chronique': { key: 'claude_chronique_system_prompt', value: DEFAULT_CLAUDE_CHRONIQUE_PROMPT, label: 'Chronique' },
            'article': { key: 'claude_article_summary_system_prompt', value: DEFAULT_CLAUDE_ARTICLE_PROMPT, label: 'Article' },
            'memoire': { key: 'claude_memoire_system_prompt', value: DEFAULT_CLAUDE_MEMOIRE_PROMPT, label: 'Mémoire' },
            'categorization': { key: 'claude_categorization_system_prompt', value: DEFAULT_CLAUDE_CATEGORIZATION_PROMPT, label: 'Catégorisation' }
        };

        const promptConfig = promptDefaults[promptType];
        if (!promptConfig) return;

        if (window.confirm(`Êtes-vous sûr de vouloir réinitialiser le prompt ${promptConfig.label} ? Vos modifications personnalisées seront perdues.`)) {
            setIsSaving(true);
            try {
                const updatedSettings = { ...settings, [promptConfig.key]: promptConfig.value };
                await Setting.update(settingId, { [promptConfig.key]: promptConfig.value });
                setSettings(updatedSettings);
                toast({ title: "✅ Prompt réinitialisé", description: `Le prompt ${promptConfig.label} a été restauré avec succès.` });
            } catch (error) {
                toast({ title: "Erreur de réinitialisation", description: `Impossible de réinitialiser le prompt ${promptConfig.label}.`, variant: "destructive" });
            }
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        const { id, value } = e.target;
        setSettings(prev => ({ ...prev, [id]: value }));
    };

    const handleFileChange = async (e, settingKey) => {
        const file = e.target.files[0];
        if (file) {
            try {
                toast({ title: "Téléchargement de l'image...", description: "Veuillez patienter." });
                const { file_url } = await UploadFile({ file: file });
                setSettings(prev => ({ ...prev, [settingKey]: file_url }));
                toast({ title: "Image téléchargée", description: "L'image a été mise à jour." });
            } catch (error) {
                toast({ title: "Erreur de téléchargement", description: "Impossible de télécharger l'image.", variant: "destructive" });
            }
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
                    <LayoutDashboard className="w-8 h-8 text-blue-600" />
                    Paramètres de l'application
                </h1>
                <p className="text-gray-600">Gérez la configuration de votre plateforme Firewatch</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
                    <TabsTrigger value="profile" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span className="hidden sm:inline">Profil</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        <span className="hidden sm:inline">Intelligence AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="newsletter" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span className="hidden sm:inline">Bulletin</span>
                    </TabsTrigger>
                    <TabsTrigger value="deputes" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="hidden sm:inline">Députés QC</span>
                    </TabsTrigger>
                    <TabsTrigger value="deputes-ottawa" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="hidden sm:inline">Députés Ottawa</span>
                    </TabsTrigger>
                </TabsList>

                {/* ONGLET PROFIL */}
                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="w-5 h-5 text-green-600" />
                                Profil Utilisateur
                            </CardTitle>
                            <CardDescription>
                                Gérez vos informations personnelles et paramètres de compte.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="w-5 h-5 text-blue-600" />
                                            <h3 className="font-semibold text-blue-900">Informations de compte</h3>
                                        </div>
                                        <p className="text-sm text-blue-700 mb-3">
                                            La gestion des utilisateurs est assurée par la plateforme Base44. Pour modifier vos informations personnelles, utilisez les options ci-dessous.
                                        </p>
                                        <div className="space-y-3">
                                            <div className="bg-white p-3 rounded border">
                                                <div className="text-sm font-medium text-gray-700">Email de connexion</div>
                                                <div className="text-gray-600">Géré automatiquement par votre compte Google</div>
                                            </div>
                                            <div className="bg-white p-3 rounded border">
                                                <div className="text-sm font-medium text-gray-700">Nom d'affichage</div>
                                                <div className="text-gray-600">Synchronisé avec votre profil Google</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                        <h3 className="font-semibold text-amber-900 mb-2">📧 Configuration Email</h3>
                                        <p className="text-sm text-amber-700 mb-3">
                                            Pour recevoir les bulletins et notifications, assurez-vous que votre adresse email est correctement configurée dans Mailchimp.
                                        </p>
                                        <div className="bg-white p-3 rounded border">
                                            <div className="text-sm font-medium text-gray-700">Email de contact</div>
                                            <div className="text-gray-600">{settings.newsletter_contact_info_email || 'Non configuré'}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Modifiable dans l'onglet "Bulletin"
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ONGLET INTELLIGENCE ARTIFICIELLE */}
                <TabsContent value="ai" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Code className="w-5 h-5 text-purple-600" />
                                Prompts Claude AI
                            </CardTitle>
                            <CardDescription>
                                Configurez les instructions système (system prompts) pour chaque type d'analyse Claude AI. 
                                Ces prompts déterminent le comportement et le format des réponses de Claude.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <>
                                    {/* Prompt Période de Questions Québec */}
                                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Label htmlFor="claude_pdq_system_prompt" className="text-base font-semibold">
                                                    📋 Période de Questions (Québec)
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Utilisé pour résumer les transcriptions de la période de questions de l'Assemblée nationale du Québec.
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleResetPrompt('pdq')}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                Réinitialiser
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="claude_pdq_system_prompt"
                                            value={settings.claude_pdq_system_prompt || DEFAULT_CLAUDE_PDQ_PROMPT}
                                            onChange={handleChange}
                                            rows={12}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Entrez le system prompt pour la période de questions (Québec)..."
                                        />
                                    </div>

                                    {/* Prompt Période de Questions Ottawa */}
                                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Label htmlFor="claude_pdq_ottawa_system_prompt" className="text-base font-semibold">
                                                    🏛️ Période de Questions (Ottawa)
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Utilisé pour résumer les transcriptions de la période de questions de la Chambre des communes du Canada.
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleResetPrompt('pdq_ottawa')}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                Réinitialiser
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="claude_pdq_ottawa_system_prompt"
                                            value={settings.claude_pdq_ottawa_system_prompt || DEFAULT_CLAUDE_PDQ_OTTAWA_PROMPT}
                                            onChange={handleChange}
                                            rows={12}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Entrez le system prompt pour la période de questions (Ottawa)..."
                                        />
                                    </div>

                                    {/* Prompt Chronique */}
                                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Label htmlFor="claude_chronique_system_prompt" className="text-base font-semibold">
                                                    🎙️ Chronique Politique
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Utilisé pour résumer les chroniques politiques (ex: Jonathan Trudeau).
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleResetPrompt('chronique')}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                Réinitialiser
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="claude_chronique_system_prompt"
                                            value={settings.claude_chronique_system_prompt || DEFAULT_CLAUDE_CHRONIQUE_PROMPT}
                                            onChange={handleChange}
                                            rows={10}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Entrez le system prompt pour la chronique..."
                                        />
                                    </div>

                                    {/* Prompt Résumé d'Articles */}
                                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Label htmlFor="claude_article_summary_system_prompt" className="text-base font-semibold">
                                                    📰 Résumé d'Articles
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Utilisé pour générer des résumés automatiques des articles de presse.
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleResetPrompt('article')}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                Réinitialiser
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="claude_article_summary_system_prompt"
                                            value={settings.claude_article_summary_system_prompt || DEFAULT_CLAUDE_ARTICLE_PROMPT}
                                            onChange={handleChange}
                                            rows={8}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Entrez le system prompt pour les résumés d'articles..."
                                        />
                                    </div>

                                    {/* Prompt Mémoires PDF */}
                                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Label htmlFor="claude_memoire_system_prompt" className="text-base font-semibold">
                                                    📄 Mémoires PDF
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Utilisé pour résumer les mémoires du Conseil des ministres (PDF).
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleResetPrompt('memoire')}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                Réinitialiser
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="claude_memoire_system_prompt"
                                            value={settings.claude_memoire_system_prompt || DEFAULT_CLAUDE_MEMOIRE_PROMPT}
                                            onChange={handleChange}
                                            rows={15}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Entrez le system prompt pour les mémoires PDF..."
                                        />
                                    </div>

                                    {/* Prompt Catégorisation */}
                                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Label htmlFor="claude_categorization_system_prompt" className="text-base font-semibold">
                                                    🏷️ Catégorisation
                                                </Label>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Utilisé pour catégoriser automatiquement les articles selon les mots-clés.
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleResetPrompt('categorization')}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                Réinitialiser
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="claude_categorization_system_prompt"
                                            value={settings.claude_categorization_system_prompt || DEFAULT_CLAUDE_CATEGORIZATION_PROMPT}
                                            onChange={handleChange}
                                            rows={15}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Entrez le system prompt pour la catégorisation..."
                                        />
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <Button onClick={handleSave} disabled={isSaving} size="lg">
                                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder tous les prompts
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ONGLET BULLETIN */}
                <TabsContent value="newsletter" className="space-y-6">
                    {/* Personnalisation visuelle */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-pink-600" />
                                Personnalisation visuelle
                            </CardTitle>
                            <CardDescription>
                                Configurez l'apparence de vos bulletins (couleurs, polices, espacement).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Mise en page */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg border-b pb-2">Mise en page</h3>
                                        <div>
                                            <Label htmlFor="newsletter_container_width">Largeur du bulletin</Label>
                                            <Select value={settings.newsletter_container_width || "680px"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_container_width: value }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="600px">Compact (600px)</SelectItem>
                                                    <SelectItem value="680px">Standard (680px)</SelectItem>
                                                    <SelectItem value="720px">Large (720px)</SelectItem>
                                                    <SelectItem value="800px">Très large (800px)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="newsletter_font_family">Police principale</Label>
                                            <Select value={settings.newsletter_font_family || "Inter, sans-serif"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_font_family: value }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Inter, sans-serif">Inter (moderne)</SelectItem>
                                                    <SelectItem value="Arial, sans-serif">Arial (classique)</SelectItem>
                                                    <SelectItem value="Helvetica, Arial, sans-serif">Helvetica</SelectItem>
                                                    <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Couleurs */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg border-b pb-2">Couleurs</h3>
                                        <div>
                                            <Label htmlFor="newsletter_body_bg_color">Fond du corps</Label>
                                            <Input id="newsletter_body_bg_color" type="color" value={settings.newsletter_body_bg_color || "#f5f5f5"} onChange={handleChange} className="w-full h-10 p-1" />
                                        </div>
                                        <div>
                                            <Label htmlFor="newsletter_text_color">Texte général</Label>
                                            <Input id="newsletter_text_color" type="color" value={settings.newsletter_text_color || "#333333"} onChange={handleChange} className="w-full h-10 p-1" />
                                        </div>
                                        <div>
                                            <Label htmlFor="newsletter_link_color">Liens</Label>
                                            <Input id="newsletter_link_color" type="color" value={settings.newsletter_link_color || "#2563eb"} onChange={handleChange} className="w-full h-10 p-1" />
                                        </div>
                                    </div>

                                    {/* En-tête */}
                                    <div className="space-y-4 md:col-span-2">
                                        <h3 className="font-semibold text-lg border-b pb-2">En-tête & Logo</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label htmlFor="newsletter_logo_text">Texte du logo</Label>
                                                <Input id="newsletter_logo_text" value={settings.newsletter_logo_text || "Catapulte"} onChange={handleChange} />
                                            </div>
                                            <div>
                                                <Label htmlFor="newsletter_logo_subtitle">Sous-titre</Label>
                                                <Input id="newsletter_logo_subtitle" value={settings.newsletter_logo_subtitle || "Bureau de communication"} onChange={handleChange} />
                                            </div>
                                            <div>
                                                <Label htmlFor="newsletter_logo_url">Logo (Image)</Label>
                                                <Input id="newsletter_logo_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_logo_url')} className="p-2" />
                                                {settings.newsletter_logo_url && (
                                                    <img src={settings.newsletter_logo_url} alt="Logo" className="mt-2 max-h-16 object-contain" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pied de page */}
                                    <div className="space-y-4 md:col-span-2">
                                        <h3 className="font-semibold text-lg border-b pb-2">Pied de page</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="newsletter_contact_info_email">Email de contact</Label>
                                                <Input id="newsletter_contact_info_email" type="email" value={settings.newsletter_contact_info_email || ""} onChange={handleChange} />
                                            </div>
                                            <div>
                                                <Label htmlFor="newsletter_contact_info_phone">Téléphone</Label>
                                                <Input id="newsletter_contact_info_phone" type="tel" value={settings.newsletter_contact_info_phone || ""} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder la personnalisation
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Chronique */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PenSquare className="w-5 h-5 text-amber-600" />
                                Chronique politique
                            </CardTitle>
                            <CardDescription>Configurez l'apparence de la section chronique.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h3 className="font-semibold border-b pb-2">Couleurs</h3>
                                        <div>
                                            <Label htmlFor="newsletter_chronique_bg_color">Fond de la boîte</Label>
                                            <Input id="newsletter_chronique_bg_color" type="color" value={settings.newsletter_chronique_bg_color || "#967150"} onChange={handleChange} className="w-full h-10 p-1" />
                                        </div>
                                        <div>
                                            <Label htmlFor="newsletter_chronique_title_color">Couleur du titre</Label>
                                            <Input id="newsletter_chronique_title_color" type="color" value={settings.newsletter_chronique_title_color || "#FFFFFF"} onChange={handleChange} className="w-full h-10 p-1" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-semibold border-b pb-2">Bannières (optionnel)</h3>
                                        <div>
                                            <Label htmlFor="newsletter_chronique_banner_1_url">Bannière avant</Label>
                                            <Input id="newsletter_chronique_banner_1_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_chronique_banner_1_url')} className="p-2" />
                                            {settings.newsletter_chronique_banner_1_url && (
                                                <img src={settings.newsletter_chronique_banner_1_url} alt="Bannière 1" className="mt-2 max-h-16 object-contain" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Template HTML */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Code className="w-5 h-5 text-red-600" />
                                        Template HTML (Avancé)
                                    </CardTitle>
                                    <CardDescription className="mt-2">
                                        Modifiez le code HTML pour une personnalisation avancée.
                                        <span className="text-red-500 font-medium block mt-1">⚠️ Attention : erreurs = affichage cassé</span>
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleResetTemplate} disabled={isSaving || isLoading}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Réinitialiser
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <Textarea
                                    id="newsletter_template"
                                    value={settings.newsletter_template || DEFAULT_NEWSLETTER_TEMPLATE}
                                    onChange={(e) => setSettings(prev => ({ ...prev, newsletter_template: e.target.value }))}
                                    rows={20}
                                    className="font-mono text-xs"
                                    placeholder="Code HTML du template..."
                                />
                            )}
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder le template
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ONGLET DÉPUTÉS (Québec) */}
                <TabsContent value="deputes" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-600" />
                                Gestion des Députés (Québec)
                            </CardTitle>
                            <CardDescription>
                                Ajoutez des photos aux députés pour les afficher automatiquement dans les résumés de période de questions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoadingDeputes ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <>
                                    {/* Statistiques */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-slate-900">{deputes.length}</div>
                                            <div className="text-sm text-slate-600">Députés</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {deputes.filter(d => d.photoUrl).length}
                                            </div>
                                            <div className="text-sm text-slate-600">Avec photo</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-orange-600">
                                                {deputes.filter(d => !d.photoUrl).length}
                                            </div>
                                            <div className="text-sm text-slate-600">Sans photo</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-slate-600">
                                                {deputes.length > 0 ? Math.round((deputes.filter(d => d.photoUrl).length / deputes.length) * 100) : 0}%
                                            </div>
                                            <div className="text-sm text-slate-600">Complétude</div>
                                        </div>
                                    </div>

                                    {/* Recherche et filtres */}
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                placeholder="Rechercher par nom ou circonscription..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                        <Select value={partyFilter} onValueChange={setPartyFilter}>
                                            <SelectTrigger className="w-full md:w-48">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les partis ({deputes.length})</SelectItem>
                                                <SelectItem value="CAQ">CAQ ({deputes.filter(d => d.allegeanceAbrege === 'CAQ').length})</SelectItem>
                                                <SelectItem value="PLQ">PLQ ({deputes.filter(d => d.allegeanceAbrege === 'PLQ').length})</SelectItem>
                                                <SelectItem value="QS">QS ({deputes.filter(d => d.allegeanceAbrege === 'QS').length})</SelectItem>
                                                <SelectItem value="PQ">PQ ({deputes.filter(d => d.allegeanceAbrege === 'PQ').length})</SelectItem>
                                                <SelectItem value="IND">Indépendants ({deputes.filter(d => d.allegeanceAbrege === 'IND').length})</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Liste des députés */}
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                        {filteredDeputes.length === 0 ? (
                                            <div className="text-center py-12 text-gray-500">
                                                Aucun député trouvé pour "{searchQuery}" ou filtre "{partyFilter}"
                                            </div>
                                        ) : (
                                            filteredDeputes.map(depute => (
                                                <DeputeCard
                                                    key={depute.id}
                                                    depute={depute}
                                                    onUpdate={handleUpdateDepute}
                                                />
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* NOUVEL ONGLET DÉPUTÉS FÉDÉRAUX (Ottawa) */}
                <TabsContent value="deputes-ottawa" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-red-600" />
                                Gestion des Députés Fédéraux (Ottawa)
                            </CardTitle>
                            <CardDescription>
                                Ajoutez des photos aux députés fédéraux pour les afficher automatiquement dans les résumés de période de questions d'Ottawa.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoadingDeputesFederaux ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <>
                                    {/* Statistiques */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-slate-900">{deputesFederaux.length}</div>
                                            <div className="text-sm text-slate-600">Députés fédéraux</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {deputesFederaux.filter(d => d.photoUrl).length}
                                            </div>
                                            <div className="text-sm text-slate-600">Avec photo</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-orange-600">
                                                {deputesFederaux.filter(d => !d.photoUrl).length}
                                            </div>
                                            <div className="text-sm text-slate-600">Sans photo</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-slate-600">
                                                {deputesFederaux.length > 0 ? Math.round((deputesFederaux.filter(d => d.photoUrl).length / deputesFederaux.length) * 100) : 0}%
                                            </div>
                                            <div className="text-sm text-slate-600">Complétude</div>
                                        </div>
                                    </div>

                                    {/* Recherche et filtres */}
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                placeholder="Rechercher par nom ou circonscription..."
                                                value={searchQueryFederal}
                                                onChange={(e) => setSearchQueryFederal(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                        <Select value={partyFilterFederal} onValueChange={setPartyFilterFederal}>
                                            <SelectTrigger className="w-full md:w-48">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les partis ({deputesFederaux.length})</SelectItem>
                                                <SelectItem value="PLC">PLC ({deputesFederaux.filter(d => d.allegeanceAbrege === 'PLC').length})</SelectItem>
                                                <SelectItem value="PCC">PCC ({deputesFederaux.filter(d => d.allegeanceAbrege === 'PCC').length})</SelectItem>
                                                <SelectItem value="BQ">BQ ({deputesFederaux.filter(d => d.allegeanceAbrege === 'BQ').length})</SelectItem>
                                                <SelectItem value="NPD">NPD ({deputesFederaux.filter(d => d.allegeanceAbrege === 'NPD').length})</SelectItem>
                                                <SelectItem value="PV">PV ({deputesFederaux.filter(d => d.allegeanceAbrege === 'PV').length})</SelectItem>
                                                <SelectItem value="IND">Indépendants ({deputesFederaux.filter(d => d.allegeanceAbrege === 'IND').length})</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Liste des députés */}
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                        {filteredDeputesFederaux.length === 0 ? (
                                            <div className="text-center py-12 text-gray-500">
                                                Aucun député fédéral trouvé pour "{searchQueryFederal}" ou filtre "{partyFilterFederal}"
                                            </div>
                                        ) : (
                                            filteredDeputesFederaux.map(depute => (
                                                <DeputeCard
                                                    key={depute.id}
                                                    depute={depute}
                                                    onUpdate={handleUpdateDeputeFederal}
                                                />
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            
            <Toaster />
        </div>
    );
}
