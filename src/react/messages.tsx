import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { en, resolveMessages } from '../core/messages';
import type { VrtMessages, VrtMessagesInput } from '../core/messages';

const MessagesContext = createContext<VrtMessages>(en);

/** Sets the language of every vrt-input component inside it. */
export function VrtMessagesProvider({
  messages,
  children,
}: {
  /** A full catalog such as `nl`, or a partial one; missing texts come from the enclosing provider or English. */
  messages: VrtMessages | VrtMessagesInput;
  children?: ReactNode;
}) {
  const parent = useContext(MessagesContext);
  const value = useMemo(() => resolveMessages(messages, parent), [messages, parent]);
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

/** The catalog in effect: the nearest provider's, with `override` on top. */
export function useVrtMessages(override?: VrtMessages | VrtMessagesInput): VrtMessages {
  const context = useContext(MessagesContext);
  return useMemo(() => (override ? resolveMessages(override, context) : context), [override, context]);
}
