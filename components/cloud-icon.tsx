// 蜜桃云朵吉祥物喵~ 治愈系的门面担当 (ฅ^•ﻌ•^ฅ)
export function CloudIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDBA9B" />
          <stop offset="100%" stopColor="#F0906E" />
        </linearGradient>
      </defs>

      {/* 主云朵形状 */}
      <path
        d="M25 55 Q25 40 38 40 Q38 28 50 28 Q62 28 62 40 Q75 40 75 55 Q75 70 62 70 L38 70 Q25 70 25 55 Z"
        fill="url(#cloudGradient)"
        className="drop-shadow-lg"
      />

      {/* 可爱的表情 */}
      <circle cx="42" cy="52" r="3" fill="white" opacity="0.95" />
      <circle cx="58" cy="52" r="3" fill="white" opacity="0.95" />
      <path
        d="M 45 60 Q 50 63 55 60"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />

      {/* 羞羞的腮红喵 */}
      <ellipse cx="36" cy="58" rx="3.5" ry="2" fill="#FF8FA3" opacity="0.55" />
      <ellipse cx="64" cy="58" rx="3.5" ry="2" fill="#FF8FA3" opacity="0.55" />

      {/* 装饰小星星 */}
      <circle cx="20" cy="30" r="2" fill="#FCD34D" className="animate-pulse-slow" />
      <circle cx="80" cy="35" r="2" fill="#F9A8D4" className="animate-pulse-slow"
              style={{ animationDelay: '0.5s' }} />
      <circle cx="70" cy="25" r="1.5" fill="#FDBA9B" className="animate-pulse-slow"
              style={{ animationDelay: '1s' }} />
    </svg>
  );
}
