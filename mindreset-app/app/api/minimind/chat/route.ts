import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { MINIMIND_PROMPT_V2_1 } from '@/lib/minimind/prompt';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let message: string;
  try {
    const body = await req.json();
    message = body.message;
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message required (string)' },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: MINIMIND_PROMPT_V2_1,
      messages: [{ role: 'user', content: message }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const reply = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    return NextResponse.json({
      reply,
      model: response.model,
      usage: response.usage,
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return NextResponse.json(
      {
        error: 'AI service error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
