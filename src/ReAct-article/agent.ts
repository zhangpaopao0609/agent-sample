import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { reActSystemPrompt } from './system-prompt-article';
import { Tool, Message } from './types';

export class ReActAgent {
    private tools: Map<string, Tool>;
    private model: string;
    private client: OpenAI;
    private projectDirectory: string;

    constructor(tools: Tool[], model: string, projectDirectory: string) {
        this.tools = new Map(tools.map(func => [func.name, func]));
        this.model = model;
        this.projectDirectory = projectDirectory;
        
        this.client = new OpenAI({
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: ReActAgent.getApiKey(),
        });
    }

    async run(userInput: string): Promise<string> {
        const messages: Message[] = [
            { role: 'system', content: this.renderSystemPrompt(reActSystemPrompt) },
            { role: 'user', content: `<Question>${userInput}</Question>` }
        ];

        while (true) {
            // 请求模型
            const content = await this.callModel(messages);

            // 检测 Thought
            const thoughtMatch = content.match(/<Thought>(.*?)<\/Thought>/s);
            if (thoughtMatch) {
                const thought = thoughtMatch[1];
                console.log(`\n\n💭 Thought: ${thought}`);
            }

            // 检测模型是否输出 Final Answer，如果是的话，直接返回
            if (content.includes('<Final Answer>')) {
                const finalAnswerMatch = content.match(/<Final Answer>(.*?)<\/Final Answer>/s);
                if (finalAnswerMatch) {
                    return finalAnswerMatch[1];
                }
            }

            // 检测 Action
            const actionMatch = content.match(/<Action>(.*?)<\/Action>/s);
            if (!actionMatch) {
                throw new Error('模型未输出 <Action>');
            }
            const action = actionMatch[1];
            const [toolName, args] = this.parseAction(action);

            console.log(`\n\n🔧 Action: ${toolName}(${args.join(', ')})`);


            try {
                const tool = this.tools.get(toolName);
                if (!tool) {
                    throw new Error(`工具 ${toolName} 不存在`);
                }
                const observation = await tool(...args);
                console.log(`\n\n🔍 Observation：${observation}`);
                const obsMsg = `<Observation>${observation}</Observation>`;
                messages.push({ role: 'user', content: obsMsg });
            } catch (e) {
                const observation = `工具执行错误：${(e as Error).message}`;
                console.log(`\n\n🔍 Observation：${observation}`);
                messages.push({ role: 'user', content: `<Observation>${observation}</Observation>` });
            }
        }
    }

    private getToolList(): string {
        const toolDescriptions: string[] = [];
        for (const [name, func] of this.tools.entries()) {
            const signature = this.getFunctionSignature(func);
            const doc = this.getFunctionDoc(func);
            toolDescriptions.push(`- ${name}${signature}: ${doc}`);
        }
        return toolDescriptions.join('\n');
    }

    private getFunctionSignature(func: Tool): string {
        // TypeScript 中无法直接获取函数签名，这里简化处理
        const funcStr = func.toString();
        const match = funcStr.match(/\((.*?)\)/);
        return match ? `(${match[1]})` : '()';
    }

    private getFunctionDoc(func: Tool): string {
        // 从函数的注释中提取文档
        const funcStr = func.toString();
        const commentMatch = funcStr.match(/\/\*\*(.*?)\*\//s);
        if (commentMatch) {
            return commentMatch[1].replace(/\n\s*\*/g, '').trim();
        }
        return '';
    }

    private renderSystemPrompt(systemPromptTemplate: string): string {
        const toolList = this.getToolList();

        return systemPromptTemplate
            .replace('${operating_system}', this.getOperatingSystemName())
            .replace('${operating_directory}', this.projectDirectory)
            .replace('${tool_list}', toolList)
    }

    private static getApiKey(): string {
        dotenv.config();
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('未找到 OPENROUTER_API_KEY 环境变量，请在 .env 文件中设置。');
        }
        return apiKey;
    }

