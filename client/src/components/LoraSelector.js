import React, { useState } from 'react';
import './LoraSelector.css';

const fluxLoras = [
    { id: 'reedy-art-style', name: 'Dark Energetic Anime', defaultWeight: 1.0 },
    { id: 'dreadmirth-style-art', name: 'Vibrant Energetic Anime', defaultWeight: 1.0 },
    { id: 'Vintage_Pulp_-_FLUX', name: 'Vintage Pulp', defaultWeight: 1.0 },
    { id: 'Anime_detail_eye', name: 'Anime Detail Eye', defaultWeight: 1.0 },
    { id: 'GLSHS', name: 'castlevaniashowstle', defaultWeight: 1.0 },
    { id: 'FaeTasticDetails', name: 'FaeTastic Details', defaultWeight: 1.0 },
    { id: 'Storybook-v2', name: 'Storybook Art Style', defaultWeight: 1.0 },
    { id: 'Arcaneintrostyle', name: 'Arcane Intro Style', defaultWeight: 1.0 },
    { id: 'FantasyWizardWitches', name: 'Fantasy Wizard Witches', defaultWeight: 1.0 },
    { id: 'Luminous_Shadowscape', name: 'Luminous Shadowscape', defaultWeight: 1.0 },
    { id: 'MJanime_Flux_LoRa', name: 'MJ Anime', defaultWeight: 1.0 },
    { id: 'FLUX-daubrez-DB4RZ-v2', name: 'Animelike Digital Painting', defaultWeight: 1.0 },
    { id: 'FluxMythAn1meL1nes', name: 'Anime Lines', defaultWeight: 1.0 },
    { id: 'CinematicStyleFlux_v1', name: 'Cinematic Style', defaultWeight: 1.0 },
    { id: 'Cyber_Graphic', name: 'Cyber Graphic', defaultWeight: 1.0 },
    { id: 'sxz-Dark-Fantasy-v2-Flux', name: 'Dark Fantasy', defaultWeight: 1.0 },
    { id: 'digital-abyss', name: 'Digital Abyss', defaultWeight: 1.0 },
    { id: 'Elden_Ring_-_Yoshitaka_Amano', name: 'Elden Ring Style', defaultWeight: 1.0 },
    { id: 'frazetta_flux_v2', name: 'Frazetta Style', defaultWeight: 1.0 },
    { id: 'FluxMythG0thicL1nes', name: 'Gothic Lines', defaultWeight: 1.0 },
    { id: 'MoriiMee_Gothic_Niji_Style__FLUX_LoRA_Test_2', name: 'Gothic Niji', defaultWeight: 1.0 },
    { id: 'Hyperdetailed_Colored_Pencil', name: 'Colored Pencil', defaultWeight: 1.0 },
    { id: 'aidmaImageUpraderv0.3', name: 'Image Upgrader', defaultWeight: 1.0 },
    { id: 'aidmaMJ6.1_v0.5_3', name: 'MJ Style', defaultWeight: 1.0 },
    { id: 'wasted_films', name: 'Wasted Films', defaultWeight: 1.0 },
    { id: 'FluxMythP0rtr4itStyle', name: 'Portrait Style', defaultWeight: 1.0 },
    { id: 'FluxMythR3alisticF', name: 'Realistic F', defaultWeight: 1.0 },
    { id: 'RealisticPeoplev0.2', name: 'Realistic People', defaultWeight: 1.0 },
    { id: 'RetroAnimeFluxV1', name: 'Retro Anime', defaultWeight: 1.0 },
    { id: 'Sinfully_Stylish_1.0_Flux', name: 'Sinfully Stylish', defaultWeight: 1.0 },
    { id: 'Flux.1_Turbo_Detailer', name: 'Turbo Detailer', defaultWeight: 1.0 },
    { id: 'UltraRealPhoto', name: 'Ultra Real Photo', defaultWeight: 1.0 }
];

/* const presets = {
    'secret sauce': {
        'princess_pony_v1': 0.5,
        'g0th1c2XLP': 0.3,
        'Beautiful face_alpha1.0_rank4_noxattn_last': 0.2,
        'EnvyPonyPrettyEyes01': 0.2,
        'incase_v14': 0.2,
    }
}; */

const LoraSelector = ({ selectedLoras, setSelectedLoras, isOpen, onClose }) => {
    // Keep all existing state and functions
    const [ponyExpanded, setPonyExpanded] = useState(false);
    const [fluxExpanded, setFluxExpanded] = useState(true);
    
    if (!isOpen) return null;

    const applyPreset = (presetName, e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedLoras(presets[presetName]);
    };

    const toggleLora = (loraId) => {
        setSelectedLoras(prev => {
            if (prev[loraId]) {
                const { [loraId]: removed, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [loraId]: fluxLoras.find(l => l.id === loraId).defaultWeight
            };
        });
    };

    const updateWeight = (loraId, weight) => {
        setSelectedLoras(prev => ({
            ...prev,
            [loraId]: parseFloat(weight)
        }));
    };

    const handleRemoveAll = () => {
        setSelectedLoras({});
    };

    const handleRandom = () => {
        const shuffled = [...fluxLoras].sort(() => 0.5 - Math.random());
        const randomLoras = shuffled.slice(0, 4).reduce((acc, lora, index) => {
            let weight;
            switch (index) {
                case 0:
                    weight = (Math.random() * 0.5) + 0.5; // 0.5 to 1
                    break;
                case 1:
                    weight = (Math.random() * 0.5) + 0.4; // 0.4 to 0.9
                    break;
                case 2:
                    weight = (Math.random() * 0.4) + 0.3; // 0.3 to 0.7
                    break;
                case 3:
                    weight = (Math.random() * 0.3) + 0.3; // 0.3 to 0.6
                    break;
                default:
                    weight = lora.defaultWeight;
            }
            acc[lora.id] = parseFloat(weight.toFixed(2)); // Ensure increments of 0.05
            return acc;
        }, {});
        setSelectedLoras(randomLoras);
    };

    return (
        <div className="lora-overlay" onClick={onClose}>
            <div className="lora-popup" onClick={e => e.stopPropagation()}>
                <div className="lora-popup-header">
                    <h3>Lora Settings</h3>
                    <button type="button" className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="section-header" onClick={() => setFluxExpanded(!fluxExpanded)}>
                    <h3>Flux Loras {fluxExpanded ? '▼' : '▶'}</h3>
                </div>
                {fluxExpanded && (
                    <div className="lora-section lora-grid">
                        <button type="button" onClick={handleRemoveAll}>Remove All</button>
                        <button type="button" onClick={handleRandom}>Random</button>
                        {fluxLoras.map(lora => (
                            <div key={lora.id} className="lora-item">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={!!selectedLoras[lora.id]}
                                        onChange={() => toggleLora(lora.id)}
                                    />
                                    {lora.name}
                                </label>
                                {selectedLoras[lora.id] !== undefined && (
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={selectedLoras[lora.id]}
                                        onChange={(e) => updateWeight(lora.id, e.target.value)}
                                    />
                                )}
                                {selectedLoras[lora.id] !== undefined && (
                                    <span>{selectedLoras[lora.id].toFixed(2)}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoraSelector;