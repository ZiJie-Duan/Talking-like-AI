"use client";

const SAMPLE_MESSAGES = [
  { role: "assistant" as const, content: "你好！我是 AI 助手，有什么可以帮你的吗？" },
  { role: "user" as const, content: "你能做什么？" },
  {
    role: "assistant" as const,
    content: "我可以回答问题、进行对话、帮你写作和翻译等。试着问我任何问题吧！",
  },
];

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Talking like AI
        </h1>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {SAMPLE_MESSAGES.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-2xl gap-3">
          <input
            type="text"
            placeholder="输入消息..."
            className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            发送
          </button>
        </div>
      </footer>
    </div>
  );
}
