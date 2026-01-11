import { CONFIG } from './config.js';

export class GeminiService {
    constructor() {
        this.apiKey = CONFIG.GEMINI_API_KEY;
        this.model = CONFIG.GEMINI_MODEL || "gemini-pro";
        this.apiUrl = `${CONFIG.API_BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;
        console.log("GeminiService initialized with model:", this.model);
    }

    async processConversation(transcript, availableFields) {
        if (!transcript || !transcript.trim()) return null;

        console.log(`Sending to Gemini. Transcript length: ${transcript.length}, Available Fields: ${Object.keys(availableFields || {}).length}`);

        const prompt = `
      You are an expert AI Medical Scribe.
      
      Task:
      1. Analyze the provided Doctor-Patient conversation transcript.
      2. Review the list of available form fields on the user's screen.
      3. EXTRACT relevant clinical information from the conversation.
      4. MAP the extracted facts to the most appropriate field ID from the list.
      5. STANDARDIZE the values to professional medical formatting (e.g., "tylenol" -> "Acetaminophen", "twenty mg" -> "20mg").
      
      CRITICAL RULES:
      - OUTPUT ONLY VALID JSON. No markdown, no explanations.
      - Usage strict JSON format: { "field_id": "standardized_value" }
      - Only include fields you are CONFIDENT about (>80% confidence).
      - Do not hallucinate information not present in the transcript.
      - If a value implies a checkbox (e.g., "I have a fever" -> Symptom: Fever), set the value to "true" or the specific option value if known.
      
      Available Fields:
      ${JSON.stringify(availableFields, null, 2)}
      
      Conversation Transcript:
      "${transcript}"
      
      JSON Response:
    `;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                console.warn('Gemini returned no candidates');
                return null;
            }

            const text = data.candidates[0].content.parts[0].text;

            const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();

            return JSON.parse(cleanJson);

        } catch (error) {
            console.error('Error calling Gemini:', error);
            throw error;
        }
    }
}
