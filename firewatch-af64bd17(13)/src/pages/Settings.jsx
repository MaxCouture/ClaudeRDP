
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
import { Save, Loader2, Code, Palette, LayoutDashboard, Mail, RefreshCw, PenSquare, User, Shield } from "lucide-react";
import { UploadFile } from "@/api/integrations";

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

export default function SettingsPage() {
    const [settings, setSettings] = useState({});
    const [settingId, setSettingId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const results = await Setting.filter({ name: "default_configuration" });
                if (results.length > 0) {
                    let currentSettings = results[0];
                    
                    // FORCE la mise à jour de la couleur chronique si elle est encore à l'ancienne valeur
                    if (currentSettings.newsletter_chronique_bg_color === '#fef9c3' || currentSettings.newsletter_chronique_bg_color === '#8B7355' || !currentSettings.newsletter_chronique_bg_color) {
                        currentSettings.newsletter_chronique_bg_color = '#967150';
                        currentSettings.newsletter_chronique_title_color = '#FFFFFF';
                        currentSettings.newsletter_chronique_text_color = '#FFFFFF';
                        
                        // Mettre à jour en base de données
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
                    // Si aucune configuration n'existe, on en crée une par défaut
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
                        // Ajout des nouvelles propriétés pour la chronique
                        newsletter_chronique_bg_color: "#967150", // Updated color
                        newsletter_chronique_title_color: "#FFFFFF", // Updated default
                        newsletter_chronique_text_color: "#FFFFFF", // Updated default
                        newsletter_chronique_banner_1_url: "",
                        newsletter_chronique_banner_2_url: "",
                        // Ajout des nouvelles propriétés pour les bandeaux de section
                        newsletter_revue_presse_banner_url: "",
                        newsletter_gov_publications_banner_url: ""
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
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                Paramètres de l'application
            </h1>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-green-600" /> Profil Utilisateur</CardTitle>
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
                                        Modifiable dans la section "Personnalisation du bulletin"
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" /> Personnalisation du bulletin (Mobile optimisé)</CardTitle>
                    <CardDescription>
                        Configurez l'apparence de vos bulletins avec un rendu optimisé pour mobile.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Mise en page & Espacement</h3>
                                <div>
                                    <Label htmlFor="newsletter_container_width">Largeur du bulletin</Label>
                                    <Select value={settings.newsletter_container_width || "680px"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_container_width: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
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
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Inter, sans-serif">Inter (moderne)</SelectItem>
                                            <SelectItem value="Arial, sans-serif">Arial (classique)</SelectItem>
                                            <SelectItem value="Helvetica, Arial, sans-serif">Helvetica (moderne)</SelectItem>
                                            <SelectItem value="Verdana, sans-serif">Verdana (lisible)</SelectItem>
                                            <SelectItem value="Trebuchet MS, sans-serif">Trebuchet (élégant)</SelectItem>
                                            <SelectItem value="Tahoma, sans-serif">Tahoma (compact)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_title_font_family">Police des titres</Label>
                                    <Select value={settings.newsletter_title_font_family || "Inter, sans-serif"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_title_font_family: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Inter, sans-serif">Inter (moderne)</SelectItem>
                                            <SelectItem value="Georgia, serif">Georgia (classique)</SelectItem>
                                            <SelectItem value="Times New Roman, serif">Times (traditionnel)</SelectItem>
                                            <SelectItem value="Arial, sans-serif">Arial (moderne)</SelectItem>
                                            <SelectItem value="Helvetica, Arial, sans-serif">Helvetica (épuré)</SelectItem>
                                            <SelectItem value="Trebuchet MS, sans-serif">Trebuchet (dynamique)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_article_spacing">Espacement entre articles</Label>
                                    <Select value={settings.newsletter_article_spacing || "30px"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_article_spacing: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="20px">Compact (20px)</SelectItem>
                                            <SelectItem value="30px">Normal (30px)</SelectItem>
                                            <SelectItem value="40px">Aéré (40px)</SelectItem>
                                            <SelectItem value="50px">Très aéré (50px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_paragraph_spacing">Espacement des paragraphes</Label>
                                    <Select value={settings.newsletter_paragraph_spacing || "15px"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_paragraph_spacing: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10px">Compact (10px)</SelectItem>
                                            <SelectItem value="15px">Normal (15px)</SelectItem>
                                            <SelectItem value="20px">Aéré (20px)</SelectItem>
                                            <SelectItem value="25px">Très aéré (25px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Couleurs</h3>
                                <div>
                                    <Label htmlFor="newsletter_body_bg_color">Couleur de fond du corps</Label>
                                    <Input id="newsletter_body_bg_color" type="color" value={settings.newsletter_body_bg_color || "#f5f5f5"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_article_box_bg_color">Couleur de fond des boîtes d'articles</Label>
                                    <Input id="newsletter_article_box_bg_color" type="color" value={settings.newsletter_article_box_bg_color || "#ffffff"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_text_color">Couleur du texte général</Label>
                                    <Input id="newsletter_text_color" type="color" value={settings.newsletter_text_color || "#333333"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_link_color">Couleur des liens</Label>
                                    <Input id="newsletter_link_color" type="color" value={settings.newsletter_link_color || "#2563eb"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_main_title_color">Couleur du titre principal</Label>
                                    <Input id="newsletter_main_title_color" type="color" value={settings.newsletter_main_title_color || "#333333"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Titre Principal</h3>
                                <div>
                                    <Label htmlFor="newsletter_main_title_font_size">Taille du titre principal</Label>
                                    <Select value={settings.newsletter_main_title_font_size || "32px"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_main_title_font_size: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="24px">Petit (24px)</SelectItem>
                                            <SelectItem value="28px">Moyen (28px)</SelectItem>
                                            <SelectItem value="32px">Grand (32px)</SelectItem>
                                            <SelectItem value="36px">Très grand (36px)</SelectItem>
                                            <SelectItem value="40px">Extra grand (40px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_main_title_font_family">Police du titre principal</Label>
                                    <Select value={settings.newsletter_main_title_font_family || "Inter, sans-serif"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_main_title_font_family: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Inter, sans-serif">Inter (moderne)</SelectItem>
                                            <SelectItem value="Georgia, serif">Georgia (classique)</SelectItem>
                                            <SelectItem value="Times New Roman, serif">Times (traditionnel)</SelectItem>
                                            <SelectItem value="Arial, sans-serif">Arial (moderne)</SelectItem>
                                            <SelectItem value="Helvetica, Arial, sans-serif">Helvetica (épuré)</SelectItem>
                                            <SelectItem value="Trebuchet MS, sans-serif">Trebuchet (dynamique)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">En-tête & Logo</h3>
                                <div>
                                    <Label htmlFor="newsletter_header_bg_color">Couleur de fond de l'en-tête</Label>
                                    <Input id="newsletter_header_bg_color" type="color" value={settings.newsletter_header_bg_color || "#FFFFFF"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_logo_text">Texte du logo</Label>
                                    <Input id="newsletter_logo_text" value={settings.newsletter_logo_text || "Catapulte"} onChange={handleChange} />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_logo_subtitle">Sous-titre du logo</Label>
                                    <Input id="newsletter_logo_subtitle" value={settings.newsletter_logo_subtitle || "Bureau de communication"} onChange={handleChange} />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_logo_font_size">Taille du logo</Label>
                                    <Select value={settings.newsletter_logo_font_size || "36px"} onValueChange={(value) => setSettings(prev => ({ ...prev, newsletter_logo_font_size: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="32px">Moyen (32px)</SelectItem>
                                            <SelectItem value="36px">Grand (36px)</SelectItem>
                                            <SelectItem value="40px">Très grand (40px)</SelectItem>
                                            <SelectItem value="44px">Extra grand (44px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_logo_url">Logo (Image URL)</Label>
                                    <Input id="newsletter_logo_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_logo_url')} className="p-2" />
                                    {settings.newsletter_logo_url && (
                                        <img src={settings.newsletter_logo_url} alt="Logo Preview" className="mt-2 max-h-24 object-contain" />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Bannières de Section</h3>
                                <p className="text-sm text-gray-500">Ces couleurs s'appliqueront aux titres de section comme "Chronique politique" ou "Éducation" si vous les ajoutez au template.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="newsletter_section_banner_bg_color">Couleur de fond de la bannière</Label>
                                        <Input id="newsletter_section_banner_bg_color" type="color" value={settings.newsletter_section_banner_bg_color || "#8B7B6B"} onChange={handleChange} className="w-full h-10 p-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="newsletter_section_banner_text_color">Couleur du texte de la bannière</Label>
                                        <Input id="newsletter_section_banner_text_color" type="color" value={settings.newsletter_section_banner_text_color || "#FFFFFF"} onChange={handleChange} className="w-full h-10 p-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 md:col-span-2">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Pied de Page</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="newsletter_footer_bg_color">Couleur de fond du pied de page</Label>
                                        <Input id="newsletter_footer_bg_color" type="color" value={settings.newsletter_footer_bg_color || "#f5f5f5"} onChange={handleChange} className="w-full h-10 p-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="newsletter_footer_text_color">Couleur du texte du pied de page</Label>
                                        <Input id="newsletter_footer_text_color" type="color" value={settings.newsletter_footer_text_color || "#666666"} onChange={handleChange} className="w-full h-10 p-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="newsletter_contact_info_email">Email de contact</Label>
                                        <Input id="newsletter_contact_info_email" type="email" value={settings.newsletter_contact_info_email || "Info@catapultecommunication.com"} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <Label htmlFor="newsletter_contact_info_phone">Téléphone de contact</Label>
                                        <Input id="newsletter_contact_info_phone" type="tel" value={settings.newsletter_contact_info_phone || "(418) 545-4373"} onChange={handleChange} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Sauvegarder la personnalisation
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PenSquare className="w-5 h-5 text-amber-600" /> Personnalisation de la Chronique</CardTitle>
                    <CardDescription>
                        Configurez l'apparence de la section "Résumé de la chronique".
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Couleurs</h3>
                                <div>
                                    <Label htmlFor="newsletter_chronique_bg_color">Couleur de fond de la boîte</Label>
                                    <Input id="newsletter_chronique_bg_color" type="color" value={settings.newsletter_chronique_bg_color || "#967150"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_chronique_title_color">Couleur du titre</Label>
                                    <Input id="newsletter_chronique_title_color" type="color" value={settings.newsletter_chronique_title_color || "#FFFFFF"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_chronique_text_color">Couleur du texte du résumé</Label>
                                    <Input id="newsletter_chronique_text_color" type="color" value={settings.newsletter_chronique_text_color || "#FFFFFF"} onChange={handleChange} className="w-full h-10 p-1" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Bannières (Optionnel)</h3>
                                <div>
                                    <Label htmlFor="newsletter_chronique_banner_1_url">Bannière (avant la chronique)</Label>
                                    <Input id="newsletter_chronique_banner_1_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_chronique_banner_1_url')} className="p-2" />
                                    {settings.newsletter_chronique_banner_1_url && (
                                        <img src={settings.newsletter_chronique_banner_1_url} alt="Bannière 1" className="mt-2 max-h-24 object-contain" />
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="newsletter_chronique_banner_2_url">Bannière (après la chronique)</Label>
                                    <Input id="newsletter_chronique_banner_2_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_chronique_banner_2_url')} className="p-2" />
                                    {settings.newsletter_chronique_banner_2_url && (
                                        <img src={settings.newsletter_chronique_banner_2_url} alt="Bannière 2" className="mt-2 max-h-24 object-contain" />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Sauvegarder la personnalisation
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-blue-600" /> Bandeaux de Section</CardTitle>
                    <CardDescription>
                        Configurez les bandeaux PNG pour "Revue de presse" et "Publications gouvernementales".
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Revue de presse</h3>
                                <div>
                                    <Label htmlFor="newsletter_revue_presse_banner_url">Bannière "Revue de presse"</Label>
                                    <Input id="newsletter_revue_presse_banner_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_revue_presse_banner_url')} className="p-2" />
                                    {settings.newsletter_revue_presse_banner_url && (
                                        <img src={settings.newsletter_revue_presse_banner_url} alt="Bannière Revue de presse" className="mt-2 max-h-24 object-contain" />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Publications gouvernementales</h3>
                                <div>
                                    <Label htmlFor="newsletter_gov_publications_banner_url">Bannière "Publications gouvernementales"</Label>
                                    <Input id="newsletter_gov_publications_banner_url" type="file" onChange={(e) => handleFileChange(e, 'newsletter_gov_publications_banner_url')} className="p-2" />
                                    {settings.newsletter_gov_publications_banner_url && (
                                        <img src={settings.newsletter_gov_publications_banner_url} alt="Bannière Publications gouvernementales" className="mt-2 max-h-24 object-contain" />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Sauvegarder les bandeaux
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> Template HTML avancé</CardTitle>
                            <CardDescription className="mt-2">
                                Modifiez le code HTML pour personnaliser la structure.
                                <span className="text-red-500 font-medium block mt-1">Attention : Des modifications incorrectes peuvent casser l'affichage.</span>
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleResetTemplate} disabled={isSaving || isLoading}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Réinitialiser le template
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
                            value={settings.newsletter_template || DEFAULT_NEWSLETTER_TEMPLATE}
                            onChange={(e) => setSettings(prev => ({ ...prev, newsletter_template: e.target.value }))}
                            rows={25}
                            className="font-mono text-sm"
                            placeholder="Entrez votre code HTML ici..."
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Variables disponibles pour le template</CardTitle>
                    <CardDescription>
                        Utilisez ces balises dans votre template HTML. Elles seront remplacées par les données réelles lors de l'envoi.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Code className="w-4 h-4" />
                        <strong className="font-mono">{'{{subject}}'}</strong>
                        <span>- Le sujet complet du bulletin.</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Code className="w-4 h-4" />
                        <strong className="font-mono">{'{{{header_html}}}'}</strong>
                        <span>- Contenu HTML de l'en-tête (logo/titre).</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Code className="w-4 h-4" />
                        <strong className="font-mono">{'{{{chronique_summary_html}}}'}</strong>
                        <span>- Résumé de la chronique (si présent).</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Code className="w-4 h-4" />
                        <strong className="font-mono">{'{{{introduction_html}}}'}</strong>
                        <span>- Le texte d'introduction que vous rédigez (permet le HTML).</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Code className="w-4 h-4" />
                        <strong className="font-mono">{'{{{articles_html}}}'}</strong>
                        <span>- La liste complète des articles formatés.</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Code className="w-4 h-4" />
                        <strong className="font-mono">{'{{current_date}}'}</strong>
                        <span>- La date actuelle du bulletin (ex: 19/06/25).</span>
                    </div>
                    <div className="mt-4 font-bold">Variables de personnalisation disponibles directement dans le template :</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                        {Object.keys(settings).filter(key => key.startsWith('newsletter_')).map(key => (
                            <div key={key} className="flex items-center gap-2 p-1 bg-blue-50 rounded">
                                <Code className="w-3 h-3" />
                                <span className="font-mono text-xs">{`{{${key}}}`}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <Toaster />
        </div>
    );
}
