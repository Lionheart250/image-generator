import React, { useState } from 'react';
import './LoraSelector.css';

const ponyLoras = [
    // Character Loras
    { id: 'Furry_Anthro_Lola_Bunny_Lora', name: 'Lola Style', defaultWeight: 1.0 },
    { id: 'Judy_Hopps_Il', name: 'Judy Style', defaultWeight: 1.0 },
    { id: 'Pony_Alicia_v1_XL', name: 'Pony Alicia', defaultWeight: 1.0 },
    { id: 'Pony_Celestine_v1_XL-000014', name: 'Pony Celestine', defaultWeight: 1.0 },
    { id: 'Pony_Chloe_v3_XL', name: 'Pony Chloe', defaultWeight: 1.0 },
    { id: 'Pony_Olga_v3_XL', name: 'Pony Olga', defaultWeight: 1.0 },
    { id: 'Sayama Chie(sr)-Pony', name: 'Sayama Chie Pony', defaultWeight: 1.0 },
    // Style Loras
    { id: 'princess_pony_v1', name: 'Princess Pony', defaultWeight: 0.5 },
    { id: 'PixelSketcher', name: 'Pixel Sketcher', defaultWeight: 0.5 },
    { id: 'Expressive_H', name: 'Expressive', defaultWeight: 0.5 },
    { id: '[GP] somethingweird [Pony XL]', name: 'Something Weird', defaultWeight: 0.5 },
    { id: 'pop-sdxl', name: 'Mini Style', defaultWeight: 1.0 },
    { id: 'cutesexyrobutts_style_pdxl_v3', name: 'Cute Sexy Style', defaultWeight: 1.0 },
    { id: 'g0th1c2XLP', name: 'Gothic', defaultWeight: 1.0 },
    { id: 'incase_v14', name: 'Incase', defaultWeight: 1.0 },
    { id: 'NEW_ERAv2.1', name: 'New Era', defaultWeight: 1.0 },
    { id: 'officialpit_v2-8', name: 'Official Pit', defaultWeight: 1.0 },
    { id: 'peoples_works_illustrius', name: 'Peoples Works', defaultWeight: 1.0 },
    { id: 'Smooth Anime Style LoRA XL', name: 'Smooth Anime', defaultWeight: 1.0 },
    { id: 'Beautiful face_alpha1.0_rank4_noxattn_last', name: 'Beautiful Face', defaultWeight: 1.0 },
    { id: 'EnvyPonyPrettyEyes01', name: 'Envy Pony Eyes', defaultWeight: 1.0 },
    { id: 'visualnovel_pony_SDXLPONY_r12_768_dim32-a1-adamW', name: 'Visual Novel', defaultWeight: 1.0 },
    { id: 'Very_Small_Women', name: 'Very Small', defaultWeight: 1.0 }
];

const fluxLoras = [
    { id: 'aidmaImageUpraderv0.3', name: 'Image Upgrader', defaultWeight: 1.0 },
    { id: 'aidmaMJ6.1_v0.5_3', name: 'MJ Style', defaultWeight: 1.0 },
    { id: 'RealisticPeoplev0.2', name: 'Realistic People', defaultWeight: 1.0 },
    { id: 'bustyfc_v2', name: 'Busty FC', defaultWeight: 1.0 },
    { id: 'CinematicStyleFlux_v1', name: 'Cinematic Style', defaultWeight: 1.0 },
    { id: 'CPA', name: 'CPA', defaultWeight: 1.0 },
    { id: 'Cyber_Graphic', name: 'Cyber Graphic', defaultWeight: 1.0 },
    { id: 'Elden_Ring_-_Yoshitaka_Amano', name: 'Elden Ring Style', defaultWeight: 1.0 },
    { id: 'flux.1_lora_flyway_Epic-Characters_v1', name: 'Epic Characters', defaultWeight: 1.0 },
    { id: 'Flux.1_Turbo_Detailer', name: 'Turbo Detailer', defaultWeight: 1.0 },
    { id: 'FluxMythAn1meL1nes', name: 'Anime Lines', defaultWeight: 1.0 },
    { id: 'FluxMythG0thicL1nes', name: 'Gothic Lines', defaultWeight: 1.0 },
    { id: 'FluxMythP0rtr4itStyle', name: 'Portrait Style', defaultWeight: 1.0 },
    { id: 'FluxMythR3alisticF', name: 'Realistic F', defaultWeight: 1.0 },
    { id: 'FluxMythV2', name: 'Flux Myth V2', defaultWeight: 1.0 },
    { id: 'frazetta_flux_v2', name: 'Frazetta Style', defaultWeight: 1.0 },
    { id: 'hourglassv2_flux', name: 'Hourglass', defaultWeight: 1.0 },
    { id: 'Hyperdetailed_Colored_Pencil', name: 'Colored Pencil', defaultWeight: 1.0 },
    { id: 'MoriiMee_Gothic_Niji_Style__FLUX_LoRA_Test_2', name: 'Gothic Niji', defaultWeight: 1.0 },
    { id: 'RetroAnimeFluxV1', name: 'Retro Anime', defaultWeight: 1.0 },
    { id: 'Sinfully_Stylish_1.0_Flux', name: 'Sinfully Stylish', defaultWeight: 1.0 },
    { id: 'sxz-Dark-Fantasy-v2-Flux', name: 'Dark Fantasy', defaultWeight: 1.0 },
    { id: 'UltraRealPhoto', name: 'Ultra Real Photo', defaultWeight: 1.0 },
    { id: 'wasted_films', name: 'Wasted Films', defaultWeight: 1.0 }
];

