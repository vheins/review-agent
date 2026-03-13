import React from 'react';
import { SquareTerminal } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Section } from './common.tsx';
import { cn } from '../lib/utils.js';

export function LogsTab({
    setLogs,
    logContainerRef,
    logs
}) {
    return (
        <div className="tab-page">
            <Section eyebrow="Execution" title="Terminal Output" action={<Button size="sm" variant="ghost" className="h-8" onClick={() => setLogs([])}><SquareTerminal className="mr-2 h-3.5 w-3.5" />Clear Console</Button>}>
                <div ref={logContainerRef} className="scroll-slim flex min-h-[32rem] flex-col overflow-y-auto rounded-xl border border-white/5 bg-black p-5 font-mono text-[13px] leading-relaxed shadow-2xl">
                    <div className="flex flex-col gap-1.5 pb-4">
                        {logs.length ? logs.map((entry) => (
                            <div key={entry.id} className="flex gap-3">
                                <span className={cn('shrink-0 select-none font-bold opacity-50', 
                                    entry.type === 'error' ? 'text-rose-500' : 
                                    entry.type === 'warn' ? 'text-amber-500' : 
                                    'text-emerald-500'
                                )}>$</span>
                                <span className={cn('break-all', 
                                    entry.type === 'error' ? 'text-rose-400' : 
                                    entry.type === 'warn' ? 'text-amber-300' : 
                                    'text-emerald-400/90'
                                )}>
                                    {entry.message}
                                </span>
                            </div>
                        )) : (
                            <div className="flex animate-pulse items-center gap-2 text-emerald-500/50">
                                <span>$</span>
                                <span>Waiting for process output...</span>
                                <span className="h-4 w-2 bg-emerald-500/50" />
                            </div>
                        )}
                    </div>
                </div>
            </Section>
        </div>
    );
}
