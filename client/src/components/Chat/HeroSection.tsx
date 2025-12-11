import React, { useCallback } from 'react';
import { useChatFormContext } from '~/Providers';
import { mainTextareaId } from '~/common';
import { cn } from '~/utils';

const PROMPT_CARDS = [
  {
    id: 1,
    text: 'What documents are required to apply for an Income Certificate?',
  },
  {
    id: 2,
    text: 'What documents are needed to apply for a Caste Certificate online?',
  },
  {
    id: 3,
    text: 'Which documents are required for getting a Domicile Certificate?',
  },
  {
    id: 4,
    text: 'What documents are needed for Birth/Death Certificate correction?',
  },
  {
    id: 5,
    text: 'Which documents are required to apply for a Character Certificate?',
  },
  {
    id: 6,
    text: 'How can I check the status of my certificate application?',
  },
];

const heroSectionTitle = 'How can I help you?';
export default function HeroSection() {
  const methods = useChatFormContext();

  const handleCardClick = useCallback(
    (text: string) => {
      methods.setValue('text', text);
      // Focus the textarea
      setTimeout(() => {
        const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          const length = text.length;
          textarea.setSelectionRange(length, length);
        }
      }, 100);
    },
    [methods],
  );

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-4 py-12 pb-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold text-foreground">{heroSectionTitle}</h1>
      </div>
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROMPT_CARDS.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.text)}
            className={cn(
              'group relative flex h-auto min-h-[80px] w-full items-center justify-center rounded-lg border-2 bg-white p-4 text-left text-sm font-medium text-foreground transition-all hover:shadow-md',
            )}
          >
            <span className="text-center">{card.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
