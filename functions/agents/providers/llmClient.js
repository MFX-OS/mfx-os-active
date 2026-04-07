'use strict';
// LLM provider adapter — abstraction layer for model calls
// Supports Anthropic Claude (primary) and can be extended to others

async function callLLM(opts) {
  const { systemPrompt, userPrompt, model, maxTokens, temperature } = opts;

  // Check for API key in environment
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    // Fallback: rule-based analysis (no LLM available)
    return { type: 'rule_based', content: null, model: 'none', tokensUsed: 0 };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 2048,
        temperature: temperature || 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LLM API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';

    return {
      type: 'llm',
      content: text,
      model: data.model,
      tokensUsed: (data.usage && data.usage.input_tokens + data.usage.output_tokens) || 0
    };
  } catch (e) {
    console.warn('LLM call failed, falling back to rule-based:', e.message);
    return { type: 'rule_based', content: null, model: 'none', tokensUsed: 0, error: e.message };
  }
}

// Parse JSON from LLM response text
function parseLLMJSON(text) {
  if (!text) return null;
  // Try to find JSON block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) { return null; }
  }
  return null;
}

module.exports = { callLLM, parseLLMJSON };
