import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext'; // Adjust path to your AuthContext
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import './ImageGenerator.css';
import LoraSelector from '../components/LoraSelector';

// Add constants at top
const dimensions = {
    Portrait: { width: 768, height: 1280 },
    Landscape: { width: 1280, height: 768 },
    Square: { width: 1024, height: 1024 }
};

const SAMPLERS = [
    "Euler",
    "Euler a",
    "DPM++ 2M",
    "DPM++ SDE",
    "DPM++ 2M SDE",
    "DPM fast",
    "DPM adaptive",
    "LMS",
    "Heun",
    "DPM2",
    "DPM2 a"
];

const SCHEDULERS = [
    "Simple",
    "Karras"
];

const FORGE_URL = 'http://127.0.0.1:7860';

const ImageGenerator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cfgScale, setCfgScale] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('Portrait');
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enableUpscale, setEnableUpscale] = useState(false); // State for upscaling
  const [spiral] = useState("Generating your image");
  const [spiral2] = useState("Generating your image");
  const spiralRef = useRef(null);
  const spiral2Ref = useRef(null);
  const [selectedLoras, setSelectedLoras] = useState({});
  const [isLoraOpen, setIsLoraOpen] = useState(false);
  const [categories, setCategories] = useState([]); // State for categories
  const [sampler, setSampler] = useState("DPM++ 2M SDE");
  const [upscaler, setUpscaler] = useState("R-ESRGAN 4x+");
  const [initImage, setInitImage] = useState(null);
  const [isImageToImage, setIsImageToImage] = useState(false);
  const [denoisingStrength, setDenoisingStrength] = useState(0.75);
  const [steps, setSteps] = useState(20); // Add state for steps
  const [scheduler, setScheduler] = useState("Karras");
  const [showAdvanced, setShowAdvanced] = useState(false); // Add state for advanced section toggle
  const [distilledCfgScale, setDistilledCfgScale] = useState(3.5);

  const ANIMATION_DURATION = 2000; // 2 seconds for full animation
  const ANIMATION_OFFSET = 500; // 0.5 second offset
  const SPIRAL2_OFFSET = 4000; // Additional offset for second spiral

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const { exp } = jwtDecode(token);
      if (Date.now() >= exp * 1000) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        navigate('/login');
      } else {
        setLoading(false);
      }
    } catch (error) {
      navigate('/login');
    }
  }, [navigate]);

  // First spiral animation
  useEffect(() => {
    if (loading && spiralRef.current) {
        spiralRef.current.innerHTML = '';
      
        spiral.split('').forEach((char, i) => {
            const div = document.createElement('div');
            div.innerText = char;
            div.classList.add('character');
            div.style.setProperty('--i', i + 1);
            // Start animation immediately but keep movement pattern
            div.style.animationDelay = `${(i * ANIMATION_DURATION / 16) - ANIMATION_OFFSET - ANIMATION_DURATION}ms`;
            spiralRef.current.appendChild(div);
        });
    }
}, [loading, spiral]);

  // Second spiral animation
  useEffect(() => {
    if (loading && spiral2Ref.current) {
      spiral2Ref.current.innerHTML = '';
      
      spiral2.split('').forEach((char, i) => {
        const div = document.createElement('div');
        div.innerText = char;
        div.classList.add('character');
        div.style.setProperty('--i', i + 1);
        div.style.animationDelay = `${-(ANIMATION_OFFSET + SPIRAL2_OFFSET) + (i * ANIMATION_DURATION / 16)}ms`;
        spiral2Ref.current.appendChild(div);
      });
    }
    
    return () => {
      if (spiral2Ref.current) {
        spiral2Ref.current.innerHTML = '';
      }
    };
  }, [loading, spiral2]);

  const buildLoraString = () => {
    return Object.entries(selectedLoras)
        .map(([id, weight]) => `<lora:${id}:${weight}>`)
        .join(' ');
  };

  const configureModel = async () => {
    const optionPayload = {
        sd_model_checkpoint: "flux_dev.safetensors",
        CLIP_stop_at_last_layers: 2
    };
    
    await fetch(`${FORGE_URL}/sdapi/v1/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optionPayload)
    });
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
        const { width, height } = dimensions[aspectRatio];
        const loraString = buildLoraString();
        const finalPrompt = `${prompt} ${loraString}`;

        const response = await fetch('http://localhost:3000/generate_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                prompt: finalPrompt,
                negative_prompt: negativePrompt || "",
                width,
                height,
                cfg_scale: 1,
                distilled_cfg_scale: distilledCfgScale,
                steps: steps,
                sampler_name: "Euler",
                scheduler: "Simple",
                batch_size: 1,
                seed: -1
            })
        });

        if (!response.ok) throw new Error('Failed to generate image');
        
        const data = await response.json();
        setImage(`data:image/png;base64,${data.image}`);
    } catch (error) {
        console.error('Error:', error);
        setError('Failed to generate image');
    } finally {
        setLoading(false);
    }
};

const validUpscalers = [
    "Latent",
    "Latent (antialiased)",
    "Latent (bicubic)",
    "Latent (bicubic antialiased)",
    "Latent (nearest)",
    "Latent (nearest-exact)",
    "None",
    "Lanczos",
    "Nearest",
    "ESRGAN_4x",
    "R-ESRGAN 4x+",
    "4x_foolhardy_Remacri",  // Custom ESRGAN model
    "LDSR",
    "SwinIR 4x"
];

const LoadingText = () => (
    <div className="loading-text">
        <div ref={spiralRef} className="spiral-text">
            {spiral.split('').map((char, i) => (
                <span 
                    key={i} 
                    className="character"
                    style={{
                        '--i': i + 1,
                        animationDelay: `${-ANIMATION_OFFSET + (i * ANIMATION_DURATION / 16)}ms`
                    }}
                >
                    {char}
                </span>
            ))}
        </div>
        <div ref={spiral2Ref} className="spiral-text">
            {spiral2.split('').map((char, i) => (
                <span 
                    key={i} 
                    className="character"
                    style={{
                        '--i': i + 1,
                        animationDelay: `${-(ANIMATION_OFFSET + SPIRAL2_OFFSET) + (i * ANIMATION_DURATION / 16)}ms`
                    }}
                >
                    {char}
                </span>
            ))}
        </div>
    </div>
);

  return (
    <div className="image-generator">
        <div className="image-generator-container">
            {/* Form Side */}
            <div className="image-generator-form-container">
                <div className="content-wrapper">
                    <h2 className="image-generator-heading">Generate Image</h2>
                    <form onSubmit={handleSubmit} className="image-generator-form">
                        <div className="image-generator-form-group">
                            <label className="image-generator-label" htmlFor="prompt">Prompt:</label>
                            <input
                                type="text"
                                id="prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                required 
                                className="image-generator-input"
                            />
                        </div>
                        
                        <div className="image-generator-form-group">
                        {/*}
                            <label className="image-generator-label" htmlFor="negativePrompt">Negative Prompt:</label>
                            <input
                                type="text"
                                id="negativePrompt"
                                value={negativePrompt}
                                onChange={(e) => setNegativePrompt(e.target.value)}
                                placeholder="what to exclude"
                                className="image-generator-input"
                            />
                            */}
                        </div>
                        <button 
                            type="button"
                            className={`lora-settings-button ${Object.keys(selectedLoras).length > 0 ? 'active' : ''}`}
                            onClick={() => setIsLoraOpen(true)}
                        >
                            Lora Settings
                        </button>
                        
                        <LoraSelector 
                            selectedLoras={selectedLoras}
                            setSelectedLoras={setSelectedLoras}
                            isOpen={isLoraOpen}
                            onClose={() => setIsLoraOpen(false)}
                        />
                        <div className="image-generator-creative-section">
                            <label className="image-generator-label">Creative Control</label>
                            <div className="image-generator-creative-buttons">
                                <button
                                    type="button"
                                    className={`image-generator-creative-btn ${distilledCfgScale === 2 ? 'selected' : ''}`}
                                    onClick={() => setDistilledCfgScale(2)}
                                >
                                    Very Creative
                                </button>
                                <button
                                    type="button"
                                    className={`image-generator-creative-btn ${distilledCfgScale === 3.5 ? 'selected' : ''}`}
                                    onClick={() => setDistilledCfgScale(3.5)}
                                >
                                    Creative
                                </button>
                                <button
                                    type="button"
                                    className={`image-generator-creative-btn ${distilledCfgScale === 5 ? 'selected' : ''}`}
                                    onClick={() => setDistilledCfgScale(5)}
                                >
                                    Subtle
                                </button>
                                <button
                                    type="button"
                                    className={`image-generator-creative-btn ${distilledCfgScale === 7 ? 'selected' : ''}`}
                                    onClick={() => setDistilledCfgScale(7)}
                                >
                                    Strict
                                </button>
                            </div>
                        </div>
                        <div className="image-generator-aspect-section">
                            <label className="image-generator-label">Aspect Ratio</label>
                            <div className="image-generator-aspect-buttons">
                                <button
                                    type="button"
                                    className={`image-generator-aspect-btn ${aspectRatio === 'Portrait' ? 'selected' : ''}`}
                                    onClick={() => setAspectRatio('Portrait')}
                                >
                                    Portrait
                                </button>
                                <button
                                    type="button"
                                    className={`image-generator-aspect-btn ${aspectRatio === 'Landscape' ? 'selected' : ''}`}
                                    onClick={() => setAspectRatio('Landscape')}
                                >
                                    Landscape
                                </button>
                                <button
                                    type="button"
                                    className={`image-generator-aspect-btn ${aspectRatio === 'Square' ? 'selected' : ''}`}
                                    onClick={() => setAspectRatio('Square')}
                                >
                                    Square
                                </button>
                            </div>
                        </div>
                        <div className="image-generator-form-group">
                            <label className="image-generator-label">Initial Image:</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setInitImage(file);
                                        setIsImageToImage(true);
                                    }
                                }}
                                className="image-generator-input"
                            />
                        </div>

                        {isImageToImage && (
                            <div className="image-generator-form-group">
                                <label className="image-generator-label">
                                    Denoising Strength: {denoisingStrength}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={denoisingStrength}
                                    onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))}
                                    className="image-generator-range"
                                />
                            </div>
                        )}
                        <div className="control-group">
                            <label>Steps: {steps}</label>
                            <input 
                                type="range"
                                min="1"
                                max="50"
                                value={steps}
                                onChange={(e) => setSteps(parseInt(e.target.value))}
                                className="slider"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="generate-button"
                        >
                                {loading ? 'Generating...' : 'Generate Image'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Preview Side */}
            <div className={`image-generator-preview-container ${loading ? 'loading' : ''}`}>
                <div className="content-wrapper">
                    <h2 className="image-generator-heading">Preview</h2>
                    <div className="preview-content">
                        {loading ? (
                            <div className="loading-container">
                                <LoadingText />
                            </div>
                        ) : image ? (
                            <img src={image} alt="Generated" className="generated-image" />
                        ) : (
                            <div className="empty-preview">Your image will appear here</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
);
}

export default ImageGenerator;