    private async callModel(messages: Message[]): Promise<string> {
        console.log('\n\n正在请求模型，请稍等...');
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages,
        });
        console.log('\n\n模型请求完成。');
        const content = response.choices[0].message.content || '';
        messages.push({ role: 'assistant', content });
        return content;
    }

    private parseAction(codeStr: string): [string, any[]] {
        const match = codeStr.match(/(\w+)\((.*)\)/s);
        if (!match) {
            throw new Error('Invalid function call syntax');
        }

        const funcName = match[1];
        const argsStr = match[2].trim();

        // 手动解析参数，特别处理包含多行内容的字符串
        const args: any[] = [];
        let currentArg = '';
        let inString = false;
        let stringChar: string | null = null;
        let i = 0;
        let parenDepth = 0;

        while (i < argsStr.length) {
            const char = argsStr[i];

            if (!inString) {
                if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    currentArg += char;
                } else if (char === '(') {
                    parenDepth++;
                    currentArg += char;
                } else if (char === ')') {
                    parenDepth--;
                    currentArg += char;
                } else if (char === ',' && parenDepth === 0) {
                    // 遇到顶层逗号，结束当前参数
                    args.push(this.parseSingleArg(currentArg.trim()));
                    currentArg = '';
                } else {
                    currentArg += char;
                }
            } else {
                currentArg += char;
                if (char === stringChar && (i === 0 || argsStr[i - 1] !== '\\')) {
                    inString = false;
                    stringChar = null;
                }
            }

            i++;
        }

        // 添加最后一个参数
        if (currentArg.trim()) {
            args.push(this.parseSingleArg(currentArg.trim()));
        }

        return [funcName, args];
    }

    private parseSingleArg(argStr: string): any {
        argStr = argStr.trim();

        // 如果是字符串字面量
        if ((argStr.startsWith('"') && argStr.endsWith('"')) ||
            (argStr.startsWith("'") && argStr.endsWith("'"))) {
            // 移除外层引号并处理转义字符
            let innerStr = argStr.slice(1, -1);
            innerStr = innerStr
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r')
                .replace(/\\\\/g, '\\');
            return innerStr;
        }

        // 尝试解析其他类型
        try {
            return JSON.parse(argStr);
        } catch {
            // 如果解析失败，返回原始字符串
            return argStr;
        }
    }

    private getOperatingSystemName(): string {
        const osMap: { [key: string]: string } = {
            'darwin': 'macOS',
            'win32': 'Windows',
            'linux': 'Linux'
        };

        return osMap[os.platform()] || 'Unknown';
    }

    private promptUser(question: string): Promise<string> {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer: string) => {
                rl.close();
                resolve(answer);
            });
        });
    }
}

// 工具函数
export function drawImage(desc: string): string {
    const images = [
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference/diagram.svg',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/intersection/diagram.svg',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/symmetricDifference/diagram.svg',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union/diagram.svg',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isDisjointFrom/diagram.svg',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSubsetOf/diagram.svg',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSupersetOf/diagram.svg'
    ]
    const index = Math.floor(Math.random() * images.length);
    return `图片绘制成功，图片 url:${images[index]}`;
}

export function writeToMd(filePath: string, content: string): string {
    /**将指定内容写入指定文件，如果文件不存在则先创建*/
    try {
        // 获取文件所在目录
        const dir = path.dirname(filePath);
        
        // 如果目录不存在，则创建目录（递归创建）
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // 写入文件内容
        fs.writeFileSync(filePath, content.replace(/\\n/g, '\n'), 'utf-8');
        return '写入成功';
    } catch (error) {
        return `写入失败：${(error as Error).message}`;
    }
}

export function checkCanWrite(fileName: string): string {
    /**检查文件是否可以写入，检查output文件夹下是否已存在该文件*/
    // 获取当前运行文件所在目录
    const currentDir = __dirname;
    // 构建output文件夹路径
    const outputDir = path.join(currentDir, 'output');
    // 构建完整的文件路径（确保文件名以.md结尾）
    const mdFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    const filePath = path.join(outputDir, mdFileName);
    
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
        return '文件已存在';
    } else {
        return '文件不存在';
    }
}

// 主函数
async function main() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // 询问项目目录
    rl.question('请输入项目目录路径（直接回车使用当前目录）：', async (dirInput: string) => {
        let projectDirectory: string;
        
        if (dirInput.trim() === '') {
            // 如果用户没有输入，使用当前目录
            projectDirectory = process.cwd();
            console.log(`使用当前目录: ${projectDirectory}`);
        } else {
            // 如果用户输入了路径，检查是否是相对路径
            const inputPath = dirInput.trim();
            
            // 如果是相对路径，基于当前目录解析
            if (!path.isAbsolute(inputPath)) {
                projectDirectory = path.resolve(process.cwd(), inputPath);
            } else {
                projectDirectory = inputPath;
            }
            
            // 检查目录是否存在
            if (!fs.existsSync(projectDirectory)) {
                console.error(`错误：目录不存在: ${projectDirectory}`);
                rl.close();
                process.exit(1);
            }
            
            // 检查是否是目录
            if (!fs.statSync(projectDirectory).isDirectory()) {
                console.error(`错误：${projectDirectory} 不是一个目录`);
                rl.close();
                process.exit(1);
            }
            
            console.log(`使用目录: ${projectDirectory}`);
        }
        const tools = [drawImage, checkCanWrite, writeToMd];
        const agent = new ReActAgent(tools, 'qwen-plus', projectDirectory);

        // 询问任务
        rl.question('\n请输入任务：', async (task: string) => {
            rl.close();
            console.log('\n\n正在执行任务...', task);
            
            const finalAnswer = await agent.run(task);
            console.log(`\n\n✅ Final Answer：${finalAnswer}`);
        });
    });
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}


