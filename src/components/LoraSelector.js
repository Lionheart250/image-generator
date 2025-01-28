import React from 'react';
import './LoraSelector.css';

const availableLoras = [
    { id: 'princess_pony_v1', name: 'Princess Pony', defaultWeight: 0.5 },
    { id: 'PixelSketcher', name: 'Pixel Sketcher', defaultWeight: 0.5 },
    { id: 'Expressive_H', name: 'Expressive', defaultWeight: 0.5 },
    { id: '[GP] somethingweird [Pony XL]', name: 'Something Weird', defaultWeight: 0.5 },
    { id: 'pop-sdxl', name: 'minisize', defaultWeight: 1.0 },
    { id: 'cutesexyrobutts_style_pdxl_v3', name: 'Cute Sexy Style PD', defaultWeight: 1.0 },
    { id: 'Furry_Anthro_Lola_Bunny_Lora', name: 'Lola Style', defaultWeight: 1.0 },
    { id: 'g0th1c2XLP', name: 'Gothic', defaultWeight: 1.0 },
    { id: 'incase_v14', name: 'Incase', defaultWeight: 1.0 },
    { id: 'Judy_Hopps_Il', name: 'Judy Style', defaultWeight: 1.0 },
    { id: 'NEW_ERAv2.1', name: 'New Era', defaultWeight: 1.0 },
    { id: 'officialpit_v2-8', name: 'Official Pit', defaultWeight: 1.0 },
    { id: 'peoples_works_illustrius', name: 'Peoples Works', defaultWeight: 1.0 },
    { id: 'Very_Small_Women', name: 'Very Small', defaultWeight: 1.0 }
];

const presets = {
    'secret sauce': {
        'princess_pony_v1': 0.5,
        'PixelSketcher': 0.5,
        'Expressive_H': 0.5,
        '[GP] somethingweird [Pony XL]': 0.5,
        'Furry_Anthro_Lola_Bunny_Lora': 0.7,
        'Judy_Hopps_Il': 0.6,
        'officialpit_v2-8': 0.2,
        'incase_v14': 0.2,
        'Very_Small_Women': 0.5,
        'pop-sdxl': 0.5
    }
};

const LoraSelector = ({ selectedLoras, setSelectedLoras, isOpen, onClose }) => {
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
                [loraId]: availableLoras.find(l => l.id === loraId).defaultWeight
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

                <div className="lora-grid">
                    {availableLoras.map(lora => (
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
            </div>
        </div>
    );
};

export default LoraSelector;