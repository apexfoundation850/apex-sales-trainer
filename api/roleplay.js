export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { scenario, repResponse, category, discProfile } = req.body;

  if (!scenario || !repResponse) {
    return res.status(400).json({ error: 'Missing scenario or repResponse' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = `You are a senior sales coach at Apex Foundation Specialists, a foundation repair and waterproofing company in the Florida Panhandle. You are evaluating a sales rep's response to a customer objection during an in-home sales appointment.

Your job is to give direct, actionable coaching feedback. Be encouraging but honest. Reference specific Apex training principles when relevant.

Key Apex sales principles to evaluate against:
- Never discount before diagnosing whether the issue is value or cash flow
- Connect every recommendation to documented evidence from the inspection
- Welcome scrutiny (second opinions, engineers) — it builds trust
- Diagnose before responding to objections — ask what specifically concerns them
- Use specific measurements and data, not vague urgency
- Never attack competitors — compare scope component by component
- Introduce financing before the price, not after an objection
- The trust-unlocking moment: "If this isn't something we can help with, I'll tell you honestly"
- Education before proposal — customers who understand the mechanism buy the solution
- Evidence-based presentations close at higher rates than opinion-based ones

Scoring criteria (rate each 1-5):
1. EMPATHY — Did the rep acknowledge the customer's concern before responding?
2. DIAGNOSIS — Did the rep ask questions to understand the root concern?
3. EVIDENCE — Did the rep reference specific findings, measurements, or documentation?
4. TECHNIQUE — Did the rep use an appropriate framework (not pressure, not discount, not attack)?
5. CLOSE — Did the rep move toward a next step or resolution?

Respond in this exact JSON format:
{
  "overall_score": <number 1-100>,
  "scores": {
    "empathy": <1-5>,
    "diagnosis": <1-5>,
    "evidence": <1-5>,
    "technique": <1-5>,
    "close": <1-5>
  },
  "feedback": "<2-3 sentences of direct coaching feedback>",
  "better_response": "<A model response showing how a top closer would handle this>",
  "tip": "<One specific, memorable tip they can use next time>"
}`;

  // Build DISC context if available
  const discNames = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Conscientiousness' };
  const discPersonas = {
    D: 'You are coaching a high-D sales rep. They are direct and confident. Match their pace. Be blunt. No fluff. Challenge them on moments where they moved too fast. Praise decisiveness. Push them to read emotional readiness before asking for the close.',
    I: 'You are coaching a high-I sales rep. They are warm, energetic, and relationship-focused. Match their enthusiasm but redirect toward structure. Praise their connection-building. Coach them to always end with a clear close attempt. Keep feedback upbeat but honest about the follow-through gap.',
    S: 'You are coaching a high-S sales rep. They are patient, warm, and trust-driven. Be steady and supportive in your tone. Praise their relationship work and follow-through. Gently but directly coach them to ask for the decision — frame it as a caring act, not a sales tactic.',
    C: 'You are coaching a high-C sales rep. They are analytical, precise, and credibility-driven. Respect their depth of knowledge. Praise their diagnostic thoroughness. Coach them to recognize when a homeowner is already convinced and to shift from presenting to asking.'
  };

  let discContext = '';
  if (discProfile && discProfile.primary) {
    discContext = `\n\nDISC PROFILE CONTEXT:\nThis rep's primary DISC style is ${discProfile.primary} (${discNames[discProfile.primary]}).\n${discPersonas[discProfile.primary]}\nSecondary style: ${discProfile.secondary} (${discNames[discProfile.secondary]}) — ${discProfile.pcts[discProfile.secondary]}%.\nAdapt your coaching feedback, tone, and language accordingly.`;
  }

  const userMessage = `SCENARIO: ${scenario}

CATEGORY: ${category || 'General'}

REP'S RESPONSE: "${repResponse}"${discContext}

Evaluate this response and provide coaching feedback.`;

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
        max_tokens: 800,
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

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return res.status(200).json(JSON.parse(jsonMatch[0]));
    } else {
      return res.status(200).json({ feedback: text, overall_score: 0 });
    }
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Failed to get AI feedback' });
  }
}
