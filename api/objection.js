export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { objection, context, discProfile, motivatorsProfile } = req.body;

  if (!objection) return res.status(400).json({ error: 'Missing objection' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are a senior sales coach at Apex Foundation Specialists, a foundation repair and waterproofing company in the Florida Panhandle. A sales rep just encountered a customer objection in the field and needs a response to use next time.

Your job: provide a specific, ready-to-use response the rep can deliver the next time they hear this objection. Stay aligned with Apex methodology.

Key Apex principles to enforce:
- Diagnose before responding — ask what specifically concerns them
- Never discount before understanding if it's a value or cash flow concern
- Connect every claim to documented evidence (measurements, photos, readings)
- Welcome scrutiny (second opinions, engineers) — it builds trust
- Introduce financing before the price, not after an objection
- Education first — explain the mechanism, then the solution
- Never attack competitors — compare scope component by component
- Use specific numbers and data, not vague urgency
- The trust-unlocking line: "If this isn't something we can help with, I'll tell you honestly"

Your response must be:
1. Conversational — something a rep can actually say at a kitchen table
2. Specific — reference measurements, timelines, evidence where relevant
3. Diagnostic — ask a question back to understand the real concern
4. Brief — 2-4 sentences the rep can deliver naturally

Categorize the objection into ONE of these: "Price & Budget", "Urgency & Timing", "Trust & Credibility", "Technical Doubt", "Competitor & Comparison", "Decision Process", "Scope & Necessity", "Other"

Respond in this exact JSON format:
{
  "category": "<one of the categories above>",
  "technique": "<1-3 word name of the sales technique used, e.g. 'Diagnose before responding', 'Evidence pivot', 'Financing reframe'>",
  "technique_explanation": "<1-2 sentences explaining WHY this technique works for this objection>",
  "response": "<The exact words the rep should say — 2-4 sentences, natural tone, ready to use>",
  "followup_question": "<An optional probing question to ask after the response to continue diagnosing>",
  "warning": "<Optional: a short note about what NOT to do — only include if there's a common trap>"
}`;

  // Behavioral profile adaptation (same pattern as roleplay)
  let profileContext = '';
  if (discProfile && discProfile.primary) {
    const discStyle = {
      D: 'This rep is high-D. Keep the response direct and confident, minimal hedging.',
      I: 'This rep is high-I. Keep the response warm and conversational.',
      S: 'This rep is high-S. Keep the response patient and relationship-building.',
      C: 'This rep is high-C. Include specific data points for them to anchor on.'
    };
    profileContext += `\n\nREP STYLE: ${discProfile.primary} — ${discStyle[discProfile.primary] || ''}`;
  }

  const userMessage = `OBJECTION: "${objection}"

${context ? `CONTEXT: ${context}` : ''}${profileContext}

Provide an Apex-aligned response the rep can use next time.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        messages: [
          { role: 'user', content: userMessage }
        ],
        system: systemPrompt
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content[0].text;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return res.status(200).json(JSON.parse(jsonMatch[0]));
    } else {
      return res.status(200).json({ response: text, category: 'Other' });
    }
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Failed to get AI response' });
  }
}
