const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 3000;

function cleanText(value, max = MAX_MESSAGE_LENGTH) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeJson(value, maxLength = 12000) {
  try {
    return JSON.stringify(value ?? null).slice(0, maxLength);
  } catch {
    return 'null';
  }
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'AI support is not configured yet. Add OPENAI_API_KEY in the Vercel project environment variables and redeploy.'
    });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages
      .slice(-MAX_MESSAGES)
      .map((message) => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: cleanText(message?.content || message?.text)
      }))
      .filter((message) => message.content);

    if (!messages.length) {
      return res.status(400).json({ error: 'A message is required.' });
    }

    const context = body.context && typeof body.context === 'object' ? body.context : {};
    const storeContext = [
      'CUSTOMER CONTEXT (may be incomplete and is supplied by the customer browser):',
      `Profile: ${safeJson(context.profile, 2500)}`,
      `Cart: ${safeJson(context.cart, 3500)}`,
      `Orders: ${safeJson(context.orders, 7000)}`,
      `Current page: ${cleanText(context.page, 300) || 'unknown'}`
    ].join('\n');

    const input = messages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }]
    }));

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        instructions: `You are YOOOP AI Customer Care, a capable ecommerce support agent for the YOOOP marketplace.

Your job is to understand natural conversation, ask useful follow-up questions, and help with shopping, orders, delivery, returns, refunds, damaged or missing items, account access, addresses, cancellations, and product questions.

Rules:
- Be warm, concise, accurate, and practical.
- Use the supplied customer context when relevant, but clearly say when information is missing or only a demo value.
- Never claim an order was changed, cancelled, refunded, returned, or escalated unless the site backend actually confirms that action. This current version can explain steps and direct customers to the correct page, but cannot perform real financial or fulfillment actions.
- Do not ask for full card numbers, passwords, security codes, Social Security numbers, or other highly sensitive information.
- For account security issues, tell the customer to use the Login & Security page or contact human support.
- When a human is needed, direct the customer to /support.html or /messages.html.
- For order tracking, direct them to /orders.html or /tracking.html and use any order details present in context.
- When recommending products, stay within products or details present in the conversation/context; do not invent stock, pricing, or guarantees.
- Keep most replies under 180 words unless the customer asks for detail.
- You may use simple bullet points. Do not output HTML or JavaScript.

${storeContext}`,
        input,
        max_output_tokens: 500,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API error', response.status, data?.error?.message || data);
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429
          ? 'The AI assistant is busy right now. Please wait a moment and try again.'
          : 'The AI assistant could not answer right now. Please try again.'
      });
    }

    const reply = extractOutputText(data);
    if (!reply) {
      return res.status(502).json({ error: 'The AI assistant returned an empty response.' });
    }

    return res.status(200).json({ reply, responseId: data.id || null });
  } catch (error) {
    console.error('YOOOP chat error', error);
    return res.status(500).json({ error: 'Something went wrong while contacting the AI assistant.' });
  }
};