const presets = {
    'secret sauce': {
        'princess_pony_v1': 0.5,
        'g0th1c2XLP': 0.3,
        'Beautiful face_alpha1.0_rank4_noxattn_last': 0.2,
        'EnvyPonyPrettyEyes01': 0.2,
        'incase_v14': 0.2,
    }
};

const LoraSelector = ({ selectedLoras, setSelectedLoras, isOpen, onClose }) => {
    const [ponyExpanded, setPonyExpanded] = useState(false);
    const [fluxExpanded, setFluxExpanded] = useState(false);
    
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
                [loraId]: ponyLoras.concat(fluxLoras).find(l => l.id === loraId).defaultWeight
            };
        });
    };

    const updateWeight = (loraId, weight) => {
        setSelectedLoras(prev => ({
            ...prev,
            [loraId]: parseFloat(weight)
        }));
    };

    return (
        <div className="lora-overlay" onClick={onClose}>
            <div className="lora-popup" onClick={e => e.stopPropagation()}>
                <div className="lora-popup-header">
                    <h3>Lora Settings</h3>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                
                <div className="presets-section">
                    <h4>Presets</h4>
                    <div className="preset-buttons">
                        {Object.keys(presets).map(presetName => (
                            <button
                                key={presetName}
                                type="button"
                                className="preset-button"
                                onClick={(e) => applyPreset(presetName, e)}
                            >
                                {presetName}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="section-header" onClick={() => setPonyExpanded(!ponyExpanded)}>
                    <h3>Pony Loras {ponyExpanded ? '▼' : '▶'}</h3>
                </div>
                {ponyExpanded && (
                    <div className="lora-section">
                        {ponyLoras.map(lora => (
                            <div key={lora.id} className="lora-item">
                                <label className="lora-label">
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
                                        step="0.1"
                                        value={selectedLoras[lora.id]}
                                        onChange={(e) => updateWeight(lora.id, e.target.value)}
                                        className="lora-weight"
                                    />
                                )}
                                {selectedLoras[lora.id] !== undefined && (
                                    <span className="weight-value">
                                        {selectedLoras[lora.id].toFixed(1)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="section-header" onClick={() => setFluxExpanded(!fluxExpanded)}>
                    <h3>Flux Loras {fluxExpanded ? '▼' : '▶'}</h3>
                </div>
                {fluxExpanded && (
                    <div className="lora-section">
                        {fluxLoras.map(lora => (
                            <div key={lora.id} className="lora-item">
                                <label className="lora-label">
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
                                        step="0.1"
                                        value={selectedLoras[lora.id]}
                                        onChange={(e) => updateWeight(lora.id, e.target.value)}
                                        className="lora-weight"
                                    />
                                )}
                                {selectedLoras[lora.id] !== undefined && (
                                    <span className="weight-value">
                                        {selectedLoras[lora.id].toFixed(1)}
                                    </span>
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