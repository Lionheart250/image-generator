import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext'; // Adjust path to your AuthContext
import { useNavigate } from 'react-router-dom';
import './ImageGenerator.css';

function ImageGenerator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cfgScale, setCfgScale] = useState(7);
  const [aspectRatio, setAspectRatio] = useState('Portrait');
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const token = localStorage.getItem('token');

    const dimensions = {
        Portrait: { width: 576, height: 1024 },
        Landscape: { width: 1024, height: 576 },
        Square: { width: 768, height: 768 }
    };

    const { width, height } = dimensions[aspectRatio];

    const defaultNegativePrompt = "morphing, noisy, bad quality, distorted, poorly drawn, blurry, grainy, low resolution, oversaturated, lack of detail, inconsistent lighting, score_3, score_2, score_1, bad hands, worst quality, low quality, bad anatomy, bad proportions, censored, bar censor, mosaic censoring, extra legs, deformed anatomy, messy color, 3d, deformed fingers, distracted, jpeg artifacts, ugly, 6 fingers, extra limb, missing limb, floating limbs, watermark, patreon, patreon logo, patreon username, extra hands, bad fingers, wrong fingers, cross eyed, easynegative";

    const finalNegativePrompt = `${defaultNegativePrompt}, ${negativePrompt}`;

    const payload = {
        prompt,
        negativePrompt: finalNegativePrompt,
        cfgScale,
        steps: 24,
        width,
        height
    };

    try {
        const response = await fetch('http://localhost:3000/generate_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            setError(errorData.error || 'Failed to generate image');
        } else {
            const data = await response.json();
            setImage(data.image);
        }
    } catch (error) {
        setError('Failed to generate image');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="image-generator-container">
        <div className="image-generator-form-container">
            <h2 className="image-generator-heading"></h2>
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
                    <label className="image-generator-label" htmlFor="negativePrompt">Negative Prompt:</label>
                    <input
                        type="text"
                        id="negativePrompt"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="what to exclude"
                        className="image-generator-input"
                    />
                </div>
                <div className="image-generator-creative-section">
                    <label className="image-generator-label">Creative Control</label>
                    <div className="image-generator-creative-buttons">
                        <button
                            type="button"
                            className={`image-generator-creative-btn ${cfgScale === 1 ? 'selected' : ''}`}
                            onClick={() => setCfgScale(1)}
                        >
                            Very Creative
                        </button>
                        <button
                            type="button"
                            className={`image-generator-creative-btn ${cfgScale === 7 ? 'selected' : ''}`}
                            onClick={() => setCfgScale(7)}
                        >
                            Creative
                        </button>
                        <button
                            type="button"
                            className={`image-generator-creative-btn ${cfgScale === 15 ? 'selected' : ''}`}
                            onClick={() => setCfgScale(15)}
                        >
                            Subtle
                        </button>
                        <button
                            type="button"
                            className={`image-generator-creative-btn ${cfgScale === 30 ? 'selected' : ''}`}
                            onClick={() => setCfgScale(30)}
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
                <button
                    type="submit"
                    disabled={loading}
                    className={`image-generator-submit-btn ${loading ? 'disabled' : ''}`}
                >
                    {loading ? 'Generating...' : 'Generate Image'}
                </button>
            </form>
        </div>
        <div className="image-generator-preview">
            <div className={`image-generator-preview-container ${loading ? 'loading' : ''}`}>
                {loading ? (
                    <div className="image-generator-loading">
                        <div className="loading-spinner">
                            <div className="loading-spinner-inner"></div>
                        </div>
                        <div className="loading-text">Generating your image...</div>
                    </div>
                ) : image ? (
                    <img src={image} alt="Generated" className="generated-image" />
                ) : (
                    <div className="placeholder-text"></div>
                )}
            </div>
        </div>
    </div>
  );
}

export default ImageGenerator;
