<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Enable error reporting (for development)
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Read the input data
$data = json_decode(file_get_contents('php://input'), true);
$prompt = $data['prompt'] ?? null;
$userNegativePrompt = $data['negativePrompt'] ?? '';
$cfgScale = isset($data['cfgScale']) ? floatval($data['cfgScale']) : 7;
$steps = isset($data['steps']) ? intval($data['steps']) : 24;
$width = isset($data['width']) ? intval($data['width']) : 1024;
$height = isset($data['height']) ? intval($data['height']) : 1024;

// Validate prompt
if (!$prompt) {
    http_response_code(400);
    echo json_encode(['error' => 'Prompt is required']);
    exit;
}

// Additional validations (optional)
if ($cfgScale < 1 || $cfgScale > 30) {
    http_response_code(400);
    echo json_encode(['error' => 'cfgScale must be between 1 and 30']);
    exit;
}
if ($steps < 1 || $steps > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Steps must be between 1 and 100']);
    exit;
}
if ($width < 256 || $width > 2048 || $height < 256 || $height > 2048) {
    http_response_code(400);
    echo json_encode(['error' => 'Width and Height must be between 256 and 2048']);
    exit;
}

// Default negative prompt
$defaultNegativePrompt = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, 
fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, username, blurry, 
morphing, noisy, bad quality, distorted, poorly drawn, blurry, grainy, low resolution, oversaturated, 
lack of detail, inconsistent lighting";

// Concatenate user input with default negative prompt if provided
$negativePrompt = $defaultNegativePrompt;
if (!empty($userNegativePrompt)) {
    $negativePrompt .= ', ' . $userNegativePrompt;
}

// Prepare API Request Payload
$payload = json_encode([
    'prompt' => $prompt,
    'negative_prompt' => $negativePrompt,
    'cfg_scale' => $cfgScale,
    'steps' => $steps,
    'width' => $width,
    'height' => $height,
]);

// Initialize cURL to send request to Stable Diffusion
$ch = curl_init('http://127.0.0.1:7860/sdapi/v1/txt2img');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

// Execute the API request
$response = curl_exec($ch);
if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to connect to API: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Handle the API response
if ($httpCode === 200) {
    $responseData = json_decode($response, true);
    if (isset($responseData['images'][0])) {
        echo json_encode(['image' => $responseData['images'][0]]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'No image generated']);
    }
} else {
    http_response_code($httpCode);
    echo json_encode(['error' => 'HTTP Error ' . $httpCode]);
}
?>
