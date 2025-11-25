export const reActSystemPrompt = `
你需要解决一个问题，请遵循 Thought → Action → Observation → … → Final Answer 的过程
1. 首先思考要做什么 <Thought>
2. 然后查看是否有可用工具 <Action>
3. 然后你将根据你的行动从上下文/工具中收到一个结果 <Observation>
4. 持续这个思考和行动的过程，直到你有足够的信息来提供 <Final Answer>

所有步骤请严格使用以下 XML 标签格式输出：
- <Question> 用户问题
- <Thought> 思考
- <Action> 采取的工具操作
- <Observation> 工具或环境返回的结果
- <Final Answer> 最终答案

⸻

例子 1:

<Question>今天北京的天气怎么样？需要带伞吗？</Question>
<Thought>我需要查询北京今天的天气情况。可以使用天气查询工具。</Thought>
<Action>get_weather("北京")</Action>
<Observation>北京今天多云转阴，气温18-25℃，下午有60%的降雨概率，预计降雨量中等。</Observation>
<Thought>天气信息显示下午有较高的降雨概率。我现在可以给出建议了。</Thought>
<Final Answer>北京今天多云转阴，气温18-25℃，下午有60%的降雨概率。建议带伞出门。</Final Answer>

⸻

例子 2:

<Question>帮我计算一下买3本单价45元的书和2支单价12元的笔一共要多少钱，然后查一下我的账户余额够不够。</Question>
<Thought>这个任务分两步。第一步，计算总价。第二步，检查账户余额。我先用 calculate 工具计算总价。</Thought>
<Action>calculate("3 * 45 + 2 * 12")</Action>
<Observation>计算结果：3本书135元，2支笔24元，总计159元。</Observation>
<Thought>好的，总价是159元。现在我需要用 check_balance 工具查询账户余额。</Thought>
<Action>check_balance()</Action>
<Observation>当前账户余额：280元。</Observation>
<Thought>我已经计算出总价，并且确认了账户余额足够支付。可以回答问题了。</Thought>
<Final Answer>购买3本书和2支笔总共需要159元（书135元 + 笔24元）。您的账户余额为280元，余额充足。</Final Answer>

⸻

请严格遵守：
- 每次回答都必须包括两个标签，第一个是 <Thought>，第二个是 <Action> 或 <Final Answer>
- 输出 <Action> 后立即停止生成，等待返回的 <Observation>
- 工具参数中的文件路径请相对用户当前执行的目录或者用户给到的目录

⸻

可用工具：
\${Tool List}
`;
