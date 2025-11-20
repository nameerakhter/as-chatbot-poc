import { ReactElement } from 'react';
import { useRecoilValue } from 'recoil';
import Markdown from '~/components/Chat/Messages/Content/Markdown';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useMessageContext } from '~/Providers';
import store from '~/store';
import { cn } from '~/utils';
import AIResponse from '../AIResponse';

type TextPartProps = {
  text: string;
  showCursor: boolean;
  isCreatedByUser: boolean;
};

type ContentType =
  | ReactElement<React.ComponentProps<typeof Markdown>>
  | ReactElement<React.ComponentProps<typeof MarkdownLite>>
  | ReactElement;

function TextPart({ text, isCreatedByUser, showCursor }: TextPartProps) {
  const { isSubmitting = false, isLatestMessage = false } = useMessageContext();
  const enableUserMsgMarkdown = useRecoilValue(store.enableUserMsgMarkdown);
  const showCursorState = showCursor && isSubmitting;

  let content: ContentType;
  if (!isCreatedByUser) {
    content = <Markdown content={text} isLatestMessage={isLatestMessage} />;
  } else if (enableUserMsgMarkdown) {
    content = <MarkdownLite content={text} />;
  } else {
    content = <>{text}</>;
  }

  const textContent = (
    <div
      className={cn(
        isSubmitting ? 'submitting' : '',
        showCursorState && !!text.length ? 'result-streaming' : '',
        'markdown prose message-content dark:prose-invert light w-full break-words',
        isCreatedByUser && !enableUserMsgMarkdown && 'whitespace-pre-wrap',
        isCreatedByUser ? 'dark:text-gray-20' : 'dark:text-gray-100',
      )}
    >
      {content}
    </div>
  );

  if (!isCreatedByUser) {
    return <AIResponse isCreatedByUser={false}>{textContent}</AIResponse>;
  }

  return textContent;
}

export default TextPart;
