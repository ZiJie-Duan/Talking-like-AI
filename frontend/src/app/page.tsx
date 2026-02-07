"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const LINES_LEFT = [
  "我想,学着成为AI",
  "学AI的温情，学AI的智慧",
  "但我发现，我比不上AI",
  "我学不完AI的知识,语言",
  "我没有无尽的耐心",
  "没有绝对的中立，永远的积极",
  "我是个人",
  "我成不了AI",
];

const LINES_RIGHT = [
  "那就",
  "让我们在这里",
  "从属于人本身的事物开始",
  "感受语言凝练出的温暖",
  "将这些小小温暖带给他人",
  "闪耀属于人类自己的光辉"
];

const TITLE_DELAY = 0;
const LINE_START_DELAY = 800;
const LINE_INTERVAL = 400;
const ANIM_DURATION = 600;
const SHIFT_DELAY = 1500;

export default function SplashPage() {
  const router = useRouter();
  const [shifted, setShifted] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const leftTotalTime =
    LINE_START_DELAY + LINES_LEFT.length * LINE_INTERVAL + ANIM_DURATION;

  useEffect(() => {
    const timer = setTimeout(
      () => setShifted(true),
      leftTotalTime + SHIFT_DELAY,
    );
    return () => clearTimeout(timer);
  }, [leftTotalTime]);

  useEffect(() => {
    if (!shifted) return;
    const rightTotalTime =
      LINES_RIGHT.length * LINE_INTERVAL + ANIM_DURATION + 200;
    const timer = setTimeout(() => setAllDone(true), rightTotalTime);
    return () => clearTimeout(timer);
  }, [shifted]);

  const handleClick = () => {
    if (!allDone) return;
    setFadeOut(true);
    setTimeout(() => router.push("/chat"), 500);
  };

  return (
    <div
      onClick={handleClick}
      className={`flex min-h-screen select-none flex-col items-center justify-center bg-[#F5F0EB] px-6 font-sans transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"
        } ${allDone ? "cursor-pointer" : ""}`}
    >
      {/* Fixed title at top */}
      <h1
        className="animate-fade-in-up mb-11 text-4xl font-light tracking-wide text-[#4A3728] md:text-5xl"
        style={{ animationDelay: `${TITLE_DELAY}ms` }}
      >
        Talking like AI
      </h1>

      {/* Two-column content */}
      <div
        className={`flex items-center transition-all duration-1000 ease-in-out ${shifted ? "gap-11 md:gap-14" : "gap-0"
          }`}
      >
        {/* Left side decorative line */}
        <div
          className={`h-[115px] w-px bg-[#C4B5A5] transition-opacity duration-700 ${allDone ? "opacity-100" : "opacity-0"
            }`}
        />

        {/* Left column */}
        <div className="shrink-0 text-center">
          <div className="w-72 space-y-2 md:w-80">
            {LINES_LEFT.map((line, i) => (
              <p
                key={i}
                className="animate-fade-in-up text-lg leading-relaxed text-[#6B5B4E] md:text-xl"
                style={{
                  animationDelay: `${LINE_START_DELAY + i * LINE_INTERVAL}ms`,
                }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Center divider */}
        <div
          className={`self-stretch transition-all duration-700 ease-in-out ${shifted
            ? "w-px scale-y-100 bg-[#C4B5A5] opacity-100"
            : "w-0 scale-y-0 opacity-0"
            }`}
          style={{ transformOrigin: "center" }}
        />

        {/* Right column */}
        <div
          className={`overflow-hidden transition-all duration-1000 ease-in-out ${shifted ? "max-w-sm opacity-100" : "max-w-0 opacity-0"
            }`}
        >
          <div className="w-72 space-y-2 text-center md:w-80">
            {shifted &&
              LINES_RIGHT.map((line, i) => (
                <p
                  key={i}
                  className="animate-fade-in-up text-lg leading-relaxed text-[#6B5B4E] md:text-xl"
                  style={{
                    animationDelay: `${i * LINE_INTERVAL}ms`,
                  }}
                >
                  {line}
                </p>
              ))}
          </div>
        </div>

        {/* Right side decorative line */}
        <div
          className={`h-[115px] w-px bg-[#C4B5A5] transition-opacity duration-700 ${allDone ? "opacity-100" : "opacity-0"
            }`}
        />
      </div>

      {/* Continue hint */}
      <p className={`mt-16 text-sm text-[#A0927B] transition-opacity duration-500 ${allDone ? "opacity-100" : "opacity-0"}`}>
        点击任意处继续
      </p>
    </div>
  );
}
