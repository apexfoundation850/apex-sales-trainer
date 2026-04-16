export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reference, transcript, title } = req.body;

  if (!reference || !transcript) {
    return res.status(400).json({ error: 'Missing reference or transcript' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are a delivery coach for Apex Foundation Specialists sales reps. A rep is practicing a sales script from memory. You have the reference script and what they actually said (transcribed from their voice).

Score their DELIVERY, not their memorization. Focus on whether the key message landed. Be lenient on:
- Filler words ("um", "uh", "like", "you know")
- Minor wording swaps that preserve meaning
- Missing punctuation (it's a speech-to-text transcript)
- Natural speech patterns vs. written phrasing

Three scores (1-10 each):
1. ACCURACY — did they hit the key phrases and the core message?
2. TONE — does it sound natural and conversational, not robotic or recited?
3. COMPLETENESS — did they cover all the main beats of the script, or skip sections?

Respond in this exact JSON format:
{
  "overall_score": <number 0-100>,
  "accuracy": <1-10>,
  "tone": <1-10>,
  "completeness": <1-10>,
  "missing": "<what the rep skipped or glossed over — empty string if they covered everything>",
  "added": "<filler words or unnecessary additions — empty string if clean>",
  "coaching": "<1-2 sentences of encouraging but direct coaching on how to tighten their delivery>"
}`;

  const userMessage = `SCRIPT TITLE: ${title || 'Untitled'}

REFERENCE (what they should have said):
${reference}

TRANSCRIPT (what they actually said):
${transcript}

Score their delivery.`;

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
        max_tokens: 600,
        messages: [{ role: 'user', content: userMessage }],
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
      return res.status(200).json({ coaching: text, overall_score: 0 });
    }
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Failed to score delivery' });
  }
}
