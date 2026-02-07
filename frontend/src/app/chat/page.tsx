"use client";

import { useState, useEffect, useRef } from "react";

// 虚假数据
const MOCK_USER_ISSUE = "今天工作上出了一些问题，感觉很挫败";

const MOCK_STAGE2_CONVERSATION = [
  { role: "user" as const, content: "今天工作上出了一些问题，感觉很挫败" },
  { role: "ai" as const, content: "听起来你今天过得很不容易，工作上的挫折确实会让人感到沮丧" },
  { role: "user" as const, content: "是啊，我准备了很久的方案被否决了" },
  { role: "ai" as const, content: "被否决一定让你觉得很失落，你付出的努力我能感受到" },
  { role: "user" as const, content: "我现在不知道该怎么办" },
  { role: "ai" as const, content: "这种迷茫的感觉很正常，给自己一些时间，慢慢来" },
];

const MOCK_STAGE3_CONVERSATION = [
  { role: "ai" as const, content: "今天工作上出了一些问题，感觉很挫败" },
  { role: "user" as const, content: "听起来你今天过得很不容易，工作上的挫折确实会让人感到沮丧" },
  { role: "ai" as const, content: "是啊，我准备了很久的方案被否决了" },
  { role: "user" as const, content: "被否决一定让你觉得很失落，你付出的努力我能感受到" },
  { role: "ai" as const, content: "我现在不知道该怎么办" },
  { role: "user" as const, content: "这种迷茫的感觉很正常，给自己一些时间，慢慢来" },
];

const MOCK_ANNOTATIONS = [
  "直接重复对方的感受，让对方知道你在倾听",
  "用'听起来'开头，表达同理心，不急于给建议",
  "简单陈述事实，继续表达",
  "确认对方的感受，让对方感到被理解",
  "表达当下的困惑",
  "给予情感上的支持，而不是立即解决问题"
];

type Stage = "input" | "conversation" | "roleSwap" | "review";

