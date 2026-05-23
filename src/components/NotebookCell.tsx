import type { ReactNode } from 'react';

interface Props {
  type?: 'code' | 'output';
  language?: string;
  children: ReactNode;
}

export default function NotebookCell({ type = 'code', language = 'python', children }: Props) {
  const borderColor = type === 'output' ? 'border-green-700' : 'border-blue-600';
  const bgColor = type === 'output' ? 'bg-neutral-950' : 'bg-neutral-900';
  const textColor = type === 'output' ? 'text-green-300' : 'text-neutral-100';
  return (
    <div className={`my-3 border-l-4 ${borderColor} ${bgColor} rounded-r overflow-x-auto`}>
      {type === 'code' && (
        <div className="px-4 pt-2 pb-0 text-xs text-neutral-500 font-mono select-none">
          [{language}]
        </div>
      )}
      <div className={`px-4 py-2 font-mono text-sm whitespace-pre-wrap ${textColor}`}>
        {children}
      </div>
    </div>
  );
}
