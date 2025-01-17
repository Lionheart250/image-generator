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
  const [enableUpscale, setEnableUpscale] = useState(false); // State for upscaling

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
      Portrait: { width: 512, height: 768, hiresWidth: 1024, hiresHeight: 1536 },
      Landscape: { width: 768, height: 512, hiresWidth: 1536, hiresHeight: 1024 },
      Square: { width: 512, height: 512, hiresWidth: 1024, hiresHeight: 1024 }
    };

    const { width, height, hiresWidth, hiresHeight } = dimensions[aspectRatio];

    const defaultNegativePrompt = "low quality, bad anatomy, poorly drawn, deformed, distorted, extra limbs, mutated hands, blurry, out of focus, missing limbs, disfigured, extra fingers, overexposed, underexposed, low contrast, 3d, realistic, sketch, crowded, cluttered background, watermark, text, logo";
    
    const finalNegativePrompt = `${defaultNegativePrompt}, ${negativePrompt}`;

    const payload = {
      prompt,
      negativePrompt: finalNegativePrompt,
      cfgScale,
      steps: 24,
      width,
      height,
      enable_hr: enableUpscale, // Use the state for upscaling
      denoising_strength: 0.5,
      upscale_factor: enableUpscale ? 2 : 1, // Set upscale factor based on state
      hires_width: enableUpscale ? hiresWidth : width, // Use hires width if upscaling
      hires_height: enableUpscale ? hiresHeight : height // Use hires height if upscaling
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

          {/* Upscale Toggle Section */}
          <div className="image-generator-upscale-section">
            <label className="image-generator-label">Enable Upscale:</label>
            <button
              type="button"
              className={`image-generator-upscale-btn ${enableUpscale ? 'selected' : ''}`}
              onClick={() => setEnableUpscale((prev) => !prev)}
            >
              {enableUpscale ? 'Upscale On' : 'Upscale Off'}
            </button>
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