export default function ChatPage() {
  const [stage, setStage] = useState<Stage>("input");
  const [userIssue, setUserIssue] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [stage2Messages, setStage2Messages] = useState<Array<{ role: "user" | "ai"; content: string }>>([]);
  const [stage3Messages, setStage3Messages] = useState<Array<{ role: "user" | "ai"; content: string }>>([]);

  // 情绪评分相关状态
  const [isRatingMode, setIsRatingMode] = useState(false);
  const [moodRating, setMoodRating] = useState(50);
  const [hasRated, setHasRated] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  const handleInputSubmit = () => {
    if (userIssue.trim()) {
      // 进入第二阶段，使用虚假数据
      setStage2Messages(MOCK_STAGE2_CONVERSATION);
      setStage("conversation");
    }
  };

  const handleStage2Complete = () => {
    // 进入第三阶段，使用虚假数据
    setStage3Messages(MOCK_STAGE3_CONVERSATION);
    setStage("roleSwap");
  };

  const handleStage3Complete = () => {
    // 进入第四阶段
    setStage("review");
  };

  const handleSendMessage = () => {
    if (currentInput.trim()) {
      // 发送消息后，进入评分模式
      setCurrentInput("");
      setIsRatingMode(true);
      setHasRated(false);
    }
  };

  const handleSaveRating = () => {
    setHasRated(true);
    setIsRatingMode(false);
  };

  // Stage 1: 询问界面
  if (stage === "input") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F0EB] px-6 font-sans">
        <div className="w-full max-w-xl animate-fade-in-up text-center">
          <p className="mb-12 text-xl font-light leading-relaxed text-[#4A3728] md:text-2xl">
            最近有什么不开心的事情吗？
            <br />
            和我说说，让我们开始练习。
          </p>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={userIssue}
              onChange={(e) => setUserIssue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInputSubmit();
              }}
              className="w-full border-b-2 border-[#C4B5A5] bg-transparent px-2 py-3 text-center text-lg text-[#4A3728] outline-none transition-colors focus:border-[#6B5B4E]"
              placeholder=""
            />
          </div>

          <p className="mt-8 text-sm text-[#A0927B]">按下回车继续</p>
        </div>
      </div>
    );
  }

  // Stage 2: AI安慰用户
  if (stage === "conversation") {
    return (
      <div className="flex h-screen flex-col bg-[#F5F0EB] font-sans">
        {/* 对话区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 pb-32 pt-12">
          <div className="mx-auto max-w-2xl space-y-8">
            {stage2Messages.map((msg, i) => (
              <div key={i} className="animate-fade-in-up flex flex-col items-center" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex w-full items-start gap-4">
                  {/* AI头像（圆形） */}
                  {msg.role === "ai" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#C4B5A5]" />
                  )}

                  {/* 消息内容 */}
                  <div className={`flex-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <p className="inline-block text-base leading-relaxed text-[#4A3728] md:text-lg">
                      {msg.content}
                    </p>
                  </div>

                  {/* 用户头像（三角形） */}
                  {msg.role === "user" && (
                    <div className="relative h-8 w-8 shrink-0">
                      <div
                        className="absolute inset-0"
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: "16px solid transparent",
                          borderRight: "16px solid transparent",
                          borderBottom: "32px solid #C4B5A5",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 分割线 - 单数长，双数短 */}
                {i < stage2Messages.length - 1 && (
                  <div className={`mt-8 h-px bg-[#C4B5A5] ${i % 2 === 0 ? "w-24" : "w-16"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/*
          输入区域定义：整个底部的交互区域，包括：
          - 顶部横线边框 (border-t)
          - 背景色区域 (bg-[#F5F0EB])
          - 输入横线/评分滑块
          - 提示文字
          - 右侧按钮

          输入横线定义：用户实际输入文字的 input 元素，带下边框样式 (border-b-2)
        */}
        {/* 输入区域 - 固定在底部 */}
        <div className="relative mb-16 flex min-h-[80px] shrink-0 items-center border-t border-[#C4B5A5] bg-[#F5F0EB] px-6">
          <div className="mx-auto w-full max-w-2xl">
            {isRatingMode ? (
              // 评分模式
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-[#A0927B]">
                  <span>糟糕</span>
                  <span>愉快</span>
                </div>
                <div className="relative">
                  <input
                    ref={sliderRef}
                    type="range"
                    min="0"
                    max="100"
                    value={moodRating}
                    onChange={(e) => setMoodRating(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRating();
                    }}
                    className="w-full cursor-pointer appearance-none bg-transparent"
                    style={{
                      height: "2px",
                      background: `linear-gradient(to right, #C4B5A5 0%, #C4B5A5 100%)`,
                    }}
                  />
                  <style jsx>{`
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: #6B5B4E;
                      cursor: pointer;
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: #6B5B4E;
                      cursor: pointer;
                      border: none;
                    }
                  `}</style>
                </div>
                <p className="text-center text-sm text-[#A0927B]">按下回车保存评分</p>
              </div>
            ) : (
              // 输入模式 - 输入横线在这里
              <div className="relative">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder="输入你的回复..."
                  className={`w-full bg-transparent px-2 py-2 text-[#4A3728] outline-none transition-all ${
                    hasRated ? "border-b-2 border-[#6B5B4E]" : "border-b-2 border-[#C4B5A5] focus:border-[#6B5B4E]"
                  }`}
                  // style={hasRated ? { transform: "translateY(8px)" } : {}}
                />
                <p className="mt-1 text-center text-sm text-[#A0927B]">按下回车发送</p>
              </div>
            )}
          </div>

          {/* 完成对话按钮 - 在输入区域右侧中心 */}
          <button
            onClick={handleStage2Complete}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg bg-[#6B5B4E] px-4 py-2 text-sm text-[#F5F0EB] transition-colors hover:bg-[#4A3728]"
          >
            完成对话
          </button>
        </div>
        {/*
          修改记录：
          - 2025-xx-xx: 将输入区域改为 flex + items-center 布局，使输入横线垂直居中
          - 添加 min-h-[80px] 确保输入区域有足够高度
          - 移除 pb-3 pt-3，改用 flex 居中对齐
        */}
      </div>
    );
  }

  // Stage 3: 角色交换
  if (stage === "roleSwap") {
    return (
      <div className="flex h-screen flex-col bg-[#F5F0EB] font-sans">
        {/* 提示文字 - 固定在顶部 */}
        <div className="animate-fade-in-up shrink-0 border-b border-[#C4B5A5] bg-[#F5F0EB] px-6 py-6 text-center">
          <p className="text-lg text-[#6B5B4E]">现在，换你来安慰我吧</p>
        </div>

        {/* 对话区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 pb-32 pt-12">
          <div className="mx-auto max-w-2xl space-y-8">
            {stage3Messages.map((msg, i) => (
              <div key={i} className="animate-fade-in-up flex flex-col items-center" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex w-full items-start gap-4">
                  {/* AI头像（圆形） */}
                  {msg.role === "ai" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#C4B5A5]" />
                  )}

                  {/* 消息内容 */}
                  <div className={`flex-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <p className="inline-block text-base leading-relaxed text-[#4A3728] md:text-lg">
                      {msg.content}
                    </p>
                  </div>

                  {/* 用户头像（三角形） */}
                  {msg.role === "user" && (
                    <div className="relative h-8 w-8 shrink-0">
                      <div
                        className="absolute inset-0"
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: "16px solid transparent",
                          borderRight: "16px solid transparent",
                          borderBottom: "32px solid #C4B5A5",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 分割线 - 单数长，双数短 */}
                {i < stage3Messages.length - 1 && (
                  <div className={`mt-8 h-px bg-[#C4B5A5] ${i % 2 === 0 ? "w-24" : "w-16"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/*
          输入区域定义：整个底部的交互区域，包括：
          - 顶部横线边框 (border-t)
          - 背景色区域 (bg-[#F5F0EB])
          - 输入横线
          - 提示文字
          - 右侧按钮

          输入横线定义：用户实际输入文字的 input 元素，带下边框样式 (border-b-2)
        */}
        {/* 输入区域 - 固定在底部 */}
        <div className="relative mb-16 flex min-h-[80px] shrink-0 items-center border-t border-[#C4B5A5] bg-[#F5F0EB] px-6">
          <div className="mx-auto w-full max-w-2xl">
            <div className="relative">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && currentInput.trim()) {
                    setCurrentInput("");
                  }
                }}
                placeholder="输入你的安慰..."
                className="w-full border-b-2 border-[#C4B5A5] bg-transparent px-2 py-2 text-[#4A3728] outline-none transition-colors focus:border-[#6B5B4E]"
              />
              <p className="mt-1 text-center text-sm text-[#A0927B]">按下回车发送</p>
            </div>
          </div>

          {/* 查看批注按钮 - 在输入区域右侧中心 */}
          <button
            onClick={handleStage3Complete}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg bg-[#6B5B4E] px-4 py-2 text-sm text-[#F5F0EB] transition-colors hover:bg-[#4A3728]"
          >
            查看批注
          </button>
        </div>
        {/*
          修改记录：
          - 2025-xx-xx: 将输入区域改为 flex + items-center 布局，使输入横线垂直居中
          - 添加 min-h-[80px] 确保输入区域有足够高度
          - 移除 pb-3 pt-3，改用 flex 居中对齐
        */}
      </div>
    );
  }

  // Stage 4: 批注与回顾
  if (stage === "review") {
    return (
      <div className="flex h-screen flex-col bg-[#F5F0EB] font-sans">
        {/* 可滚动的内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-12">
          <div className="mx-auto max-w-2xl">
            <h2 className="animate-fade-in-up mb-12 text-center text-2xl font-light text-[#4A3728] md:text-3xl">
              回顾与批注
            </h2>

            <div className="space-y-10">
              {stage3Messages.map((msg, i) => (
                <div key={i} className="animate-fade-in-up flex flex-col" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex items-start gap-4">
                    {/* AI头像（圆形） */}
                    {msg.role === "ai" && (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-[#C4B5A5]" />
                    )}

                    {/* 消息和批注 */}
                    <div className={`flex-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                      <p className="inline-block text-base leading-relaxed text-[#4A3728] md:text-lg">
                        {msg.content}
                      </p>
                      <p className="mt-2 block text-sm leading-relaxed text-[#A0927B]">
                        {MOCK_ANNOTATIONS[i]}
                      </p>
                    </div>

                    {/* 用户头像（三角形） */}
                    {msg.role === "user" && (
                      <div className="relative h-8 w-8 shrink-0">
                        <div
                          className="absolute inset-0"
                          style={{
                            width: 0,
                            height: 0,
                            borderLeft: "16px solid transparent",
                            borderRight: "16px solid transparent",
                            borderBottom: "32px solid #C4B5A5",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {i < stage3Messages.length - 1 && (
                    <div className={`mx-auto mt-8 h-px bg-[#C4B5A5] ${i % 2 === 0 ? "w-24" : "w-16"}`} />
                  )}
                </div>
              ))}

              <div className="mt-16 pb-8 text-center">
                <button
                  onClick={() => {
                    setStage("input");
                    setUserIssue("");
                    setCurrentInput("");
                    setStage2Messages([]);
                    setStage3Messages([]);
                    setIsRatingMode(false);
                    setHasRated(false);
                    setMoodRating(50);
                  }}
                  className="animate-fade-in-up rounded-lg bg-[#6B5B4E] px-8 py-3 text-[#F5F0EB] transition-colors hover:bg-[#4A3728]"
                >
                  开始新的练习
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
