import axios from 'axios';

// Update API URL to match Stable Diffusion Web UI
const API_URL = 'http://127.0.0.1:7860/sdapi/v1/txt2img';

export const generateImage = async (formData) => {
  try {
    // Construct request payload
    const response = await axios.post(API_URL, {
      prompt: formData.prompt,                       // Text prompt for image generation
      negative_prompt: formData.negativePrompt,     // Negative prompt (if needed)
      cfg_scale: parseFloat(formData.cfgScale),     // Configuration scale
      steps: parseInt(formData.steps, 10),          // Number of steps for generation
      width: parseInt(formData.width, 10),          // Image width
      height: parseInt(formData.height, 10)         // Image height
    }, {
      headers: {
        'Content-Type': 'application/json',          // Content type for JSON
      },
    });

    // Check if the response contains an error
    if (response.data.error) {
      throw new Error(response.data.error);
    }

    // The image data structure may vary; adjust according to your API's response
    return response.data.images[0]; // Assuming the image is in an array format
  } catch (error) {
    // Improved error handling with more detailed logging
    throw new Error(error.response?.data?.error || error.message || 'Failed to generate image');
  }
};
