export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export type Tool = (...args: any[]) => string | Promise<string>;
