import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Sources from "./Sources";

import Categories from "./Categories";

import AssembleeNationale from "./AssembleeNationale";

import Keywords from "./Keywords";

import Archives from "./Archives";

import CategoriesKeywords from "./CategoriesKeywords";

import Newsletter from "./Newsletter";

import Settings from "./Settings";

import Retranscription from "./Retranscription";

import AddArticle from "./AddArticle";

import SendPdQ from "./SendPdQ";

import UploadDeputePhotos from "./UploadDeputePhotos";

import StabilityTests from "./StabilityTests";

import TeamsChannels from "./TeamsChannels";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Sources: Sources,
    
    Categories: Categories,
    
    AssembleeNationale: AssembleeNationale,
    
    Keywords: Keywords,
    
    Archives: Archives,
    
    CategoriesKeywords: CategoriesKeywords,
    
    Newsletter: Newsletter,
    
    Settings: Settings,
    
    Retranscription: Retranscription,
    
    AddArticle: AddArticle,
    
    SendPdQ: SendPdQ,
    
    UploadDeputePhotos: UploadDeputePhotos,
    
    StabilityTests: StabilityTests,
    
    TeamsChannels: TeamsChannels,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Sources" element={<Sources />} />
                
                <Route path="/Categories" element={<Categories />} />
                
                <Route path="/AssembleeNationale" element={<AssembleeNationale />} />
                
                <Route path="/Keywords" element={<Keywords />} />
                
                <Route path="/Archives" element={<Archives />} />
                
                <Route path="/CategoriesKeywords" element={<CategoriesKeywords />} />
                
                <Route path="/Newsletter" element={<Newsletter />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/Retranscription" element={<Retranscription />} />
                
                <Route path="/AddArticle" element={<AddArticle />} />
                
                <Route path="/SendPdQ" element={<SendPdQ />} />
                
                <Route path="/UploadDeputePhotos" element={<UploadDeputePhotos />} />
                
                <Route path="/StabilityTests" element={<StabilityTests />} />
                
                <Route path="/TeamsChannels" element={<TeamsChannels />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}