"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  createSession,
  submitIssue,
  saveMoodRating,
  completeStage3,
  streamStage2Chat,
  streamCompleteStage2,
  streamStage3Chat,
  type SSEEvent,
} from "@/lib/api";

type Stage = "input" | "conversation" | "roleSwap" | "review";

export default function ChatPage() {
  const [stage, setStage] = useState<Stage>("input");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userIssue, setUserIssue] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [stage2Messages, setStage2Messages] = useState<Array<{ role: "user" | "ai"; content: string }>>([]);
  const [stage3Messages, setStage3Messages] = useState<Array<{ role: "user" | "ai"; content: string }>>([]);
  const [annotations, setAnnotations] = useState<Array<{ message_index: number; content: string }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 情绪评分相关状态
  const [showSlider, setShowSlider] = useState(false);
  const [moodRating, setMoodRating] = useState(50);

  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [stage2Messages, stage3Messages, scrollToBottom]);

  // 组件挂载时创建 session
  useEffect(() => {
    createSession()
      .then((s) => setSessionId(s.id))
      .catch((e) => setErrorMsg(`创建会话失败: ${e.message}`));
  }, []);

  // 消除错误提示
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // 通用 SSE 流式消费：通过 rAF 节流渲染，确保逐帧更新
  const consumeStream = useCallback(
    async (
      stream: AsyncGenerator<SSEEvent>,
      onUpdate: (fullText: string) => void,
    ): Promise<string> => {
      let full = "";
      let rafId: number | null = null;

      const scheduleFlush = () => {
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            onUpdate(full);
          });
        }
      };

      for await (const evt of stream) {
        if (evt.event === "token") {
          full += (evt.data as { content: string }).content;
          scheduleFlush();
        } else if (evt.event === "error") {
          if (rafId !== null) cancelAnimationFrame(rafId);
          throw new Error((evt.data as { detail: string }).detail);
        }
      }

      // 确保最终状态完整刷新
      if (rafId !== null) cancelAnimationFrame(rafId);
      onUpdate(full);

      return full;
    },
    [],
  );

  // 更新消息列表中最后一条消息的 content（用于流式渲染）
  const updateLastMessage = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Array<{ role: "user" | "ai"; content: string }>>>) =>
      (fullText: string) => {
        setter((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullText };
          return copy;
        });
      },
    [],
  );

  // --- Stage 1: 提交问题 ---
  const handleInputSubmit = useCallback(async () => {
    if (!userIssue.trim() || !sessionId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await submitIssue(sessionId, userIssue.trim());
      // 同时添加用户消息和 AI 占位消息，流式更新 AI 消息内容
      setStage2Messages([
        { role: "user", content: userIssue.trim() },
        { role: "ai", content: "" },
      ]);
      setStage("conversation");

      await consumeStream(
        streamStage2Chat(sessionId, userIssue.trim()),
        updateLastMessage(setStage2Messages),
      );
      setShowSlider(true);
    } catch (e: unknown) {
      // 出错时清理空的 AI 占位消息
      setStage2Messages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "ai" && !last.content ? prev.slice(0, -1) : prev;
      });
      setErrorMsg(`提交失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [userIssue, sessionId, consumeStream, updateLastMessage]);

  // --- Stage 2: 发送消息（同时自动提交当前心情评分） ---
  const handleSendMessage = useCallback(async () => {
    if (!currentInput.trim() || !sessionId || isLoading) return;
    const text = currentInput.trim();
    setCurrentInput("");
    setIsLoading(true);
    setErrorMsg(null);
    setShowSlider(false);

    // 自动提交当前心情评分
    try {
      await saveMoodRating(sessionId, moodRating);
    } catch (e: unknown) {
      setErrorMsg(`保存评分失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 同时添加用户消息和 AI 占位消息
    setStage2Messages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "ai", content: "" },
    ]);
    try {
      await consumeStream(
        streamStage2Chat(sessionId, text),
        updateLastMessage(setStage2Messages),
      );
      setShowSlider(true);
    } catch (e: unknown) {
      setStage2Messages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "ai" && !last.content ? prev.slice(0, -1) : prev;
      });
      setErrorMsg(`发送失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentInput, sessionId, isLoading, moodRating, consumeStream, updateLastMessage]);

  // --- Stage 2 → 3: 完成对话 ---
  const handleStage2Complete = useCallback(async () => {
    if (!sessionId || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    setShowSlider(false);

    // 先提交当前评分
    await saveMoodRating(sessionId, moodRating).catch(() => {});

    try {
      // 立即切换到角色交换阶段，AI 消息在新视图中流式渲染
      setStage3Messages([{ role: "ai", content: "" }]);
      setStage("roleSwap");

      await consumeStream(
        streamCompleteStage2(sessionId),
        updateLastMessage(setStage3Messages),
      );
    } catch (e: unknown) {
      setErrorMsg(`完成对话失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading, moodRating, consumeStream, updateLastMessage]);

  // --- Stage 3: 发送安慰消息 ---
  const handleStage3SendMessage = useCallback(async () => {
    if (!currentInput.trim() || !sessionId || isLoading) return;
    const text = currentInput.trim();
    setCurrentInput("");
    setIsLoading(true);
    setErrorMsg(null);

    setStage3Messages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "ai", content: "" },
    ]);
    try {
      await consumeStream(
        streamStage3Chat(sessionId, text),
        updateLastMessage(setStage3Messages),
      );
    } catch (e: unknown) {
      setStage3Messages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "ai" && !last.content ? prev.slice(0, -1) : prev;
      });
      setErrorMsg(`发送失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentInput, sessionId, isLoading, consumeStream, updateLastMessage]);

  // --- Stage 3 → 4: 查看批注 ---
  const handleStage3Complete = useCallback(async () => {
    if (!sessionId || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const session = await completeStage3(sessionId);
      setAnnotations(session.annotations);
      setStage("review");
    } catch (e: unknown) {
      setErrorMsg(`获取批注失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading]);

  // --- 重新开始 ---
  const handleRestart = useCallback(async () => {
    setErrorMsg(null);
    try {
      const s = await createSession();
      setSessionId(s.id);
      setStage("input");
      setUserIssue("");
      setCurrentInput("");
      setStage2Messages([]);
      setStage3Messages([]);
      setAnnotations([]);
      setShowSlider(false);
      setMoodRating(50);
    } catch (e: unknown) {
      setErrorMsg(`创建会话失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // 错误提示组件
  const errorBanner = errorMsg && (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-red-100 px-6 py-3 text-sm text-red-700 shadow-md">
      {errorMsg}
    </div>
  );

  // Stage 1: 询问界面
  if (stage === "input") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F0EB] px-6 font-sans">
        {errorBanner}
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
              disabled={isLoading}
              className="w-full border-b-2 border-[#C4B5A5] bg-transparent px-2 py-3 text-center text-lg text-[#4A3728] outline-none transition-colors focus:border-[#6B5B4E] disabled:opacity-50"
              placeholder=""
            />
          </div>

          <p className="mt-8 text-sm text-[#A0927B]">
            {isLoading ? "正在连接..." : "按下回车继续"}
          </p>
        </div>
      </div>
    );
  }

  // Stage 2: AI安慰用户
  if (stage === "conversation") {
    return (
      <div className="flex h-screen flex-col bg-[#F5F0EB] font-sans">
        {errorBanner}
        {/* 对话区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 pb-32 pt-12">
          <div className="mx-auto max-w-2xl space-y-8">
            {stage2Messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col items-center ${msg.role === "user" ? "animate-fade-in-up" : ""}`}
                style={msg.role === "user" ? { animationDelay: `${i * 150}ms` } : undefined}
              >
                <div className="flex w-full items-start gap-4">
                  {msg.role === "ai" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#C4B5A5]" />
                  )}

                  <div className={`flex-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <p className="inline-block text-base leading-relaxed text-[#4A3728] md:text-lg">
                      {msg.content}
                    </p>
                  </div>

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

                {i < stage2Messages.length - 1 && (
                  <div className={`mt-8 h-px bg-[#C4B5A5] ${i % 2 === 0 ? "w-24" : "w-16"}`} />
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 输入区域 - 固定在底部 */}
        <div className="relative mb-16 shrink-0 border-t border-[#C4B5A5] bg-[#F5F0EB] px-6 py-6">
          <div className="mx-auto w-full max-w-2xl space-y-5">
            {/* 文本输入框 —— 始终可见，在上方 */}
            <div className="relative">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                disabled={isLoading}
                placeholder="输入你的回复..."
                className="w-full border-b-2 border-[#C4B5A5] bg-transparent px-2 py-2 text-[#4A3728] outline-none transition-colors focus:border-[#6B5B4E] disabled:opacity-50"
              />
              <p className="mt-2 text-center text-sm text-[#A0927B]">
                {isLoading ? "AI 正在回复..." : "按下回车发送"}
              </p>
            </div>
            {/* 心情评分滑块 —— AI 回复后显示，在下方，宽度为输入框的 2/3 */}
            {showSlider && (
              <div className="mx-auto w-2/3 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#A0927B]">
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
              </div>
            )}
          </div>

          <button
            onClick={handleStage2Complete}
            disabled={isLoading}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg bg-[#6B5B4E] px-4 py-2 text-sm text-[#F5F0EB] transition-colors hover:bg-[#4A3728] disabled:opacity-50"
          >
            完成对话
          </button>
        </div>
      </div>
    );
  }

  // Stage 3: 角色交换
  if (stage === "roleSwap") {
    return (
      <div className="flex h-screen flex-col bg-[#F5F0EB] font-sans">
        {errorBanner}
        {/* 提示文字 - 固定在顶部 */}
        <div className="animate-fade-in-up shrink-0 border-b border-[#C4B5A5] bg-[#F5F0EB] px-6 py-6 text-center">
          <p className="text-lg text-[#6B5B4E]">现在，换你来安慰我吧</p>
        </div>

        {/* 对话区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 pb-32 pt-12">
          <div className="mx-auto max-w-2xl space-y-8">
            {stage3Messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col items-center ${msg.role === "user" ? "animate-fade-in-up" : ""}`}
                style={msg.role === "user" ? { animationDelay: `${i * 150}ms` } : undefined}
              >
                <div className="flex w-full items-start gap-4">
                  {msg.role === "ai" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#C4B5A5]" />
                  )}

                  <div className={`flex-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <p className="inline-block text-base leading-relaxed text-[#4A3728] md:text-lg">
                      {msg.content}
                    </p>
                  </div>

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
                  <div className={`mt-8 h-px bg-[#C4B5A5] ${i % 2 === 0 ? "w-24" : "w-16"}`} />
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 输入区域 - 固定在底部 */}
        <div className="relative mb-16 flex min-h-[80px] shrink-0 items-center border-t border-[#C4B5A5] bg-[#F5F0EB] px-6">
          <div className="mx-auto w-full max-w-2xl">
            <div className="relative">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStage3SendMessage();
                }}
                disabled={isLoading}
                placeholder="输入你的安慰..."
                className="w-full border-b-2 border-[#C4B5A5] bg-transparent px-2 py-2 text-[#4A3728] outline-none transition-colors focus:border-[#6B5B4E] disabled:opacity-50"
              />
              <p className="mt-1 text-center text-sm text-[#A0927B]">
                {isLoading ? "AI 正在回复..." : "按下回车发送"}
              </p>
            </div>
          </div>

          <button
            onClick={handleStage3Complete}
            disabled={isLoading}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg bg-[#6B5B4E] px-4 py-2 text-sm text-[#F5F0EB] transition-colors hover:bg-[#4A3728] disabled:opacity-50"
          >
            查看批注
          </button>
        </div>
      </div>
    );
  }

  // Stage 4: 批注与回顾
  if (stage === "review") {
    return (
      <div className="flex h-screen flex-col bg-[#F5F0EB] font-sans">
        {errorBanner}
        {/* 可滚动的内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-12">
          <div className="mx-auto max-w-2xl">
            <h2 className="animate-fade-in-up mb-12 text-center text-2xl font-light text-[#4A3728] md:text-3xl">
              回顾与批注
            </h2>

            <div className="space-y-10">
              {stage3Messages.map((msg, i) => {
                const annotation = annotations.find((a) => a.message_index === i);
                return (
                  <div key={i} className="animate-fade-in-up flex flex-col" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-start gap-4">
                      {msg.role === "ai" && (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-[#C4B5A5]" />
                      )}

                      <div className={`flex-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                        <p className="inline-block text-base leading-relaxed text-[#4A3728] md:text-lg">
                          {msg.content}
                        </p>
                        {annotation && msg.role === "user" && (
                          <p className="mt-2 block text-sm leading-relaxed text-[#A0927B]">
                            {annotation.content}
                          </p>
                        )}
                      </div>

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
                );
              })}

              <div className="mt-16 pb-8 text-center">
                <button
                  onClick={handleRestart}
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
