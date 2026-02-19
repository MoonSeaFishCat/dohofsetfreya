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
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      
      {/* 主云朵形状 */}
      <path
        d="M25 55 Q25 40 38 40 Q38 28 50 28 Q62 28 62 40 Q75 40 75 55 Q75 70 62 70 L38 70 Q25 70 25 55 Z"
        fill="url(#cloudGradient)"
        className="drop-shadow-lg"
      />
      
      {/* 可爱的表情 */}
      <circle cx="42" cy="52" r="3" fill="white" opacity="0.9" />
      <circle cx="58" cy="52" r="3" fill="white" opacity="0.9" />
      <path
        d="M 45 60 Q 50 63 55 60"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      
      {/* 装饰星星 */}
      <circle cx="20" cy="30" r="2" fill="#93C5FD" className="animate-pulse-slow" />
      <circle cx="80" cy="35" r="2" fill="#93C5FD" className="animate-pulse-slow" 
              style={{ animationDelay: '0.5s' }} />
      <circle cx="70" cy="25" r="1.5" fill="#BFDBFE" className="animate-pulse-slow" 
              style={{ animationDelay: '1s' }} />
    </svg>
  );
}
